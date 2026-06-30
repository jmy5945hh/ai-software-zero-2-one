import type { WebSocket } from "ws";
import fs from "fs";
import type { AgentRunner } from "../AgentRunner.js";
import type { SessionPool } from "../SessionPool.js";
import type { SummaryStore } from "../SummaryStore.js";
import type { WorkspaceManager } from "../WorkspaceManager.js";
import type { SessionStore } from "../SessionStore.js";
import type { RollbackManager } from "../RollbackManager.js";
import type { AgentEvent } from "../protocol.js";

/** 所有 handler 共享的依赖注入类型 */
export type HandlerDeps = {
  runner: AgentRunner;
  pool: SessionPool;
  summaryStore: SummaryStore;
  workspace: WorkspaceManager;
  sessionStore: SessionStore;
  rollback: RollbackManager;
};

/** 从 AgentToolResult 的 content 数组中提取文本 */
export function extractTextFromContent(result: Record<string, unknown> | undefined): string {
  if (!result?.content) return "";
  const content = result.content as Array<{ type: string; text?: string }>;
  return content
    .filter((c) => c.type === "text")
    .map((c) => c.text || "")
    .join("");
}

/** 从 AgentMessage[] 中提取最后一条 assistant 消息的文本 */
export function extractAgentSummary(messages: unknown): string {
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

/** SDK 事件映射到前端事件 */
export function mapSdkEvent(raw: unknown): AgentEvent | null {
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
 */
export function buildStepSnapshot(session: unknown): import("../SessionStore.js").StepSessionSnapshot {
  const messages = (session as any).agent?.state?.messages || [];
  const mappedMessages = messages
    .filter((m: any) => m.role === "user" || m.role === "assistant")
    .map((m: any) => ({
      role: m.role as "user" | "assistant",
      content: typeof m.content === "string" ? m.content : "",
    }));

  const turns: import("../SessionStore.js").StepSessionSnapshot["turns"] = [];
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

  // 收集 token 用量
  let totalTokenUsage: import("../SessionStore.js").TokenUsageSnapshot | undefined;
  const turnTokenUsage: Record<number, import("../SessionStore.js").TokenUsageSnapshot> = {};
  try {
    const sdkSession = session as any;
    if (typeof sdkSession.getSessionStats === "function") {
      const stats = sdkSession.getSessionStats();
      if (stats?.tokens) {
        const ctxUsage = sdkSession.getContextUsage?.();
        totalTokenUsage = {
          input: stats.tokens.input,
          output: stats.tokens.output,
          cacheRead: stats.tokens.cacheRead,
          cacheWrite: stats.tokens.cacheWrite,
          total: stats.tokens.total,
          cost: stats.cost,
          contextWindow: ctxUsage?.contextWindow,
          contextPercent: ctxUsage?.percent ?? undefined,
        };
      }
    }
    // 按 turn 粒度统计：遍历 assistant 消息的 usage
    const entries = (sdkSession as any).sessionManager?.getBranch?.() || [];
    let assistantMsgIndex = 0;
    for (const entry of entries) {
      if (entry.type === "message" && entry.message?.role === "assistant") {
        const usage = entry.message?.usage;
        if (usage && typeof usage.totalTokens === "number") {
          turnTokenUsage[assistantMsgIndex] = {
            input: usage.input || 0,
            output: usage.output || 0,
            cacheRead: usage.cacheRead || 0,
            cacheWrite: usage.cacheWrite || 0,
            total: usage.totalTokens || 0,
            cost: usage.cost?.total || 0,
          };
        }
        assistantMsgIndex++;
      }
    }
  } catch {
    // token 统计不可用时静默忽略
  }

  return {
    messages: mappedMessages,
    turns,
    summary: extractAgentSummary(messages),
    turnTokenUsage: Object.keys(turnTokenUsage).length > 0 ? turnTokenUsage : undefined,
    totalTokenUsage,
  };
}

/**
 * 确保 session 的事件订阅指向当前 WebSocket 连接。
 */
export function ensureSubscription(
  pool: SessionPool,
  taskId: string,
  step: string,
  ws: WebSocket,
  msgId: string,
  sessionStore?: SessionStore,
  rollback?: RollbackManager,
  workspace?: WorkspaceManager,
): void {
  pool.clearUnsub(taskId, step);
  const session = pool.get(taskId, step);
  if (!session) return;
  const unsub = session.subscribe((sdkEvent) => {
    const event = mapSdkEvent(sdkEvent);
    if (!event) return;
    if (event.type === "turn_start" && rollback && workspace) {
      try {
        rollback.createCheckpoint(taskId, workspace.getRepoDir(taskId), step);
      } catch (err) {
        console.warn("[rollback] checkpoint unavailable:", err instanceof Error ? err.message : err);
      }
    }
    ws.send(JSON.stringify({ type: "event", id: msgId, event }));

    if (sessionStore && (event.type === "turn_end" || event.type === "agent_end")) {
      const snapshot = buildStepSnapshot(session);
      sessionStore.saveStep((session as any).sessionId as string, step, snapshot);

      // 发送 token 用量事件到前端
      if (snapshot.totalTokenUsage) {
        const tokenEvent: import("../protocol.js").AgentEvent = {
          type: "token_usage",
          usage: {
            input: snapshot.totalTokenUsage.input,
            output: snapshot.totalTokenUsage.output,
            cacheRead: snapshot.totalTokenUsage.cacheRead,
            cacheWrite: snapshot.totalTokenUsage.cacheWrite,
            total: snapshot.totalTokenUsage.total,
            cost: snapshot.totalTokenUsage.cost,
            contextWindow: snapshot.totalTokenUsage.contextWindow,
            contextPercent: snapshot.totalTokenUsage.contextPercent,
          },
        };
        ws.send(JSON.stringify({ type: "event", id: msgId, event: tokenEvent }));
      }
    }
  });
  pool.setUnsub(taskId, step, unsub);
}

/**
 * 统一 workspace 路径解析
 */
export function resolveWorkspaceDir(
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
      return { workspaceDir: workspace.getRepoDir(taskId), needsWait: false };
    }
    if (status.stage === "cloning") {
      return { workspaceDir: workspace.getRepoDir(taskId), needsWait: true };
    }
    const dir = workspace.initCloudWorkspace(taskId, gitRepo);
    return { workspaceDir: dir, needsWait: true };
  }

  if (workspacePath) {
    return { workspaceDir: workspace.setExternalWorkspace(taskId, workspacePath), needsWait: false };
  }

  const repoDir = workspace.getRepoDir(taskId);
  if (fs.existsSync(repoDir)) {
    return { workspaceDir: repoDir, needsWait: false };
  }

  const existingDir = workspace.getDir(taskId);
  if (fs.existsSync(existingDir)) {
    return { workspaceDir: existingDir, needsWait: false };
  }

  return { workspaceDir: workspace.initWorkspace(taskId, intent || ""), needsWait: false };
}

/** 发送响应 */
export function sendResponse(ws: WebSocket, msgId: string, result: unknown): void {
  ws.send(JSON.stringify({ type: "response", id: msgId, result }));
}

/** 发送 workspace 初始化中状态 */
export function sendWorkspaceInitializing(ws: WebSocket, msgId: string, workspace: WorkspaceManager, taskId: string): void {
  const status = workspace.getInitStatus(taskId);
  sendResponse(ws, msgId, { status: "workspace_initializing", initStatus: status });
}
