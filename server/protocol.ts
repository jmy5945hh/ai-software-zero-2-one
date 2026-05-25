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
  | "session.retry"
  | "summarization.save"
  | "summarization.trigger"
  | "workspace.tree"
  | "workspace.readFile"
  | "workspace.browse"
  | "git.snapshot"
  | "git.restore"
  | "git.worktreeSave"
  | "git.worktreeRestore";

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
  | { type: "auto_retry_start" }
  | { type: "auto_retry_end" };
