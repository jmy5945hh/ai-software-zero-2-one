import http from "http";
import { SessionPool } from "./SessionPool.js";
import { SessionStore } from "./SessionStore.js";
import { RollbackManager } from "./RollbackManager.js";
import { WorkspaceManager } from "./WorkspaceManager.js";
import { handleWorkspaceRoutes } from "./routes/workspace.routes.js";
import { handleSessionRoutes } from "./routes/session.routes.js";
import { handleBuildRoutes } from "./routes/build.routes.js";
import { handleApiRoutes } from "./routes/api.routes.js";
import { handleUserRoutes } from "./routes/user.routes.js";

export type HttpRouteGroup = "api" | "user" | "session" | "build" | "workspace" | null;

export function resolveHttpRouteGroup(url: string | undefined): HttpRouteGroup {
  // 去掉 /server 前缀
  const path = url?.startsWith("/server") ? url.slice(7) || "/" : url;
  if (path?.startsWith("/api/user/")) return "user";
  if (path?.startsWith("/api/")) return "api";
  if (path?.startsWith("/session/") || path === "/task/init" ||
      path?.startsWith("/repo-diff") || path?.startsWith("/step-snapshot") ||
      path?.startsWith("/rollback/")) return "session";
  if (path?.startsWith("/project-build") || path?.startsWith("/read-file") ||
      path?.startsWith("/qa-review") || path?.startsWith("/verification-plan") ||
      path?.startsWith("/verification-run") || path?.startsWith("/delivery-report")) return "build";
  if (path?.startsWith("/specs-") || path?.startsWith("/workspace-") ||
      path?.startsWith("/repo-") || path?.startsWith("/git-") ||
      path?.startsWith("/session-file")) return "workspace";
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
  const reqPath = req.url?.startsWith("/server") ? req.url.slice(7) || "/" : req.url;

  // 健康检查
  if (req.method === "GET" && (reqPath === "/health" || req.url === "/health")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", timestamp: Date.now() }));
    return true;
  }

  switch (resolveHttpRouteGroup(reqPath)) {
    case "api": return handleApiRoutes(req, res, deps, reqPath);
    case "user": return handleUserRoutes(req, res, deps.sessionStore, reqPath);
    case "session": return handleSessionRoutes(req, res, deps, reqPath);
    case "build": return handleBuildRoutes(req, res, deps, reqPath);
    case "workspace": return handleWorkspaceRoutes(req, res, deps, reqPath);
    default: return false;
  }
}
