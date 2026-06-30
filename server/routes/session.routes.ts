import http from "http";
import { getRepoDiff, getRepoDiffFiles } from "../utils/gitOps.js";
import type { SessionStore } from "../SessionStore.js";
import type { WorkspaceManager } from "../WorkspaceManager.js";
import type { RollbackManager } from "../RollbackManager.js";
import type { SessionPool } from "../SessionPool.js";

const PORT = parseInt(process.env.AGENT_PORT || "3100", 10);

/**
 * Session 相关路由
 */
export function handleSessionRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  deps: { sessionStore: SessionStore; workspace: WorkspaceManager; rollback: RollbackManager; pool: SessionPool },
): boolean {
  const { sessionStore, workspace, rollback, pool } = deps;

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

        if (!isCloud) {
          try {
            rollback.ensureBaseline(params.taskId, resolvedWorkspacePath);
          } catch (err) {
            console.warn("[rollback] baseline unavailable:", err instanceof Error ? err.message : err);
          }
        }

        const meta = {
          sessionId: params.taskId,
          taskId: params.taskId,
          intent: params.intent,
          workspacePath: resolvedWorkspacePath,
          runtimeMode: params.runtimeMode,
          deliveryConfig: params.deliveryConfig || undefined,
          gitRepo: params.gitRepo || undefined,
          localGit: params.localGit || undefined,
          stepIndex: 0,
          activeStage: "intent",
          notes: params.notes || "",
          todoAnswers: params.todoAnswers || {},
          initialPrompts: params.initialPrompts || {},
          codeConfirmed: false,
          fixApproved: false,
          releaseApproved: false,
          qualityPassed: false,
          prototype: {
            mode: "none",
            status: "pending",
            htmlPath: "",
            handoffPath: "",
          },
          createdAt: now,
          updatedAt: now,
          status: "active",
          stepSummaries: {},
        } satisfies import("../SessionStore.js").SessionMeta;
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

  // 查询任务回退点
  if (req.method === "GET" && req.url?.startsWith("/rollback/status")) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const taskId = url.searchParams.get("taskId");
    if (!taskId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing 'taskId' query parameter" }));
      return true;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(rollback.getStatus(taskId)));
    return true;
  }

  // 按轮次、文件或整个任务执行回退
  if (req.method === "POST" && req.url === "/rollback/apply") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        const params = JSON.parse(body) as {
          taskId: string;
          type: "round" | "file" | "task";
          checkpointId?: string;
          filePath?: string;
        };
        if (!params.taskId) throw new Error("缺少 taskId");
        if (pool.isTaskStreaming(params.taskId)) throw new Error("Agent 正在执行，请先停止当前任务再回退");
        if (params.type === "round") {
          if (!params.checkpointId) throw new Error("缺少 checkpointId");
          rollback.rollbackRound(params.taskId, params.checkpointId);
        } else if (params.type === "file") {
          if (!params.filePath) throw new Error("缺少 filePath");
          rollback.rollbackFile(params.taskId, params.filePath);
        } else if (params.type === "task") {
          rollback.rollbackTask(params.taskId);
        } else {
          throw new Error("未知回退类型");
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Rollback failed" }));
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
        const meta = JSON.parse(body) as import("../SessionStore.js").SessionMeta;
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
          snapshot: import("../SessionStore.js").StepSessionSnapshot;
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
      const rollbackStatus = taskId ? rollback.getStatus(taskId) : null;
      const result = taskId && rollbackStatus?.ready
        ? { files: rollback.getDiffFiles(taskId) }
        : getRepoDiffFiles(resolvedPath);
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
