# AI 原生研发平台：从静态 Demo 到真实平台演进方案

> **一句话目标**：让平台每一步都接入 Pi Agent SDK + 真实模型，用户交互即真实 Agent 交互。
>
> **核心约束**：前端与 Agent Runtime 逻辑分离，通过标准化协议通信；每个 SOP 步骤独立 session，上一步完成后 `/new` 进入下一步。

---

## 1. 现状：静态 Demo 的六处"假"

| # | 假在哪里 | 代码位置 | 真实应该怎样 |
|---|---------|---------|------------|
| 1 | 内容硬编码 | `stageContent.ts` 7 个函数返回固定文案 | Agent 实时产出，与用户输入相关 |
| 2 | 流式输出是模拟 | `useTypewriter` 逐字显示预设文本 | SDK `text_delta` 真实 token 流 |
| 3 | 文件树是假的 | `getFileTreeForStage(stepIndex)` 按 index 返回 | 从 workspace 真实目录扫描 |
| 4 | 对话是假的 | `getAIReply()` 从预设池随机抽取 | `session.steer()` → 真实 Agent 回复 |
| 5 | 决策按钮无后端 | 点击"确认方向"只是 `stepIndex++` | 触发 `session.create` + `session.prompt` |
| 6 | Agent 状态是假的 | `getAgents()` 返回固定 confidence/status | 从 Agent 事件流推导真实状态 |

---

## 2. 目标架构

### 2.1 架构总览

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              运行时全景                                  │
│                                                                         │
│   Browser                           localhost                          │
│   ┌──────────────────────┐          ┌────────────────────────────┐     │
│   │                      │   WS     │                            │     │
│   │   React SPA          │◄────────►│   Agent Server (Node.js)   │     │
│   │                      │ :5173    │   Port 3100                │     │
│   │  ┌────────────────┐  │  proxy   │                            │     │
│   │  │ useAgent()     │  │◄────────►│  ┌──────────────────────┐ │     │
│   │  │  sessions{}    │  │          │  │ SessionPool          │ │     │
│   │  │  prompt()      │  │          │  │  taskId:step → Agent │ │     │
│   │  │  steer()       │  │          │  │  Session             │ │     │
│   │  │  getFileTree() │  │          │  └──────────┬───────────┘ │     │
│   │  │  readFile()    │  │          │             │              │     │
│   │  └────────────────┘  │          │  ┌──────────▼───────────┐ │     │
│   │                      │          │  │ AgentRunner          │ │     │
│   │  Vite Dev Server     │          │  │  STEP_CONFIGS[step]  │ │     │
│   │  (HMR + WS Proxy)   │          │  │  → createSession()   │ │     │
│   └──────────────────────┘          │  └──────────┬───────────┘ │     │
│                                      │             │              │     │
│                                      │  ┌──────────▼───────────┐ │     │
│                                      │  │ WorkspaceManager     │ │     │
│                                      │  │  init / tree / read  │ │     │
│                                      │  └──────────┬───────────┘ │     │
│                                      │             │              │     │
│                                      └─────────────┼──────────────┘     │
│                                                    │                    │
│                           ┌────────────────────────┼────────────────┐   │
│                           │  Pi Agent SDK          │                │   │
│                           │  @earendil-works/pi-coding-agent        │   │
│                           │                        │                │   │
│                           │  AuthStorage ──────────┤                │   │
│                           │  ModelRegistry ────────┤                │   │
│                           │  DefaultResourceLoader ┤                │   │
│                           │  SessionManager ───────┘                │   │
│                           │                                         │   │
│                           │  createAgentSession({                   │   │
│                           │    model, tools, cwd,                   │   │
│                           │    resourceLoader,                      │   │
│                           │    sessionManager                       │   │
│                           │  })                                     │   │
│                           └─────────────────┬───────────────────────┘   │
│                                             │                         │
│                           ┌─────────────────▼───────────────────────┐   │
│                           │  LLM Provider                           │   │
│                           │  DeepSeek V4 Pro / Claude / GPT         │   │
│                           │  (API Key via env var → AuthStorage)    │   │
│                           └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 关键架构决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 进程模型 | Agent Server 独立进程 | 前后端真正分离；Agent Server 可独立部署；日志不混 |
| Agent 策略 | 每 SOP 步骤独立 session | 上下文干净；每步可独立配置 prompt/skills/tools；可回溯可分支 |
| 上下文传递 | workspace 文件（AGENTS.md + 产出文件） | 跨 session 天然共享；Agent 可直接 read 已有文件 |
| 通信协议 | 请求-响应 + 事件流，与 SDK 事件模型对齐 | 不丢失 SDK 事件；前端可做丰富可视化；操作可追踪 |
| 模型配置 | 环境变量 + AuthStorage | 安全；支持多模型；SDK 原生能力 |
| 启动方式 | `concurrently` 并发 Vite + Agent Server | 开发体验简单；两个进程各自独立 |

### 2.3 为什么不用 Vite 单进程？

已有方案将 Agent Server 嵌入 Vite dev server，原型阶段可行但有根本问题：

1. **Vite 不是应用服务器**：HTTP server 为 HMR 设计，不适合长连接 WebSocket + Agent 生命周期
2. **耦合构建与运行**：`npm run build` 后 Vite server 消失，Agent 能力随之消失
3. **调试困难**：Agent 日志和 Vite HMR 日志混在一起
4. **无法独立部署**：生产环境需要 Agent Server 独立运行

### 2.4 为什么每步独立 Session？

1. **上下文干净**：每步的 system prompt / skills / tools 按需配置，不受前步消息历史污染
2. **可回溯**：每个 session 有独立持久化文件，可随时恢复到任意步骤
3. **可分支**：用户回到 spec 步骤尝试不同方案，不影响后续已完成的 session
4. **上下文传递**：通过 workspace 文件（AGENTS.md、产出文件）而非消息历史传递——Agent 在新 session 中 `read` 前序产出即可获得上下文

---

## 3. 通信协议

### 3.1 消息格式

所有 WebSocket 通信统一为四种消息类型：

```typescript
type WsMessage =
  | { type: "request";  id: string; method: AgentMethod; params: Record<string, unknown> }
  | { type: "event";    id: string; event: AgentEvent }
  | { type: "response"; id: string; result: unknown }
  | { type: "error";    id: string; error: { code: string; message: string } }
```

- `id`：请求唯一标识，前端生成（递增计数器），用于关联 request ↔ response/event
- `method`：操作名，见下表
- `event`：SDK 事件直接映射，见 3.3

### 3.2 请求方法

| Method | Params | 说明 |
|--------|--------|------|
| `session.create` | `{ taskId, step, intent }` | 为指定 SOP 步骤创建新 AgentSession |
| `session.prompt` | `{ taskId, step, text }` | 发送 prompt |
| `session.steer` | `{ taskId, step, text }` | 流式中的修正指令 |
| `session.followUp` | `{ taskId, step, text }` | 流式中的追加指令 |
| `session.abort` | `{ taskId, step }` | 中止当前操作 |
| `session.dispose` | `{ taskId, step }` | 销毁 session |
| `workspace.tree` | `{ taskId }` | 获取 workspace 文件树 |
| `workspace.readFile` | `{ taskId, filePath }` | 读取 workspace 文件内容 |

### 3.3 Agent 事件（与 SDK `AgentSessionEvent` 对齐）

```typescript
type AgentEvent =
  | { type: "text_delta";            delta: string }
  | { type: "thinking_delta";        delta: string }
  | { type: "tool_execution_start";  toolName: string; toolCallId: string }
  | { type: "tool_execution_update"; toolCallId: string; output: string }
  | { type: "tool_execution_end";    toolCallId: string; isError: boolean }
  | { type: "message_start" }
  | { type: "message_end" }
  | { type: "agent_start" }
  | { type: "agent_end" }
  | { type: "turn_start" }
  | { type: "turn_end" }
  | { type: "error"; message: string }
```

### 3.4 交互时序

```
Frontend                          Agent Server                     Pi Agent SDK
   │                                  │                                │
   │── request(session.create) ──────►│                                │
   │                                  │── createAgentSession() ───────►│
   │◄── response({ sessionId }) ──────│                                │
   │                                  │                                │
   │── request(session.prompt) ──────►│                                │
   │                                  │── session.prompt(text) ───────►│
   │                                  │                                │
   │◄── event(text_delta) ────────────│◄── subscribe ──────────────────│
   │◄── event(text_delta) ────────────│◄── subscribe ──────────────────│
   │◄── event(tool_execution_start) ──│◄── subscribe ──────────────────│
   │◄── event(tool_execution_end) ────│◄── subscribe ──────────────────│
   │◄── event(text_delta) ────────────│◄── subscribe ──────────────────│
   │◄── event(agent_end) ─────────────│◄── subscribe ──────────────────│
   │                                  │                                │
   │── response({}) ◄─────────────────│  (prompt resolved)             │
   │                                  │                                │
   │── request(workspace.tree) ──────►│                                │
   │◄── response({ tree }) ───────────│                                │
```

---

## 4. SOP 步骤 → Agent Session 映射

### 4.1 流程图

```
 用户输入意图
     │
     ▼
 ┌─────────────────────────────────────────────────────────────────────┐
 │ ① Intent Session                                                    │
 │                                                                     │
 │   systemPrompt: "你是一位资深产品经理，擅长从模糊需求中提炼..."       │
 │   tools: [read, grep, find, ls]  ← 只读，分析阶段不写文件           │
 │   thinkingLevel: medium                                             │
 │                                                                     │
 │   prompt: "分析以下业务意图：{用户输入}"                              │
 │   产出: → 更新 AGENTS.md（业务对象、角色、场景摘要）                 │
 │   用户确认 → dispose session                                        │
 └──────────────────────────────┬──────────────────────────────────────┘
                                │  AGENTS.md
                                ▼
 ┌─────────────────────────────────────────────────────────────────────┐
 │ ② Scope Session                                                     │
 │                                                                     │
 │   systemPrompt: "你是一位技术架构师，擅长模块拆分和依赖分析..."       │
 │   tools: [read, grep, find, ls]                                     │
 │   thinkingLevel: medium                                             │
 │                                                                     │
 │   prompt: "阅读 AGENTS.md，分析模块依赖，建议交付范围"               │
 │   产出: → scope.md（模块列表、依赖关系、风险提示）                   │
 │   用户确认 → dispose session                                        │
 └──────────────────────────────┬──────────────────────────────────────┘
                                │  AGENTS.md + scope.md
                                ▼
 ┌─────────────────────────────────────────────────────────────────────┐
 │ ③ Spec Session                                                      │
 │                                                                     │
 │   systemPrompt: "你是一位技术架构师，负责生成机器可读的规格..."       │
 │   tools: [read, write, grep, find, ls]  ← 开始写文件                │
 │   thinkingLevel: high                                               │
 │                                                                     │
 │   prompt: "基于 scope.md，生成 API 契约和数据模型"                   │
 │   产出: → src/api/openapi.yaml, src/domain/*.ts, specs/acceptance.md│
 │   用户确认 → dispose session                                        │
 └──────────────────────────────┬──────────────────────────────────────┘
                                │  全部已有文件
                                ▼
 ┌─────────────────────────────────────────────────────────────────────┐
 │ ④ Build Session                                                     │
 │                                                                     │
 │   systemPrompt: "你是一位全栈开发工程师，严格按 Spec 实现..."         │
 │   tools: [read, write, edit, bash, grep, find, ls]  ← 完整工具      │
 │   thinkingLevel: medium                                             │
 │                                                                     │
 │   prompt: "基于 Spec，实现页面组件和 mock 数据"                      │
 │   产出: → src/pages/*.tsx, src/components/*.tsx, src/mocks/*.json   │
 │   用户确认 → dispose session                                        │
 └──────────────────────────────┬──────────────────────────────────────┘
                                │  全部已有文件
                                ▼
 ┌─────────────────────────────────────────────────────────────────────┐
 │ ⑤ Quality Session                                                   │
 │                                                                     │
 │   systemPrompt: "你是一位质量工程师，负责代码检视和测试..."           │
 │   tools: [read, bash, grep, find, ls]                               │
 │   thinkingLevel: medium                                             │
 │                                                                     │
 │   prompt: "运行测试，检查代码质量，输出质量报告"                      │
 │   产出: → 测试报告（text_delta 输出 + bash 执行结果）               │
 │   用户确认 → dispose session                                        │
 └──────────────────────────────┬──────────────────────────────────────┘
                                │  全部已有文件
                                ▼
 ┌─────────────────────────────────────────────────────────────────────┐
 │ ⑥ Verify Session                                                    │
 │                                                                     │
 │   systemPrompt: "你是一位质量工程师，负责修复问题并复测..."           │
 │   tools: [read, write, edit, bash, grep, find, ls]                  │
 │   thinkingLevel: medium                                             │
 │                                                                     │
 │   prompt: "修复以下问题并复测：{质量报告中的失败项}"                  │
 │   产出: → 修复后的文件 + 复测结果                                   │
 │   用户确认 → dispose session                                        │
 └──────────────────────────────┬──────────────────────────────────────┘
                                │  全部已有文件
                                ▼
 ┌─────────────────────────────────────────────────────────────────────┐
 │ ⑦ Release Session                                                   │
 │                                                                     │
 │   systemPrompt: "你是一位 DevOps 工程师，负责交付和发布..."           │
 │   tools: [read, write, bash, grep, find, ls]                        │
 │   thinkingLevel: low                                                │
 │                                                                     │
 │   prompt: "生成交付清单、变更摘要和发布记录"                         │
 │   产出: → CHANGELOG.md, DELIVERY.md                                 │
 │   用户确认 → 完成                                                   │
 └─────────────────────────────────────────────────────────────────────┘
```

### 4.2 上下文传递机制

每个步骤的 session 是独立的，上下文通过 workspace 文件传递：

```
Workspace 文件系统（跨 session 共享）
─────────────────────────────────────
AGENTS.md          ← ① 创建，②③④⑤⑥⑦ 均可 read
scope.md           ← ② 写入，③④⑤⑥⑦ 可 read
src/api/*.yaml     ← ③ 写入，④⑤⑥⑦ 可 read
src/domain/*.ts    ← ③ 写入，④⑤⑥⑦ 可 read
src/pages/*.tsx    ← ④ 写入，⑤⑥⑦ 可 read
src/mocks/*.json   ← ④ 写入，⑤⑥⑦ 可 read
CHANGELOG.md       ← ⑦ 写入
DELIVERY.md        ← ⑦ 写入
```

每步的 prompt 模板会显式引用 workspace 中已有的文件，例如 Build 步骤：

```markdown
# 开发任务

请阅读以下文件了解项目上下文：
- AGENTS.md（项目规范和意图摘要）
- scope.md（范围定义）
- src/api/openapi.yaml（API 契约）
- src/domain/*.ts（数据模型）

基于以上上下文，完成以下开发任务：
- 实现 API 契约中定义的所有页面组件
- 生成 mock 数据
- 确保代码风格与 AGENTS.md 中的规范一致
```

### 4.3 每步配置表

| 步骤 | systemPrompt 角色 | tools | thinkingLevel | 可写文件 |
|------|------------------|-------|---------------|---------|
| intent | 产品经理 | read, grep, find, ls | medium | AGENTS.md |
| scope | 技术架构师 | read, grep, find, ls | medium | scope.md |
| spec | 技术架构师 | read, write, grep, find, ls | high | src/api/*, src/domain/*, specs/* |
| build | 全栈工程师 | read, write, edit, bash, grep, find, ls | medium | src/pages/*, src/components/*, src/mocks/* |
| quality | 质量工程师 | read, bash, grep, find, ls | medium | （只读，输出报告） |
| verify | 质量工程师 | read, write, edit, bash, grep, find, ls | medium | 修复已有文件 |
| release | DevOps 工程师 | read, write, bash, grep, find, ls | low | CHANGELOG.md, DELIVERY.md |

---

## 5. Agent Server 设计

### 5.1 目录结构

```
server/
├── index.ts                 # 入口：HTTP + WebSocket 服务器
├── AgentRunner.ts           # AgentSession 创建、按步骤配置
├── SessionPool.ts           # 多 session 管理（taskId:step → AgentSession）
├── WorkspaceManager.ts      # workspace 目录管理、文件树扫描
├── protocol.ts              # 通信协议类型定义（WsMessage, AgentEvent 等）
├── config.ts                # 模型配置、环境变量读取
├── stepConfigs.ts           # 7 个 SOP 步骤的配置（prompt/skills/tools）
├── prompts/                 # 各步骤的 prompt 模板（.md 文件）
│   ├── intent.md
│   ├── scope.md
│   ├── spec.md
│   ├── build.md
│   ├── quality.md
│   ├── verify.md
│   └── release.md
├── skills/                  # 各步骤的 skill 定义
│   ├── product-analysis.md
│   ├── architecture-design.md
│   ├── frontend-dev.md
│   ├── testing.md
│   └── devops.md
├── models.json              # 自定义模型 provider 配置（不含 API Key）
└── workspaces/              # 运行时 workspace 目录
    └── {taskId}/
        ├── AGENTS.md
        ├── package.json
        └── src/
```

### 5.2 AgentRunner

```typescript
import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  ModelRegistry,
  SessionManager,
  SettingsManager,
  createSyntheticSourceInfo,
  type Skill,
  type AgentSession,
} from "@earendil-works/pi-coding-agent";
import { STEP_CONFIGS, type StepConfig } from "./stepConfigs";

export class AgentRunner {
  private authStorage: AuthStorage;
  private modelRegistry: ModelRegistry;
  private settingsManager: SettingsManager;

  constructor(config: { modelsJsonPath?: string }) {
    this.authStorage = AuthStorage.create();
    if (process.env.DEEPSEEK_API_KEY) {
      this.authStorage.setRuntimeApiKey("deepseek", process.env.DEEPSEEK_API_KEY);
    }
    this.modelRegistry = ModelRegistry.create(this.authStorage, config.modelsJsonPath);
    this.settingsManager = SettingsManager.inMemory({
      compaction: { enabled: false },
      retry: { enabled: true, maxRetries: 2 },
    });
  }

  async createSession(
    taskId: string,
    step: string,
    workspaceDir: string,
  ): Promise<AgentSession> {
    const stepConfig = STEP_CONFIGS[step];
    if (!stepConfig) throw new Error(`Unknown step: ${step}`);

    const model = this.modelRegistry.find(stepConfig.modelProvider, stepConfig.modelId);
    if (!model) throw new Error(`Model not found: ${stepConfig.modelProvider}/${stepConfig.modelId}`);

    const loader = new DefaultResourceLoader({
      cwd: workspaceDir,
      systemPromptOverride: () => stepConfig.systemPrompt,
      skillsOverride: (current) => ({
        skills: [...current.skills, ...stepConfig.skills],
        diagnostics: current.diagnostics,
      }),
    });
    await loader.reload();

    const { session } = await createAgentSession({
      model,
      thinkingLevel: stepConfig.thinkingLevel,
      authStorage: this.authStorage,
      modelRegistry: this.modelRegistry,
      settingsManager: this.settingsManager,
      tools: stepConfig.tools,
      cwd: workspaceDir,
      resourceLoader: loader,
      sessionManager: SessionManager.create(workspaceDir),
    });

    return session;
  }
}
```

### 5.3 SessionPool

```typescript
import type { AgentSession } from "@earendil-works/pi-coding-agent";

type PooledSession = {
  session: AgentSession;
  step: string;
  unsub: (() => void) | null;
};

export class SessionPool {
  private pool = new Map<string, PooledSession>();

  private key(taskId: string, step: string) {
    return `${taskId}:${step}`;
  }

  set(taskId: string, step: string, session: AgentSession): void {
    const k = this.key(taskId, step);
    this.pool.get(k)?.session.dispose();
    this.pool.set(k, { session, step, unsub: null });
  }

  get(taskId: string, step: string): AgentSession | undefined {
    return this.pool.get(this.key(taskId, step))?.session;
  }

  setUnsub(taskId: string, step: string, unsub: () => void): void {
    const entry = this.pool.get(this.key(taskId, step));
    if (entry) entry.unsub = unsub;
  }

  dispose(taskId: string, step: string): void {
    const k = this.key(taskId, step);
    const entry = this.pool.get(k);
    if (entry) {
      entry.unsub?.();
      entry.session.dispose();
      this.pool.delete(k);
    }
  }

  disposeAll(): void {
    for (const entry of this.pool.values()) {
      entry.unsub?.();
      entry.session.dispose();
    }
    this.pool.clear();
  }
}
```

### 5.4 WorkspaceManager

```typescript
import path from "path";
import fs from "fs";

export type FileNode = {
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
};

export class WorkspaceManager {
  constructor(private root: string) {}

  initWorkspace(taskId: string, intent: string): string {
    const dir = this.dir(taskId);
    fs.mkdirSync(dir, { recursive: true });
    fs.mkdirSync(path.join(dir, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, "AGENTS.md"),
      [
        `# ${taskId}`,
        "",
        "本项目由 AI Agent 驱动生成。",
        "",
        "## 业务意图",
        intent,
        "",
        "## 规范",
        "- 代码使用 TypeScript + React",
        "- 样式使用 CSS（保持与平台 UI 风格一致）",
        "- 数据先 mock，存在 localStorage",
      ].join("\n"),
    );
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ name: taskId, private: true, type: "module" }, null, 2),
    );
    return dir;
  }

  getFileTree(taskId: string): FileNode[] {
    const dir = this.dir(taskId);
    if (!fs.existsSync(dir)) return [];
    return this.scanDir(dir, dir);
  }

  readFile(taskId: string, filePath: string): string {
    const full = path.join(this.dir(taskId), filePath);
    if (!full.startsWith(path.resolve(this.dir(taskId)))) {
      throw new Error("Path traversal detected");
    }
    return fs.readFileSync(full, "utf-8");
  }

  private dir(taskId: string): string {
    return path.join(this.root, taskId);
  }

  private scanDir(base: string, current: string): FileNode[] {
    return fs
      .readdirSync(current, { withFileTypes: true })
      .filter((d) => !d.name.startsWith(".") && d.name !== "node_modules")
      .sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      })
      .map((d) => {
        const full = path.join(current, d.name);
        if (d.isDirectory()) {
          return { name: d.name, type: "folder" as const, children: this.scanDir(base, full) };
        }
        return { name: d.name, type: "file" as const };
      });
  }
}
```

### 5.5 Server 入口

```typescript
import http from "http";
import { WebSocketServer, type WebSocket } from "ws";
import { AgentRunner } from "./AgentRunner";
import { SessionPool } from "./SessionPool";
import { WorkspaceManager } from "./WorkspaceManager";
import type { WsMessage, AgentEvent } from "./protocol";

const PORT = 3100;

const runner = new AgentRunner({ modelsJsonPath: "./server/models.json" });
const pool = new SessionPool();
const workspace = new WorkspaceManager("./server/workspaces");

const server = http.createServer();
const wss = new WebSocketServer({ server, path: "/agent" });

function mapSdkEvent(raw: unknown): AgentEvent {
  // 将 SDK AgentSessionEvent 映射为前端 AgentEvent
  // 保留 type / delta / toolName / toolCallId / isError 等字段
  // 省略前端不需要的细节
}

wss.on("connection", (ws: WebSocket) => {
  ws.on("message", async (raw) => {
    const msg: WsMessage = JSON.parse(raw.toString());
    if (msg.type !== "request") return;

    try {
      switch (msg.method) {
        case "session.create": {
          const { taskId, step, intent } = msg.params as {
            taskId: string; step: string; intent: string;
          };
          const workspaceDir = workspace.initWorkspace(taskId, intent);
          const session = await runner.createSession(taskId, step, workspaceDir);
          pool.set(taskId, step, session);

          const unsub = session.subscribe((sdkEvent) => {
            ws.send(JSON.stringify({
              type: "event",
              id: msg.id,
              event: mapSdkEvent(sdkEvent),
            }));
          });
          pool.setUnsub(taskId, step, unsub);

          ws.send(JSON.stringify({
            type: "response",
            id: msg.id,
            result: { sessionId: session.sessionId },
          }));
          break;
        }

        case "session.prompt": {
          const { taskId, step, text } = msg.params as {
            taskId: string; step: string; text: string;
          };
          const session = pool.get(taskId, step);
          if (!session) throw new Error("Session not found");
          await session.prompt(text);
          ws.send(JSON.stringify({ type: "response", id: msg.id, result: {} }));
          break;
        }

        case "session.steer": {
          const { taskId, step, text } = msg.params as {
            taskId: string; step: string; text: string;
          };
          pool.get(taskId, step)?.steer(text);
          ws.send(JSON.stringify({ type: "response", id: msg.id, result: {} }));
          break;
        }

        case "session.dispose": {
          const { taskId, step } = msg.params as { taskId: string; step: string };
          pool.dispose(taskId, step);
          ws.send(JSON.stringify({ type: "response", id: msg.id, result: {} }));
          break;
        }

        case "workspace.tree": {
          const { taskId } = msg.params as { taskId: string };
          const tree = workspace.getFileTree(taskId);
          ws.send(JSON.stringify({ type: "response", id: msg.id, result: { tree } }));
          break;
        }

        case "workspace.readFile": {
          const { taskId, filePath } = msg.params as { taskId: string; filePath: string };
          const content = workspace.readFile(taskId, filePath);
          ws.send(JSON.stringify({ type: "response", id: msg.id, result: { content } }));
          break;
        }
      }
    } catch (err) {
      ws.send(JSON.stringify({
        type: "error",
        id: msg.id,
        error: { code: "INTERNAL", message: String(err) },
      }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`Agent Server listening on ws://localhost:${PORT}/agent`);
});
```

---

## 6. 前端改造设计

### 6.1 新增文件

```
src/agent/
├── types.ts              # AgentEvent, WsMessage, SessionState 类型
├── ws.ts                 # WebSocket 连接管理（请求-响应封装 + 自动重连）
├── useAgent.ts           # 核心 Hook：多 session 管理 + 事件流消费
└── stepPrompts.ts        # 前端侧的步骤 prompt 组装逻辑
```

### 6.2 useAgent Hook

```typescript
import { useState, useEffect, useRef, useCallback } from "react";
import type { AgentEvent, FileNode } from "./types";
import { AgentWebSocket } from "./ws";

type SessionState = {
  id: string;
  streamingText: string;
  isStreaming: boolean;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  toolCalls: Array<{ id: string; name: string; status: "running" | "done" | "error" }>;
};

export function useAgent(taskId: string | null) {
  const [sessions, setSessions] = useState<Record<string, SessionState>>({});
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected" | "connecting"
  >("disconnected");
  const wsRef = useRef<AgentWebSocket | null>(null);
  const activeStepRef = useRef<string | null>(null);

  // ── 创建 session ──
  const createSession = useCallback(
    async (step: string, intent: string) => {
      if (!taskId || !wsRef.current) return;
      activeStepRef.current = step;
      const result = await wsRef.current.request("session.create", {
        taskId,
        step,
        intent,
      });
      setSessions((prev) => ({
        ...prev,
        [step]: {
          id: result.sessionId,
          streamingText: "",
          isStreaming: false,
          messages: [],
          toolCalls: [],
        },
      }));
    },
    [taskId],
  );

  // ── 发送 prompt ──
  const prompt = useCallback(
    async (step: string, text: string) => {
      if (!taskId || !wsRef.current) return;
      activeStepRef.current = step;
      setSessions((prev) => ({
        ...prev,
        [step]: {
          ...prev[step],
          messages: [...(prev[step]?.messages || []), { role: "user", content: text }],
        },
      }));
      await wsRef.current.request("session.prompt", { taskId, step, text });
    },
    [taskId],
  );

  // ── 流式修正 ──
  const steer = useCallback(
    (step: string, text: string) => {
      wsRef.current?.request("session.steer", { taskId, step, text });
    },
    [taskId],
  );

  // ── 获取文件树 ──
  const getFileTree = useCallback(async () => {
    if (!taskId || !wsRef.current) return;
    const result = await wsRef.current.request("workspace.tree", { taskId });
    setFileTree(result.tree);
  }, [taskId]);

  // ── 读取文件 ──
  const readFile = useCallback(
    async (filePath: string) => {
      if (!taskId || !wsRef.current) return "";
      const result = await wsRef.current.request("workspace.readFile", { taskId, filePath });
      return result.content;
    },
    [taskId],
  );

  // ── WebSocket 事件处理 ──
  useEffect(() => {
    if (!taskId) return;
    const ws = new AgentWebSocket("ws://localhost:3100/agent");
    wsRef.current = ws;
    setConnectionStatus("connecting");

    ws.on("open", () => setConnectionStatus("connected"));
    ws.on("close", () => setConnectionStatus("disconnected"));

    ws.onEvent((event: AgentEvent) => {
      const step = activeStepRef.current;
      if (!step) return;

      setSessions((prev) => {
        const s = prev[step] || {
          id: "",
          streamingText: "",
          isStreaming: false,
          messages: [],
          toolCalls: [],
        };

        switch (event.type) {
          case "text_delta":
            return {
              ...prev,
              [step]: { ...s, streamingText: s.streamingText + event.delta },
            };
          case "agent_start":
            return {
              ...prev,
              [step]: { ...s, isStreaming: true, streamingText: "" },
            };
          case "agent_end":
            return {
              ...prev,
              [step]: {
                ...s,
                isStreaming: false,
                messages: [
                  ...s.messages,
                  ...(s.streamingText
                    ? [{ role: "assistant" as const, content: s.streamingText }]
                    : []),
                ],
                streamingText: "",
              },
            };
          case "tool_execution_start":
            return {
              ...prev,
              [step]: {
                ...s,
                toolCalls: [
                  ...s.toolCalls,
                  { id: event.toolCallId, name: event.toolName, status: "running" as const },
                ],
              },
            };
          case "tool_execution_end":
            return {
              ...prev,
              [step]: {
                ...s,
                toolCalls: s.toolCalls.map((t) =>
                  t.id === event.toolCallId
                    ? { ...t, status: event.isError ? ("error" as const) : ("done" as const) }
                    : t,
                ),
              },
            };
          default:
            return prev;
        }
      });
    });

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [taskId]);

  return {
    sessions,
    fileTree,
    connectionStatus,
    createSession,
    prompt,
    steer,
    getFileTree,
    readFile,
  };
}
```

### 6.3 各组件改造映射

| 组件 | 当前（静态） | 改造后（真实） | 改动量 |
|------|-------------|---------------|--------|
| **HomeTaskBoard** | 点击"开始"→ `setState({ view: "workspace" })` | `agent.createSession("intent", intent)` + 初始化 workspace | 小 |
| **DecisionBoard** | `getContentForStage(stepIndex)` 返回硬编码 | `agent.sessions[step].streamingText` + `messages` 渲染真实产出 | 中 |
| **TrajectoryChatTab** | `getAIReply()` 随机回复 | `agent.steer(step, text)` → 真实 Agent 回复流 | 中 |
| **LeftPanel** | `getFileTreeForStage(stepIndex)` 硬编码 | `agent.getFileTree()` 从真实 workspace 扫描 | 小 |
| **StageDecisions** | 按钮只做 `stepIndex++` | 触发 `agent.createSession(nextStep)` + `agent.prompt(nextStep, ...)` | 中 |
| **Drawer** | `getMockFileContent()` 返回假内容 | `agent.readFile(path)` 读取真实文件 | 小 |
| **SopNav** | stepIndex 驱动 | 由 Agent session 完成状态驱动 | 小 |

### 6.4 可删除的代码

| 文件 | 删除内容 | 原因 |
|------|---------|------|
| `src/hooks.tsx` | `useTypewriter` / `useStreamingList` / `StreamText` | SDK 真实 token 流替代 |
| `src/data/stageContent.ts` | 全部 7 个 `getXxxContent()` 函数 | Agent 实时产出替代 |
| `src/data/taskData.ts` | `getFileTreeForStage()` | workspace 真实扫描替代 |
| `src/data/workflowData.ts` | `getAgents()` / `getGates()` | Agent 事件状态推导替代 |
| `App.tsx` | `getMockFileContent()` / `getLanguageFromPath()` | `agent.readFile()` 替代 |

---

## 7. 模型配置

### 7.1 API Key 安全

```typescript
// server/config.ts
const authStorage = AuthStorage.create();

// 环境变量传入，不硬编码
if (process.env.DEEPSEEK_API_KEY) {
  authStorage.setRuntimeApiKey("deepseek", process.env.DEEPSEEK_API_KEY);
}
```

### 7.2 models.json（不含 API Key）

基于 DeepSeek 实际 API 格式（`POST https://api.deepseek.com/chat/completions`，模型 `deepseek-v4-flash`，支持 `thinking` + `reasoning_effort`）：

**关键说明**：

- `baseUrl` 设为 `https://api.deepseek.com`（SDK 的 OpenAI 兼容层会自动拼接 `/chat/completions`）
- `reasoning: true` + `compat.thinkingFormat: "deepseek"` 告知 SDK 该模型支持 DeepSeek 风格的 thinking 参数
- DeepSeek 的 `thinking: {"type": "enabled"}` 和 `reasoning_effort` 参数由 SDK 根据 `thinkingLevel` 配置自动映射
- API Key 通过环境变量 `DEEPSEEK_API_KEY` 注入 `AuthStorage`，不写入 models.json

### 7.3 启动方式

```bash
# .env.local（不提交到 git）
DEEPSEEK_API_KEY=sk-xxx

# 启动
npm run dev
```

```json
{
  "scripts": {
    "dev": "concurrently -n ui,agent -c blue,green \"vite\" \"tsx server/index.ts\"",
    "dev:agent": "tsx server/index.ts",
    "dev:ui": "vite"
  }
}
```

Vite 开发服务器通过 `vite.config.ts` 代理 WebSocket 到 Agent Server：

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      "/agent": {
        target: "ws://localhost:3100",
        ws: true,
      },
    },
  },
});
```

---

## 8. 实施计划

### Phase 1：基础设施（1-2 天）

**目标**：前端能连接 Agent Server，发送 prompt，收到 text_delta 事件流。

- [ ] 安装依赖：`@earendil-works/pi-coding-agent`、`ws`、`express`、`concurrently`、`tsx`
- [ ] 创建 `server/` 目录结构
- [ ] 实现 `server/protocol.ts`（类型定义）
- [ ] 实现 `server/config.ts`（模型配置 + 环境变量读取）
- [ ] 实现 `server/WorkspaceManager.ts`
- [ ] 实现 `server/stepConfigs.ts`（先只填 intent 配置）
- [ ] 实现 `server/AgentRunner.ts`
- [ ] 实现 `server/SessionPool.ts`
- [ ] 实现 `server/index.ts`（HTTP + WebSocket）
- [ ] 实现 `src/agent/` 通信层（types + ws + useAgent）
- [ ] 更新 `package.json` scripts + `vite.config.ts` 代理

**验证**：在浏览器控制台调用 `agent.prompt("intent", "你好")`，收到 `text_delta` 事件流。

### Phase 2：Intent 步骤真实化（1 天）

**目标**：用户输入"销售线索跟进"，Agent 真实分析意图并流式输出结果。

- [ ] 编写 `server/prompts/intent.md`
- [ ] 编写 `server/skills/product-analysis.md`
- [ ] 改造 Home 页面"开始"按钮：`agent.createSession("intent", intent)`
- [ ] 改造 DecisionBoard：Intent 步骤内容来自 Agent 实时产出
- [ ] 改造 TrajectoryChatTab：用户输入 → `agent.steer()` → 真实回复
- [ ] 改造 LeftPanel 文件树：`agent.getFileTree()` 真实扫描

**验证**：完整走通 Intent 步骤——输入意图 → Agent 流式分析 → 用户可对话修正 → 确认。

### Phase 3：全部 SOP 步骤接入（2-3 天）

**目标**：7 步 SOP 全部可真实执行。

- [ ] 编写各步骤 prompt 模板（scope/spec/build/quality/verify/release）
- [ ] 编写各步骤 skill 文件
- [ ] 完善 `server/stepConfigs.ts` 全部 7 步配置
- [ ] 改造 StageDecisions：每个按钮触发对应步骤的 session 创建 + prompt
- [ ] 改造 Drawer：从 workspace 读取真实文件内容
- [ ] 步骤间上下文传递（AGENTS.md 更新机制）

**验证**：完整走通 7 步 SOP——从意图输入到发布交付，每步有真实 Agent 产出。

### Phase 4：体验打磨（1-2 天）

**目标**：完整用户体验闭环。

- [ ] Agent 连接状态指示器（顶部横幅）
- [ ] 工具调用可视化（tool_start/tool_end 事件展示）
- [ ] 错误处理和重试
- [ ] WebSocket 断线重连
- [ ] 删除废弃的静态数据代码
- [ ] 流式文本微缓冲（3-5 token 批量更新，减少 re-render）

**验证**：从输入到交付，体验流畅，异常有友好提示。

---

## 9. 风险与缓解

| 风险 | 缓解 |
|------|------|
| SDK 安装/兼容问题 | Phase 1 第一步验证 SDK 可用性，不行就早暴露 |
| 模型响应速度 | DeepSeek V4 Pro 流式输出，前端逐 token 渲染不显慢 |
| Agent 行为不可控 | 每步 system prompt + skills 严格约束 + tools 白名单 |
| 生成代码质量波动 | Spec 步骤产出验收标准，Build 步骤以此为约束 |
| 文件系统安全 | WorkspaceManager 限制路径在 workspace 目录内 |
| 前端改造工作量大 | 分 4 阶段实施，每阶段独立验证 |
| Vite WS 代理限制 | 开发时用 `vite.config.ts` proxy；生产时直连 Agent Server |
