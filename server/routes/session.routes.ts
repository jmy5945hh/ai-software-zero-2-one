import http from "http";
import { getRepoDiff, getRepoDiffFiles } from "../utils/gitOps";
import type { SessionStore } from "../SessionStore";
import type { WorkspaceManager } from "../WorkspaceManager";

const PORT = parseInt(process.env.AGENT_PORT || "3100", 10);

/**
 * Session 相关路由
 */
export function handleSessionRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  deps: { sessionStore: SessionStore; workspace: WorkspaceManager },
): boolean {
  const { sessionStore, workspace } = deps;

  // 初始化任务环境
  if (req.method === "POST" && req.url === "/task/init") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        const params = JSON.parse(body);
        const now = new Date().toISOString();

        const isCloud = params.runtimeMode === "cloud";
        let resolvedWorkspacePath: string;
        if (isCloud) {
          if (!params.gitRepo) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "云端任务需要 gitRepo 参数" }));
            return;
          }
          resolvedWorkspacePath = workspace.initCloudWorkspace(params.taskId, params.gitRepo);
        } else {
          resolvedWorkspacePath = workspace.setExternalWorkspace(params.taskId, params.workspacePath);
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
        } satisfies import("../SessionStore").SessionMeta;
        sessionStore.saveMeta(meta);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Init failed" }));
      }
    });
    return true;
  }

  // 读取会话元信息
  if (req.method === "GET" && req.url?.startsWith("/session/meta")) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const sessionId = url.searchParams.get("sessionId");
    if (!sessionId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing 'sessionId' query parameter" }));
      return true;
    }
    try {
      const meta = sessionStore.loadMeta(sessionId);
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

  // 保存会话元信息
  if (req.method === "POST" && req.url === "/session/save-meta") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        const meta = JSON.parse(body) as import("../SessionStore").SessionMeta;
        sessionStore.saveMeta(meta);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Save meta failed" }));
      }
    });
    return true;
  }

  // 保存步骤会话快照
  if (req.method === "POST" && req.url === "/session/save-step") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        const { sessionId, stepId, snapshot } = JSON.parse(body) as {
          sessionId: string;
          stepId: string;
          snapshot: import("../SessionStore").StepSessionSnapshot;
        };
        sessionStore.saveStep(sessionId, stepId, snapshot);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Save step failed" }));
      }
    });
    return true;
  }

  // 读取步骤会话快照
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
      const snapshot = sessionStore.loadStep(sessionId, stepId);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ snapshot }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Load failed" }));
    }
    return true;
  }

  // 获取按文件拆分的 git diff
  if (req.method === "GET" && req.url?.startsWith("/repo-diff-files")) {
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
      const result = getRepoDiffFiles(resolvedPath);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Git diff failed" }));
    }
    return true;
  }

  // 获取仓库 git diff
  if (req.method === "GET" && req.url?.startsWith("/repo-diff")) {
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
      const diff = getRepoDiff(resolvedPath);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ diff }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Git diff failed" }));
    }
    return true;
  }

  return false;
}
