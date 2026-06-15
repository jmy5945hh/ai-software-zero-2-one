// ── 通信协议类型定义 ──────────────────────

/** 前端 → Agent Server 的请求方法 */
export type AgentMethod =
  | "session.create"
  | "session.prompt"
  | "session.steer"
  | "session.followUp"
  | "session.abort"
  | "session.dispose"
  | "session.answerQuestion"
  | "session.continueQuestion"
  | "session.retry"
  | "session.reconnect"
  | "session.restore"
  | "summarization.save"
  | "summarization.trigger"
  | "workspace.tree"
  | "workspace.readFile"
  | "workspace.browse"
  | "workspace.initStatus"
  | "workspace.retryClone"
  // ── 会话记录 ──
  | "session.saveRecord"
  | "session.loadRecord"
  | "session.listRecords"
  | "session.deleteRecord"
  // ── 按步骤独立存储 ──
  | "session.saveMeta"
  | "session.loadMeta"
  // ── 项目编译 ──
  | "build.detectCommand"
  | "build.save"
  | "build.fix"
  | "build.trigger";

/** 所有 WebSocket 消息统一格式 */
export type WsMessage =
  | { type: "request"; id: string; method: AgentMethod; params: Record<string, unknown> }
  | { type: "event"; id: string; event: AgentEvent }
  | { type: "response"; id: string; result: unknown }
  | { type: "error"; id: string; error: { code: string; message: string } }
  | { type: "ping"; ts: number }
  | { type: "pong"; ts: number };

/** Agent 事件（与 SDK AgentSessionEvent 对齐） */
export type AgentEvent =
  | { type: "text_delta"; delta: string }
  | { type: "thinking_delta"; delta: string }
  | { type: "tool_execution_start"; toolName: string; toolCallId: string; input: string }
  | { type: "tool_execution_update"; toolCallId: string; output: string }
  | { type: "tool_execution_end"; toolCallId: string; result: string; isError: boolean }
  | { type: "message_start" }
  | { type: "message_end" }
  | { type: "agent_start" }
  | { type: "agent_end"; summary: string }
  | { type: "turn_start" }
  | { type: "turn_end" }
  | { type: "error"; message: string }
  | { type: "queue_update"; steering: string[]; followUp: string[] }
  | { type: "compaction_start" }
  | { type: "compaction_end" }
  | { type: "session_snapshot"; session: SessionSnapshot };

/** 重连时推送的 session 状态快照 */
export type SessionSnapshot = {
  sessionId: string;
  taskId: string;
  step: string;
  isStreaming: boolean;
  completed: boolean;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  turns: Array<{
    id: string;
    index: number;
    status: "running" | "done";
    textContent: string;
    thinking: string;
    toolCalls: Array<{
      id: string;
      name: string;
      status: "running" | "done" | "error";
      category: string;
      input: string;
      result?: string;
      outputFragments: string[];
    }>;
  }>;
  hasPendingQuestion: boolean;
  pendingQuestion?: { question: string; options?: string[] };
};
