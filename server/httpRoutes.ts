import http from "http";
import path from "path";
import { readSpecsTree, readRepoTree, readFileSafe, writeFileSafe, existsSync } from "./utils/fileOps";
import { getRepoDiff, execCommand } from "./utils/gitOps";

const PORT = parseInt(process.env.AGENT_PORT || "3100", 10);

/**
 * 注册所有 HTTP 路由到 server。
 * 返回 true 表示已处理，false 表示未匹配（由调用方返回 404）。
 */
export function handleHttpRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): boolean {
  // 健康检查端点（前端连通性验证）
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", timestamp: Date.now() }));
    return true;
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
