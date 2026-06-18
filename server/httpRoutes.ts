import http from "http";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import { readSpecsTree, readRepoTree, readFileSafe, writeFileSafe, existsSync } from "./utils/fileOps";
import { getRepoDiff, getRepoDiffFiles, execCommand } from "./utils/gitOps";
import { SessionPool } from "./SessionPool";
import { SessionStore } from "./SessionStore";
import { WorkspaceManager } from "./WorkspaceManager";

const PORT = parseInt(process.env.AGENT_PORT || "3100", 10);

/**
 * 注册所有 HTTP 路由到 server。
 * 返回 true 表示已处理，false 表示未匹配（由调用方返回 404）。
 */
export function handleHttpRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  deps: { pool: SessionPool; sessionStore: SessionStore; workspace: WorkspaceManager },
): boolean {
  // ── CORS 头（允许前端跨域访问） ──
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // 预检请求直接返回
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return true;
  }

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
    const taskId = url.searchParams.get("taskId");
    // 云端模式：优先使用 taskId 解析 workspace repo 路径
    let resolvedPath = projectPath;
    if (!resolvedPath && taskId) {
      resolvedPath = deps.workspace.getRepoDir(taskId);
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
      resolvedPath = deps.workspace.getRepoDir(taskId);
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
          resolvedPath = deps.workspace.getRepoDir(taskId);
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

  // ── 获取 workspace 文件树（替代 WebSocket workspace.tree） ──
  if (req.method === "GET" && req.url?.startsWith("/workspace-tree")) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const taskId = url.searchParams.get("taskId");
    if (!taskId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing 'taskId' query parameter" }));
      return true;
    }
    try {
      const tree = deps.workspace.getFileTree(taskId);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ tree }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Failed to get file tree" }));
    }
    return true;
  }

  // ── 读取 workspace 文件（替代 WebSocket workspace.readFile） ──
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
      const content = deps.workspace.readFile(taskId, filePath);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ content }));
    } catch (err) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : "File not found" }));
    }
    return true;
  }

  // ── 浏览 workspace 目录（替代 WebSocket workspace.browse） ──
  if (req.method === "GET" && req.url?.startsWith("/workspace-browse")) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const dirPath = url.searchParams.get("dirPath") || "/";
    try {
      const entries = deps.workspace.browseDir(dirPath);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ entries }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Browse failed" }));
    }
    return true;
  }

  // 读取项目仓库目录树（排除 specs 目录）
  if (req.method === "GET" && req.url?.startsWith("/repo-tree")) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const projectPath = url.searchParams.get("path");
    const taskId = url.searchParams.get("taskId");
    let resolvedPath = projectPath;
    if (!resolvedPath && taskId) {
      resolvedPath = deps.workspace.getRepoDir(taskId);
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
      resolvedPath = deps.workspace.getRepoDir(taskId);
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

  // ── 初始化任务环境（HTTP 替代 WebSocket task.init） ──
  if (req.method === "POST" && req.url === "/task/init") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        const params = JSON.parse(body);
        const now = new Date().toISOString();

        // 根据运行模式初始化 workspace
        const isCloud = params.runtimeMode === "cloud";
        let resolvedWorkspacePath: string;
        if (isCloud) {
          if (!params.gitRepo) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "云端任务需要 gitRepo 参数" }));
            return;
          }
          // 异步克隆（不阻塞 HTTP 响应）
          resolvedWorkspacePath = deps.workspace.initCloudWorkspace(params.taskId, params.gitRepo);
        } else {
          resolvedWorkspacePath = deps.workspace.setExternalWorkspace(params.taskId, params.workspacePath);
        }

        const meta = {
          sessionId: params.taskId,
          taskId: params.taskId,
          intent: params.intent,
          workspacePath: resolvedWorkspacePath,
          runtimeMode: params.runtimeMode,
          gitRepo: params.gitRepo || undefined,
          stepIndex: 0,
          activeStage: "intent",
          notes: params.notes || "",
          todoAnswers: params.todoAnswers || {},
          initialPrompts: params.initialPrompts || {},
          codeConfirmed: false,
          fixApproved: false,
          releaseApproved: false,
          qualityPassed: false,
          createdAt: now,
          updatedAt: now,
          status: "active",
          stepSummaries: {},
        } satisfies import("./SessionStore").SessionMeta;
        deps.sessionStore.saveMeta(meta);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Init failed" }));
      }
    });
    return true;
  }

  // ── 读取会话元信息（HTTP 替代 WebSocket） ──
  if (req.method === "GET" && req.url?.startsWith("/session/meta")) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const sessionId = url.searchParams.get("sessionId");
    if (!sessionId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing 'sessionId' query parameter" }));
      return true;
    }
    try {
      const meta = deps.sessionStore.loadMeta(sessionId);
      if (!meta) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Session not found" }));
        return true;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ meta }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Load meta failed" }));
    }
    return true;
  }

  // ── 保存会话元信息（HTTP 替代 WebSocket） ──
  if (req.method === "POST" && req.url === "/session/save-meta") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        const meta = JSON.parse(body) as import("./SessionStore").SessionMeta;
        deps.sessionStore.saveMeta(meta);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Save meta failed" }));
      }
    });
    return true;
  }

  // ── 保存步骤会话快照（HTTP 替代 WebSocket session.saveStep） ──
  if (req.method === "POST" && req.url === "/session/save-step") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        const { sessionId, stepId, snapshot } = JSON.parse(body) as {
          sessionId: string;
          stepId: string;
          snapshot: import("./SessionStore").StepSessionSnapshot;
        };
        deps.sessionStore.saveStep(sessionId, stepId, snapshot);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Save step failed" }));
      }
    });
    return true;
  }

  // ── 读取步骤会话快照（HTTP 替代 WebSocket session.loadStep） ──
  if (req.method === "GET" && req.url?.startsWith("/step-snapshot")) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const sessionId = url.searchParams.get("sessionId");
    const stepId = url.searchParams.get("stepId");
    if (!sessionId || !stepId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing 'sessionId' or 'stepId' query parameter" }));
      return true;
    }
    try {
      const snapshot = deps.sessionStore.loadStep(sessionId, stepId);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ snapshot }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Load failed" }));
    }
    return true;
  }

  // 获取按文件拆分的 git diff（必须放在 /repo-diff 之前，避免路由被先匹配）
  if (req.method === "GET" && req.url?.startsWith("/repo-diff-files")) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const projectPath = url.searchParams.get("path");
    const taskId = url.searchParams.get("taskId");
    let resolvedPath = projectPath;
    if (!resolvedPath && taskId) {
      resolvedPath = deps.workspace.getRepoDir(taskId);
    }
    if (!resolvedPath) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing 'path' or 'taskId' query parameter" }));
      return true;
    }
    try {
      const result = getRepoDiffFiles(resolvedPath);
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
    const taskId = url.searchParams.get("taskId");
    let resolvedPath = projectPath;
    if (!resolvedPath && taskId) {
      resolvedPath = deps.workspace.getRepoDir(taskId);
    }
    if (!resolvedPath) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing 'path' or 'taskId' query parameter" }));
      return true;
    }
    try {
      const diff = getRepoDiff(resolvedPath);
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
    const taskId = url.searchParams.get("taskId");
    console.log("[project-build] path=%s command=%s taskId=%s", projectPath, customCommand, taskId);

    // 云端模式：优先使用 taskId 解析 workspace repo 路径
    let resolvedPath = projectPath;
    if (!resolvedPath && taskId) {
      resolvedPath = deps.workspace.getRepoDir(taskId);
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

      const output = execCommand(command, resolvedPath);
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

  // ── 读取文件内容（供前端 fetchResultFile 使用） ──
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

  // ── QA 质量审查：执行本地 CLI 命令并 SSE 流式输出 ──
  if (req.method === "GET" && req.url?.startsWith("/qa-review")) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const projectPath = url.searchParams.get("path");
    const sessionId = url.searchParams.get("sessionId");
    const taskId = url.searchParams.get("taskId");

    let resolvedPath = projectPath;
    if (!resolvedPath && taskId) {
      resolvedPath = deps.workspace.getRepoDir(taskId);
    }
    if (!resolvedPath || !sessionId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing 'path'/'taskId' or 'sessionId' query parameter" }));
      return true;
    }

    // 构建输出目录
    const outputDir = path.join(
      process.env.HOME || process.env.USERPROFILE || "~",
      ".aiNativeDevPlatform",
      "sessions",
      sessionId,
    );

    // 确保输出目录存在
    try {
      fs.mkdirSync(outputDir, { recursive: true });
    } catch {
      // ignore
    }

    const outputFile = path.join(outputDir, "quality_result.toml");

    // SSE 响应头
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    // 发送初始事件
    res.write(`data: ${JSON.stringify({ type: "start", message: "QA 审查开始执行...", outputFile })}\n\n`);

    const cliCommand = `qa-review --output ${outputFile}`;

    // 在项目目录下执行 CLI 命令
    const child = spawn("sh", ["-c", cliCommand], {
      cwd: resolvedPath,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });

    let fullOutput = "";

    child.stdout.on("data", (data: Buffer) => {
      const text = data.toString();
      fullOutput += text;
      // 逐行发送
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
      // 尝试读取结果文件
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

    // 客户端断开连接时终止子进程
    req.on("close", () => {
      child.kill();
    });

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
