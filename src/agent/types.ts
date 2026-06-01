// ── Agent 通信层类型定义（前端侧） ──────────

/** 从 Agent Server 接收的 Agent 事件 */
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

/** WebSocket 统一消息格式 */
export type WsMessage =
  | { type: "request"; id: string; method: string; params: Record<string, unknown> }
  | { type: "event"; id: string; event: AgentEvent }
  | { type: "response"; id: string; result: unknown }
  | { type: "error"; id: string; error: { code: string; message: string } }
  | { type: "ping"; ts: number }
  | { type: "pong"; ts: number };

/** 文件树节点 */
export type FileNode = {
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
};

/** 工具调用类别 */
export type ToolCallCategory = "tool" | "mcp" | "skill" | "subagent" | "unknown";

/** 单次工具调用记录 */
export type ToolCallRecord = {
  id: string;
  name: string;
  status: "running" | "done" | "error";
  category: ToolCallCategory;
  outputFragments: string[];
  /** 调用参数（JSON 序列化后的字符串） */
  input: string;
  /** 调用完成后的完整结果 */
  result?: string;
};

/** 一轮（turn）的产出 */
export type Turn = {
  id: string;
  index: number;
  status: "running" | "done";
  textContent: string;
  /** 思考过程片段 */
  thinking: string;
  toolCalls: ToolCallRecord[];
  /** 触发该轮的 user 输入（steer/followUp 时记录） */
  userInput?: string;
};

/** 单个 Session 的状态快照（前端维护） */
export type SessionState = {
  id: string;
  streamingText: string;
  isStreaming: boolean;
  completed: boolean;
  /** agent_end 事件中提取的会话总结 */
  summary: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  turns: Turn[];
  error?: string;
  isCompacting: boolean;
  isRetrying: boolean;
  queue: { steering: string[]; followUp: string[] };
  /** 结构化总结状态 */
  summarizationStatus: "idle" | "pending" | "loading" | "done" | "error";
  /** 解析后的结构化总结结果 */
  summarizationResult?: import("../data/types").AgentSummary;
  /** 总结 Agent 原始返回文本（调试 / 兜底用） */
  summarizationRaw?: string;
  /** 项目编译状态 */
  buildStatus: "idle" | "pending" | "loading" | "done" | "error";
  /** 编译结果 */
  buildResult?: import("../data/types").BuildResult;
  /** 编译 Agent 原始返回文本 */
  buildRaw?: string;
};

/** WebSocket 连接状态 */
export type ConnectionStatus =
  | "connected"
  | "disconnected"
  | "connecting"
  | "reconnecting";

/** 连接质量指标（心跳延迟 + 重连统计） */
export type ConnectionQuality = {
  /** 延迟（ms），-1 表示心跳超时 */
  latency: number;
  /** 重连尝试次数 */
  reconnectAttempt: number;
};
