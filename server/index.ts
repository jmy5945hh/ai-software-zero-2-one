import http from "http";
import { WebSocketServer, type WebSocket } from "ws";
import { AgentRunner } from "./AgentRunner";
import { SessionPool } from "./SessionPool";
import { WorkspaceManager } from "./WorkspaceManager";
import { resolveQuestion } from "./customTools";
import type { WsMessage, AgentEvent } from "./protocol";

const PORT = parseInt(process.env.AGENT_PORT || "3100", 10);

// ── 初始化核心组件 ──────────────────────────
const runner = new AgentRunner("./server/models.json");
const pool = new SessionPool();
const workspace = new WorkspaceManager("./server/workspaces");

const server = http.createServer();
const wss = new WebSocketServer({ server, path: "/agent" });

console.log("Agent Server starting...");
console.log(`  Model provider: DeepSeek (via DEEPSEEK_API_KEY)`);
console.log(`  Port: ${PORT}`);

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
  // 倒序查找最后一条 assistant 消息
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

  // 基于 SDK AgentSessionEvent 的 type 字段映射
  const type = e.type as string | undefined;

  switch (type) {
    // ── message_update 解包 ──
    case "message_update": {
      const ame = (e.assistantMessageEvent as Record<string, unknown>) || {};
      const ameType = ame.type as string;
      if (ameType === "text_delta") {
        return { type: "text_delta", delta: (ame.delta as string) || "" };
      }
      if (ameType === "thinking_delta") {
        return { type: "thinking_delta", delta: (ame.delta as string) || "" };
      }
      // 忽略其他子类型（text_start/end, thinking_start/end, toolcall_*, start, done, error）
      return null;
    }

    // ── 工具调用 ──
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

    // ── 会话生命周期 ──
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
      return { type };

    default:
      // 未知事件丢弃（不再兜底为空 text_delta）
      return null;
  }
}

// ── WebSocket 连接处理 ──────────────────────
wss.on("connection", (ws: WebSocket) => {
  console.log("[ws] Client connected");

  ws.on("message", async (raw) => {
    let msg: WsMessage;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type !== "request") return;

    try {
      switch (msg.method as string) {
        // ── Session 管理 ────────────────────
        case "session.create": {
          const { taskId, step } = msg.params as {
            taskId: string;
            step: string;
            intent?: string;
            workspacePath?: string;
          };
          const intent = (msg.params as { intent?: string }).intent || "";
          const extPath = (msg.params as { workspacePath?: string }).workspacePath;
          let workspaceDir: string;
          if (extPath) {
            workspaceDir = workspace.setExternalWorkspace(taskId, extPath);
          } else {
            workspaceDir = workspace.initWorkspace(taskId, intent);
          }
          const session = await runner.createSession(taskId, step, workspaceDir);
          pool.set(taskId, step, session);

          // 订阅 SDK 事件 → 前端
          const unsub = session.subscribe((sdkEvent) => {
            const event = mapSdkEvent(sdkEvent);
            if (!event) return; // 跳过不需要转发的事件
            ws.send(JSON.stringify({ type: "event", id: msg.id, event }));
          });
          pool.setUnsub(taskId, step, unsub);

          ws.send(
            JSON.stringify({
              type: "response",
              id: msg.id,
              result: { sessionId: session.sessionId },
            }),
          );
          break;
        }

        case "session.prompt": {
          const { taskId, step, text } = msg.params as {
            taskId: string;
            step: string;
            text: string;
          };
          const session = pool.get(taskId, step);
          if (!session) throw new Error(`Session not found: ${taskId}:${step}`);
          await session.prompt(text);
          ws.send(JSON.stringify({ type: "response", id: msg.id, result: {} }));
          break;
        }

        case "session.steer": {
          const { taskId, step, text } = msg.params as {
            taskId: string;
            step: string;
            text: string;
          };
          const session = pool.get(taskId, step);
          if (!session) throw new Error(`Session not found: ${taskId}:${step}`);
          session.steer(text);
          ws.send(JSON.stringify({ type: "response", id: msg.id, result: {} }));
          break;
        }

        case "session.followUp": {
          const { taskId, step, text } = msg.params as {
            taskId: string;
            step: string;
            text: string;
          };
          const session = pool.get(taskId, step);
          if (!session) throw new Error(`Session not found: ${taskId}:${step}`);
          session.followUp(text);
          ws.send(JSON.stringify({ type: "response", id: msg.id, result: {} }));
          break;
        }

        case "session.abort": {
          const { taskId, step } = msg.params as {
            taskId: string;
            step: string;
          };
          const session = pool.get(taskId, step);
          if (!session) throw new Error(`Session not found: ${taskId}:${step}`);
          session.abort();
          ws.send(JSON.stringify({ type: "response", id: msg.id, result: {} }));
          break;
        }

        case "session.dispose": {
          const { taskId, step } = msg.params as {
            taskId: string;
            step: string;
          };
          pool.dispose(taskId, step);
          ws.send(JSON.stringify({ type: "response", id: msg.id, result: {} }));
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
          const { taskId, filePath } = msg.params as {
            taskId: string;
            filePath: string;
          };
          const content = workspace.readFile(taskId, filePath);
          ws.send(
            JSON.stringify({ type: "response", id: msg.id, result: { content } }),
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
  });

  ws.on("close", () => {
    console.log("[ws] Client disconnected");
  });
});

// ── 启动服务 ────────────────────────────────
server.listen(PORT, () => {
  console.log(`Agent Server listening on ws://localhost:${PORT}/agent`);
});
