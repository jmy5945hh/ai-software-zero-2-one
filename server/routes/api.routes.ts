import http from "http";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { SessionPool } from "../SessionPool.js";
import type { SessionStore } from "../SessionStore.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Cloud Runtime REST API 路由
 */
export function handleApiRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  deps: { pool: SessionPool; sessionStore: SessionStore },
): boolean {
  const { pool, sessionStore } = deps;

  if (req.method === "GET" && req.url === "/api/models") {
    const modelsPath = join(__dirname, "..", "models.json");
    const raw = readFileSync(modelsPath, "utf-8");
    const config = JSON.parse(raw);

    // 只返回有 API Key 配置的 provider（环境变量或 models.json 中的 apiKey 字段）
    const filteredProviders: Record<string, unknown> = {};
    for (const [providerKey, provider] of Object.entries(config.providers as Record<string, { apiKey?: string }>)) {
      const envKey = `${providerKey.toUpperCase()}_API_KEY`;
      const hasApiKey = process.env[envKey] || provider.apiKey;
      if (hasApiKey) {
        filteredProviders[providerKey] = provider;
      }
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      defaultModel: config.defaultModel,
      defaultProvider: config.defaultProvider,
      providers: filteredProviders,
    }));
    return true;
  }

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
    const projects = records.map((meta) => {
      const includesPrototype = meta.activeStage === "prototype" || (
        meta.prototype?.mode !== undefined
        && meta.prototype.mode !== "none"
        && meta.prototype.status !== "skipped"
      );
      const stageIds = includesPrototype
        ? ["intent", "prototype", "plan", "coding", "quality", "verify", "release"]
        : ["intent", "plan", "coding", "quality", "verify", "release"];
      const semanticIndex = stageIds.indexOf(meta.activeStage);
      const stepIndex = semanticIndex >= 0 ? semanticIndex : meta.stepIndex;
      return {
        id: meta.sessionId,
        name: meta.intent?.slice(0, 60) || meta.taskId,
        description: meta.intent || "",
        status: meta.status === "completed" ? "completed" : stepIndex >= 3 ? "running" : "building",
        progress: Math.round(((stepIndex + (meta.releaseApproved ? 1 : 0)) / stageIds.length) * 100),
        lastActivity: meta.updatedAt || meta.createdAt,
        toolCallCount: 0,
        fileCount: 0,
      };
    });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(projects));
    return true;
  }

  if (req.method === "POST" && req.url === "/api/projects") {
    const MAX_BODY_SIZE = 1024 * 1024;
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
