# 01 · AI 原生研发平台

> **创意需求 → 可运行软件**  
> 从"一句话需求"开始，AI Agent 驱动全流程 SOP，让软件开发像聊天一样自然。

---

## 项目简介

**01** (Zero-One Software) 是一个 AI 原生研发平台原型，核心理念是**用 AI Agent 驱动完整的软件交付生命周期**。用户仅需描述一个业务想法（甚至一句话），平台自动通过 7 步 SOP 交付可运行软件。

不同于 Copilot 等代码补全工具，01 将 AI 视为**完整研发团队**——产品经理、架构师、前端工程师、测试工程师、DevOps 工程师——每个角色由独立的 Agent Session 承载，按步骤产生可验证的交付物，由用户在每个关键节点确认后推进。

### 核心亮点

- **一句话需求**：在首页输入业务想法即可启动完整交付流程
- **7 步 SOP 工作流**：意图校准 → 范围锁定 → Spec 基线 → Agent 开发 → 质量门禁 → 验证修复 → 发布交付
- **Local-Cloud Hybrid 运行时**：同一个工作台，任务可选择本地 Agent（贴近代码、低延迟）或云端 Agent（7×24 在线、长任务托管），运行时状态全局一致
- **流式 Agent 交互**：Agent 的思考过程、文本输出、工具调用实时流式展示，用户可在任意时刻修正方向
- **真实文件系统**：每个任务有独立的 workspace 目录，Agent 的每次 read/write 操作直接反映在文件树上；云端模式支持 Git 仓库 clone
- **会话持久化与恢复**：会话记录按步骤独立存储，支持跨页面、跨刷新恢复，历史任务可从记录继续

---

## Quick Start

### 前置依赖

- Node.js >= 18
- DeepSeek API Key（[申请地址](https://platform.deepseek.com/)）

### 安装与启动

```bash
# 1. 克隆项目
git clone <repo-url>
cd zero-one-software

# 2. 安装依赖
npm install

# 3. 配置 API Key
export DEEPSEEK_API_KEY=sk-your-key-here

# 4. 启动（同时启动前端 Vite 开发服务器 + Agent Server）
npm run dev
```

启动后访问 **http://localhost:5173** 即可进入平台。

### 体验流程

1. **落地页** — 选择运行时模式（本地 / 云端），了解平台核心价值
2. **控制台** — 浏览预设任务卡片，或输入自定义需求（如："做一个销售线索跟进系统"）
3. **选择工作空间** — 本地模式选择本机目录，云端模式输入 Git 仓库地址和分支
4. **进入工作空间** — SOP 导航栏显示 7 步流程，Agent 实时执行
5. **逐步推进** — 每步 Agent 实时产出内容，用户在决策台确认后继续下一步
6. **文件预览** — 左侧面板展示 workspace 真实文件树，点击可在右侧抽屉中预览
7. **历史恢复** — 从历史会话列表恢复任务，自动切换到对应运行时模式

### 环境变量

| 变量 | 说明 | 必需 |
|------|------|------|
| `DEEPSEEK_API_KEY` | DeepSeek API Key | 是 |
| `AGENT_PORT` | Agent Server 端口（默认 3100） | 否 |
| `AGENT_SECRET` | Agent Server 连接认证 Token（为空时无认证） | 生产建议 |
| `VITE_LOCAL_AGENT_WS_URL` | 本地模式 WebSocket 地址（默认 `ws://localhost:3100/agent`） | 否 |
| `VITE_CLOUD_AGENT_WS_URL` | 云端模式 WebSocket 地址 | 云端模式必需 |
| `VITE_LOCAL_AGENT_SECRET` | 本地模式连接认证 Token（须与 AGENT_SECRET 一致） | 生产建议 |
| `VITE_CLOUD_AGENT_SECRET` | 云端模式连接认证 Token | 生产建议 |
| `VITE_CLOUD_API_URL` | 云端 REST API 基础 URL（默认从 WS URL 推导） | 否 |
| `WORKSPACE_ROOT` | 服务端 workspace 根目录（默认 `~/workspaces`） | 否 |

### 常用命令

```bash
npm run dev        # 启动完整开发环境（前端 + Agent Server）
npm run dev:ui     # 仅启动前端
npm run dev:agent  # 仅启动 Agent Server
npm run build      # 构建前端产物
npm run preview    # 预览构建产物
```

---

## 系统架构

### Local-Cloud Hybrid 运行时

平台支持两种运行时模式，共享同一个 UI 工作台和 SOP 工作流：

| 模式 | 适用场景 | 特点 |
|------|----------|------|
| **本地运行时** | 已有本地仓库、快速试错、私有代码 | 贴近本机文件系统，低延迟，数据不出本机 |
| **云端运行时** | 长任务、远程托管、团队协作 | 7×24 在线，Git clone 仓库，独立算力 |

`RuntimeProvider`（React Context）提升到应用根部，所有页面共享同一运行时状态。模式切换通过 `IRuntimeConnector` 接口抽象，本地和云端连接器可热切换。

### 架构总览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              运行时全景                                      │
│                                                                             │
│   Browser                           localhost / cloud                      │
│   ┌──────────────────────┐          ┌────────────────────────────┐         │
│   │                      │   WS     │                            │         │
│   │   React SPA          │◄────────►│   Agent Server (Node.js)   │         │
│   │   (Vite) :5173       │  +REST   │   Port 3100                │         │
│   │                      │          │                            │         │
│   │  ┌────────────────┐  │          │  ┌──────────────────────┐  │         │
│   │  │ RuntimeProvider│  │          │  │ SessionPool          │  │         │
│   │  │  mode: local/  │  │          │  │  taskId:step → Agent │  │         │
│   │  │  cloud         │  │          │  │  Session             │  │         │
│   │  ├────────────────┤  │          │  └──────────┬───────────┘  │         │
│   │  │ useAgent()     │  │──────────►             │               │         │
│   │  │  sessions{}    │  │◄──────────  ┌──────────▼───────────┐  │         │
│   │  │  prompt()      │  │          │  │ AgentRunner          │  │         │
│   │  │  steer()       │  │          │  │  STEP_CONFIGS[step]  │  │         │
│   │  ├────────────────┤  │          │  └──────────┬───────────┘  │         │
│   │  │ Connector      │  │          │             │               │         │
│   │  │  Local / Cloud │  │          │  ┌──────────▼───────────┐  │         │
│   │  └────────────────┘  │          │  │ WorkspaceManager     │  │         │
│   │                      │          │  │  local / cloud / ext │  │         │
│   │  Pages:              │          │  └──────────┬───────────┘  │         │
│   │  / LandingPage       │          │             │               │         │
│   │  /dashboard Console  │          │  ┌──────────▼───────────┐  │         │
│   │  /task TaskPage      │          │  │ SessionStore         │  │         │
│   │  /agent Runtime Mgr  │          │  │  meta + step files   │  │         │
│   │                      │          │  └──────────────────────┘  │         │
│   └──────────────────────┘          └────────────────────────────┘         │
│                                                                             │
│                           ┌──────────────────────────────────────────────┐   │
│                           │  Pi Agent SDK                                │   │
│                           │  @earendil-works/pi-coding-agent             │   │
│                           │  createAgentSession({ model, tools, cwd })   │   │
│                           └──────────────────────┬───────────────────────┘   │
│                                                  │                          │
│                           ┌──────────────────────▼───────────────────────┐   │
│                           │  LLM Provider (DeepSeek V4 Flash)            │   │
│                           │  API: https://api.deepseek.com               │   │
│                           └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 核心架构决策

| 决策 | 选型 | 说明 |
|------|------|------|
| **前端框架** | React 19 + Vite 6 + TypeScript | 快速开发原型，HMR 体验好 |
| **Agent 引擎** | Pi Agent SDK (`@earendil-works/pi-coding-agent`) | 统一 Agent session 管理、工具调用、事件订阅 |
| **LLM 模型** | DeepSeek V4 Flash | 性价比高，支持 thinking/reasoning |
| **进程模型** | 前端 + Agent Server 双进程 | 前后端分离，Agent Server 可独立部署 |
| **通信协议** | WebSocket (请求-响应 + 事件流) + REST API | 实时流式输出 + 云端资源管理 |
| **运行时抽象** | `IRuntimeConnector` 接口 + `RuntimeProvider` | 本地/云端连接器可热切换，全局状态一致 |
| **Session 策略** | 每 SOP 步骤独立 Session | 上下文干净，可回溯可分支 |
| **会话持久化** | `SessionStore` 主存储 + workspace 镜像 | 支持跨刷新恢复，按步骤独立存储 |

### 7 步 SOP 工作流

| 步骤 | 步骤名 | Agent 角色 | 核心 Skill | 核心产出 |
|------|--------|-----------|-----------|----------|
| 1 | **意图校准** | 产品经理 | — | 业务对象、角色、场景分析 |
| 2 | **范围锁定** | 技术架构师 | — | 模块拆分、依赖关系、风险提示 |
| 3 | **Spec 基线** | 技术架构师 | — | API 契约、数据模型、验收标准 |
| 4 | **Agent 开发** | 全栈工程师 | frontend-dev | 页面组件、mock 数据、API 层 |
| 5 | **质量门禁** | 质量工程师 | testing | 代码检视、测试报告 |
| 6 | **验证修复** | 质量工程师 | testing | 修复方案、复测结果 |
| 7 | **发布交付** | DevOps 工程师 | devops | CHANGELOG、交付清单 |

步骤间通过 **workspace 文件系统**传递上下文：上一步的产出写入文件（如 `AGENTS.md`、`scope.md`、`src/api/openapi.yaml`），下一步的 Agent 通过 read 工具读取后继续工作。每步的 System Prompt 和可用工具集通过 `stepConfigs.ts` 独立配置。

### 页面路由

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | LandingPage | 产品愿景 + 运行时模式选择 |
| `/dashboard` | DashboardPage | 控制台：任务看板 / 想法输入 / 历史会话 |
| `/task` | TaskPage | 任务执行：SOP 导航 + 决策面板 + 文件预览 |
| `/agent` | AgentDashboard | Agent 运行时管理中心：模式切换 / 资源监控 / 项目管理 |

所有页面共享同一个 `RuntimeProvider`，运行时状态全局一致。

### 目录结构

```
zero-one-software/
├── src/                        # 前端 React 应用
│   ├── main.tsx                # 入口
│   ├── App.tsx                 # 顶层组件（RuntimeProvider + 路由）
│   ├── agent/                  # Agent 通信层
│   │   ├── config.ts           #   WS URL 构造（按 runtime mode 路由）
│   │   ├── types.ts            #   类型定义
│   │   ├── ws.ts               #   WebSocket 连接管理（心跳 + 重连）
│   │   ├── index.ts            #   useAgent hook（多 session 管理）
│   │   └── useAgent.ts         #   核心 hook 实现
│   ├── components/             # UI 组件
│   │   ├── DecisionBoard.tsx   #   决策台（各步骤内容展示）
│   │   ├── LeftPanel.tsx       #   左侧面板（文件树 + 对话）
│   │   ├── SopNav.tsx          #   SOP 导航栏
│   │   ├── Drawer.tsx          #   右侧抽屉（文件预览）
│   │   ├── WorkspaceSelector.tsx # 工作空间选择器（本地目录 / Git 仓库）
│   │   ├── SessionHistoryPanel.tsx # 会话历史面板
│   │   ├── AgentStatusBadge.tsx #   Agent 连接状态徽章
│   │   └── ...                 #   其他组件
│   ├── connectors/             # 运行时连接器
│   │   ├── index.ts            #   连接器工厂 + switchRuntime()
│   │   ├── LocalRuntimeConnector.ts  # 本地运行时（localStorage 项目）
│   │   └── CloudRuntimeConnector.ts  # 云端运行时（REST API + WS）
│   ├── stores/                 # 状态管理
│   │   └── runtimeStore.tsx    #   RuntimeProvider（Context + useReducer）
│   ├── types/                  # 类型定义
│   │   └── runtime.ts          #   RuntimeMode, IRuntimeConnector 等
│   ├── hooks/                  # 自定义 hooks
│   │   ├── useSessionRecords.ts #  会话记录管理（WS 通信）
│   │   └── useStoredState.ts   #  localStorage 状态持久化
│   ├── data/                   # 静态数据与工作流定义
│   │   ├── types.ts            #   AppState 类型
│   │   ├── workflowData.ts     #   7 步 SOP 定义
│   │   ├── stageContent.ts     #   各步骤内容
│   │   └── taskData.ts         #   任务卡片数据
│   ├── pages/                  # 页面组件
│   │   ├── LandingPage.tsx     #   落地页（模式选择）
│   │   ├── DashboardPage.tsx   #   控制台
│   │   ├── TaskPage.tsx        #   任务执行
│   │   └── AgentDashboard.tsx  #   运行时管理中心
│   ├── styles.css              # 全局样式
│   └── workspace.css           # 工作空间样式
├── server/                     # Agent Server（Node.js）
│   ├── index.ts                # 入口：HTTP + WebSocket + REST API
│   ├── AgentRunner.ts          # AgentSession 创建工厂
│   ├── SessionPool.ts          # 多 session 管理（taskId:step → Agent）
│   ├── SessionStore.ts         # 会话持久化（meta + step 文件）
│   ├── SummaryStore.ts         # Agent 总结临时存储
│   ├── WorkspaceManager.ts     # 工作区文件系统（托管 / 外部 / Git clone）
│   ├── protocol.ts             # 通信协议类型定义
│   ├── config.ts               # 模型/API Key 配置
│   ├── stepConfigs.ts          # 7 步 SOP 配置（prompt/skills/tools）
│   ├── models.json             # LLM 模型配置
│   ├── customTools.ts          # 自定义工具（问答交互）
│   ├── customFindTool.ts       # 自定义 find 工具
│   ├── prompts/                # 步骤 system prompt 模板
│   │   ├── intent.md
│   │   ├── plan.md
│   │   ├── coding.md
│   │   ├── quality.md
│   │   ├── verify.md
│   │   └── release.md
│   └── skills/                 # Agent Skill 定义
│       ├── product-analysis.md
│       ├── architecture-design.md
│       ├── frontend-dev.md
│       ├── testing.md
│       └── devops.md
├── docs/                       # 项目文档
├── vite.config.ts              # Vite 配置（含 WS / HTTP 代理）
├── package.json
└── AGENTS.md                   # AI 开发规范
```

### 通信协议

前后端通过 WebSocket 通信，统一为四种消息类型：

```typescript
// 请求-响应
{ type: "request",  id: string, method: string, params: object }
{ type: "response", id: string, result: any }
{ type: "error",    id: string, error: { code: string, message: string } }

// Agent 事件流（SDK 事件实时映射）
{ type: "event",    id: string, event: AgentEvent }

// 心跳
{ type: "ping", ts: number }
{ type: "pong", ts: number }
```

WebSocket 支持的方法：

| Method | 说明 |
|--------|------|
| `session.create` | 为指定 SOP 步骤创建新 AgentSession |
| `session.prompt` | 向 Agent 发送 prompt |
| `session.steer` | 流式修正指令（streaming 时入队，空闲时触发新轮次） |
| `session.followUp` | 追加指令 |
| `session.abort` | 中止当前操作 |
| `session.dispose` | 销毁 Session |
| `session.answerQuestion` | 回答 Agent 提出的问题 |
| `session.continueQuestion` | 回答后继续执行 |
| `workspace.tree` | 获取工作区文件树 |
| `workspace.readFile` | 读取工作区文件 |
| `workspace.browse` | 浏览文件系统目录 |
| `session.saveMeta` | 保存任务元信息 |
| `session.saveStep` / `loadStep` | 按步骤保存/加载会话快照 |
| `session.saveRecord` / `loadRecord` / `listRecords` / `deleteRecord` | 会话记录 CRUD |
| `summarization.trigger` | 触发 Agent 总结（独立 LLM 会话） |
| `build.trigger` / `build.save` / `build.fix` | 项目编译与修复 |

云端模式额外提供 REST API（供 CloudRuntimeConnector 调用）：

| Endpoint | 说明 |
|----------|------|
| `GET /api/resources` | 获取当前资源指标（CPU/内存/token 额度） |
| `GET /api/projects` | 获取项目列表（映射自 SessionStore） |
| `POST /api/projects` | 创建项目 |
| `DELETE /api/projects/:id` | 删除项目 |
| `POST /api/projects/:id/start` | 启动项目 |
| `POST /api/projects/:id/pause` | 暂停项目 |

### 关键设计要点

1. **每步独立 Session** — 7 个 SOP 步骤各有一个独立的 AgentSession，system prompt、skills、tools 均可通过 `stepConfigs.ts` 按需配置。上下文通过 workspace 文件传递，保障每步上下文干净。

2. **文件即上下文** — 步骤间的上下文通过 workspace 文件传递，而非消息历史。Agent 在新 Session 中通过 read 工具读取前序产出文件即可获取完整项目上下文。

3. **事件驱动 UI** — 前端通过 `useAgent` hook 订阅 Agent 事件（text_delta、thinking_delta、tool_execution 等），所有 UI 状态由事件流驱动。WebSocket 内置应用层心跳检测与应用级重连。

4. **运行时全局一致** — `RuntimeProvider` 提升到 App 根部，`switchMode()` 是唯一切换入口，内部统一处理旧连接断开、handler 清理、新连接建立。Landing、Dashboard、TaskPage、AgentDashboard 共享同一运行时状态。

5. **Workspace 三种模式** — WorkspaceManager 支持托管模式（自动创建目录）、外部模式（用户指定的本地目录）和云端模式（Git clone 到 workspace），云端模式使用 `spawnSync` 防止 shell 注入。

6. **会话双重持久化** — `SessionStore` 在 `~/.aiNativeDevPlatform/sessions/` 保存主存储，同时在 `~/workspaces/{taskId}/session/` 保存镜像。每个会话按步骤独立存储（meta.json + step-{id}.json），支持精细恢复。

---

## 技术栈

| 层 | 技术 |
|----|------|
| 前端框架 | React 19 |
| 构建工具 | Vite 6 + TypeScript 5 |
| Agent SDK | @earendil-works/pi-coding-agent |
| LLM | DeepSeek V4 Flash (deepseek-v4-flash) |
| 服务端运行时 | Node.js + tsx |
| WebSocket | ws (Node.js 服务端) |
| 图标 | lucide-react |
| Markdown | react-markdown + remark-gfm |
| 流程图 | mermaid |
| 状态持久化 | localStorage + 文件系统（SessionStore） |

---

## 文档
- [AGENTS.md](./AGENTS.md) — AI 开发规范与项目约束
- [Local-Cloud Hybrid 评审报告](./docs/local-cloud-hybrid-review.md) — 混合运行时架构评审与路线图
