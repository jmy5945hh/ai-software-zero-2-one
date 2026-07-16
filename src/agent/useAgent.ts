import { useState, useEffect, useRef, useCallback } from "react";
import type { AgentEvent, FileNode, SessionState, ConnectionStatus, ToolCallCategory, Turn, ConnectionQuality, SessionSnapshot, WorkspaceInitStatus } from "./types";
import type { FileChange, AgentSummary } from "../data/types";
import { AgentWebSocket } from "./ws";
import { agentFetch, buildAgentWsUrl, getBaseUrl } from "./config";
import type { RuntimeMode } from "../types/runtime";

// ── 工具函数 ─────────────────────────────────

/** 根据工具名称推断调用类别 */
function categorizeToolCall(name: string): ToolCallCategory {
  const lower = name.toLowerCase();
  if (lower.startsWith("mcp") || lower.includes("mcp")) return "mcp";
  if (lower.includes("skill") || lower === "use_skill") return "skill";
  if (lower === "subagent" || lower === "fork" || lower.includes("subagent")) return "subagent";
  if (lower === "read" || lower === "write" || lower === "edit" || lower === "bash" ||
      lower === "web_search" || lower === "web_fetch" || lower === "todo" ||
      lower === "recall" || lower === "grep" || lower === "glob" || lower === "ls") return "tool";
  return "unknown";
}

/** 从 diff 文本中提取 +N -M 统计 */
function extractDiffStats(text: string): { additions: number; deletions: number } {
  if (!text) return { additions: 0, deletions: 0 };
  let adds = 0;
  let dels = 0;
  for (const line of text.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) adds++;
    if (line.startsWith("-") && !line.startsWith("---")) dels++;
  }
  return { additions: adds, deletions: dels };
}

/** 从 session 的所有 turns 中提取文件变更列表（create / modify / delete），含行数统计和 diff 内容 */
export function extractFileChanges(turns: Turn[]): FileChange[] {
  const seen = new Set<string>();
  const changes: FileChange[] = [];

  for (const turn of turns) {
    for (const tc of turn.toolCalls || []) {
      if (tc.status === "error") continue;

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(tc.input);
      } catch {
        continue;
      }

      if (tc.name === "write" && typeof parsed.path === "string") {
        if (!seen.has(parsed.path)) {
          seen.add(parsed.path);
          const content = typeof parsed.content === "string" ? parsed.content : "";
          const lines = content ? content.split("\n").length : 0;
          changes.push({
            path: parsed.path,
            action: "create",
            additions: lines,
            deletions: 0,
            diffContent: content || undefined,
          });
        }
      } else if (tc.name === "edit" && typeof parsed.path === "string") {
        if (!seen.has(parsed.path)) {
          seen.add(parsed.path);
          const output = tc.result || (tc.outputFragments || []).join("");
          const stats = extractDiffStats(output);
          changes.push({
            path: parsed.path,
            action: "modify",
            additions: stats.additions,
            deletions: stats.deletions,
            diffContent: output || undefined,
          });
        }
      } else if (tc.name === "bash") {
        const cmd = typeof parsed.command === "string" ? parsed.command.trim() : "";
        const rmMatch = cmd.match(/(?:^|\s)(?:rm|unlink)\s+(?:-rf?\s+)?(["']?)([^\s"']+)\1/);
        const mvMatch = cmd.match(/(?:^|\s)mv\s+(["']?)([^\s"']+)\1\s+(["']?)([^\s"']+)\3/);
        const mkMatch = cmd.match(/(?:^|\s)mkdir\s+(?:-p\s+)?(["']?)([^\s"']+)\1/);

        if (rmMatch) {
          const p = rmMatch[2];
          if (!seen.has(p)) { seen.add(p); changes.push({ path: p, action: "delete" }); }
        }
        if (mvMatch) {
          const src = mvMatch[2];
          if (!seen.has(src)) { seen.add(src); changes.push({ path: src, action: "delete" }); }
          const dst = mvMatch[4];
          if (!seen.has(dst)) { seen.add(dst); changes.push({ path: dst, action: "create" }); }
        }
        if (mkMatch) {
          const p = mkMatch[2];
          if (!seen.has(p)) { seen.add(p); changes.push({ path: p, action: "create" }); }
        }
      }
    }
  }

  return changes;
}

/**
 * 鲁棒 JSON 提取器。
 * 能处理：markdown 代码块包裹（```json / ```markdown / ```）、
 * 前后中文说明文本、BOM / 零宽字符、JSON 尾部逗号容错。
 * 多层 fallback 策略。
 */
function robustExtractJson(raw: string): string {
  let text = raw.trim();

  // Step 0: 移除 BOM 和常见零宽字符
  text = text.replace(/^[\uFEFF\u200B-\u200D\u2060]+/, "");

  // Step 1: 移除 markdown 代码块包裹 ```json / ```markdown / ```
  // 匹配开头的 ```xxx 和结尾的 ```
  const fenceMatch = text.match(/^```(?:json|markdown)?\s*\n?([\s\S]*?)\n?```$/);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  } else {
    // Step 2: 如果不在完整的代码块中，尝试提取 { ... } 部分
    const braceStart = text.indexOf("{");
    const braceEnd = text.lastIndexOf("}");
    if (braceStart !== -1 && braceEnd > braceStart) {
      text = text.slice(braceStart, braceEnd + 1);
    }
  }

  // Step 3: 容错移除尾部多余的逗号（JSON 最后一组逗号）
  // 匹配 ,} ,] ,\s+} ,\s+]
  text = text.replace(/,(\s*[}\]])/g, "$1");

  // Step 4: 再次 trim
  text = text.trim();

  // 验证是否以 { 开头以 } 结尾
  if (text.startsWith("{") && text.endsWith("}")) {
    return text;
  }

  // 兜底：返回原始内容（后续 JSON.parse 会报错，降级展示即可）
  return raw;
}

/** 从可能包含 markdown 代码块的内容中提取纯 JSON */
function extractJsonFromMarkdown(raw: string): string {
  return robustExtractJson(raw);
}

/** 默认 Session 状态工厂 */
function defaultSession(): SessionState {
  return {
    id: "",
    streamingText: "",
    isStreaming: false,
    completed: false,
    summary: "",
    messages: [],
    turns: [],
    isCompacting: false,
    queue: { steering: [], followUp: [] },
    summarizationStatus: "idle",
    buildStatus: "idle",
  };
}

// ── Hook ──────────────────────────────────────

/**
 * useAgent — 前端 Agent 核心 Hook。
 * 管理 WebSocket 连接、多 session 状态、文件树、消息流。
 */
export function useAgent(taskId: string | null, workspacePath?: string, hookGitRepo?: { url: string; branch: string }, mode?: RuntimeMode) {
  const [sessions, setSessions] = useState<Record<string, SessionState>>({});
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>({
    latency: 0,
    reconnectAttempt: 0,
  });

  const wsRef = useRef<AgentWebSocket | null>(null);
  const activeStepRef = useRef<string | null>(null);
  const connectionStatusRef = useRef<ConnectionStatus>("disconnected");
  /** 记录哪些 step 的总结已被触发，确保只触发一次 */
  const summarizingRef = useRef<Set<string>>(new Set());
  /** 当前正在总结的 step（用于分流总结事件到对应 session） */
  const summarizingStepRef = useRef<string | null>(null);
  /** 记录哪些 step 的编译已被触发，确保只触发一次 */
  const buildRef = useRef<Set<string>>(new Set());
  /** 当前正在编译的 step（用于分流编译事件到对应 session） */
  const buildStepRef = useRef<string | null>(null);
  /** 外部注册的轮次完成回调（接收 step 和最新的 sessions 快照） */
  const onSessionCompleteRef = useRef<((step: string, sessions: Record<string, SessionState>) => void) | null>(null);
  /** Workspace 初始化状态（云端模式 git clone 进度） */
  const [workspaceInitStatus, setWorkspaceInitStatus] = useState<WorkspaceInitStatus>({ stage: "idle" });
  /** 记录每个 step 的 steer 输入（ref 方式，不受 React 批处理影响） */
  const steerInputsRef = useRef<Record<string, string[]>>({});
  /** 记录每个 step 的 steer 输入及对应的 turn 索引 */
  const steerInputPairsRef = useRef<Record<string, Array<{ turnIndex: number; text: string }>>>({});
  /** 云端模式 workspace 目录回调 */
  const onWorkspaceDirRef = useRef<((dir: string) => void) | null>(null);
  /** 保存 hook 级别的 gitRepo，避免闭包陈旧 */
  const hookGitRepoRef = useRef(hookGitRepo);
  hookGitRepoRef.current = hookGitRepo;
  /** 保存 hook 级别的 mode，避免闭包陈旧 */
  const hookModeRef = useRef(mode);
  hookModeRef.current = mode;
  /** 记录需要重连恢复的 session（step → sessionId），WebSocket 重连后自动触发 reconnect */
  const pendingReconnectRef = useRef<Record<string, string>>({});
  /** 克隆状态轮询定时器，用于清理 */
  const clonePollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── 初始化任务环境（HTTP 接口） ──
  const initTask = useCallback(
    async (params: {
      taskId?: string;
      intent: string;
      workspacePath: string;
      runtimeMode: "local" | "cloud";
      notes: string;
      todoAnswers: Record<number, string | string[]>;
      initialPrompts: Record<string, string>;
      deliveryConfig?: import("../data/types").DeliveryConfig;
      gitRepo?: { url: string; branch: string };
      localGit?: { branch: string; shouldPull: boolean };
    }) => {
      const effectiveTaskId = params.taskId || taskId;
      if (!effectiveTaskId) return;
      const baseUrl = getBaseUrl(params.runtimeMode);
      try {
        const res = await agentFetch(`${baseUrl}/task/init`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...params, taskId: effectiveTaskId }),
        }, params.runtimeMode);
        if (!res.ok) {
          console.warn("[useAgent] initTask HTTP error:", res.status, await res.text());
        }
      } catch (err) {
        console.warn("[useAgent] initTask failed:", err);
      }
    },
    [taskId],
  );

  // ── 创建 session ──
  const createSession = useCallback(
    async (
      step: string,
      intent: string,
      workspacePath?: string,
      gitRepo?: { url: string; branch: string },
      modelId?: string,
      modelProvider?: string,
    ) => {
      if (!taskId || !wsRef.current) return;
      activeStepRef.current = step;
      const params: Record<string, unknown> = {
        taskId,
        step,
        intent,
      };
      if (modelId && modelId !== "auto") {
        params.modelId = modelId;
      }
      if (modelProvider) {
        params.modelProvider = modelProvider;
      }
      if (workspacePath) {
        params.workspacePath = workspacePath;
      }
      // 优先使用调用者传入的 gitRepo，回退到 hook 级别的 gitRepo（通过 ref 避免闭包陈旧）
      const effectiveGitRepo = gitRepo || hookGitRepoRef.current;
      if (effectiveGitRepo?.url) {
        params.gitRepo = effectiveGitRepo;
      }
      const result = (await wsRef.current.request("session.create", params)) as {
        sessionId?: string;
        workspaceDir?: string;
        status?: string;
        initStatus?: { stage: string; progress?: string; error?: string };
      };

      // 如果 workspace 正在初始化（git clone 进行中），更新状态并返回
      if (result.status === "workspace_initializing") {
        const initStatus = result.initStatus as WorkspaceInitStatus | undefined;
        setWorkspaceInitStatus(initStatus || { stage: "cloning" });

        // 清除旧轮询定时器（如果存在）
        if (clonePollRef.current) clearInterval(clonePollRef.current);

        // 持续轮询直到克隆完成或失败
        clonePollRef.current = setInterval(async () => {
          if (!wsRef.current?.isConnected()) {
            // WebSocket 已断开，等待重连后 onOpen 恢复轮询
            return;
          }
          try {
            const s = await getWorkspaceInitStatus();
            if (!s || s.stage === "ready" || s.stage === "error") {
              if (clonePollRef.current) {
                clearInterval(clonePollRef.current);
                clonePollRef.current = null;
              }
              if (s?.stage === "ready") {
                // 克隆完成 — 自动重新调用 session.create 创建 session
                const retryResult = await wsRef.current!.request("session.create", params) as {
                  sessionId?: string;
                  workspaceDir?: string;
                };
                if (retryResult.sessionId) {
                  const sessionId = retryResult.sessionId;
                  if (retryResult.workspaceDir && onWorkspaceDirRef.current) {
                    onWorkspaceDirRef.current(retryResult.workspaceDir);
                  }
                  setSessions((prev) => ({
                    ...prev,
                    [step]: { ...defaultSession(), id: sessionId },
                  }));
                  pendingReconnectRef.current[step] = sessionId;
                }
              }
              // 如果是 error，状态已在 getWorkspaceInitStatus 中更新，UI 会显示错误 + 重试按钮
            }
          } catch {
            // 暂时错误不停止轮询，等待 WebSocket 恢复
          }
        }, 2000);

        return;
      }

      // 云端模式：记录 workspace 目录路径（用于后续保存到 session meta）
      if (result.workspaceDir && onWorkspaceDirRef.current) {
        onWorkspaceDirRef.current(result.workspaceDir);
      }

      if (!result.sessionId) {
        console.warn("[useAgent] createSession: no sessionId returned");
        return;
      }
      const sessionId = result.sessionId;

      setSessions((prev) => ({
        ...prev,
        [step]: { ...defaultSession(), id: sessionId },
      }));

      // 记录 sessionId，用于 WebSocket 重连后自动恢复
      pendingReconnectRef.current[step] = sessionId;
    },
    [taskId],
  );

  // ── 发送 prompt ──
  const prompt = useCallback(
    async (step: string, text: string) => {
      console.log("[useAgent] prompt() called", { step, text: text.slice(0, 50), taskId, hasWs: !!wsRef.current });
      if (!taskId || !wsRef.current) {
        console.warn("[useAgent] prompt() aborted — no taskId or wsRef", { taskId, hasWs: !!wsRef.current });
        return;
      }
      activeStepRef.current = step;

      // 记录到 steerInputPairsRef（与 steer 一致），确保 agent_end 时消息不被丢失
      const inputs = steerInputsRef.current[step] || [];
      const turnIndex = (sessions[step]?.turns?.length || 0);
      inputs.push(text);
      steerInputsRef.current[step] = inputs;
      const inputPairs = steerInputPairsRef.current[step] || [];
      inputPairs.push({ turnIndex, text });
      steerInputPairsRef.current[step] = inputPairs;

      setSessions((prev) => {
        const existing = prev[step] || defaultSession();
        // 在 turns 中插入一条 user 消息（与 steer 一致）
        const userTurn = {
          id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          index: existing.turns.length,
          status: "done" as const,
          textContent: text,
          thinking: "",
          toolCalls: [],
          role: "user" as const,
        };
        return {
          ...prev,
          [step]: {
            ...existing,
            completed: false,
            messages: [
              ...(existing.messages || []),
              { role: "user" as const, content: text },
            ],
            turns: [...existing.turns, userTurn],
          },
        };
      });

      wsRef.current.request("session.steer", { taskId, step, text });
    },
    [taskId],
  );

  // ── 流式修正 ──
  const steer = useCallback(
    (step: string, text: string, intent?: string, workspacePath?: string, gitRepo?: { url: string; branch: string }) => {
      if (!taskId || !wsRef.current) return;
      activeStepRef.current = step;
      // 记录到 ref（不受 React 批处理影响），同时记录当前 turn 数量
      const inputs = steerInputsRef.current[step] || [];
      const turnIndex = (sessions[step]?.turns?.length || 0);
      inputs.push(text);
      steerInputsRef.current[step] = inputs;
      // 记录 (turnIndex, text) 对
      const inputPairs = steerInputPairsRef.current[step] || [];
      inputPairs.push({ turnIndex, text });
      steerInputPairsRef.current[step] = inputPairs;
      setSessions((prev) => {
        const existing = prev[step] || defaultSession();
        // 在 turns 中插入一条 user 消息（在最后一个 turn 之前）
        const userTurn = {
          id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          index: existing.turns.length,
          status: "done" as const,
          textContent: text,
          thinking: "",
          toolCalls: [],
          role: "user" as const,
        };
        const turns = [...existing.turns, userTurn];
        return {
          ...prev,
          [step]: {
            ...existing,
            completed: false,
            messages: [
              ...(existing.messages || []),
              { role: "user" as const, content: text },
            ],
            turns,
          },
        };
      });
      wsRef.current.request("session.steer", { taskId, step, text, intent, workspacePath, gitRepo });
    },
    [taskId],
  );

  // ── 中断当前 session ──
  const abort = useCallback(
    (step: string) => {
      if (!taskId || !wsRef.current) return;
      wsRef.current.request("session.abort", { taskId, step });
      setSessions((prev) => {
        const existing = prev[step];
        if (!existing) return prev;
        return {
          ...prev,
          [step]: {
            ...existing,
            isStreaming: false,
            completed: true,
          },
        };
      });
    },
    [taskId],
  );

  // ── 回答问题 ──
  const answerQuestion = useCallback(
    async (step: string, answer: string) => {
      if (!taskId || !wsRef.current) return;
      activeStepRef.current = step;

      // 记录到 steerInputPairsRef，确保 agent_end 时消息不被丢失
      const inputs = steerInputsRef.current[step] || [];
      const turnIndex = (sessions[step]?.turns?.length || 0);
      inputs.push(answer);
      steerInputsRef.current[step] = inputs;
      const inputPairs = steerInputPairsRef.current[step] || [];
      inputPairs.push({ turnIndex, text: answer });
      steerInputPairsRef.current[step] = inputPairs;

      setSessions((prev) => {
        const existing = prev[step] || defaultSession();
        const userTurn = {
          id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          index: existing.turns.length,
          status: "done" as const,
          textContent: answer,
          thinking: "",
          toolCalls: [],
          role: "user" as const,
        };
        return {
          ...prev,
          [step]: {
            ...existing,
            messages: [
              ...(existing.messages || []),
              { role: "user" as const, content: answer },
            ],
            turns: [...existing.turns, userTurn],
          },
        };
      });

      await wsRef.current.request("session.answerQuestion", { taskId, step, answer });
    },
    [taskId],
  );

  // ── 回答后手动触发继续 ──
  const continueQuestion = useCallback(
    async (step: string) => {
      if (!taskId || !wsRef.current) return;
      activeStepRef.current = step;
      await wsRef.current.request("session.continueQuestion", { taskId, step });
    },
    [taskId],
  );

  // ── 从历史恢复后继续问答（重建 session 并发送已存储的回答）──
  const resumeQuestion = useCallback(
    async (step: string, answer: string, intent?: string, workspacePath?: string, gitRepo?: { url: string; branch: string }) => {
      if (!taskId || !wsRef.current) return;
      activeStepRef.current = step;

      // 重置 session 状态，准备接收新事件
      setSessions((prev) => ({
        ...prev,
        [step]: {
          ...defaultSession(),
          id: prev[step]?.id || "",
        },
      }));

      const effectiveGitRepo = gitRepo || hookGitRepoRef.current;
      const result = await wsRef.current.request("session.resumeQuestion", {
        taskId,
        step,
        answer,
        intent,
        workspacePath,
        gitRepo: effectiveGitRepo,
      }) as { sessionId: string };

      // 记录 sessionId，用于 WebSocket 重连后自动恢复
      if (result?.sessionId) {
        pendingReconnectRef.current[step] = result.sessionId;
        setSessions((prev) => ({
          ...prev,
          [step]: { ...prev[step], id: result.sessionId },
        }));
      }
    },
    [taskId],
  );

  // ── 重连恢复 session ──
  const reconnectSession = useCallback(
    async (step: string, sessionId: string): Promise<boolean> => {
      if (!taskId || !wsRef.current) return false;
      activeStepRef.current = step;
      try {
        const result = (await wsRef.current.request("session.reconnect", {
          sessionId,
        })) as { found: boolean };
        return result.found;
      } catch {
        return false;
      }
    },
    [taskId],
  );

  // ── 从历史恢复 server-side session（创建新 session + 回放历史消息）──
  const restoreServerSession = useCallback(
    async (
      step: string,
      messages: Array<{ role: "user" | "assistant"; content: string }>,
      intent?: string,
      workspacePath?: string,
      gitRepo?: { url: string; branch: string },
    ): Promise<string | undefined> => {
      if (!taskId || !wsRef.current) return undefined;
      activeStepRef.current = step;
      const effectiveGitRepo = gitRepo || hookGitRepoRef.current;
      try {
        const result = (await wsRef.current.request("session.restore", {
          taskId,
          step,
          messages,
          intent,
          workspacePath,
          gitRepo: effectiveGitRepo,
        })) as { sessionId: string };

        // 记录 sessionId，用于 WebSocket 重连后自动恢复
        if (result?.sessionId) {
          pendingReconnectRef.current[step] = result.sessionId;
        }

        return result?.sessionId;
      } catch (err) {
        console.error("[useAgent] restoreServerSession failed:", step, err);
        return undefined;
      }
    },
    [taskId],
  );

  // ── 获取文件树（HTTP 方式） ──
  const getFileTree = useCallback(async () => {
    if (!taskId) return;
    try {
      const baseUrl = getBaseUrl(mode || "local");
      const res = await agentFetch(`${baseUrl}/workspace-tree?taskId=${encodeURIComponent(taskId)}`, {}, mode || "local");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { tree: FileNode[] };
      setFileTree(data.tree);
    } catch (err) {
      console.error("[useAgent] getFileTree failed:", err);
    }
  }, [taskId, mode]);

  // ── 读取文件（HTTP 方式） ──
  const readFile = useCallback(
    async (filePath: string): Promise<string> => {
      if (!taskId) return "";
      try {
        const baseUrl = getBaseUrl(mode || "local");
        const res = await agentFetch(`${baseUrl}/workspace-read-file?taskId=${encodeURIComponent(taskId)}&filePath=${encodeURIComponent(filePath)}`, {}, mode || "local");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { content: string };
        return data.content;
      } catch (err) {
        console.error("[useAgent] readFile failed:", err);
        return "";
      }
    },
    [taskId, mode],
  );

  // ── 浏览目录（HTTP 方式） ──
  const browseDirForMode = useCallback(
    async (dirPath: string, browseMode?: RuntimeMode): Promise<{ name: string; type: "dir" | "file"; path: string }[]> => {
      const effectiveMode = browseMode || mode || "local";
      try {
        const baseUrl = getBaseUrl(effectiveMode);
        const res = await agentFetch(`${baseUrl}/workspace-browse?dirPath=${encodeURIComponent(dirPath)}`, {}, effectiveMode);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { entries: { name: string; type: "dir" | "file"; path: string }[] };
        return data.entries;
      } catch (err) {
        console.error("[useAgent] browseDir failed:", err);
        return [];
      }
    },
    [mode],
  );

  const browseDir = useCallback(
    async (dirPath: string) => browseDirForMode(dirPath),
    [browseDirForMode],
  );

  // ── 列出 Git 分支 ──
  const listGitBranches = useCallback(
    async (dirPath: string): Promise<{ branches: string[]; current: string | null; isRepo: boolean }> => {
      try {
        const baseUrl = getBaseUrl("local");
        const res = await agentFetch(`${baseUrl}/git-branches?dirPath=${encodeURIComponent(dirPath)}`, {}, "local");
        if (!res.ok) {
          const data = await res.json().catch(() => null) as { error?: string } | null;
          throw new Error(data?.error || `Git 检测失败（HTTP ${res.status}）`);
        }
        return await res.json();
      } catch (err) {
        throw err instanceof Error ? err : new Error("Git 检测失败");
      }
    },
    [],
  );

  // ── Git preflight（checkout + pull） ──
  const gitPreflight = useCallback(
    async (dirPath: string, branch: string, shouldPull: boolean): Promise<{ success: boolean; error?: string; output?: string; errorType?: string }> => {
      try {
        const baseUrl = getBaseUrl("local");
        const res = await agentFetch(`${baseUrl}/git-preflight`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dirPath, branch, shouldPull }),
        }, "local");
        return await res.json();
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "Preflight request failed" };
      }
    },
    [],
  );

  // ── 查询 workspace 初始化状态（云端模式 git clone 进度） ──
  const getWorkspaceInitStatus = useCallback(async () => {
    if (!taskId || !wsRef.current) return;
    try {
      const result = await wsRef.current.request("workspace.initStatus", {
        taskId,
      }) as { initStatus: WorkspaceInitStatus };
      setWorkspaceInitStatus(result.initStatus);
      return result.initStatus;
    } catch {
      return undefined;
    }
  }, [taskId]);

  /** 重试云端 workspace 初始化（git clone 失败后） */
  const retryWorkspaceInit = useCallback(async (gitRepo?: { url: string; branch: string }) => {
    if (!taskId || !wsRef.current) return;
    const effectiveGitRepo = gitRepo || hookGitRepoRef.current;
    if (!effectiveGitRepo?.url) return;

    // 清除旧轮询
    if (clonePollRef.current) {
      clearInterval(clonePollRef.current);
      clonePollRef.current = null;
    }

    // UI 立即进入 cloning 状态
    setWorkspaceInitStatus({ stage: "cloning", progress: "正在重试克隆..." });

    try {
      const result = await wsRef.current.request("workspace.retryClone", {
        taskId,
        gitRepo: effectiveGitRepo,
      }) as { repoDir: string; initStatus: WorkspaceInitStatus };

      setWorkspaceInitStatus(result.initStatus);

      // 如果已完成（小仓库秒克隆），直接返回
      if (result.initStatus.stage === "ready" || result.initStatus.stage === "error") {
        return;
      }

      // 否则启动持续轮询
      clonePollRef.current = setInterval(async () => {
        if (!wsRef.current?.isConnected()) return;
        try {
          const s = await getWorkspaceInitStatus();
          if (!s || s.stage === "ready" || s.stage === "error") {
            if (clonePollRef.current) {
              clearInterval(clonePollRef.current);
              clonePollRef.current = null;
            }
          }
        } catch {
          // 暂时错误不停止轮询
        }
      }, 2000);
    } catch (err) {
      setWorkspaceInitStatus({
        stage: "error",
        error: err instanceof Error ? err.message : "重试克隆失败",
        errorType: "unknown",
      });
    }
  }, [taskId, getWorkspaceInitStatus]);

  // ── WebSocket 生命周期 ──
  useEffect(() => {
    if (!taskId) {
      wsRef.current?.close();
      wsRef.current = null;
      setConnectionStatus("disconnected");
      connectionStatusRef.current = "disconnected";
      setConnectionQuality({ latency: 0, reconnectAttempt: 0 });
      return;
    }

    const wsUrl = buildAgentWsUrl(mode || "local");
    const ws = new AgentWebSocket(wsUrl);
    wsRef.current = ws;
    setConnectionStatus("connecting");
    connectionStatusRef.current = "connecting";

    ws.onOpen(async () => {
      setConnectionStatus("connected");
      connectionStatusRef.current = "connected";
      setConnectionQuality({ latency: 0, reconnectAttempt: 0 });

      // WebSocket 重连后，自动恢复之前活跃的 session
      const reconnectMap = pendingReconnectRef.current;
      const entries = Object.entries(reconnectMap);
      if (entries.length > 0) {
        console.log("[useAgent] onOpen — reconnecting %d sessions", entries.length);
        for (const [step, sessionId] of entries) {
          try {
            const result = await ws.request("session.reconnect", { sessionId }) as { found: boolean };
            if (!result.found) {
              console.log("[useAgent] reconnect session not found, removing: step=%s sessionId=%s", step, sessionId);
              delete pendingReconnectRef.current[step];
            }
            // found=true 时，session_snapshot 事件会通过 onEvent 处理
          } catch (err) {
            console.error("[useAgent] reconnect failed for step=%s sessionId=%s", step, sessionId, err);
            delete pendingReconnectRef.current[step];
          }
        }
      }

      // 如果之前 workspace 正在克隆中，重连后恢复轮询
      try {
        const cloneStatus = await (async () => {
          if (!taskId || !wsRef.current) return undefined;
          const r = await wsRef.current.request("workspace.initStatus", { taskId }) as { initStatus: WorkspaceInitStatus };
          return r.initStatus;
        })();
        if (cloneStatus?.stage === "cloning") {
          console.log("[useAgent] onOpen — resuming clone polling");
          setWorkspaceInitStatus(cloneStatus);
          // 清除旧轮询（如果有的话）
          if (clonePollRef.current) clearInterval(clonePollRef.current);
          // 恢复持续轮询
          clonePollRef.current = setInterval(async () => {
            if (!wsRef.current?.isConnected()) return;
            try {
              const s = await getWorkspaceInitStatus();
              if (!s || s.stage === "ready" || s.stage === "error") {
                if (clonePollRef.current) {
                  clearInterval(clonePollRef.current);
                  clonePollRef.current = null;
                }
              }
            } catch {
              // 暂时错误不停止轮询
            }
          }, 2000);
        }
      } catch {
        // 获取克隆状态失败，忽略
      }
    });
    ws.onClose(() => {
      // 只在非 auth 错误时设 disconnected（auth_failed 由 onAuthError 处理）
      if (connectionStatusRef.current !== "auth_failed") {
        setConnectionStatus("disconnected");
        connectionStatusRef.current = "disconnected";
      }
    });

    ws.onAuthError(() => {
      connectionStatusRef.current = "auth_failed";
      setConnectionStatus("auth_failed");
    });

    ws.onReconnecting((attempt: number) => {
      setConnectionStatus("reconnecting");
      connectionStatusRef.current = "reconnecting";
      setConnectionQuality((prev) => ({ ...prev, reconnectAttempt: attempt }));
    });

    ws.onStatusUpdate((quality: ConnectionQuality) => {
      setConnectionQuality(quality);
    });

    ws.onEvent((event: AgentEvent) => {
      // ── session_snapshot 事件：重连恢复状态 ──
      if (event.type === "session_snapshot") {
        const snapshot = event.session;
        console.log("[useAgent] session_snapshot received: step=%s isStreaming=%s messages=%d",
          snapshot.step, snapshot.isStreaming, snapshot.messages.length);

        // 清除该 step 的重连标记
        delete pendingReconnectRef.current[snapshot.step];

        // 用 snapshot 数据恢复 session 状态
        setSessions((prev) => {
          const existing = prev[snapshot.step] || defaultSession();
          const turns = snapshot.turns.map((t, i) => ({
            id: t.id || `turn-${i}`,
            index: t.index,
            status: t.status as "running" | "done",
            textContent: t.textContent,
            thinking: t.thinking || "",
            toolCalls: (t.toolCalls || []).map((tc) => ({
              id: tc.id,
              name: tc.name,
              status: tc.status as "running" | "done" | "error",
              category: tc.category as ToolCallCategory,
              input: tc.input,
              result: tc.result,
              outputFragments: tc.outputFragments || [],
            })),
          }));

          return {
            ...prev,
            [snapshot.step]: {
              ...existing,
              id: snapshot.sessionId,
              isStreaming: snapshot.isStreaming,
              completed: snapshot.completed,
              messages: snapshot.messages,
              turns,
              streamingText: "",
              // 如果有 pending question，标记为等待用户回答
              summarizationStatus: existing.summarizationStatus || "idle",
              buildStatus: existing.buildStatus || "idle",
            },
          };
        });

        // 如果 session 已完成，触发后续流程（总结、编译等）
        if (snapshot.completed) {
          queueMicrotask(() => {
            setSessions((prev) => {
              const s = prev[snapshot.step];
              if (!s) return prev;
              // 只在尚未触发总结时设为 pending，避免覆盖 loading/done/error 状态
              const currentStatus = s.summarizationStatus;
              const shouldTriggerSummary = (currentStatus === "idle" || currentStatus === undefined)
                && snapshot.step !== "quality";
              return {
                ...prev,
                [snapshot.step]: {
                  ...s,
                  summarizationStatus: shouldTriggerSummary ? "pending" : currentStatus,
                  buildStatus: (snapshot.step === "coding" ? "pending" : "idle") as "pending" | "idle",
                },
              };
            });
          });
        }

        return; // session_snapshot 不继续走下面的分流逻辑
      }

      // ── 总结事件分流（独立 session，不影响正常流程）──
      const sumStep = summarizingStepRef.current;
      if (sumStep) {
        setSessions((prev) => {
          const s = prev[sumStep] || defaultSession();

          switch (event.type) {
            case "agent_start":
              return { ...prev, [sumStep]: { ...s, summarizationRaw: "" } };

            case "text_delta":
              return {
                ...prev,
                [sumStep]: {
                  ...s,
                  summarizationRaw: (s.summarizationRaw || "") + event.delta,
                },
              };

            case "agent_end": {
              const raw = extractJsonFromMarkdown(
                (event as { summary: string }).summary || "",
              );
              let result: AgentSummary | undefined;
              try {
                result = JSON.parse(raw);
              } catch {
                result = undefined;
              }

              // 校验 todos 中每个 item 的 type 必须为 "choice" 或 "fill"
              if (result?.todos) {
                const valid = result.todos.every(
                  (t) => t.type === "choice" || t.type === "fill",
                );
                if (!valid) {
                  result = undefined;
                }
              }

              summarizingStepRef.current = null;
              if (!result) {
                // 解析失败或校验不通过 → 重置状态触发重试
                summarizingRef.current.delete(sumStep);
                return {
                  ...prev,
                  [sumStep]: {
                    ...s,
                    summarizationStatus: "pending",
                    summarizationResult: undefined,
                    summarizationRaw: raw,
                  },
                };
              }
              summarizingRef.current.delete(sumStep);
              return {
                ...prev,
                [sumStep]: {
                  ...s,
                  summarizationStatus: "done",
                  summarizationResult: result,
                  summarizationRaw: raw,
                },
              };
            }

            default:
              return prev;
          }
        });
        return;
      }

      // ── 编译事件分流（独立 session，不影响正常流程）──
      const buildStep = buildStepRef.current;
      if (buildStep) {
        setSessions((prev) => {
          const s = prev[buildStep] || defaultSession();

          switch (event.type) {
            case "agent_start":
              return { ...prev, [buildStep]: { ...s, buildRaw: "" } };

            case "text_delta":
              return {
                ...prev,
                [buildStep]: {
                  ...s,
                  buildRaw: (s.buildRaw || "") + event.delta,
                },
              };

            case "agent_end": {
              const raw = extractJsonFromMarkdown(
                (event as { summary: string }).summary || "",
              );
              let result: import("../data/types").BuildResult | undefined;
              try {
                result = JSON.parse(raw);
              } catch {
                result = undefined;
              }

              buildStepRef.current = null;
              if (!result || typeof result.success !== "boolean") {
                // 解析失败 → 重置状态触发重试
                buildRef.current.delete(buildStep);
                return {
                  ...prev,
                  [buildStep]: {
                    ...s,
                    buildStatus: "pending",
                    buildResult: undefined,
                    buildRaw: raw,
                  },
                };
              }
              buildRef.current.delete(buildStep);
              // 用真实编译命令覆盖 LLM 可能篡改的 command 字段
              const realCommand = s.buildCommand;
              return {
                ...prev,
                [buildStep]: {
                  ...s,
                  buildStatus: "done",
                  buildResult: {
                    ...result,
                    command: realCommand || result.command,
                    timestamp: result.timestamp || new Date().toISOString(),
                  },
                  buildRaw: raw,
                },
              };
            }

            default:
              return prev;
          }
        });
        return;
      }

      // ── 正常流程 ──
      const step = activeStepRef.current;
      if (!step) return;

      setSessions((prev) => {
        const s = prev[step] || defaultSession();

        switch (event.type) {
          case "text_delta":
            return {
              ...prev,
              [step]: {
                ...s,
                streamingText: s.streamingText + event.delta,
                turns: s.turns.length > 0
                  ? s.turns.map((t, i) =>
                      i === s.turns.length - 1 && t.status === "running"
                        ? { ...t, textContent: t.textContent + event.delta }
                        : t,
                    )
                  : [{
                      id: `turn-${Date.now()}`,
                      index: 0,
                      status: "running" as const,
                      textContent: event.delta,
                      thinking: "",
                      toolCalls: [],
                    }],
              },
            };

          case "thinking_delta":
            return {
              ...prev,
              [step]: {
                ...s,
                turns: s.turns.length > 0
                  ? s.turns.map((t, i) =>
                      i === s.turns.length - 1 && t.status === "running"
                        ? { ...t, thinking: t.thinking + event.delta }
                        : t,
                    )
                  : [{
                      id: `turn-${Date.now()}`,
                      index: 0,
                      status: "running" as const,
                      textContent: "",
                      thinking: event.delta,
                      toolCalls: [],
                    }],
              },
            };

          case "agent_start":
            return {
              ...prev,
              [step]: { ...s, isStreaming: true, streamingText: "", completed: false },
            };

          case "agent_end": {
            const finalText = s.streamingText;
            const summary = (event as { type: "agent_end"; summary: string }).summary || finalText;
            const updatedTurns = s.turns.map((t, i) =>
              i === s.turns.length - 1 && t.status === "running"
                ? { ...t, status: "done" as const }
                : i === s.turns.length - 1 ? { ...t, status: "done" as const, textContent: finalText } : t,
            );
            const lastTurn = updatedTurns.length > 0 ? updatedTurns[updatedTurns.length - 1] : null;
            if (lastTurn && !lastTurn.textContent && finalText) {
              lastTurn.textContent = finalText;
            }
            console.log("[useAgent] agent_end building newState, step:", step, "s.messages.length:", s.messages?.length, "s.turns.length:", s.turns?.length, "finalText.length:", finalText?.length);
            // 确保 turns 中包含 user 输入条目（可能因 React 批处理丢失）
            const inputPairs = steerInputPairsRef.current[step] || [];
            console.log("[useAgent] agent_end inputPairs:", JSON.stringify(inputPairs), "turns:", updatedTurns.length, "s.messages:", s.messages?.length);
            // 检查 updatedTurns 中是否已有 user 条目
            const existingUserContents = new Set(
              updatedTurns.filter((t: any) => t.role === "user").map((t: any) => t.textContent),
            );
            const sortedPairs = [...inputPairs].sort((a, b) => a.turnIndex - b.turnIndex);
            for (const pair of sortedPairs) {
              if (!existingUserContents.has(pair.text)) {
                // 补充缺失的 user turn
                updatedTurns.push({
                  id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  index: updatedTurns.length,
                  status: "done" as const,
                  textContent: pair.text,
                  thinking: "",
                  toolCalls: [],
                  role: "user" as const,
                });
                existingUserContents.add(pair.text);
              }
            }
            // 重新排序：user turn 按 index 插入到对应位置
            updatedTurns.sort((a: any, b: any) => a.index - b.index);
            // 从 steerInputPairsRef 构建完整的 user 消息列表（按 turnIndex 排序）
            const userMessages = sortedPairs.map((p) => ({ role: "user" as const, content: p.text }));
            // 去重（相邻相同内容只保留一个）
            const dedupedUserMessages: Array<{ role: "user"; content: string }> = [];
            for (const msg of userMessages) {
              const last = dedupedUserMessages[dedupedUserMessages.length - 1];
              if (!last || last.content !== msg.content) {
                dedupedUserMessages.push(msg);
              }
            }
            console.log("[useAgent] agent_end dedupedUserMessages:", dedupedUserMessages.length, "contents:", dedupedUserMessages.map(m => m.content));
            const messages = [
              ...dedupedUserMessages,
              ...(finalText
                ? [{ role: "assistant" as const, content: finalText }]
                : []),
            ];
            const newState = {
              ...prev,
              [step]: {
                ...s,
                isStreaming: false,
                completed: true,
                summary,
                messages,
                streamingText: "",
                turns: updatedTurns,
                // quality 阶段的修复 session 不触发独立总结
                // 只在尚未触发总结时设为 pending，避免覆盖 loading/done/error 状态
                summarizationStatus: (step === "quality" || s.summarizationStatus === "loading" || s.summarizationStatus === "done" || s.summarizationStatus === "error")
                  ? s.summarizationStatus
                  : "pending",
                // coding 步骤标记待触发编译
                buildStatus: (step === "coding" ? "pending" : "idle") as "pending" | "idle",
              },
            };
            // 在 setSessions 完成后通知外部保存
            // 使用 queueMicrotask 确保 state 已更新
            queueMicrotask(() => {
              console.log("[useAgent] agent_end queueMicrotask, step:", step, "has callback:", !!onSessionCompleteRef.current, "turns:", newState[step]?.turns?.length);
              onSessionCompleteRef.current?.(step, newState);
            });
            return newState;
          }

          case "turn_start": {
            const finalizedTurns = s.turns.map((t, i) =>
              i === s.turns.length - 1 && t.status === "running"
                ? { ...t, status: "done" as const }
                : t,
            );
            return {
              ...prev,
              [step]: {
                ...s,
                streamingText: "",
                turns: [
                  ...finalizedTurns,
                  {
                    id: `turn-${Date.now()}`,
                    index: finalizedTurns.length,
                    status: "running" as const,
                    textContent: "",
                    thinking: "",
                    toolCalls: [],
                  },
                ],
              },
            };
          }

          case "turn_end": {
            const turnEndState = {
              ...prev,
              [step]: {
                ...s,
                turns: s.turns.map((t, i) =>
                  i === s.turns.length - 1 && t.status === "running"
                    ? { ...t, status: "done" as const }
                    : t,
                ),
                streamingText: "",
              },
            };
            // 每轮自问自答完成后立即触发保存，保证消息实时性
            queueMicrotask(() => {
              onSessionCompleteRef.current?.(step, turnEndState);
            });
            return turnEndState;
          }

          case "tool_execution_start":
            return {
              ...prev,
              [step]: {
                ...s,
                turns: s.turns.map((t, i) =>
                  i === s.turns.length - 1
                    ? {
                        ...t,
                        toolCalls: [
                          ...(t.toolCalls || []),
                          {
                            id: event.toolCallId,
                            name: event.toolName,
                            status: "running" as const,
                            category: categorizeToolCall(event.toolName),
                            outputFragments: [],
                            input: event.input,
                          },
                        ],
                      }
                    : t,
                ),
              },
            };

          case "tool_execution_update":
            return {
              ...prev,
              [step]: {
                ...s,
                turns: s.turns.map((t) => ({
                  ...t,
                  toolCalls: (t.toolCalls || []).map((tc) =>
                    tc.id === event.toolCallId
                      ? { ...tc, outputFragments: [...(tc.outputFragments || []), event.output] }
                      : tc,
                  ),
                })),
              },
            };

          case "tool_execution_end":
            return {
              ...prev,
              [step]: {
                ...s,
                turns: s.turns.map((t) => ({
                  ...t,
                  toolCalls: (t.toolCalls || []).map((tc) =>
                    tc.id === event.toolCallId
                      ? {
                          ...tc,
                          result: event.result,
                          status: event.isError
                            ? ("error" as const)
                            : ("done" as const),
                        }
                      : tc,
                  ),
                })),
              },
            };

          case "error":
            return {
              ...prev,
              [step]: {
                ...s,
                error: event.message,
                isStreaming: false,
              },
            };

          case "queue_update":
            return {
              ...prev,
              [step]: {
                ...s,
                queue: {
                  steering: event.steering,
                  followUp: event.followUp,
                },
              },
            };

          case "compaction_start":
            return {
              ...prev,
              [step]: { ...s, isCompacting: true },
            };

          case "compaction_end":
            return {
              ...prev,
              [step]: { ...s, isCompacting: false },
            };

          case "token_usage":
            return {
              ...prev,
              [step]: {
                ...s,
                totalTokenUsage: event.usage,
              },
            };

          default:
            return prev;
        }
      });
    });

    return () => {
      if (clonePollRef.current) {
        clearInterval(clonePollRef.current);
        clonePollRef.current = null;
      }
      ws.close();
      wsRef.current = null;
    };
  }, [taskId]);

  // ── 自动触发独立结构化总结 ──
  useEffect(() => {
    if (!wsRef.current || !taskId) return;

    for (const [step, session] of Object.entries(sessions)) {
      if (
        session.summarizationStatus === "pending" &&
        session.summary &&
        !summarizingRef.current.has(step)
      ) {
        summarizingRef.current.add(step);

        // Step 1: 保存 summary 到后端
        wsRef.current
          .request("summarization.save", {
            taskId,
            step,
            summary: session.summary,
          })
          .then(() => {
            // Step 2: 触发独立总结 session
            setSessions((prev) => ({
              ...prev,
              [step]: {
                ...prev[step],
                summarizationStatus: "loading",
              },
            }));

            // 设置分流标记，让后续事件路由到总结分支
            summarizingStepRef.current = step;

            return wsRef.current!.request("summarization.trigger", {
              taskId,
              step,
            });
          })
          .catch(() => {
            summarizingStepRef.current = null;
            summarizingRef.current.delete(step);
            setSessions((prev) => ({
              ...prev,
              [step]: {
                ...prev[step],
                summarizationStatus: "error",
              },
            }));
          });
      }
    }
  }, [sessions, taskId]);

  // ── 项目编译 ──
  const triggerBuild = useCallback(
    async (workspacePath: string, command?: string, mode?: RuntimeMode): Promise<{ success: boolean; output: string; command: string }> => {
      if (!command) {
        return { success: false, output: "// 错误：模型未提供编译命令", command: "" };
      }
      const effectiveMode = mode || hookModeRef.current || "local";
      try {
        // 云端模式使用绝对 URL（绕过 Vite 代理），本地模式使用相对 URL（经过 Vite 代理）
        const baseUrl = effectiveMode === "cloud" ? getBaseUrl("cloud") : "";
        const taskIdParam = taskId ? `&taskId=${encodeURIComponent(taskId)}` : "";
        const url = `${baseUrl}/project-build?path=${encodeURIComponent(workspacePath)}&command=${encodeURIComponent(command)}${taskIdParam}`;
        console.log("[triggerBuild] url:", url);
        const res = await agentFetch(url, {}, effectiveMode);
        return await res.json();
      } catch {
        return { success: false, output: "// 编译请求失败", command: "" };
      }
    },
    [taskId],
  );

  /** 通过模型检测编译命令 */
  const detectBuildCommand = useCallback(
    async (workspacePath: string): Promise<string> => {
      if (!wsRef.current) return "";
      try {
        const result = await wsRef.current.request("build.detectCommand", { workspacePath, taskId }) as { command: string };
        return result.command?.trim() || "";
      } catch {
        return "";
      }
    },
    [taskId],
  );

  // ── 自动触发独立编译 ──
  useEffect(() => {
    if (!wsRef.current || !taskId) return;

    for (const [step, session] of Object.entries(sessions)) {
      if (
        step === "coding" &&
        session.buildStatus === "pending" &&
        !buildRef.current.has(step)
      ) {
        buildRef.current.add(step);

        // 如果已有编译命令（从历史恢复），跳过检测直接执行
        if (session.buildCommand) {
          triggerBuild(workspacePath || "", session.buildCommand, hookModeRef.current)
            .then((buildResult) => {
              setSessions((prev) => ({
                ...prev,
                [step]: {
                  ...prev[step],
                  buildStatus: "loading",
                },
              }));
              buildStepRef.current = step;
              return wsRef.current!.request("build.trigger", {
                taskId,
                step,
                buildResult,
                workspacePath,
                _realCommand: session.buildCommand,
              });
            })
            .catch(() => {
              buildStepRef.current = null;
              buildRef.current.delete(step);
              setSessions((prev) => ({
                ...prev,
                [step]: {
                  ...prev[step],
                  buildStatus: "error",
                },
              }));
            });
          continue;
        }

        // Step 1: 模型检测编译命令
        setSessions((prev) => ({
          ...prev,
          [step]: {
            ...prev[step],
            buildStatus: "detecting",
          },
        }));

        detectBuildCommand(workspacePath || "")
          .then((command) => {
            // 保存模型检测到的编译命令
            setSessions((prev) => ({
              ...prev,
              [step]: {
                ...prev[step],
                buildCommand: command,
              },
            }));

            // Step 2: 执行编译
            return triggerBuild(workspacePath || "", command, hookModeRef.current);
          })
          .then((buildResult) => {
            // Step 3: 触发独立编译 session（让 LLM 分析编译结果）
            setSessions((prev) => ({
              ...prev,
              [step]: {
                ...prev[step],
                buildStatus: "loading",
              },
            }));

            // 设置分流标记，让后续事件路由到编译分支
            buildStepRef.current = step;

            return wsRef.current!.request("build.trigger", {
              taskId,
              step,
              buildResult,
              workspacePath,
            });
          })
          .catch(() => {
            buildStepRef.current = null;
            buildRef.current.delete(step);
            setSessions((prev) => ({
              ...prev,
              [step]: {
                ...prev[step],
                buildStatus: "error",
              },
            }));
          });
      }
    }
  }, [sessions, taskId, triggerBuild, detectBuildCommand]);

  return {
    sessions,
    fileTree,
    connectionStatus,
    connectionQuality,
    createSession,
    initTask,
    prompt,
    steer,
    abort,
    answerQuestion,
    continueQuestion,
    resumeQuestion,
    reconnectSession,
    restoreServerSession,
    getFileTree,
    readFile,
    browseDir,
    browseDirForMode,
    listGitBranches,
    gitPreflight,
    triggerBuild,
    detectBuildCommand,
    /** 更新指定步骤的编译数据（命令 + 结果），用于手动检测/编译后的持久化 */
    updateBuildData: (step: string, command: string, result: import("../data/types").BuildResult) => {
      setSessions((prev) => ({
        ...prev,
        [step]: {
          ...prev[step],
          buildCommand: command,
          buildResult: result,
          buildStatus: "done",
        },
      }));
    },
    /**
     * 从历史恢复的 session 快照初始化 agent session 状态。
     * 如果 agent 已完成但 summary 未完成，将 summarizationStatus 设为 "pending"
     * 以触发自动总结流程。
     */
    restoreSessionState: (step: string, restored: {
      completed?: boolean;
      summarizationStatus?: string;
      summary?: string;
      turns?: Array<any>;
      messages?: Array<any>;
      totalTokenUsage?: {
        input: number;
        output: number;
        cacheRead: number;
        cacheWrite: number;
        total: number;
        cost: number;
        contextWindow?: number;
        contextPercent?: number;
      };
      turnTokenUsage?: Record<number, {
        input: number;
        output: number;
        cacheRead: number;
        cacheWrite: number;
        total: number;
        cost: number;
      }>;
      summarizationResult?: any;
      buildCommand?: string | null;
      buildResult?: any;
      buildStatus?: string;
    }) => {
      // 如果恢复的 session 需要重新触发编译，清除 buildRef 标记
      if (restored.buildStatus === "pending" && !restored.buildCommand) {
        buildRef.current.delete(step);
      }
      setSessions((prev) => {
        const existing = prev[step] || defaultSession();
        // 判断是否需要触发总结：agent 已完成但 summary 未完成
        // 注意：只有持久化状态明确为 "pending" 时才触发（说明上次总结还没开始）
        // "loading" 和 undefined 都不触发，避免刷新后重复调用
        const needsSummary = restored.completed === true
          && restored.summarizationStatus === "pending"
          && !!restored.summary;
        return {
          ...prev,
          [step]: {
            ...existing,
            completed: restored.completed ?? existing.completed,
            summary: restored.summary || existing.summary,
            messages: restored.messages || existing.messages,
            turns: restored.turns || existing.turns,
            totalTokenUsage: restored.totalTokenUsage ?? existing.totalTokenUsage,
            turnTokenUsage: restored.turnTokenUsage ?? existing.turnTokenUsage,
            summarizationResult: restored.summarizationResult ?? existing.summarizationResult,
            summarizationStatus: needsSummary && step !== "quality" ? "pending" : (restored.summarizationStatus as any) || existing.summarizationStatus,
            buildCommand: restored.buildCommand ?? existing.buildCommand,
            buildResult: restored.buildResult ?? existing.buildResult,
            buildStatus: (restored.buildStatus as any) || existing.buildStatus,
          },
        };
      });
    },
    /** 获取底层 WebSocket 实例，用于直接发送请求（如 git 操作） */
    getWs: () => wsRef.current,
    /** 注册轮次完成回调（接收 step 和最新的 sessions 快照） */
    setOnSessionComplete: (cb: ((step: string, sessions: Record<string, SessionState>) => void) | null) => {
      onSessionCompleteRef.current = cb;
    },
    /** 注册 workspace 目录回调（云端模式 session.create 完成后回传实际目录路径） */
    setOnWorkspaceDir: (cb: ((dir: string) => void) | null) => {
      onWorkspaceDirRef.current = cb;
    },
    /** Workspace 初始化状态（云端模式 git clone 进度） */
    workspaceInitStatus,
    /** 主动查询 workspace 初始化状态 */
    getWorkspaceInitStatus,
    /** 重试云端 workspace 初始化（git clone 失败后） */
    retryWorkspaceInit,
  } as const;
}
