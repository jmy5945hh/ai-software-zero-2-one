import http from "http";
import path from "path";
import { readSpecsTree, readRepoTree, readFileSafe, writeFileSafe, existsSync } from "../utils/fileOps";
import type { WorkspaceManager } from "../WorkspaceManager";

const PORT = parseInt(process.env.AGENT_PORT || "3100", 10);

/**
 * Workspace/Repo/Specs 相关路由
 */
export function handleWorkspaceRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  deps: { workspace: WorkspaceManager },
): boolean {
  const { workspace } = deps;

  // 读取指定项目路径下的 specs 目录内容
  if (req.method === "GET" && req.url?.startsWith("/specs-tree")) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const projectPath = url.searchParams.get("path");
    const taskId = url.searchParams.get("taskId");
    let resolvedPath = projectPath;
    if (!resolvedPath && taskId) {
      resolvedPath = workspace.getRepoDir(taskId);
    }
    if (!resolvedPath) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing 'path' or 'taskId' query parameter" }));
      return true;
    }
    const specsDir = path.join(resolvedPath, "specs");
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
    const taskId = url.searchParams.get("taskId");
    let resolvedPath = projectPath;
    if (!resolvedPath && taskId) {
      resolvedPath = workspace.getRepoDir(taskId);
    }
    if (!resolvedPath || !filePath) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing 'path'/'taskId' or 'file' query parameter" }));
      return true;
    }
    try {
      const content = readFileSafe(path.join(resolvedPath, "specs"), filePath);
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
        const { path: projectPath, file: filePath, content, taskId } = JSON.parse(body);
        let resolvedPath = projectPath;
        if (!resolvedPath && taskId) {
          resolvedPath = workspace.getRepoDir(taskId);
        }
        if (!resolvedPath || !filePath || content === undefined) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing 'path'/'taskId', 'file', or 'content'" }));
          return;
        }
        try {
          writeFileSafe(path.join(resolvedPath, "specs"), filePath, content);
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

  // 获取 workspace 文件树
  if (req.method === "GET" && req.url?.startsWith("/workspace-tree")) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const taskId = url.searchParams.get("taskId");
    if (!taskId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing 'taskId' query parameter" }));
      return true;
    }
    try {
      const tree = workspace.getFileTree(taskId);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ tree }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Failed to get file tree" }));
    }
    return true;
  }

  // 读取 workspace 文件
  if (req.method === "GET" && req.url?.startsWith("/workspace-read-file")) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const taskId = url.searchParams.get("taskId");
    const filePath = url.searchParams.get("filePath");
    if (!taskId || !filePath) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing 'taskId' or 'filePath' query parameter" }));
      return true;
    }
    try {
      const content = workspace.readFile(taskId, filePath);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ content }));
    } catch (err) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : "File not found" }));
    }
    return true;
  }

  // 浏览 workspace 目录
  if (req.method === "GET" && req.url?.startsWith("/workspace-browse")) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const dirPath = url.searchParams.get("dirPath") || "/";
    try {
      const entries = workspace.browseDir(dirPath);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ entries }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Browse failed" }));
    }
    return true;
  }

  // 读取项目仓库目录树
  if (req.method === "GET" && req.url?.startsWith("/repo-tree")) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const projectPath = url.searchParams.get("path");
    const taskId = url.searchParams.get("taskId");
    let resolvedPath = projectPath;
    if (!resolvedPath && taskId) {
      resolvedPath = workspace.getRepoDir(taskId);
    }
    if (!resolvedPath) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing 'path' or 'taskId' query parameter" }));
      return true;
    }
    try {
      if (!existsSync(resolvedPath)) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify([]));
        return true;
      }
      const result = readRepoTree(resolvedPath);
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
    const taskId = url.searchParams.get("taskId");
    let resolvedPath = projectPath;
    if (!resolvedPath && taskId) {
      resolvedPath = workspace.getRepoDir(taskId);
    }
    if (!resolvedPath || !filePath) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing 'path'/'taskId' or 'file' query parameter" }));
      return true;
    }
    try {
      const content = readFileSafe(resolvedPath, filePath);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ content }));
    } catch {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "File not found" }));
    }
    return true;
  }

  return false;
}
