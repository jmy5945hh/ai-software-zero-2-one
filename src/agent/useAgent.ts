import { useState, useEffect, useRef, useCallback } from "react";
import type { AgentEvent, FileNode, SessionState, ConnectionStatus, ToolCallCategory, Turn, ConnectionQuality } from "./types";
import type { FileChange, AgentSummary } from "../data/types";
import { AgentWebSocket } from "./ws";
import { buildAgentWsUrl } from "./config";
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
  /** 记录每个 step 的 steer 输入（ref 方式，不受 React 批处理影响） */
  const steerInputsRef = useRef<Record<string, string[]>>({});
  /** 记录每个 step 的 steer 输入及对应的 turn 索引 */
  const steerInputPairsRef = useRef<Record<string, Array<{ turnIndex: number; text: string }>>>({});
  /** 云端模式 workspace 目录回调 */
  const onWorkspaceDirRef = useRef<((dir: string) => void) | null>(null);
  /** 保存 hook 级别的 gitRepo，避免闭包陈旧 */
  const hookGitRepoRef = useRef(hookGitRepo);
  hookGitRepoRef.current = hookGitRepo;

  // ── 创建 session ──
  const createSession = useCallback(
    async (step: string, intent: string, workspacePath?: string, gitRepo?: { url: string; branch: string }) => {
      if (!taskId || !wsRef.current) return;
      activeStepRef.current = step;
      const params: Record<string, unknown> = {
        taskId,
        step,
        intent,
      };
      if (workspacePath) {
        params.workspacePath = workspacePath;
      }
      // 优先使用调用者传入的 gitRepo，回退到 hook 级别的 gitRepo（通过 ref 避免闭包陈旧）
      const effectiveGitRepo = gitRepo || hookGitRepoRef.current;
      if (effectiveGitRepo?.url) {
        params.gitRepo = effectiveGitRepo;
      }
      const result = (await wsRef.current.request("session.create", params)) as { sessionId: string; workspaceDir?: string };

      // 云端模式：记录 workspace 目录路径（用于后续保存到 session meta）
      if (result.workspaceDir && onWorkspaceDirRef.current) {
        onWorkspaceDirRef.current(result.workspaceDir);
      }

      setSessions((prev) => ({
        ...prev,
        [step]: { ...defaultSession(), id: result.sessionId },
      }));
    },
    [taskId],
  );

  // ── 发送 prompt ──
  const prompt = useCallback(
    async (step: string, text: string) => {
      if (!taskId || !wsRef.current) return;
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

      await wsRef.current.request("session.prompt", { taskId, step, text });
    },
    [taskId],
  );

  // ── 流式修正 ──
  const steer = useCallback(
    (step: string, text: string, intent?: string, workspacePath?: string) => {
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
      wsRef.current.request("session.steer", { taskId, step, text, intent, workspacePath });
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
      await wsRef.current.request("session.continueQuestion", { taskId, step });
    },
    [taskId],
  );

  // ── 从历史恢复后继续问答（重建 session 并发送已存储的回答）──
  const resumeQuestion = useCallback(
    async (step: string, answer: string, intent?: string, workspacePath?: string) => {
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

      await wsRef.current.request("session.resumeQuestion", {
        taskId,
        step,
        answer,
        intent,
        workspacePath,
      });
    },
    [taskId],
  );

  // ── 重试整个 Agent 流程 ──
  const retrySession = useCallback(
    async (step: string, text: string, initialPrompt?: string) => {
      if (!taskId || !wsRef.current) return;
      activeStepRef.current = step;

      // 重置 session 状态（前端立即清理，等待新 session 事件覆盖）
      setSessions((prev) => ({
        ...prev,
        [step]: {
          ...defaultSession(),
          id: prev[step]?.id || "",
          messages: [],
        },
      }));

      // 清除该 step 的总结标记，允许重新触发总结
      summarizingRef.current.delete(step);

      await wsRef.current.request("session.retry", { taskId, step, text, initialPrompt });
    },
    [taskId],
  );

  // ── 获取文件树 ──
  const getFileTree = useCallback(async () => {
    if (!taskId || !wsRef.current) return;
    const result = (await wsRef.current.request("workspace.tree", {
      taskId,
    })) as { tree: FileNode[] };
    setFileTree(result.tree);
  }, [taskId]);

  // ── 读取文件 ──
  const readFile = useCallback(
    async (filePath: string): Promise<string> => {
      if (!taskId || !wsRef.current) return "";
      const result = (await wsRef.current.request("workspace.readFile", {
        taskId,
        filePath,
      })) as { content: string };
      return result.content;
    },
    [taskId],
  );

  // ── 浏览目录 ──
  const browseDir = useCallback(
    async (dirPath: string): Promise<{ name: string; type: "dir" | "file"; path: string }[]> => {
      if (!wsRef.current) return [];
      const result = (await wsRef.current.request("workspace.browse", {
        dirPath,
      })) as { entries: { name: string; type: "dir" | "file"; path: string }[] };
      return result.entries;
    },
    [],
  );

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

    ws.onOpen(() => {
      setConnectionStatus("connected");
      connectionStatusRef.current = "connected";
      setConnectionQuality({ latency: 0, reconnectAttempt: 0 });
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
                // 标记待触发独立总结
                summarizationStatus: "pending" as const,
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
            return {
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

          default:
            return prev;
        }
      });
    });

    return () => {
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
    async (workspacePath: string, command?: string): Promise<{ success: boolean; output: string; command: string }> => {
      if (!command) {
        return { success: false, output: "// 错误：模型未提供编译命令", command: "" };
      }
      try {
        const url = `/project-build?path=${encodeURIComponent(workspacePath)}&command=${encodeURIComponent(command)}`;
        console.log("[triggerBuild] url:", url);
        const res = await fetch(url);
        return await res.json();
      } catch {
        return { success: false, output: "// 编译请求失败", command: "" };
      }
    },
    [],
  );

  /** 通过模型检测编译命令 */
  const detectBuildCommand = useCallback(
    async (workspacePath: string): Promise<string> => {
      if (!wsRef.current) return "";
      try {
        const result = await wsRef.current.request("build.detectCommand", { workspacePath }) as { command: string };
        return result.command?.trim() || "";
      } catch {
        return "";
      }
    },
    [],
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
          triggerBuild(workspacePath || "", session.buildCommand)
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
            return triggerBuild(workspacePath || "", command);
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
    prompt,
    steer,
    answerQuestion,
    continueQuestion,
    resumeQuestion,
    retrySession,
    getFileTree,
    readFile,
    browseDir,
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
        const needsSummary = restored.completed === true
          && restored.summarizationStatus !== "done"
          && !!restored.summary;
        return {
          ...prev,
          [step]: {
            ...existing,
            completed: restored.completed ?? existing.completed,
            summary: restored.summary || existing.summary,
            messages: restored.messages || existing.messages,
            turns: restored.turns || existing.turns,
            summarizationResult: restored.summarizationResult ?? existing.summarizationResult,
            summarizationStatus: needsSummary ? "pending" : (restored.summarizationStatus as any) || existing.summarizationStatus,
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
  } as const;
}
