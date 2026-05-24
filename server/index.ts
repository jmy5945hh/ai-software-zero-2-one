import http from "http";
import { WebSocketServer, type WebSocket } from "ws";
import { AgentRunner } from "./AgentRunner";
import { SessionPool } from "./SessionPool";
import { SummaryStore } from "./SummaryStore";
import { WorkspaceManager } from "./WorkspaceManager";
import { resolveQuestion } from "./customTools";
import type { WsMessage, AgentEvent } from "./protocol";

const PORT = parseInt(process.env.AGENT_PORT || "3100", 10);

// ── 初始化核心组件 ──────────────────────────
const runner = new AgentRunner("./server/models.json");
const pool = new SessionPool();
const summaryStore = new SummaryStore();
const workspace = new WorkspaceManager("./server/workspaces");

const server = http.createServer();
const wss = new WebSocketServer({ server, path: "/agent" });

console.log("Agent Server starting...");
console.log(`  Model provider: DeepSeek (via DEEPSEEK_API_KEY)`);
console.log(`  Port: ${PORT}`);

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

    // ── 心跳 ping/pong ──────────────────
    if (msg.type === "ping") {
      ws.send(JSON.stringify({ type: "pong", ts: msg.ts }));
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

        // ── 重试整个 Agent 流程 ──────────────
        case "session.retry": {
          const { taskId, step, text, initialPrompt } = msg.params as {
            taskId: string;
            step: string;
            text: string;
            initialPrompt?: string;
          };
          // 1. 销毁旧 session
          pool.dispose(taskId, step);
          // 2. 重新创建 session，用用户提示词替换系统提示词
          const intent = (msg.params as { intent?: string }).intent || "";
          const extPath = (msg.params as { workspacePath?: string }).workspacePath;
          let workspaceDir: string;
          if (extPath) {
            workspaceDir = workspace.setExternalWorkspace(taskId, extPath);
          } else {
            workspaceDir = workspace.initWorkspace(taskId, intent);
          }
          const newSession = await runner.createSession(taskId, step, workspaceDir, text);
          pool.set(taskId, step, newSession);

          const unsub = newSession.subscribe((sdkEvent) => {
            const event = mapSdkEvent(sdkEvent);
            if (!event) return;
            ws.send(JSON.stringify({ type: "event", id: msg.id, event }));
          });
          pool.setUnsub(taskId, step, unsub);

          // 3. 发响应（前端准备接收事件）
          ws.send(
            JSON.stringify({
              type: "response",
              id: msg.id,
              result: { sessionId: newSession.sessionId },
            }),
          );

          // 4. 发送初始 user prompt（复用步骤原本的提示词）
          if (initialPrompt) {
            await newSession.prompt(initialPrompt);
          }
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
          const { taskId, step } = msg.params as {
            taskId: string;
            step: string;
          };
          const saved = summaryStore.get(taskId, step);
          if (!saved) {
            throw new Error(`No summary saved for ${taskId}:${step}`);
          }
          const workspaceDir = workspace.getDir(taskId);
          const session = await runner.createSummarizationSession(workspaceDir);

          // 监听 agent_end，完成后自动清理
          const unsub = session.subscribe((sdkEvent) => {
            const event = mapSdkEvent(sdkEvent);
            if (!event) return;
            ws.send(JSON.stringify({ type: "event", id: msg.id, event }));

            // 总结完成 → 清理 session
            if (event.type === "agent_end") {
              unsub();
              session.dispose();
              summaryStore.delete(taskId, step);
            }
          });

          // 先发响应（前端准备接收事件）
          ws.send(
            JSON.stringify({
              type: "response",
              id: msg.id,
              result: { sessionId: session.sessionId },
            }),
          );

          // 发送总结 prompt
          const promptText = buildSummarizationPrompt(saved);
          await session.prompt(promptText);
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
