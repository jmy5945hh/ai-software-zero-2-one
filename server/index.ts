import "dotenv/config";
import http from "http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { WebSocketServer, type WebSocket } from "ws";
import { AgentRunner } from "./AgentRunner.js";
import { SessionPool } from "./SessionPool.js";
import { SummaryStore } from "./SummaryStore.js";
import { WorkspaceManager } from "./WorkspaceManager.js";
import { SessionStore } from "./SessionStore.js";
import { RollbackManager } from "./RollbackManager.js";
import { handleHttpRequest } from "./httpRoutes.js";
import { handleWsMessage } from "./wsHandler.js";
import { isHttpRequestAuthorized, rejectUnauthorizedRequest } from "./httpAuth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = parseInt(process.env.AGENT_PORT || "3100", 10);
const HOST = process.env.AGENT_HOST || "0.0.0.0";

// ── 初始化核心组件 ──────────────────────────
const runner = new AgentRunner(join(__dirname, "models.json"));
const pool = new SessionPool();
const summaryStore = new SummaryStore();
const workspace = new WorkspaceManager(WorkspaceManager.defaultRoot());
const sessionStore = new SessionStore();
const rollback = new RollbackManager();
const AGENT_SECRET = process.env.AGENT_SECRET;

// ── HTTP 服务 ───────────────────────────────
const server = http.createServer((req, res) => {
  try {
    if (!isHttpRequestAuthorized(req, AGENT_SECRET)) {
      rejectUnauthorizedRequest(res);
      return;
    }
    const handled = handleHttpRequest(req, res, { pool, sessionStore, workspace, rollback });
    if (!handled) {
      res.writeHead(404);
      res.end();
    }
  } catch (err) {
    console.error("[http] Unhandled error:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: String(err) }));
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

  // ── 传输层心跳保活 ──
  // 每 25 秒发一次 ws.ping()，防止浏览器/中间件因空闲断开连接。
  // ws 库的 ping 是 WebSocket 协议帧（非应用层消息），浏览器会自动回复 pong。
  const HEARTBEAT_INTERVAL = 25000;
  const heartbeatTimer = setInterval(() => {
    ws.ping();
  }, HEARTBEAT_INTERVAL);

  ws.on("message", async (raw) => {
    await handleWsMessage(ws, raw, { runner, pool, summaryStore, workspace, sessionStore, rollback });
  });

  ws.on("close", () => {
    clearInterval(heartbeatTimer);
    console.log("[ws] Client disconnected");
  });
});

// ── 启动服务 ────────────────────────────────
server.listen(PORT, HOST, () => {
  console.log(`Agent Server listening on ws://${HOST}:${PORT}/agent`);
  console.log(`  Health check: http://${HOST}:${PORT}/health`);
});
