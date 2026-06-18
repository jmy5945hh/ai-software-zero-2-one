import "dotenv/config";
import http from "http";
import { WebSocketServer, type WebSocket } from "ws";
import { AgentRunner } from "./AgentRunner";
import { SessionPool } from "./SessionPool";
import { SummaryStore } from "./SummaryStore";
import { WorkspaceManager } from "./WorkspaceManager";
import { SessionStore } from "./SessionStore";
import { handleHttpRequest } from "./httpRoutes";
import { handleWsMessage } from "./wsHandler";
import { isHttpRequestAuthorized, rejectUnauthorizedRequest } from "./httpAuth";

const PORT = parseInt(process.env.AGENT_PORT || "3100", 10);

// ── 初始化核心组件 ──────────────────────────
const runner = new AgentRunner("./server/models.json");
const pool = new SessionPool();
const summaryStore = new SummaryStore();
const workspace = new WorkspaceManager(WorkspaceManager.defaultRoot());
const sessionStore = new SessionStore();
const AGENT_SECRET = process.env.AGENT_SECRET;

// ── HTTP 服务 ───────────────────────────────
const server = http.createServer((req, res) => {
  if (!isHttpRequestAuthorized(req, AGENT_SECRET)) {
    rejectUnauthorizedRequest(res);
    return;
  }
  const handled = handleHttpRequest(req, res, { pool, sessionStore, workspace });
  if (!handled) {
    res.writeHead(404);
    res.end();
  }
});

// ── WebSocket 服务 ──────────────────────────
const wss = new WebSocketServer({ server, path: "/agent" });

console.log("Agent Server starting...");
console.log(`  Model provider: DeepSeek (via DEEPSEEK_API_KEY)`);
console.log(`  Port: ${PORT}`);

// ── WebSocket 连接认证 ──────────────────────
if (AGENT_SECRET) {
  console.log("[auth] Token authentication enabled");
} else {
  console.log("[auth] WARNING: No AGENT_SECRET set — accepting all connections");
}

// ── WebSocket 连接处理 ──────────────────────
wss.on("connection", (ws: WebSocket, req) => {
  // Token 认证
  if (AGENT_SECRET) {
    try {
      const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
      const token = url.searchParams.get("token");
      if (token !== AGENT_SECRET) {
        console.log("[ws] Rejected: invalid token from %s", req.socket.remoteAddress);
        ws.send(JSON.stringify({ type: "error", id: "0", error: { code: "AUTH_FAILED", message: "认证失败：Token 无效" } }));
        ws.close(4001, "Unauthorized");
        return;
      }
    } catch {
      ws.send(JSON.stringify({ type: "error", id: "0", error: { code: "AUTH_FAILED", message: "认证失败：Token 无效" } }));
      ws.close(4001, "Unauthorized");
      return;
    }
  }

  console.log("[ws] Client connected");

  ws.on("message", async (raw) => {
    await handleWsMessage(ws, raw, { runner, pool, summaryStore, workspace, sessionStore });
  });

  ws.on("close", () => {
    console.log("[ws] Client disconnected");
  });
});

// ── 启动服务 ────────────────────────────────
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Agent Server listening on ws://0.0.0.0:${PORT}/agent`);
  console.log(`  Health check: http://0.0.0.0:${PORT}/health`);
});
