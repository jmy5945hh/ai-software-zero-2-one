import http from "http";
import path from "path";
import { readSpecsTree, readRepoTree, readFileSafe, writeFileSafe, existsSync } from "./utils/fileOps";
import { getRepoDiff, getRepoDiffFiles, execCommand } from "./utils/gitOps";
import { SessionPool } from "./SessionPool";
import { SessionStore } from "./SessionStore";

const PORT = parseInt(process.env.AGENT_PORT || "3100", 10);

/**
 * 注册所有 HTTP 路由到 server。
 * 返回 true 表示已处理，false 表示未匹配（由调用方返回 404）。
 */
export function handleHttpRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  deps: { pool: SessionPool; sessionStore: SessionStore },
): boolean {
  // 健康检查端点（前端连通性验证）
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", timestamp: Date.now() }));
    return true;
  }

  // Cloud Runtime API
  if (req.url?.startsWith("/api/")) {
    return handleCloudApiRequest(req, res, deps);
  }

  // 读取指定项目路径下的 specs 目录内容
  if (req.method === "GET" && req.url?.startsWith("/specs-tree")) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const projectPath = url.searchParams.get("path");
    if (!projectPath) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing 'path' query parameter" }));
      return true;
    }
    const specsDir = path.join(projectPath, "specs");
    try {
      const result = readSpecsTree(specsDir);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify([]));
    }
    return true;
  }

  // 读取 specs 目录下某个文件的内容
  if (req.method === "GET" && req.url?.startsWith("/specs-file")) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const projectPath = url.searchParams.get("path");
    const filePath = url.searchParams.get("file");
    if (!projectPath || !filePath) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing 'path' or 'file' query parameter" }));
      return true;
    }
    try {
      const content = readFileSafe(path.join(projectPath, "specs"), filePath);
      const isMarkdown = /\.md$/i.test(filePath);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ content, isMarkdown }));
    } catch {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "File not found" }));
    }
    return true;
  }

  // 保存 specs 目录下某个文件的内容（支持 Markdown 编辑）
  if (req.method === "POST" && req.url === "/specs-save") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        const { path: projectPath, file: filePath, content } = JSON.parse(body);
        if (!projectPath || !filePath || content === undefined) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing 'path', 'file', or 'content'" }));
          return;
        }
        try {
          writeFileSafe(path.join(projectPath, "specs"), filePath, content);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        } catch (err) {
          res.writeHead(403, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Forbidden" }));
        }
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Save failed" }));
      }
    });
    return true;
  }

  // 读取项目仓库目录树（排除 specs 目录）
  if (req.method === "GET" && req.url?.startsWith("/repo-tree")) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const projectPath = url.searchParams.get("path");
    if (!projectPath) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing 'path' query parameter" }));
      return true;
    }
    try {
      if (!existsSync(projectPath)) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify([]));
        return true;
      }
      const result = readRepoTree(projectPath);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (err) {
      console.error("repo-tree error:", err);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify([]));
    }
    return true;
  }

  // 读取仓库中某个文件的内容
  if (req.method === "GET" && req.url?.startsWith("/repo-file")) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const projectPath = url.searchParams.get("path");
    const filePath = url.searchParams.get("file");
    if (!projectPath || !filePath) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing 'path' or 'file' query parameter" }));
      return true;
    }
    try {
      const content = readFileSafe(projectPath, filePath);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ content }));
    } catch {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "File not found" }));
    }
    return true;
  }

  // 获取按文件拆分的 git diff（必须放在 /repo-diff 之前，避免路由被先匹配）
  if (req.method === "GET" && req.url?.startsWith("/repo-diff-files")) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const projectPath = url.searchParams.get("path");
    if (!projectPath) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing 'path' query parameter" }));
      return true;
    }
    try {
      const result = getRepoDiffFiles(projectPath);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Git diff failed" }));
    }
    return true;
  }

  // 获取仓库 git diff（当前工作区变更）
  if (req.method === "GET" && req.url?.startsWith("/repo-diff")) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const projectPath = url.searchParams.get("path");
    if (!projectPath) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing 'path' query parameter" }));
      return true;
    }
    try {
      const diff = getRepoDiff(projectPath);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ diff }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Git diff failed" }));
    }
    return true;
  }

  // 项目编译（支持由模型提供编译命令）
  if (req.method === "GET" && req.url?.startsWith("/project-build")) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const projectPath = url.searchParams.get("path");
    const customCommand = url.searchParams.get("command");
    console.log("[project-build] path=%s command=%s", projectPath, customCommand);
    if (!projectPath) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing 'path' query parameter" }));
      return true;
    }
    try {
      if (!existsSync(projectPath)) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, output: "// 目录不存在", command: "" }));
        return true;
      }

      const command = customCommand;
      if (!command) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, output: "// 错误：模型未提供编译命令", command: "" }));
        return true;
      }

      const output = execCommand(command, projectPath);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, output, command }));
    } catch (err: any) {
      const errOutput = err.stdout || err.stderr || err.message || "";
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        success: false,
        output: errOutput,
        command: customCommand,
      }));
    }
    return true;
  }

  return false; // 未匹配任何路由
}

// ── Cloud Runtime REST API ──────────────────
// 为 CloudRuntimeConnector 提供项目和资源数据
function handleCloudApiRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  deps: { pool: SessionPool; sessionStore: SessionStore },
): boolean {
  const { pool, sessionStore } = deps;

  if (req.method === "GET" && req.url === "/api/resources") {
    const memUsage = process.memoryUsage();
    const memPercent = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);
    const activeSessions = pool.getActiveCount();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      cpu: Math.min(Math.round(10 + Math.random() * 25), 100),
      memory: Math.min(memPercent || 20, 100),
      disk: Math.min(Math.round(30 + Math.random() * 15), 100),
      activeQueues: activeSessions,
      monthlyTokens: { used: 125_000, total: 1_000_000 },
    }));
    return true;
  }

  if (req.method === "GET" && req.url === "/api/projects") {
    const records = sessionStore.list();
    const projects = records.map((meta) => ({
      id: meta.sessionId,
      name: meta.intent?.slice(0, 60) || meta.taskId,
      description: meta.intent || "",
      status: meta.status === "completed" ? "completed" : meta.stepIndex >= 3 ? "running" : "building",
      progress: Math.round((meta.stepIndex / 7) * 100),
      lastActivity: meta.updatedAt || meta.createdAt,
      toolCallCount: 0,
      fileCount: 0,
    }));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(projects));
    return true;
  }

  if (req.method === "POST" && req.url === "/api/projects") {
    const MAX_BODY_SIZE = 1024 * 1024; // 1MB
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY_SIZE) {
        res.writeHead(413, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Request body too large" }));
        req.destroy();
      }
    });
    req.on("error", (err) => {
      console.error("[httpRoutes] Request body error:", err);
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid request body" }));
    });
    req.on("end", () => {
      try {
        const { name, description } = JSON.parse(body);
        const project = {
          id: `cloud-${Date.now()}`,
          name: name || "New Project",
          description: description || "",
          status: "draft",
          progress: 0,
          lastActivity: new Date().toISOString(),
          toolCallCount: 0,
          fileCount: 0,
        };
        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify(project));
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid request body" }));
      }
    });
    return true;
  }

  const deleteMatch = req.url?.match(/^\/api\/projects\/([^/]+)$/);
  if (req.method === "DELETE" && deleteMatch) {
    const projectId = decodeURIComponent(deleteMatch[1]);
    try {
      sessionStore.delete(projectId);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
    } catch (err) {
      console.error(`[httpRoutes] Failed to delete project ${projectId}:`, err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Failed to delete project" }));
    }
    return true;
  }

  const startMatch = req.url?.match(/^\/api\/projects\/([^/]+)\/start$/);
  if (req.method === "POST" && startMatch) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true }));
    return true;
  }

  const pauseMatch = req.url?.match(/^\/api\/projects\/([^/]+)\/pause$/);
  if (req.method === "POST" && pauseMatch) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true }));
    return true;
  }

  return false;
}
