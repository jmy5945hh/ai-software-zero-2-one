import http from "http";
import fs from "fs";
import path from "path";
import os from "os";
import type { SessionStore } from "../SessionStore.js";

const PORT = parseInt(process.env.AGENT_PORT || "3100", 10);

export function getUserDir(username: string): string {
  return path.join(os.homedir(), ".aiNativeDevPlatform", username);
}

function ensureUserDir(username: string): string {
  const dir = getUserDir(username);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function handleUserRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  sessionStore?: SessionStore,
): boolean {

  // POST /api/user/login — 用户登录，创建用户目录
  if (req.method === "POST" && req.url === "/api/user/login") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        const { username } = JSON.parse(body);
        if (!username || typeof username !== "string" || !username.trim()) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "用户名不能为空" }));
          return;
        }
        const safeName = username.trim().replace(/[^a-zA-Z0-9_一-龥\-]/g, "");
        if (!safeName) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "用户名包含非法字符" }));
          return;
        }
        ensureUserDir(safeName);
        // 切换 SessionStore 到用户目录
        sessionStore?.setUser(safeName);
        console.log(`[user] login: ${safeName}`);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, username: safeName }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : "登录失败" }));
      }
    });
    return true;
  }

  // GET /api/user/me?username=xxx — 设置当前用户（用于 warmup）
  if (req.method === "GET" && req.url?.startsWith("/api/user/me")) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const username = url.searchParams.get("username");
    if (!username) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "缺少用户名" }));
      return true;
    }
    const userDir = getUserDir(username);
    if (fs.existsSync(userDir)) {
      sessionStore?.setUser(username);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, username }));
    } else {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "用户不存在" }));
    }
    return true;
  }

  return false;
}
