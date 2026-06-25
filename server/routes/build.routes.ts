import http from "http";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import { existsSync } from "../utils/fileOps";
import { executeBuildCommand } from "../utils/buildCommand";
import type { WorkspaceManager } from "../WorkspaceManager";

const PORT = parseInt(process.env.AGENT_PORT || "3100", 10);

/**
 * 编译/QA 相关路由
 */
export function handleBuildRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  deps: { workspace: WorkspaceManager },
): boolean {
  const { workspace } = deps;

  // 项目编译
  if (req.method === "GET" && req.url?.startsWith("/project-build")) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const projectPath = url.searchParams.get("path");
    const customCommand = url.searchParams.get("command");
    const taskId = url.searchParams.get("taskId");
    console.log("[project-build] path=%s command=%s taskId=%s", projectPath, customCommand, taskId);

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
        res.end(JSON.stringify({ success: false, output: "// 目录不存在", command: "" }));
        return true;
      }

      const command = customCommand;
      if (!command) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, output: "// 错误：模型未提供编译命令", command: "" }));
        return true;
      }

      const output = executeBuildCommand(command, resolvedPath);
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

  // 读取文件内容
  if (req.method === "GET" && req.url?.startsWith("/read-file")) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const filePath = url.searchParams.get("file") || "";
    const resolvedPath = filePath.replace(/^~/, process.env.HOME || process.env.USERPROFILE || "");
    try {
      const content = fs.readFileSync(resolvedPath, "utf-8");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ content }));
    } catch (err: any) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `文件读取失败: ${err.message}` }));
    }
    return true;
  }

  // QA 质量审查
  if (req.method === "GET" && req.url?.startsWith("/qa-review")) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const projectPath = url.searchParams.get("path");
    const sessionId = url.searchParams.get("sessionId");
    const taskId = url.searchParams.get("taskId");

    let resolvedPath = projectPath;
    if (!resolvedPath && taskId) {
      resolvedPath = workspace.getRepoDir(taskId);
    }
    if (!resolvedPath || !sessionId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing 'path'/'taskId' or 'sessionId' query parameter" }));
      return true;
    }

    const outputDir = path.join(
      process.env.HOME || process.env.USERPROFILE || "~",
      ".aiNativeDevPlatform",
      "sessions",
      sessionId,
    );

    try {
      fs.mkdirSync(outputDir, { recursive: true });
    } catch {
      // ignore
    }

    const outputFile = path.join(outputDir, "quality_result.toml");

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    res.write(`data: ${JSON.stringify({ type: "start", message: "QA 审查开始执行...", outputFile })}\n\n`);

    const cliCommand = `qa-review --scope untracked --output ${outputFile}`;

    const child = spawn("sh", ["-c", cliCommand], {
      cwd: resolvedPath,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });

    let fullOutput = "";

    child.stdout.on("data", (data: Buffer) => {
      const text = data.toString();
      fullOutput += text;
      const lines = text.split("\n").filter(Boolean);
      for (const line of lines) {
        res.write(`data: ${JSON.stringify({ type: "output", line })}\n\n`);
      }
    });

    child.stderr.on("data", (data: Buffer) => {
      const text = data.toString();
      fullOutput += text;
      const lines = text.split("\n").filter(Boolean);
      for (const line of lines) {
        res.write(`data: ${JSON.stringify({ type: "output", line })}\n\n`);
      }
    });

    child.on("close", async (code: number | null) => {
      let resultContent = "";
      try {
        if (fs.existsSync(outputFile)) {
          resultContent = fs.readFileSync(outputFile, "utf-8");
        }
      } catch {
        // 读取失败
      }

      res.write(`data: ${JSON.stringify({
        type: "complete",
        exitCode: code,
        outputFile,
        resultContent,
        fullOutput,
      })}\n\n`);
      res.end();
    });

    child.on("error", (err: Error) => {
      res.write(`data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`);
      res.end();
    });

    req.on("close", () => {
      child.kill();
    });

    return true;
  }

  return false;
}
