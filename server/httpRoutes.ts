import http from "http";
import { SessionPool } from "./SessionPool";
import { SessionStore } from "./SessionStore";
import { RollbackManager } from "./RollbackManager";
import { WorkspaceManager } from "./WorkspaceManager";
import { handleWorkspaceRoutes } from "./routes/workspace.routes";
import { handleSessionRoutes } from "./routes/session.routes";
import { handleBuildRoutes } from "./routes/build.routes";
import { handleApiRoutes } from "./routes/api.routes";

export type HttpRouteGroup = "api" | "session" | "build" | "workspace" | null;

export function resolveHttpRouteGroup(url: string | undefined): HttpRouteGroup {
  if (url?.startsWith("/api/")) return "api";
  if (url?.startsWith("/session/") || url === "/task/init" ||
      url?.startsWith("/repo-diff") || url?.startsWith("/step-snapshot") ||
      url?.startsWith("/rollback/")) return "session";
  if (url?.startsWith("/project-build") || url?.startsWith("/read-file") ||
      url?.startsWith("/qa-review")) return "build";
  if (url?.startsWith("/specs-") || url?.startsWith("/workspace-") ||
      url?.startsWith("/repo-")) return "workspace";
  return null;
}

/**
 * HTTP 路由入口 — 按 URL 前缀分发到对应路由模块
 */
export function handleHttpRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  deps: { pool: SessionPool; sessionStore: SessionStore; workspace: WorkspaceManager; rollback: RollbackManager },
): boolean {
  // ── CORS 头 ──
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return true;
  }

  // 健康检查
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", timestamp: Date.now() }));
    return true;
  }

  switch (resolveHttpRouteGroup(req.url)) {
    case "api": return handleApiRoutes(req, res, deps);
    case "session": return handleSessionRoutes(req, res, deps);
    case "build": return handleBuildRoutes(req, res, deps);
    case "workspace": return handleWorkspaceRoutes(req, res, deps);
    default: return false;
  }
}
