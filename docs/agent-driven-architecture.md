# Agent-Driven 平台架构方案

> **目标**：将当前静态 demo 演进为真实可工作的 AI 原生研发平台。
>
> 核心思路：前端 React UI 通过 WebSocket 与本地 Agent 服务通信，Agent 服务使用 Pi Agent SDK + DeepSeek 模型真实驱动每个 SOP 步骤。

---

## 1. 总体架构

```
┌─────────────────────────────────────────────────────────┐
│                    Mac 本地单进程                        │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Vite Dev Server (Node.js)                       │   │
│  │  ┌───────────────┐  ┌─────────────────────────┐  │   │
│  │  │ React SPA     │  │ Agent WebSocket Handler  │  │   │
│  │  │ (Browser)     │  │ (同一 HTTP Server 上)    │  │   │
│  │  │               │  │                         │  │   │
│  │  │ useAgentSession│◄─┤ 管理 AgentSession 实例  │  │   │
│  │  │   ↕ WS        │  │ 转发事件流到前端        │  │   │
│  │  └───────────────┘  └───────────┬─────────────┘  │   │
│  │                                 │                 │   │
│  │                   ┌─────────────┴─────────────┐   │   │
│  │                   │ @earendil-works/           │   │   │
│  │                   │   pi-coding-agent          │   │   │
│  │                   │                            │   │   │
│  │                   │ createAgentSession()       │   │   │
│  │                   │ SessionManager             │   │   │
│  │                   │ DeepSeek via models.json   │   │   │
│  │                   └─────────────┬─────────────┘   │   │
│  │                                 │                 │   │
│  │                   ┌─────────────┴─────────────┐   │   │
│  │                   │ Workspace 文件系统          │   │   │
│  │                   │ server/workspaces/         │   │   │
│  │                   │   cs-2026-0518/            │   │   │
│  │                   │     src/                   │   │   │
│  │                   │     tests/                 │   │   │
│  │                   │     package.json           │   │   │
│  │                   │     AGENTS.md              │   │   │
│  │                   └───────────────────────────┘   │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**为什么单进程？** Vite dev server 本身就是 Node.js，我们可以在启动 Vite 时同时挂载 Agent WebSocket handler，只用一个端口、一个 `npm run dev` 命令。不需要额外的后端进程。

---

## 2. DeepSeek 模型配置

Pi Agent SDK 通过 `models.json` 支持自定义 provider。DeepSeek 是 OpenAI API 兼容的，配置如下：

### 2.1 `server/models.json`

```json
{
  "providers": {
    "deepseek": {
      "baseUrl": "https://api.deepseek.com/v1",
      "api": "openai-completions",
      "apiKey": "sk-e889d3208adc476da5fb04f54f4ed878",
      "models": [
        {
          "id": "deepseek-chat",
          "name": "DeepSeek V3",
          "reasoning": false,
          "input": ["text"],
          "contextWindow": 128000,
          "maxTokens": 8192,
          "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 }
        },
        {
          "id": "deepseek-reasoner",
          "name": "DeepSeek R1",
          "reasoning": true,
          "input": ["text"],
          "contextWindow": 128000,
          "maxTokens": 8192,
          "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },
          "compat": {
            "thinkingFormat": "deepseek"
          }
        }
      ]
    }
  }
}
```

### 2.2 SDK 集成代码

```typescript
import { AuthStorage, createAgentSession, ModelRegistry, SessionManager } from "@earendil-works/pi-coding-agent";

const authStorage = AuthStorage.create(); // 空 auth，models.json 里已有 apiKey
const modelRegistry = ModelRegistry.create(authStorage, "./server/models.json");

const model = modelRegistry.find("deepseek", "deepseek-chat");

const { session } = await createAgentSession({
  model,
  thinkingLevel: "off",
  authStorage,
  modelRegistry,
  tools: ["read", "write", "edit", "bash"],
  cwd: workspaceDir,
  sessionManager: SessionManager.create(workspaceDir),
});
```

---

## 3. 数据流与通信协议

### 3.1 WebSocket 协议

前端通过 WebSocket 连接到 `ws://localhost:{port}/agent`：

```
Client → Server:
  { type: "prompt",   taskId: string, text: string }
  { type: "steer",    taskId: string, text: string }
  { type: "followUp", taskId: string, text: string }
  { type: "abort",    taskId: string }

Server → Client:
  { type: "event",    taskId: string, event: AgentEvent }
  { type: "workspace", taskId: string, fileTree: FileNode[] }
  { type: "task_done", taskId: string }
  { type: "error",    taskId: string, message: string }
```

### 3.2 AgentEvent 类型（统一事件模型）

```typescript
// src/agent/events.ts
type AgentEvent =
  | { type: "text_delta"; delta: string }
  | { type: "thinking_delta"; delta: string }
  | { type: "tool_start"; toolName: string; toolCallId: string; input: unknown }
  | { type: "tool_progress"; toolCallId: string; output: string }
  | { type: "tool_end"; toolCallId: string; isError: boolean }
  | { type: "agent_start" }
  | { type: "agent_end"; messages: unknown[] }
  | { type: "turn_start" }
  | { type: "turn_end" }
  | { type: "error"; message: string };
```

### 3.3 SOP 步骤 → Agent 交互映射

每个 SOP 步骤触发一次 `session.prompt()`，在同一 session 内累积上下文：

```
SOP:  intent  →  scope   →  spec    →  build   →  quality →  verify →  release

      prompt(    prompt(    prompt(    prompt(    prompt(    prompt(   prompt(
      "需求:      "锁定        "生成       "开始        "运行        "修复       "发布
      销售线索"   模块"        Spec"      开发"       质量门禁"   失败项"     交付包"
      )          )           )          )           )          )          )
```

每个步骤的 prompt 是结构化的，包含上一步上下文 + 用户决策 + 本步目标。

---

## 4. 模块划分与实施方案

### 4.1 新目录结构

```
zero-one-software/
├── server/                          # ✨ 新增：Agent 后端（Node.js）
│   ├── index.ts                     # Vite + WebSocket 服务器入口
│   ├── AgentManager.ts              # AgentSession 生命周期管理
│   ├── models.json                  # DeepSeek 模型配置
│   ├── AGENTS.md                    # 全局 Agent 上下文（项目规范）
│   └── workspaces/                  # 任务 Workspace 目录
│       └── cs-2026-0518/            # 单个任务的工作空间
│           ├── AGENTS.md            # 项目级上下文
│           ├── package.json
│           └── src/                 # Agent 代码产出目录
│
├── src/                             # 前端（React，改造部分）
│   ├── agent/                       # ✨ 新增：Agent 通信层
│   │   ├── types.ts                 # AgentEvent, WsMessage 类型
│   │   ├── useAgentSession.ts       # React Hook：订阅事件流
│   │   └── ws.ts                    # WebSocket 客户端
│   │
│   ├── data/                        # 改造
│   │   ├── types.ts                 # 保持不变
│   │   ├── index.ts                 # 
│   │   ├── workflowData.ts          # 简化：移除静态 mock
│   │   ├── taskData.ts              # 保留
│   │   └── stageContent.ts          # 🔥 大幅精简：agent 实时产出替代
│   │
│   ├── components/                  # 改造
│   │   ├── DecisionBoard.tsx        # 接入 useAgentSession
│   │   ├── LeftPanel.tsx            # 文件树从 workspace WS 获取
│   │   ├── StageDecisions.tsx       # 按钮触发 agent prompt
│   │   └── ...
│   │
│   └── styles.css / workspace.css   # 微调
│
├── vite.config.ts                   # 改造：加载 agent plugin
└── package.json                     # 新增依赖：pi-coding-agent, ws
```

### 4.2 分阶段实施

#### Phase 1：基础设施 ← 当前阶段

- [ ] 安装依赖：`@earendil-works/pi-coding-agent`、`ws`
- [ ] 创建 `server/models.json`（DeepSeek 配置）
- [ ] 创建 `server/AGENTS.md`（全局 Agent 上下文）
- [ ] 实现 `server/AgentManager.ts`
  - `getOrCreate(taskId)` → 创建/复用 AgentSession
  - `prompt(taskId, text)` → 调用 `session.prompt()`
  - `steer/followUp/abort`
  - 订阅 SDK 事件，转换为统一 `AgentEvent` 通过 WebSocket 推送
  - 每次工具执行后扫描 workspace 目录，推送文件树
- [ ] 实现 `server/index.ts`
  - 创建 Vite dev server
  - 在 Vite HTTP server 上挂载 WebSocket (`ws://localhost:5173/agent`)
  - 路由 WebSocket 消息到 AgentManager
- [ ] 前端 WebSocket 客户端 `src/agent/ws.ts`
- [ ] 前端 `src/agent/types.ts`（事件类型定义）
- [ ] 实现 `src/agent/useAgentSession.ts`

#### Phase 2：UI 接入 Agent

- [ ] 改造 Home 页面「开始」按钮：创建 Agent session + 发送 intent prompt
- [ ] 改造 `DecisionBoard`：交付内容来自 agent text_delta（替代静态 `getContentForStage`）
- [ ] 改造 `TrajectoryChatTab`（任务轨迹 Tab）：
  - 用户输入 → `session.steer()` / `session.followUp()`
  - Agent 回复 → 实时 text_delta 渲染
  - 轨迹列表 → 来自 `tool_start/tool_end` 事件
- [ ] 改造 `LeftPanel` 文件树：通过 WebSocket 获取真实 workspace 结构
- [ ] 改造 `StageDecisions`：每个按钮触发对应的 `session.prompt()`

#### Phase 3：SOP 工作流深化

- [ ] 为每个 SOP 步骤编写结构化 prompt 模板
- [ ] 定义每步的 tool 组合（早期步骤只读，后期步骤完整工具）
- [ ] 步骤间上下文继承（同一 session 连续 prompt）
- [ ] Session fork/branch 支持（用户回溯到 spec 阶段尝试不同方案）

#### Phase 4：会话管理 & 体验打磨

- [ ] 任务列表 ↔ SessionManager 映射
- [ ] 会话恢复、历史回溯
- [ ] 工具调用可视化动画
- [ ] 错误处理和重试

---

## 5. 核心代码骨架

### 5.1 `server/index.ts` — 单进程入口

```typescript
import { createServer } from "vite";
import { WebSocketServer } from "ws";
import { AgentManager } from "./AgentManager";

async function main() {
  // 1. 创建 Vite dev server
  const vite = await createServer({ server: { port: 5173 } });
  await vite.listen();

  // 2. 在 Vite HTTP server 上挂载 WebSocket
  const wss = new WebSocketServer({ 
    server: vite.httpServer!,   // 复用 Vite 的 HTTP server
    path: "/agent"
  });

  // 3. Agent 管理
  const agentManager = new AgentManager("./server/workspaces");

  wss.on("connection", (ws) => {
    ws.on("message", async (raw) => {
      const msg = JSON.parse(raw.toString());
      
      switch (msg.type) {
        case "prompt": {
          const stream = await agentManager.getOrCreate(msg.taskId);
          const unsub = stream.subscribe((event) => {
            ws.send(JSON.stringify({ type: "event", taskId: msg.taskId, event }));
          });
          try {
            await stream.prompt(msg.text);
            ws.send(JSON.stringify({ type: "task_done", taskId: msg.taskId }));
          } catch (err) {
            ws.send(JSON.stringify({ type: "error", taskId: msg.taskId, message: String(err) }));
          }
          unsub();
          break;
        }
        case "steer":
          agentManager.get(msg.taskId)?.steer(msg.text);
          break;
        case "followUp":
          agentManager.get(msg.taskId)?.followUp(msg.text);
          break;
        case "abort":
          agentManager.get(msg.taskId)?.abort();
          break;
      }
    });
  });

  console.log("Agent platform running at http://localhost:5173");
}

main();
```

### 5.2 `server/AgentManager.ts`

```typescript
import {
  AuthStorage,
  createAgentSession,
  ModelRegistry,
  SessionManager,
} from "@earendil-works/pi-coding-agent";
import type { AgentSession } from "@earendil-works/pi-coding-agent";
import path from "path";
import fs from "fs";

export class AgentManager {
  private sessions = new Map<string, AgentSession>();
  private authStorage: AuthStorage;
  private modelRegistry: ModelRegistry;
  
  constructor(private workspacesRoot: string) {
    this.authStorage = AuthStorage.create();
    this.modelRegistry = ModelRegistry.create(
      this.authStorage,
      path.resolve("./server/models.json")
    );
  }

  async getOrCreate(taskId: string): Promise<AgentSession> {
    const existing = this.sessions.get(taskId);
    if (existing) return existing;

    const workspaceDir = path.join(this.workspacesRoot, taskId);
    fs.mkdirSync(workspaceDir, { recursive: true });

    // 初始化 workspace 骨架
    this.initWorkspace(workspaceDir, taskId);

    const model = this.modelRegistry.find("deepseek", "deepseek-chat");
    if (!model) throw new Error("DeepSeek model not found");

    const { session } = await createAgentSession({
      model,
      thinkingLevel: "off",
      authStorage: this.authStorage,
      modelRegistry: this.modelRegistry,
      tools: ["read", "write", "edit", "bash"],
      cwd: workspaceDir,
      sessionManager: SessionManager.create(workspaceDir),
    });

    this.sessions.set(taskId, session);
    return session;
  }

  get(taskId: string): AgentSession | undefined {
    return this.sessions.get(taskId);
  }

  dispose(taskId: string) {
    this.sessions.get(taskId)?.dispose();
    this.sessions.delete(taskId);
  }

  private initWorkspace(dir: string, taskId: string) {
    // 创建 AGENTS.md、package.json 等必要文件
    fs.writeFileSync(path.join(dir, "AGENTS.md"), 
      `# ${taskId}\n\n本项目由 AI Agent 驱动生成。\n\n## 规范\n- 代码使用 TypeScript + React\n- 样式使用 CSS（保持与平台 UI 风格一致）\n- 数据先 mock，存在 localStorage\n`);
    fs.writeFileSync(path.join(dir, "package.json"),
      JSON.stringify({ name: taskId, private: true, type: "module" }, null, 2));
  }
}
```

### 5.3 `src/agent/useAgentSession.ts` — React Hook

```typescript
import { useState, useEffect, useRef, useCallback } from "react";
import type { AgentEvent } from "./types";
import { connectAgent } from "./ws";

export function useAgentSession(taskId: string | null) {
  const [messages, setMessages] = useState<Array<{role: string; content: string; id: string}>>([]);
  const [currentStreaming, setCurrentStreaming] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [toolCalls, setToolCalls] = useState<ToolCallRecord[]>([]);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<ReturnType<typeof connectAgent> | null>(null);
  const sentenceRef = useRef<string>(""); // 累积当前句子用于打字机效果

  const send = useCallback((type: string, text: string) => {
    wsRef.current?.send(JSON.stringify({ type, taskId, text }));
  }, [taskId]);

  useEffect(() => {
    if (!taskId) return;
    
    const ws = connectAgent();
    wsRef.current = ws;

    ws.onmessage = (raw) => {
      const msg = JSON.parse(raw.data);
      if (msg.taskId !== taskId) return;

      switch (msg.type) {
        case "event": {
          const event: AgentEvent = msg.event;
          switch (event.type) {
            case "text_delta":
              sentenceRef.current += event.delta;
              setCurrentStreaming(sentenceRef.current);
              break;
            case "agent_start":
              setIsStreaming(true);
              sentenceRef.current = "";
              setCurrentStreaming("");
              break;
            case "agent_end":
              setIsStreaming(false);
              // 将 streaming 内容固化为一条消息
              if (sentenceRef.current) {
                setMessages(prev => [...prev, {
                  role: "assistant",
                  content: sentenceRef.current,
                  id: `msg-${Date.now()}`
                }]);
                sentenceRef.current = "";
                setCurrentStreaming("");
              }
              break;
            case "tool_start":
              setToolCalls(prev => [...prev, {
                id: event.toolCallId,
                name: event.toolName,
                status: "running",
                input: event.input
              }]);
              break;
            case "tool_end":
              setToolCalls(prev => prev.map(t =>
                t.id === event.toolCallId
                  ? { ...t, status: event.isError ? "error" : "done" }
                  : t
              ));
              break;
            case "error":
              setError(event.message);
              break;
          }
          break;
        }
        case "workspace":
          setFileTree(msg.fileTree);
          break;
        case "error":
          setError(msg.message);
          break;
      }
    };

    return () => { ws.close(); wsRef.current = null; };
  }, [taskId]);

  return {
    messages,
    currentStreaming,
    isStreaming,
    toolCalls,
    fileTree,
    error,
    prompt: (text: string) => send("prompt", text),
    steer: (text: string) => send("steer", text),
    followUp: (text: string) => send("followUp", text),
    abort: () => send("abort", ""),
  };
}

type ToolCallRecord = {
  id: string;
  name: string;
  status: "running" | "done" | "error";
  input: unknown;
};
```

### 5.4 `src/agent/ws.ts`

```typescript
export function connectAgent(): WebSocket {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(`${protocol}//${location.host}/agent`);
  
  ws.onopen = () => console.log("[Agent] WebSocket connected");
  ws.onclose = () => console.log("[Agent] WebSocket disconnected");
  ws.onerror = (e) => console.error("[Agent] WebSocket error", e);
  
  return ws;
}
```

---

## 6. 关键设计要点

### 6.1 打字机效果

SDK 的 `text_delta` 是每个 token 的增量。前端累积到 `sentenceRef` 中，通过 React state 更新实现逐字渲染。不需要 `useTypewriter` hook（那是模拟用的），真实的流式输出本身就逐字到达。

但为了 UI 节奏感，可以加一个 **微缓冲**：累积 3-5 个 token 再更新 state，避免过于频繁的 re-render。

### 6.2 文件树实时更新

Agent 每次写文件后，服务端扫描 workspace 目录，生成 `FileNode[]` 结构，通过 WebSocket 推送到前端。前端 `LeftPanel` 直接渲染。

### 6.3 工具调用可视化

`tool_start` / `tool_end` 事件驱动轨迹列表。前端可以展示：
- 🔨 `write src/pages/lead-list.tsx` → running → done
- 耗时、输出摘要

这些完全替代当前静态的 `trajectory` 数据。

### 6.4 错误处理

前端在 WebSocket 断开时显示连接状态指示器（例如顶部横幅 "Agent 离线"），自动重连。

---

## 7. 风险与缓解

| 风险 | 缓解 |
|------|------|
| DeepSeek API 响应速度 | 使用 `deepseek-chat`（V3），响应快；token 流式到达，UI 逐字渲染不显慢 |
| Agent 行为不可控 | Prompt 工程 + AGENTS.md 约束 + 每步明确的 tool 白名单 |
| LLM 生成代码质量波动 | Spec 步骤产出严格的验收标准，build 步骤以此为唯一事实来源 |
| 文件系统安全 | cwd 严格限定在 workspace 目录；不暴露系统路径 |

---

## 8. 总结

**核心变化**：
- ❌ ~~Mock 模式~~ — 直接上真实 Agent SDK
- ❌ ~~多进程架构~~ — 单进程 Vite + WebSocket
- ✅ DeepSeek V3 驱动，密钥固定配置在 `models.json`
- ✅ Workspace 在 `server/workspaces/` 下
- ✅ 前端通过 `useAgentSession` Hook 消费统一事件流

**开发体验**：一个 `npm run dev`，Vite HMR + Agent WebSocket 都就绪。Agent 不运行时前端优雅降级（显示"Agent 离线"），但仍可通过 localStorage 查看已有数据。
