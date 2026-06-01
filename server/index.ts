import http from "http";
import path from "path";
import fs from "fs";
import { WebSocketServer, type WebSocket } from "ws";
import { AgentRunner } from "./AgentRunner";
import { SessionPool } from "./SessionPool";
import { SummaryStore } from "./SummaryStore";
import { WorkspaceManager } from "./WorkspaceManager";
import { SessionStore } from "./SessionStore";
import { resolveQuestion, continueQuestion } from "./customTools";
import type { WsMessage, AgentEvent } from "./protocol";

const PORT = parseInt(process.env.AGENT_PORT || "3100", 10);

// ── 初始化核心组件 ──────────────────────────
const runner = new AgentRunner("./server/models.json");
const pool = new SessionPool();
const summaryStore = new SummaryStore();
const workspace = new WorkspaceManager("./server/workspaces");
const sessionStore = new SessionStore();

const server = http.createServer((req, res) => {
  // 健康检查端点（前端连通性验证）
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", timestamp: Date.now() }));
    return;
  }

  // 读取指定项目路径下的 specs 目录内容
  if (req.method === "GET" && req.url?.startsWith("/specs-tree")) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const projectPath = url.searchParams.get("path");
    if (!projectPath) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing 'path' query parameter" }));
      return;
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
    return;
  }

  // 读取 specs 目录下某个文件的内容
  if (req.method === "GET" && req.url?.startsWith("/specs-file")) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const projectPath = url.searchParams.get("path");
    const filePath = url.searchParams.get("file");
    if (!projectPath || !filePath) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing 'path' or 'file' query parameter" }));
      return;
    }
    // 安全校验：防止路径穿越
    const fullPath = path.resolve(projectPath, "specs", filePath);
    if (!fullPath.startsWith(path.resolve(projectPath, "specs"))) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Forbidden" }));
      return;
    }
    try {
      const content = fs.readFileSync(fullPath, "utf-8");
      const isMarkdown = /\.md$/i.test(filePath);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ content, isMarkdown }));
    } catch {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "File not found" }));
    }
    return;
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
        // 安全校验：防止路径穿越
        const fullPath = path.resolve(projectPath, "specs", filePath);
        if (!fullPath.startsWith(path.resolve(projectPath, "specs"))) {
          res.writeHead(403, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Forbidden" }));
          return;
        }
        // 确保父目录存在
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(fullPath, content, "utf-8");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Save failed" }));
      }
    });
    return;
  }

  // 读取项目仓库目录树（排除 specs 目录）
  if (req.method === "GET" && req.url?.startsWith("/repo-tree")) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const projectPath = url.searchParams.get("path");
    if (!projectPath) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing 'path' query parameter" }));
      return;
    }
    try {
      if (!fs.existsSync(projectPath)) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify([]));
        return;
      }
      const result = readRepoTree(projectPath);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (err) {
      console.error("repo-tree error:", err);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify([]));
    }
    return;
  }

  // 读取仓库中某个文件的内容
  if (req.method === "GET" && req.url?.startsWith("/repo-file")) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const projectPath = url.searchParams.get("path");
    const filePath = url.searchParams.get("file");
    if (!projectPath || !filePath) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing 'path' or 'file' query parameter" }));
      return;
    }
    // 安全校验：防止路径穿越
    const fullPath = path.resolve(projectPath, filePath);
    if (!fullPath.startsWith(path.resolve(projectPath))) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Forbidden" }));
      return;
    }
    try {
      const content = fs.readFileSync(fullPath, "utf-8");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ content }));
    } catch {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "File not found" }));
    }
    return;
  }

  // 获取仓库 git diff（当前工作区变更）
  if (req.method === "GET" && req.url?.startsWith("/repo-diff")) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const projectPath = url.searchParams.get("path");
    if (!projectPath) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing 'path' query parameter" }));
      return;
    }
    try {
      const { execSync } = require("child_process");
      const fs = require("fs");
      const path = require("path");

      // 检查目录是否存在
      if (!fs.existsSync(projectPath)) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ diff: "// 目录不存在" }));
        return;
      }

      // 检查是否为 git 仓库
      const gitDir = path.join(projectPath, ".git");
      if (!fs.existsSync(gitDir)) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ diff: "// 当前目录不是 Git 仓库，无法显示 Diff" }));
        return;
      }

      // 检查是否有提交记录（git diff HEAD 需要至少一个 commit）
      try {
        execSync("git rev-parse HEAD", { cwd: projectPath, encoding: "utf-8", stdio: "pipe" });
      } catch {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ diff: "// Git 仓库暂无提交记录" }));
        return;
      }

      const diffOutput = execSync("git diff HEAD", { cwd: projectPath, encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
      const stagedOutput = execSync("git diff --cached", { cwd: projectPath, encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
      const combined = [diffOutput, stagedOutput].filter(Boolean).join("\n");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ diff: combined || "No changes" }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Git diff failed" }));
    }
    return;
  }

  // 项目编译（自动检测 build 命令并执行）
  if (req.method === "GET" && req.url?.startsWith("/project-build")) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const projectPath = url.searchParams.get("path");
    if (!projectPath) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing 'path' query parameter" }));
      return;
    }
    try {
      const { execSync } = require("child_process");
      const fs = require("fs");
      const path = require("path");

      // 检查目录是否存在
      if (!fs.existsSync(projectPath)) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, output: "// 目录不存在", command: "" }));
        return;
      }

      // 自动检测 build 命令
      const pkgPath = path.join(projectPath, "package.json");
      let command = "npm run build";
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
          const scripts = pkg.scripts || {};
          if (scripts.build) {
            command = `npm run build`;
          } else if (scripts.compile) {
            command = `npm run compile`;
          } else if (scripts.tsc) {
            command = `npm run tsc`;
          }
        } catch {
          // 使用默认命令
        }
      }

      // 执行编译
      const output = execSync(command, {
        cwd: projectPath,
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
        stdio: ["pipe", "pipe", "pipe"],
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, output, command }));
    } catch (err: any) {
      // 编译失败（非零退出码）
      const output = err.stdout || err.stderr || err.message || "";
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        success: false,
        output: output,
        command: err.cmd || "npm run build",
      }));
    }
    return;
  }

  // 其他 HTTP 请求返回 404
  res.writeHead(404);
  res.end();
});

/** 递归读取目录结构，返回 { name, type, children? }[] */
function readSpecsTree(dir: string): Array<{ name: string; type: "file" | "folder"; children?: any[] }> {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const result: Array<{ name: string; type: "file" | "folder"; children?: any[] }> = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue; // 忽略隐藏文件
    if (entry.isDirectory()) {
      const children = readSpecsTree(path.join(dir, entry.name));
      result.push({ name: entry.name, type: "folder", children });
    } else if (entry.isFile()) {
      result.push({ name: entry.name, type: "file" });
    }
  }
  return result;
}

/** 递归读取项目仓库目录树（排除 specs 目录、.git、node_modules、隐藏文件） */
function readRepoTree(dir: string): Array<{ name: string; type: "file" | "folder"; children?: any[] }> {
  try {
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const result: Array<{ name: string; type: "file" | "folder"; children?: any[] }> = [];
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue; // 忽略隐藏文件
      if (entry.name === "node_modules") continue;
      if (entry.name === "specs") continue; // 排除 specs 目录
      if (entry.isDirectory()) {
        const children = readRepoTree(path.join(dir, entry.name));
        result.push({ name: entry.name, type: "folder", children });
      } else if (entry.isFile()) {
        result.push({ name: entry.name, type: "file" });
      }
    }
    return result;
  } catch {
    return [];
  }
}
const wss = new WebSocketServer({ server, path: "/agent" });

console.log("Agent Server starting...");
console.log(`  Model provider: DeepSeek (via DEEPSEEK_API_KEY)`);
console.log(`  Port: ${PORT}`);

// ── 总结 Prompt 构建 ───────────────────────
/** 构造总结 Agent 的 prompt（与前端 buildSummarizationPrompt 一致） */
function buildSummarizationPrompt(summary: string): string {
  return `你是一个任务总结专家。请严格基于下面的 Agent 工作摘要，生成结构化总结。

要求：
1. 忠于原文，不添加原文中没有的内容，不自由发挥
2. 仅输出 JSON，不要有任何额外说明文字

输出 JSON schema：
{
  "brief": "核心总结，不超过200字",
  "key_points": [
    { "title": "要点概要，不超过50字", "summary": "要点内容，不超过200字" }
  ],
  "todos": [
    {
      "task": "需要用户决策或讨论的问题",
      "type": "choice" | "fill",
      "multiSelect": true/false,
      "choices": [{ "option": "选项名", "description": "选项描述" }],
      "placeholder": "填空题占位文本"
    }
  ]
}

注意：
- key_points 数量不限，提取核心要点
- todos 为待决策事项，字段必填，且type字段必填
- 若无待决策问题，则type为choice，且仅包含一个选项:需求已明确，进入下一阶段
- 必须包含type字段，并且仅支持choice 和fill 两种类型
- type=choice 时 choices 必填，type=fill 时 choices 可为空数组、placeholder 必填
- multiSelect 仅 type=choice 时有效，默认 false
- type=choice 时，必须包含一个选项:需求已明确，进入下一阶段
- brief 使用中文

以下是 Agent 工作摘要：
---
${summary}
---`;
}

// ── SDK 事件映射 ────────────────────────────
/** 从 AgentToolResult 的 content 数组中提取文本 */
function extractTextFromContent(result: Record<string, unknown> | undefined): string {
  if (!result?.content) return "";
  const content = result.content as Array<{ type: string; text?: string }>;
  return content
    .filter((c) => c.type === "text")
    .map((c) => c.text || "")
    .join("");
}

/** 从 AgentMessage[] 中提取最后一条 assistant 消息的文本 */
function extractAgentSummary(messages: unknown): string {
  if (!Array.isArray(messages)) return "";
  // 倒序查找最后一条 assistant 消息
  const lastAssistant = [...messages].reverse().find(
    (m: Record<string, unknown>) => m.role === "assistant",
  ) as Record<string, unknown> | undefined;
  if (!lastAssistant?.content) return "";
  if (typeof lastAssistant.content === "string") {
    return lastAssistant.content;
  }
  if (Array.isArray(lastAssistant.content)) {
    return (lastAssistant.content as Array<{ type: string; text?: string }>)
      .filter((c) => c.type === "text")
      .map((c) => c.text || "")
      .join("");
  }
  return "";
}

/**
 * 确保 session 的事件订阅指向当前 WebSocket 连接。
 * WebSocket 重连后，旧的订阅会失效，需要重新注册。
 */
function ensureSubscription(
  pool: SessionPool,
  taskId: string,
  step: string,
  ws: WebSocket,
  msgId: string,
): void {
  // 先取消旧的订阅
  pool.clearUnsub(taskId, step);
  // 重新注册
  const session = pool.get(taskId, step);
  if (!session) return;
  const unsub = session.subscribe((sdkEvent) => {
    const event = mapSdkEvent(sdkEvent);
    if (!event) return;
    ws.send(JSON.stringify({ type: "event", id: msgId, event }));
  });
  pool.setUnsub(taskId, step, unsub);
}

function mapSdkEvent(raw: unknown): AgentEvent | null {
  const e = raw as Record<string, unknown>;

  // 基于 SDK AgentSessionEvent 的 type 字段映射
  const type = e.type as string | undefined;

  switch (type) {
    // ── message_update 解包 ──
    case "message_update": {
      const ame = (e.assistantMessageEvent as Record<string, unknown>) || {};
      const ameType = ame.type as string;
      if (ameType === "text_delta") {
        return { type: "text_delta", delta: (ame.delta as string) || "" };
      }
      if (ameType === "thinking_delta") {
        return { type: "thinking_delta", delta: (ame.delta as string) || "" };
      }
      // 忽略其他子类型（text_start/end, thinking_start/end, toolcall_*, start, done, error）
      return null;
    }

    // ── 工具调用 ──
    case "tool_execution_start":
      return {
        type: "tool_execution_start",
        toolName: (e.toolName as string) || "",
        toolCallId: (e.toolCallId as string) || "",
        input: e.args ? JSON.stringify(e.args) : "{}",
      };

    case "tool_execution_update": {
      const partialResult = e.partialResult as Record<string, unknown> | undefined;
      return {
        type: "tool_execution_update",
        toolCallId: (e.toolCallId as string) || "",
        output: extractTextFromContent(partialResult),
      };
    }

    case "tool_execution_end": {
      const result = e.result as Record<string, unknown> | undefined;
      return {
        type: "tool_execution_end",
        toolCallId: (e.toolCallId as string) || "",
        result: extractTextFromContent(result),
        isError: (e.isError as boolean) || false,
      };
    }

    // ── 会话生命周期 ──
    case "message_start":
    case "message_end":
    case "agent_start":
    case "turn_start":
    case "turn_end":
      return { type };

    case "agent_end":
      return {
        type: "agent_end",
        summary: extractAgentSummary(e.messages),
      };

    case "error":
      return { type: "error", message: (e.message as string) || "Unknown error" };

    case "queue_update":
      return {
        type: "queue_update",
        steering: Array.isArray(e.steering) ? (e.steering as string[]) : [],
        followUp: Array.isArray(e.followUp) ? (e.followUp as string[]) : [],
      };

    case "compaction_start":
    case "compaction_end":
    case "auto_retry_start":
    case "auto_retry_end":
      return { type };

    default:
      // 未知事件丢弃（不再兜底为空 text_delta）
      return null;
  }
}

// ── WebSocket 连接处理 ──────────────────────
wss.on("connection", (ws: WebSocket) => {
  console.log("[ws] Client connected");

  ws.on("message", async (raw) => {
    let msg: WsMessage;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    // ── 心跳 ping/pong ──────────────────
    if (msg.type === "ping") {
      ws.send(JSON.stringify({ type: "pong", ts: msg.ts }));
      return;
    }

    if (msg.type !== "request") return;

    try {
      switch (msg.method as string) {
        // ── Session 管理 ────────────────────
        case "session.create": {
          const { taskId, step } = msg.params as {
            taskId: string;
            step: string;
            intent?: string;
            workspacePath?: string;
          };
          const intent = (msg.params as { intent?: string }).intent || "";
          const extPath = (msg.params as { workspacePath?: string }).workspacePath;
          let workspaceDir: string;
          if (extPath) {
            workspaceDir = workspace.setExternalWorkspace(taskId, extPath);
          } else {
            workspaceDir = workspace.initWorkspace(taskId, intent);
          }
          const session = await runner.createSession(taskId, step, workspaceDir);
          pool.set(taskId, step, session);

          // 订阅 SDK 事件 → 前端
          const unsub = session.subscribe((sdkEvent) => {
            const event = mapSdkEvent(sdkEvent);
            if (!event) return; // 跳过不需要转发的事件
            ws.send(JSON.stringify({ type: "event", id: msg.id, event }));
          });
          pool.setUnsub(taskId, step, unsub);

          ws.send(
            JSON.stringify({
              type: "response",
              id: msg.id,
              result: { sessionId: session.sessionId },
            }),
          );
          break;
        }

        case "session.prompt": {
          const { taskId, step, text } = msg.params as {
            taskId: string;
            step: string;
            text: string;
          };
          console.log("[session.prompt] userPrompt=%.20s systemPrompt=N/A step=%s", text.slice(0, 20), step);
          const session = pool.get(taskId, step);
          if (!session) throw new Error(`Session not found: ${taskId}:${step}`);

          // WebSocket 可能已重连，重新注册订阅确保事件能转发到当前连接
          ensureSubscription(pool, taskId, step, ws, msg.id);

          await session.prompt(text);
          ws.send(JSON.stringify({ type: "response", id: msg.id, result: {} }));
          break;
        }

        case "session.steer": {
          const { taskId, step, text } = msg.params as {
            taskId: string;
            step: string;
            text: string;
          };
          console.log("[session.steer] userPrompt=%.20s systemPrompt=N/A step=%s", text.slice(0, 20), step);
          let session = pool.get(taskId, step);
          if (!session) {
            // 自动创建 session（从历史恢复后首次 steer）
            const intent = (msg.params as { intent?: string }).intent || "";
            const extPath = (msg.params as { workspacePath?: string }).workspacePath;
            let workspaceDir: string;
            if (extPath) {
              workspaceDir = workspace.setExternalWorkspace(taskId, extPath);
            } else {
              workspaceDir = workspace.initWorkspace(taskId, intent);
            }
            session = await runner.createSession(taskId, step, workspaceDir);
            pool.set(taskId, step, session);
          }

          // WebSocket 可能已重连，重新注册订阅确保事件能转发到当前连接
          ensureSubscription(pool, taskId, step, ws, msg.id);

          // 关键修复：session.steer() 仅入队，不触发模型执行。
          // 当 agent 空闲时，入队的消息永远不会被处理。
          // 因此：streaming 中 → 用 steer() 入队中断；空闲时 → 用 prompt() 直接触发新轮次。
          console.log(`[session.steer] isStreaming=${session.isStreaming} step=${step} text=%.20s`, text.slice(0, 20));
          if (session.isStreaming) {
            console.log(`[session.steer] → steer() (queue during streaming)`);
            session.steer(text);
          } else {
            console.log(`[session.steer] → prompt() (idle, start new run)`);
            try {
              await session.prompt(text);
              console.log(`[session.steer] prompt() completed successfully`);
            } catch (err) {
              console.error(`[session.steer] prompt() FAILED:`, err);
            }
          }

          ws.send(JSON.stringify({ type: "response", id: msg.id, result: {} }));
          break;
        }

        case "session.followUp": {
          const { taskId, step, text } = msg.params as {
            taskId: string;
            step: string;
            text: string;
          };
          let session = pool.get(taskId, step);
          if (!session) {
            // 自动创建 session（从历史恢复后首次 followUp）
            const intent = (msg.params as { intent?: string }).intent || "";
            const extPath = (msg.params as { workspacePath?: string }).workspacePath;
            let workspaceDir: string;
            if (extPath) {
              workspaceDir = workspace.setExternalWorkspace(taskId, extPath);
            } else {
              workspaceDir = workspace.initWorkspace(taskId, intent);
            }
            session = await runner.createSession(taskId, step, workspaceDir);
            pool.set(taskId, step, session);
          }

          // WebSocket 可能已重连，重新注册订阅确保事件能转发到当前连接
          ensureSubscription(pool, taskId, step, ws, msg.id);

          // 同 steer：followUp() 仅入队，空闲时需用 prompt() 触发执行
          console.log(`[session.followUp] isStreaming=${session.isStreaming} step=${step} text=%.20s`, text.slice(0, 20));
          if (session.isStreaming) {
            console.log(`[session.followUp] → followUp() (queue during streaming)`);
            session.followUp(text);
          } else {
            console.log(`[session.followUp] → prompt() (idle, start new run)`);
            try {
              await session.prompt(text);
              console.log(`[session.followUp] prompt() completed successfully`);
            } catch (err) {
              console.error(`[session.followUp] prompt() FAILED:`, err);
            }
          }
          ws.send(JSON.stringify({ type: "response", id: msg.id, result: {} }));
          break;
        }

        case "session.abort": {
          const { taskId, step } = msg.params as {
            taskId: string;
            step: string;
          };
          const session = pool.get(taskId, step);
          if (!session) throw new Error(`Session not found: ${taskId}:${step}`);
          session.abort();
          ws.send(JSON.stringify({ type: "response", id: msg.id, result: {} }));
          break;
        }

        case "session.dispose": {
          const { taskId, step } = msg.params as {
            taskId: string;
            step: string;
          };
          pool.dispose(taskId, step);
          ws.send(JSON.stringify({ type: "response", id: msg.id, result: {} }));
          break;
        }

        // ── 重试整个 Agent 流程 ──────────────
        case "session.retry": {
          const { taskId, step, text, initialPrompt } = msg.params as {
            taskId: string;
            step: string;
            text: string;
            initialPrompt?: string;
          };
          console.log("[session.retry] systemPromptOverride=%.20s initialPrompt=%.20s step=%s", text.slice(0, 20), (initialPrompt || "").slice(0, 20), step);
          // 1. 销毁旧 session
          pool.dispose(taskId, step);
          // 2. 重新创建 session，用用户提示词替换系统提示词
          const intent = (msg.params as { intent?: string }).intent || "";
          const extPath = (msg.params as { workspacePath?: string }).workspacePath;
          let workspaceDir: string;
          if (extPath) {
            workspaceDir = workspace.setExternalWorkspace(taskId, extPath);
          } else {
            workspaceDir = workspace.initWorkspace(taskId, intent);
          }
          const newSession = await runner.createSession(taskId, step, workspaceDir, text);
          pool.set(taskId, step, newSession);

          const unsub = newSession.subscribe((sdkEvent) => {
            const event = mapSdkEvent(sdkEvent);
            if (!event) return;
            ws.send(JSON.stringify({ type: "event", id: msg.id, event }));
          });
          pool.setUnsub(taskId, step, unsub);

          // 3. 发响应（前端准备接收事件）
          ws.send(
            JSON.stringify({
              type: "response",
              id: msg.id,
              result: { sessionId: newSession.sessionId },
            }),
          );

          // 4. 发送初始 user prompt（复用步骤原本的提示词）
          if (initialPrompt) {
            await newSession.prompt(initialPrompt);
          }
          break;
        }

        // ── 用户回答问题 ────────────────────
        case "session.answerQuestion": {
          const { taskId, step, answer } = msg.params as {
            taskId: string;
            step: string;
            answer: string;
          };
          const resolved = resolveQuestion(taskId, step, answer);
          if (!resolved) {
            throw new Error(`No pending question for ${taskId}:${step}`);
          }
          ws.send(JSON.stringify({ type: "response", id: msg.id, result: {} }));
          break;
        }

        // ── 用户点击"继续"（回答后手动触发）──
        case "session.continueQuestion": {
          const { taskId, step } = msg.params as {
            taskId: string;
            step: string;
          };
          const continued = continueQuestion(taskId, step);
          if (!continued) {
            throw new Error(`No answered question to continue for ${taskId}:${step}`);
          }
          ws.send(JSON.stringify({ type: "response", id: msg.id, result: {} }));
          break;
        }

        // ── 总结独立链路 ──────────────────
        case "summarization.save": {
          const { taskId, step, summary } = msg.params as {
            taskId: string;
            step: string;
            summary: string;
          };
          summaryStore.set(taskId, step, summary);
          ws.send(JSON.stringify({ type: "response", id: msg.id, result: {} }));
          break;
        }

        case "summarization.trigger": {
          const { taskId, step } = msg.params as {
            taskId: string;
            step: string;
          };
          const saved = summaryStore.get(taskId, step);
          if (!saved) {
            throw new Error(`No summary saved for ${taskId}:${step}`);
          }
          const workspaceDir = workspace.getDir(taskId);
          const session = await runner.createSummarizationSession(workspaceDir);

          // 监听 agent_end，完成后自动清理
          const unsub = session.subscribe((sdkEvent) => {
            const event = mapSdkEvent(sdkEvent);
            if (!event) return;
            ws.send(JSON.stringify({ type: "event", id: msg.id, event }));

            // 总结完成 → 清理 session
            if (event.type === "agent_end") {
              unsub();
              session.dispose();
              summaryStore.delete(taskId, step);
            }
          });

          // 先发响应（前端准备接收事件）
          ws.send(
            JSON.stringify({
              type: "response",
              id: msg.id,
              result: { sessionId: session.sessionId },
            }),
          );

          // 发送总结 prompt
          const promptText = buildSummarizationPrompt(saved);
          console.log("[summarization.trigger] userPrompt=%.20s", promptText.slice(0, 20));
          await session.prompt(promptText);
          break;
        }

        // ── 项目编译 ──────────────────────
        case "build.save": {
          const { sessionId, stepId, buildResult } = msg.params as {
            sessionId: string;
            stepId: string;
            buildResult: Record<string, unknown>;
          };
          // 将编译结果保存到 step 文件中
          const existing = sessionStore.loadStep(sessionId, stepId) || {
            messages: [],
            turns: [],
            summary: "",
          };
          (existing as any).buildResult = buildResult;
          sessionStore.saveStep(sessionId, stepId, existing);
          ws.send(JSON.stringify({ type: "response", id: msg.id, result: {} }));
          break;
        }

        case "build.fix": {
          const { taskId, step, sessionId, buildOutput, workspacePath } = msg.params as {
            taskId: string;
            step: string;
            sessionId: string;
            buildOutput: string;
            workspacePath?: string;
          };
          // 创建修复 session（复用 coding 步骤配置）
          let workspaceDir: string;
          if (workspacePath) {
            workspaceDir = workspace.setExternalWorkspace(taskId, workspacePath);
          } else {
            workspaceDir = workspace.getDir(taskId);
          }
          const fixSession = await runner.createSession(taskId, step, workspaceDir);

          // 订阅事件转发到前端
          const unsub = fixSession.subscribe((sdkEvent) => {
            const event = mapSdkEvent(sdkEvent);
            if (!event) return;
            ws.send(JSON.stringify({ type: "event", id: msg.id, event }));
          });

          ws.send(
            JSON.stringify({
              type: "response",
              id: msg.id,
              result: { sessionId: fixSession.sessionId },
            }),
          );

          // 发送修复 prompt
          const fixPrompt = `项目编译失败，请修复以下编译错误：\n\n\`\`\`\n${buildOutput.slice(0, 5000)}\n\`\`\`\n\n请分析错误原因并修复代码。修复完成后，项目应该能成功编译。`;
          await fixSession.prompt(fixPrompt);
          break;
        }

        // ── Workspace 操作 ──────────────────
        case "workspace.tree": {
          const { taskId } = msg.params as { taskId: string };
          const tree = workspace.getFileTree(taskId);
          ws.send(
            JSON.stringify({ type: "response", id: msg.id, result: { tree } }),
          );
          break;
        }

        case "workspace.readFile": {
          const { taskId, filePath } = msg.params as {
            taskId: string;
            filePath: string;
          };
          const content = workspace.readFile(taskId, filePath);
          ws.send(
            JSON.stringify({ type: "response", id: msg.id, result: { content } }),
          );
          break;
        }

        case "workspace.browse": {
          const { dirPath } = msg.params as { dirPath: string };
          const entries = workspace.browseDir(dirPath || "/");
          ws.send(
            JSON.stringify({ type: "response", id: msg.id, result: { entries } }),
          );
          break;
        }

        // ── 会话记录 ──────────────────────
        case "session.saveRecord": {
          const record = msg.params as Record<string, unknown>;
          sessionStore.save(record as import("./SessionStore").SessionRecord);
          ws.send(JSON.stringify({ type: "response", id: msg.id, result: {} }));
          break;
        }

        case "session.loadRecord": {
          const { sessionId } = msg.params as { sessionId: string };
          const record = sessionStore.load(sessionId);
          ws.send(JSON.stringify({ type: "response", id: msg.id, result: { record } }));
          break;
        }

        case "session.listRecords": {
          const records = sessionStore.list();
          ws.send(JSON.stringify({ type: "response", id: msg.id, result: { records } }));
          break;
        }

        case "session.deleteRecord": {
          const { sessionId } = msg.params as { sessionId: string };
          sessionStore.delete(sessionId);
          ws.send(JSON.stringify({ type: "response", id: msg.id, result: {} }));
          break;
        }

        // ── 按步骤独立存储 ────────────────
        case "session.saveStep": {
          const { sessionId, stepId, snapshot } = msg.params as {
            sessionId: string;
            stepId: string;
            snapshot: import("./SessionStore").StepSessionSnapshot;
          };
          sessionStore.saveStep(sessionId, stepId, snapshot);
          ws.send(JSON.stringify({ type: "response", id: msg.id, result: {} }));
          break;
        }

        case "session.loadStep": {
          const { sessionId, stepId } = msg.params as {
            sessionId: string;
            stepId: string;
          };
          const snapshot = sessionStore.loadStep(sessionId, stepId);
          ws.send(JSON.stringify({ type: "response", id: msg.id, result: { snapshot } }));
          break;
        }

        case "session.saveMeta": {
          const meta = msg.params as Record<string, unknown>;
          sessionStore.saveMeta(meta as import("./SessionStore").SessionMeta);
          ws.send(JSON.stringify({ type: "response", id: msg.id, result: {} }));
          break;
        }

        case "session.loadMeta": {
          const { sessionId } = msg.params as { sessionId: string };
          const meta = sessionStore.loadMeta(sessionId);
          ws.send(JSON.stringify({ type: "response", id: msg.id, result: { meta } }));
          break;
        }

        default:
          throw new Error(`Unknown method: ${msg.method}`);
      }
    } catch (err) {
      console.error("[ws] Error:", err);
      ws.send(
        JSON.stringify({
          type: "error",
          id: msg.id,
          error: {
            code: "INTERNAL",
            message: err instanceof Error ? err.message : String(err),
          },
        }),
      );
    }
  });

  ws.on("close", () => {
    console.log("[ws] Client disconnected");
  });
});

// ── 启动服务 ────────────────────────────────
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Agent Server listening on ws://0.0.0.0:${PORT}/agent`);
  console.log(`  Health check: http://0.0.0.0:${PORT}/health`);
});
