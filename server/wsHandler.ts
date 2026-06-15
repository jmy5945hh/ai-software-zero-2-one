import { type WebSocket } from "ws";
import fs from "fs";
import { AgentRunner } from "./AgentRunner";
import { SessionPool } from "./SessionPool";
import { SummaryStore } from "./SummaryStore";
import { WorkspaceManager } from "./WorkspaceManager";
import { SessionStore } from "./SessionStore";
import { resolveQuestion, continueQuestion, rejectQuestion, pendingQuestions } from "./customTools";
import type { WsMessage, AgentEvent, SessionSnapshot } from "./protocol";

// ── 总结 Prompt 构建 ───────────────────────
/** 构造总结 Agent 的 prompt（与前端 buildSummarizationPrompt 一致） */
function buildSummarizationPrompt(summary: string): string {
  return `你是一个任务总结专家。请严格基于下面的 Agent 工作摘要，生成结构化总结。

要求：
1. 忠于原文，不添加原文中没有的内容，不自由发挥
2. 仅输出 JSON，不要有任何额外说明文字

输出 JSON schema：
{
  "brief": "核心总结，不超过200字",
  "key_points": [
    { "title": "要点概要，不超过50字", "summary": "要点内容，不超过200字" }
  ],
  "todos": [
    {
      "task": "需要用户决策或讨论的问题",
      "type": "choice" | "fill",
      "multiSelect": true/false,
      "choices": [{ "option": "选项名", "description": "选项描述" }],
      "placeholder": "填空题占位文本"
    }
  ]
}

注意：
- key_points 数量不限，提取核心要点
- todos 为待决策事项，字段必填，且type字段必填
- 若无待决策问题，则type为choice，且仅包含一个选项:需求已明确，进入下一阶段
- 必须包含type字段，并且仅支持choice 和fill 两种类型
- type=choice 时 choices 必填，type=fill 时 choices 可为空数组、placeholder 必填
- multiSelect 仅 type=choice 时有效，默认 false
- type=choice 时，必须包含一个选项:需求已明确，进入下一阶段
- brief 使用中文

以下是 Agent 工作摘要：
---
${summary}
---`;
}

/** 构建编译分析 prompt */
function buildBuildPrompt(buildResult: {
  command: string;
  success: boolean;
  output: string;
  timestamp: string;
}): string {
  return `你是一个项目编译分析专家。请严格基于下面的编译输出，生成结构化的编译报告。

要求：
1. 忠于原文，不添加原文中没有的内容，不自由发挥
2. 仅输出 JSON，不要有任何额外说明文字（不要加 markdown 代码块）

输出 JSON schema：
{
  "command": "编译命令（必须原样保留，不要修改）",
  "success": true/false,
  "output": "编译输出（完整保留原始输出，不要截断）",
  "timestamp": "编译时间戳",
  "retryCount": 0,
  "building": false,
  "fixing": false
}

注意：
- success 字段必须严格根据编译结果判断
- output 字段必须完整保留原始编译输出，不要做任何修改或截断
- **command 字段必须原样使用下面传入的命令，不要做任何修改**

以下是编译输出：
---
命令: ${buildResult.command}
时间: ${buildResult.timestamp}
状态: ${buildResult.success ? "成功" : "失败"}
输出:
${buildResult.output}
---`;
}

/** 构建编译命令检测 prompt */
function buildDetectCommandPrompt(): string {
  return `请分析当前项目的构建配置文件（如 package.json、Makefile、Cargo.toml、build.gradle、CMakeLists.txt 等），输出正确的编译命令。

要求：
1. 只输出编译命令本身，不要有任何额外说明文字
2. 例如：npm run build、npm run compile、make、go build ./...、cargo build 等
3. 如果找不到任何构建配置，输出 npm run build 作为默认值`;
}

// ── 统一 workspace 路径解析 ──────────────────
/** 根据参数决定 Agent 工作目录（repo 目录），支持 gitRepo / workspacePath / 已初始化 workspace */
function resolveWorkspaceDir(
  workspace: WorkspaceManager,
  taskId: string,
  opts: {
    gitRepo?: { url: string; branch: string };
    workspacePath?: string;
    intent?: string;
  },
): { workspaceDir: string; needsWait: boolean } {
  const { gitRepo, workspacePath, intent } = opts;

  if (gitRepo?.url) {
    const status = workspace.getInitStatus(taskId);
    if (status.stage === "ready") {
      // 已克隆完成，直接使用
      return { workspaceDir: workspace.getRepoDir(taskId), needsWait: false };
    }
    if (status.stage === "cloning") {
      // 正在克隆中，返回 repo 路径但标记需要等待
      return { workspaceDir: workspace.getRepoDir(taskId), needsWait: true };
    }
    // 首次初始化：启动异步克隆
    const dir = workspace.initCloudWorkspace(taskId, gitRepo);
    return { workspaceDir: dir, needsWait: true };
  }

  if (workspacePath) {
    // 本地模式：使用外部目录
    return { workspaceDir: workspace.setExternalWorkspace(taskId, workspacePath), needsWait: false };
  }

  // 检查是否已有云端 workspace 初始化过
  const repoDir = workspace.getRepoDir(taskId);
  if (fs.existsSync(repoDir)) {
    return { workspaceDir: repoDir, needsWait: false };
  }

  // 检查是否已有外部 workspace 映射
  const existingDir = workspace.getDir(taskId);
  if (fs.existsSync(existingDir)) {
    return { workspaceDir: existingDir, needsWait: false };
  }

  // 全新托管模式
  return { workspaceDir: workspace.initWorkspace(taskId, intent || ""), needsWait: false };
}

// ── SDK 事件映射 ────────────────────────────
/** 从 AgentToolResult 的 content 数组中提取文本 */
function extractTextFromContent(result: Record<string, unknown> | undefined): string {
  if (!result?.content) return "";
  const content = result.content as Array<{ type: string; text?: string }>;
  return content
    .filter((c) => c.type === "text")
    .map((c) => c.text || "")
    .join("");
}

/** 从 AgentMessage[] 中提取最后一条 assistant 消息的文本 */
function extractAgentSummary(messages: unknown): string {
  if (!Array.isArray(messages)) return "";
  const lastAssistant = [...messages].reverse().find(
    (m: Record<string, unknown>) => m.role === "assistant",
  ) as Record<string, unknown> | undefined;
  if (!lastAssistant?.content) return "";
  if (typeof lastAssistant.content === "string") {
    return lastAssistant.content;
  }
  if (Array.isArray(lastAssistant.content)) {
    return (lastAssistant.content as Array<{ type: string; text?: string }>)
      .filter((c) => c.type === "text")
      .map((c) => c.text || "")
      .join("");
  }
  return "";
}

function mapSdkEvent(raw: unknown): AgentEvent | null {
  const e = raw as Record<string, unknown>;
  const type = e.type as string | undefined;

  switch (type) {
    case "message_update": {
      const ame = (e.assistantMessageEvent as Record<string, unknown>) || {};
      const ameType = ame.type as string;
      if (ameType === "text_delta") {
        return { type: "text_delta", delta: (ame.delta as string) || "" };
      }
      if (ameType === "thinking_delta") {
        return { type: "thinking_delta", delta: (ame.delta as string) || "" };
      }
      return null;
    }

    case "tool_execution_start":
      return {
        type: "tool_execution_start",
        toolName: (e.toolName as string) || "",
        toolCallId: (e.toolCallId as string) || "",
        input: e.args ? JSON.stringify(e.args) : "{}",
      };

    case "tool_execution_update": {
      const partialResult = e.partialResult as Record<string, unknown> | undefined;
      return {
        type: "tool_execution_update",
        toolCallId: (e.toolCallId as string) || "",
        output: extractTextFromContent(partialResult),
      };
    }

    case "tool_execution_end": {
      const result = e.result as Record<string, unknown> | undefined;
      return {
        type: "tool_execution_end",
        toolCallId: (e.toolCallId as string) || "",
        result: extractTextFromContent(result),
        isError: (e.isError as boolean) || false,
      };
    }

    case "message_start":
    case "message_end":
    case "agent_start":
    case "turn_start":
    case "turn_end":
      return { type };

    case "agent_end":
      return {
        type: "agent_end",
        summary: extractAgentSummary(e.messages),
      };

    case "error":
      return { type: "error", message: (e.message as string) || "Unknown error" };

    case "queue_update":
      return {
        type: "queue_update",
        steering: Array.isArray(e.steering) ? (e.steering as string[]) : [],
        followUp: Array.isArray(e.followUp) ? (e.followUp as string[]) : [],
      };

    case "compaction_start":
    case "compaction_end":
    case "auto_retry_start":
    case "auto_retry_end":
      return null;

    default:
      return null;
  }
}

/**
 * 从 session 中提取 StepSessionSnapshot（用于持久化）。
 * 复用 session.reconnect 中的提取逻辑。
 */
function buildStepSnapshot(session: unknown): import("./SessionStore").StepSessionSnapshot {
  const messages = (session as any).agent?.state?.messages || [];
  const mappedMessages = messages
    .filter((m: any) => m.role === "user" || m.role === "assistant")
    .map((m: any) => ({
      role: m.role as "user" | "assistant",
      content: typeof m.content === "string" ? m.content : "",
    }));

  const turns: import("./SessionStore").StepSessionSnapshot["turns"] = [];
  let turnIndex = 0;
  for (const msg of messages) {
    if (msg.role === "assistant") {
      const content = typeof msg.content === "string" ? msg.content : "";
      turns.push({
        id: `turn-${turnIndex}`,
        index: turnIndex++,
        status: "done",
        textContent: content,
        thinking: "",
        toolCalls: [],
      });
    }
  }

  return {
    messages: mappedMessages,
    turns,
    summary: extractAgentSummary(messages),
  };
}

/**
 * 确保 session 的事件订阅指向当前 WebSocket 连接。
 * WebSocket 重连后，旧的订阅会失效，需要重新注册。
 * 在 turn_end / agent_end 时自动保存步骤快照到 sessionStore。
 */
function ensureSubscription(
  pool: SessionPool,
  taskId: string,
  step: string,
  ws: WebSocket,
  msgId: string,
  sessionStore?: SessionStore,
): void {
  pool.clearUnsub(taskId, step);
  const session = pool.get(taskId, step);
  if (!session) return;
  const unsub = session.subscribe((sdkEvent) => {
    const event = mapSdkEvent(sdkEvent);
    if (!event) return;
    ws.send(JSON.stringify({ type: "event", id: msgId, event }));

    // 每轮 turn 或 agent 结束时，自动保存步骤快照
    if (sessionStore && (event.type === "turn_end" || event.type === "agent_end")) {
      const snapshot = buildStepSnapshot(session);
      sessionStore.saveStep(taskId, (session as any).sessionId as string, step, snapshot);
    }
  });
  pool.setUnsub(taskId, step, unsub);
}

/**
 * 处理 WebSocket 消息。
 * 接收核心组件引用，处理所有 method 分发。
 */
export async function handleWsMessage(
  ws: WebSocket,
  raw: Buffer | string,
  deps: {
    runner: AgentRunner;
    pool: SessionPool;
    summaryStore: SummaryStore;
    workspace: WorkspaceManager;
    sessionStore: SessionStore;
  },
): Promise<void> {
  let msg: WsMessage;
  try {
    msg = JSON.parse(raw.toString());
  } catch {
    return;
  }

  // 记录所有收到的 request（ping 除外）
  if (msg.type === "request") {
    const params = msg.params as Record<string, unknown> || {};
    const textPreview = typeof params.text === "string" ? params.text.slice(0, 30) : "(no text)";
    console.log("[wsHandler] request received: method=%s step=%s text=%.30s", msg.method, params.step || "(no step)", textPreview);
  }

  // ── 心跳 ping/pong ──────────────────
  if (msg.type === "ping") {
    ws.send(JSON.stringify({ type: "pong", ts: msg.ts }));
    return;
  }

  if (msg.type !== "request") return;

  const { runner, pool, summaryStore, workspace, sessionStore } = deps;

  try {
    switch (msg.method as string) {
      // ── Session 管理 ────────────────────
      case "session.create": {
        const { taskId, step } = msg.params as {
          taskId: string;
          step: string;
          intent?: string;
          workspacePath?: string;
          gitRepo?: { url: string; branch: string };
        };
        const intent = (msg.params as { intent?: string }).intent || "";
        const extPath = (msg.params as { workspacePath?: string }).workspacePath;
        const gitRepo = (msg.params as { gitRepo?: { url: string; branch: string } }).gitRepo;
        const { workspaceDir, needsWait } = resolveWorkspaceDir(workspace, taskId, {
          gitRepo,
          workspacePath: extPath,
          intent,
        });

        // 如果 workspace 正在初始化（git clone 进行中），返回状态让前端等待
        if (needsWait) {
          const status = workspace.getInitStatus(taskId);
          ws.send(
            JSON.stringify({
              type: "response",
              id: msg.id,
              result: {
                status: "workspace_initializing",
                initStatus: status,
                workspaceDir,
              },
            }),
          );
          break;
        }

        const session = await runner.createSession(taskId, step, workspaceDir);
        pool.set(taskId, step, session);

        const unsub = session.subscribe((sdkEvent) => {
          const event = mapSdkEvent(sdkEvent);
          if (!event) return;
          ws.send(JSON.stringify({ type: "event", id: msg.id, event }));

          // 每轮 turn 或 agent 结束时，自动保存步骤快照
          if (event.type === "turn_end" || event.type === "agent_end") {
            const snapshot = buildStepSnapshot(session);
            sessionStore.saveStep(taskId, session.sessionId, step, snapshot);
          }
        });
        pool.setUnsub(taskId, step, unsub);

        ws.send(
          JSON.stringify({
            type: "response",
            id: msg.id,
            result: { sessionId: session.sessionId, workspaceDir },
          }),
        );
        break;
      }

      case "session.steer": {
        const { taskId, step, text } = msg.params as {
          taskId: string;
          step: string;
          text: string;
        };
        console.log("[session.steer] userPrompt=%.20s systemPrompt=N/A step=%s", text.slice(0, 20), step);
        let session = pool.get(taskId, step);
        if (!session) {
          const intent = (msg.params as { intent?: string }).intent || "";
          const extPath = (msg.params as { workspacePath?: string }).workspacePath;
          const gitRepo = (msg.params as { gitRepo?: { url: string; branch: string } }).gitRepo;
          const { workspaceDir, needsWait } = resolveWorkspaceDir(workspace, taskId, {
            gitRepo,
            workspacePath: extPath,
            intent,
          });
          if (needsWait) {
            const status = workspace.getInitStatus(taskId);
            ws.send(JSON.stringify({ type: "response", id: msg.id, result: { status: "workspace_initializing", initStatus: status } }));
            break;
          }
          session = await runner.createSession(taskId, step, workspaceDir);
          pool.set(taskId, step, session);
        }

        ensureSubscription(pool, taskId, step, ws, msg.id, sessionStore);

        console.log(`[session.steer] isStreaming=${session.isStreaming} step=${step} text=%.20s`, text.slice(0, 20));
        if (session.isStreaming) {
          session.steer(text);
        } else {
          await session.prompt(text);
        }

        ws.send(JSON.stringify({ type: "response", id: msg.id, result: {} }));
        break;
      }

      case "session.abort": {
        const { taskId, step } = msg.params as { taskId: string; step: string };
        const session = pool.get(taskId, step);
        if (!session) throw new Error(`Session not found: ${taskId}:${step}`);
        session.abort();
        ws.send(JSON.stringify({ type: "response", id: msg.id, result: {} }));
        break;
      }

      case "session.dispose": {
        const { taskId, step } = msg.params as { taskId: string; step: string };
        pool.dispose(taskId, step);
        ws.send(JSON.stringify({ type: "response", id: msg.id, result: {} }));
        break;
      }

      // ── 重连恢复 session 状态 ────────────
      case "session.reconnect": {
        const { sessionId } = msg.params as { sessionId: string };
        console.log("[session.reconnect] sessionId=%s", sessionId);

        const found = pool.findBySessionId(sessionId);
        if (!found) {
          console.log("[session.reconnect] session not found: %s", sessionId);
          ws.send(JSON.stringify({ type: "response", id: msg.id, result: { found: false } }));
          break;
        }

        const { taskId, step, session } = found;

        // 重新绑定事件订阅到当前 WebSocket
        ensureSubscription(pool, taskId, step, ws, msg.id, sessionStore);

        // 从 session 中提取当前消息列表
        const messages = (session as any).agent?.state?.messages || [];
        const mappedMessages = messages
          .filter((m: any) => m.role === "user" || m.role === "assistant")
          .map((m: any) => ({
            role: m.role as "user" | "assistant",
            content: typeof m.content === "string" ? m.content : "",
          }));

        // 检查是否有 pending question
        const pqKey = `${taskId}:${step}`;
        const pq = pendingQuestions.get(pqKey);
        const hasPendingQuestion = !!pq && pq.storedAnswer === null;

        // 构建 turns（从 messages 中提取）
        const turns: SessionSnapshot["turns"] = [];
        let turnIndex = 0;
        for (const msg of messages) {
          if (msg.role === "assistant") {
            const content = typeof msg.content === "string" ? msg.content : "";
            turns.push({
              id: `turn-${turnIndex}`,
              index: turnIndex++,
              status: "done",
              textContent: content,
              thinking: "",
              toolCalls: [],
            });
          }
        }

        const snapshot: SessionSnapshot = {
          sessionId,
          taskId,
          step,
          isStreaming: session.isStreaming,
          completed: !session.isStreaming,
          messages: mappedMessages,
          turns,
          hasPendingQuestion,
          pendingQuestion: hasPendingQuestion && pq
            ? { question: pq.question, options: pq.options }
            : undefined,
        };

        console.log("[session.reconnect] found, isStreaming=%s, messages=%d, hasPendingQuestion=%s",
          snapshot.isStreaming, snapshot.messages.length, snapshot.hasPendingQuestion);

        // 先发 response，再发 snapshot 事件（前端按顺序处理）
        ws.send(JSON.stringify({ type: "response", id: msg.id, result: { found: true } }));
        ws.send(JSON.stringify({ type: "event", id: msg.id, event: { type: "session_snapshot", session: snapshot } }));
        break;
      }

      // ── 从历史恢复 session（创建新 session + 回放历史消息）──
      case "session.restore": {
        const { taskId, step, messages } = msg.params as {
          taskId: string;
          step: string;
          messages?: Array<{ role: "user" | "assistant"; content: string }>;
          intent?: string;
          workspacePath?: string;
        };
        console.log("[session.restore] step=%s messages=%d", step, messages?.length || 0);

        const intent = (msg.params as { intent?: string }).intent || "";
        const extPath = (msg.params as { workspacePath?: string }).workspacePath;
        const gitRepo = (msg.params as { gitRepo?: { url: string; branch: string } }).gitRepo;
        const { workspaceDir, needsWait } = resolveWorkspaceDir(workspace, taskId, {
          gitRepo,
          workspacePath: extPath,
          intent,
        });

        if (needsWait) {
          const status = workspace.getInitStatus(taskId);
          ws.send(JSON.stringify({ type: "response", id: msg.id, result: { status: "workspace_initializing", initStatus: status } }));
          break;
        }

        // 如果已有 session，先销毁
        pool.dispose(taskId, step);

        const session = await runner.createSession(taskId, step, workspaceDir);
        pool.set(taskId, step, session);

        const unsub = session.subscribe((sdkEvent) => {
          const event = mapSdkEvent(sdkEvent);
          if (!event) return;
          ws.send(JSON.stringify({ type: "event", id: msg.id, event }));

          // 每轮 turn 或 agent 结束时，自动保存步骤快照
          if (event.type === "turn_end" || event.type === "agent_end") {
            const snapshot = buildStepSnapshot(session);
            sessionStore.saveStep(taskId, session.sessionId, step, snapshot);
          }
        });
        pool.setUnsub(taskId, step, unsub);

        // 回放历史用户消息（用 steer 入队，不触发模型执行）
        if (messages) {
          for (const m of messages) {
            if (m.role === "user") {
              session.steer(m.content);
            }
          }
        }

        ws.send(
          JSON.stringify({
            type: "response",
            id: msg.id,
            result: { sessionId: session.sessionId },
          }),
        );
        break;
      }

      // ── 用户回答问题 ────────────────────
      case "session.answerQuestion": {
        const { taskId, step, answer } = msg.params as {
          taskId: string;
          step: string;
          answer: string;
        };
        const resolved = resolveQuestion(taskId, step, answer);
        if (!resolved) {
          throw new Error(`No pending question for ${taskId}:${step}`);
        }
        ws.send(JSON.stringify({ type: "response", id: msg.id, result: {} }));
        break;
      }

      case "session.continueQuestion": {
        const { taskId, step } = msg.params as { taskId: string; step: string };
        const continued = continueQuestion(taskId, step);
        if (!continued) {
          throw new Error(`No answered question to continue for ${taskId}:${step}`);
        }
        ws.send(JSON.stringify({ type: "response", id: msg.id, result: {} }));
        break;
      }

      case "session.resumeQuestion": {
        const { taskId, step, answer, intent, workspacePath } = msg.params as {
          taskId: string;
          step: string;
          answer: string;
          intent?: string;
          workspacePath?: string;
        };

        // 清理旧 session 遗留的 pending question（新 session 会通过 resumePrompt 直接获得回答）
        rejectQuestion(taskId, step, new Error("Session resumed, old question superseded"));

        const gitRepo = (msg.params as { gitRepo?: { url: string; branch: string } }).gitRepo;
        const { workspaceDir, needsWait } = resolveWorkspaceDir(workspace, taskId, {
          gitRepo,
          workspacePath,
          intent,
        });

        if (needsWait) {
          const status = workspace.getInitStatus(taskId);
          ws.send(JSON.stringify({ type: "response", id: msg.id, result: { status: "workspace_initializing", initStatus: status } }));
          break;
        }

        const session = await runner.createSession(taskId, step, workspaceDir);
        pool.set(taskId, step, session);

        const unsub = session.subscribe((sdkEvent) => {
          const event = mapSdkEvent(sdkEvent);
          if (!event) return;
          ws.send(JSON.stringify({ type: "event", id: msg.id, event }));

          // 每轮 turn 或 agent 结束时，自动保存步骤快照
          if (event.type === "turn_end" || event.type === "agent_end") {
            const snapshot = buildStepSnapshot(session);
            sessionStore.saveStep(taskId, session.sessionId, step, snapshot);
          }
        });
        pool.setUnsub(taskId, step, unsub);

        ws.send(
          JSON.stringify({
            type: "response",
            id: msg.id,
            result: { sessionId: session.sessionId },
          }),
        );

        const resumePrompt = `用户已回答了你的问题。回答是：${answer}\n\n请基于此回答继续执行任务。`;
        await session.prompt(resumePrompt);
        break;
      }

      // ── 总结独立链路 ──────────────────
      case "summarization.save": {
        const { taskId, step, summary } = msg.params as {
          taskId: string;
          step: string;
          summary: string;
        };
        summaryStore.set(taskId, step, summary);
        ws.send(JSON.stringify({ type: "response", id: msg.id, result: {} }));
        break;
      }

      case "summarization.trigger": {
        const { taskId, step } = msg.params as { taskId: string; step: string };
        const saved = summaryStore.get(taskId, step);
        if (!saved) {
          throw new Error(`No summary saved for ${taskId}:${step}`);
        }
        const workspaceDir = workspace.getRepoDir(taskId);
        const session = await runner.createSummarizationSession(workspaceDir);

        const unsub = session.subscribe((sdkEvent) => {
          const event = mapSdkEvent(sdkEvent);
          if (!event) return;
          ws.send(JSON.stringify({ type: "event", id: msg.id, event }));

          if (event.type === "agent_end") {
            unsub();
            session.dispose();
            summaryStore.delete(taskId, step);
          }
        });

        ws.send(
          JSON.stringify({
            type: "response",
            id: msg.id,
            result: { sessionId: session.sessionId },
          }),
        );

        const promptText = buildSummarizationPrompt(saved);
        console.log("[summarization.trigger] userPrompt=%.20s", promptText.slice(0, 20));
        await session.prompt(promptText);
        break;
      }

      // ── 编译命令检测 ──────────────────
      case "build.detectCommand": {
        const { workspacePath, taskId } = msg.params as { workspacePath: string; taskId?: string };
        // 优先使用 taskId 解析 workspace（云端模式），否则回退到传入的 workspacePath
        const workspaceDir = taskId
          ? workspace.getRepoDir(taskId)
          : (workspacePath || workspace.getRepoDir(taskId));
        const session = await runner.createBuildCommandSession(workspaceDir);

        let fullOutput = "";

        const unsub = session.subscribe((sdkEvent) => {
          const event = mapSdkEvent(sdkEvent);
          if (!event) return;

          if (event.type === "text_delta") {
            fullOutput += event.delta;
          }

          if (event.type === "agent_end") {
            unsub();
            session.dispose();

            const lines = fullOutput
              .split("\n")
              .map((l) => l.trim())
              .filter((l) => l && !l.startsWith("```") && !l.startsWith("`"));
            const rawCommand =
              lines.find(
                (l) =>
                  !/[\u4e00-\u9fff]/.test(l) && !l.includes("：") && !l.includes(":"),
              ) || lines[0] || "npm run build";
            const command = rawCommand.replace(/^`|`$/g, "").trim();
            console.log("[build.detectCommand] fullOutput:", fullOutput);
            console.log("[build.detectCommand] detected command:", command);
            ws.send(
              JSON.stringify({
                type: "response",
                id: msg.id,
                result: { command },
              }),
            );
          }
        });

        const detectPrompt = buildDetectCommandPrompt();
        console.log("[build.detectCommand] sending prompt");
        await session.prompt(detectPrompt);
        break;
      }

      // ── 项目编译 ──────────────────────
      case "build.trigger": {
        const { taskId, step, buildResult } = msg.params as {
          taskId: string;
          step: string;
          buildResult: {
            command: string;
            success: boolean;
            output: string;
            timestamp: string;
          };
        };
        const workspaceDir = workspace.getRepoDir(taskId);
        const session = await runner.createBuildSession(workspaceDir);

        const unsub = session.subscribe((sdkEvent) => {
          const event = mapSdkEvent(sdkEvent);
          if (!event) return;
          ws.send(JSON.stringify({ type: "event", id: msg.id, event }));

          if (event.type === "agent_end") {
            unsub();
            session.dispose();
          }
        });

        ws.send(
          JSON.stringify({
            type: "response",
            id: msg.id,
            result: { sessionId: session.sessionId },
          }),
        );

        const promptText = buildBuildPrompt(buildResult);
        console.log("[build.trigger] userPrompt=%.20s", promptText.slice(0, 20));
        await session.prompt(promptText);
        break;
      }

      case "build.save": {
        const { taskId, sessionId, stepId, buildResult } = msg.params as {
          taskId: string;
          sessionId: string;
          stepId: string;
          buildResult: import("./SessionStore").StepSessionSnapshot["buildResult"];
        };
        const existing = sessionStore.loadStep(sessionId, stepId) || {
          messages: [],
          turns: [],
          summary: "",
        };
        existing.buildResult = buildResult;
        sessionStore.saveStep(taskId, sessionId, stepId, existing);
        ws.send(JSON.stringify({ type: "response", id: msg.id, result: {} }));
        break;
      }

      case "build.fix": {
        const { taskId, step, sessionId, buildOutput, workspacePath } = msg.params as {
          taskId: string;
          step: string;
          sessionId: string;
          buildOutput: string;
          workspacePath?: string;
        };
        const gitRepo = (msg.params as { gitRepo?: { url: string; branch: string } }).gitRepo;
        const intent = (msg.params as { intent?: string }).intent || "";
        const { workspaceDir, needsWait } = resolveWorkspaceDir(workspace, taskId, {
          gitRepo,
          workspacePath,
          intent,
        });

        if (needsWait) {
          const status = workspace.getInitStatus(taskId);
          ws.send(JSON.stringify({ type: "response", id: msg.id, result: { status: "workspace_initializing", initStatus: status } }));
          break;
        }

        const fixSession = await runner.createSession(taskId, step, workspaceDir);

        const unsub = fixSession.subscribe((sdkEvent) => {
          const event = mapSdkEvent(sdkEvent);
          if (!event) return;
          ws.send(JSON.stringify({ type: "event", id: msg.id, event }));

          // 每轮 turn 或 agent 结束时，自动保存步骤快照
          if (event.type === "turn_end" || event.type === "agent_end") {
            const snapshot = buildStepSnapshot(fixSession);
            sessionStore.saveStep(taskId, fixSession.sessionId, step, snapshot);
          }
        });

        ws.send(
          JSON.stringify({
            type: "response",
            id: msg.id,
            result: { sessionId: fixSession.sessionId },
          }),
        );

        const fixPrompt = `项目编译失败，请修复以下编译错误：\n\n\`\`\`\n${buildOutput.slice(0, 5000)}\n\`\`\`\n\n请分析错误原因并修复代码。修复完成后，项目应该能成功编译。`;
        await fixSession.prompt(fixPrompt);
        break;
      }

      // ── Workspace 操作 ──────────────────
      case "workspace.tree": {
        const { taskId } = msg.params as { taskId: string };
        const tree = workspace.getFileTree(taskId);
        ws.send(
          JSON.stringify({ type: "response", id: msg.id, result: { tree } }),
        );
        break;
      }

      case "workspace.readFile": {
        const { taskId, filePath } = msg.params as { taskId: string; filePath: string };
        const content = workspace.readFile(taskId, filePath);
        ws.send(
          JSON.stringify({ type: "response", id: msg.id, result: { content } }),
        );
        break;
      }

      case "workspace.initStatus": {
        const { taskId } = msg.params as { taskId: string };
        const status = workspace.getInitStatus(taskId);
        ws.send(
          JSON.stringify({ type: "response", id: msg.id, result: { initStatus: status } }),
        );
        break;
      }

      case "workspace.retryClone": {
        const { taskId } = msg.params as { taskId: string };
        const gitRepo = (msg.params as { gitRepo?: { url: string; branch: string } }).gitRepo;
        if (!gitRepo?.url) {
          throw new Error("retryClone 需要 gitRepo 参数");
        }
        const repoDir = workspace.retryCloudWorkspace(taskId, gitRepo);
        const initStatus = workspace.getInitStatus(taskId);
        ws.send(
          JSON.stringify({
            type: "response",
            id: msg.id,
            result: { repoDir, initStatus },
          }),
        );
        break;
      }

      case "workspace.browse": {
        const { dirPath } = msg.params as { dirPath: string };
        const entries = workspace.browseDir(dirPath || "/");
        ws.send(
          JSON.stringify({ type: "response", id: msg.id, result: { entries } }),
        );
        break;
      }


      // ── 会话记录 ──────────────────────
      case "session.saveStep": {
        const { taskId, sessionId, stepId, snapshot } = msg.params as { taskId: string; sessionId: string; stepId: string; snapshot: import("./SessionStore").StepSessionSnapshot };
        sessionStore.saveStep(taskId, sessionId, stepId, snapshot);
        ws.send(JSON.stringify({ type: "response", id: msg.id, result: {} }));
        break;
      }

      case "session.saveRecord": {
        const record = msg.params as Record<string, unknown>;
        sessionStore.save(record as import("./SessionStore").SessionRecord);
        ws.send(JSON.stringify({ type: "response", id: msg.id, result: {} }));
        break;
      }

      case "session.loadRecord": {
        const { sessionId } = msg.params as { sessionId: string };
        const record = sessionStore.load(sessionId);
        ws.send(JSON.stringify({ type: "response", id: msg.id, result: { record } }));
        break;
      }

      case "session.listRecords": {
        const records = sessionStore.list();
        ws.send(JSON.stringify({ type: "response", id: msg.id, result: { records } }));
        break;
      }

      case "session.deleteRecord": {
        const { sessionId } = msg.params as { sessionId: string };
        sessionStore.delete(sessionId);
        ws.send(JSON.stringify({ type: "response", id: msg.id, result: {} }));
        break;
      }

      default:
        throw new Error(`Unknown method: ${msg.method}`);
    }
  } catch (err) {
    console.error("[ws] Error:", err);
    ws.send(
      JSON.stringify({
        type: "error",
        id: msg.id,
        error: {
          code: "INTERNAL",
          message: err instanceof Error ? err.message : String(err),
        },
      }),
    );
  }
}
