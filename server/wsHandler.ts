import { type RawData, type WebSocket } from "ws";
import { AgentRunner } from "./AgentRunner";
import { SessionPool } from "./SessionPool";
import { SummaryStore } from "./SummaryStore";
import { WorkspaceManager } from "./WorkspaceManager";
import { SessionStore } from "./SessionStore";
import type { WsMessage } from "./protocol";
import type { HandlerDeps } from "./handlers/utils";
import { handleSessionMessage } from "./handlers/session.handler";
import { handleSummarizationMessage } from "./handlers/summarization.handler";
import { handleBuildMessage } from "./handlers/build.handler";
import { handleWorkspaceMessage } from "./handlers/workspace.handler";

export type WsHandlerGroup = "session" | "summarization" | "build" | "workspace" | null;

export function resolveWsHandlerGroup(method: string): WsHandlerGroup {
  if (method.startsWith("session.")) return "session";
  if (method.startsWith("summarization.")) return "summarization";
  if (method.startsWith("build.")) return "build";
  if (method.startsWith("workspace.")) return "workspace";
  return null;
}

/**
 * WebSocket 消息路由 — 按 method 前缀分发到对应 handler
 */
export async function handleWsMessage(
  ws: WebSocket,
  raw: RawData,
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

  // ── 心跳 ping/pong ──
  if (msg.type === "ping") {
    ws.send(JSON.stringify({ type: "pong", ts: msg.ts }));
    return;
  }

  if (msg.type !== "request") return;

  const handlerDeps: HandlerDeps = deps;

  try {
    const method = msg.method as string;

    // ── 按 method 前缀路由到对应 handler ──
    switch (resolveWsHandlerGroup(method)) {
      case "session": await handleSessionMessage(ws, msg, handlerDeps); break;
      case "summarization": await handleSummarizationMessage(ws, msg, handlerDeps); break;
      case "build": await handleBuildMessage(ws, msg, handlerDeps); break;
      case "workspace": await handleWorkspaceMessage(ws, msg, handlerDeps); break;
      default: throw new Error(`Unknown method: ${method}`);
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
