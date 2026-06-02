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
- **流式 Agent 交互**：Agent 的思考过程、文本输出、工具调用实时流式展示，用户可在任意时刻修正方向
- **真实文件系统**：每个任务有独立的 workspace 目录，Agent 的每次 read/write 操作直接反映在文件树上
- **双视图设计**：首页（任务看板 + 想法输入）和工作空间（SOP 导航 + Agent 决策台 + 文件预览）

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

1. **首页** — 选择"任务交付"标签可浏览预设任务卡片，或切换到"想法实现"标签输入自定义需求（如："做一个销售线索跟进系统"）
2. **选择工作空间** — 可选择已有目录或自动创建托管工作空间
3. **进入工作空间** — 页面自动连接 Agent Server，SOP 导航栏显示 7 步流程
4. **逐步推进** — 每步 Agent 实时产出内容，用户在决策台确认后继续下一步
5. **文件预览** — 左侧面板展示 workspace 真实文件树，点击可在右侧抽屉中预览

### 环境变量

| 变量 | 说明 | 必需 |
|------|------|------|
| `DEEPSEEK_API_KEY` | DeepSeek API Key | 是 |
| `AGENT_PORT` | Agent Server 端口（默认 3100） | 否 |
| `AGENT_SECRET` | Agent Server 连接认证 Token（为空时无认证） | 生产建议 |
| `VITE_AGENT_SECRET` | 前端连接认证 Token（须与 AGENT_SECRET 一致） | 生产建议 |
| `VITE_AGENT_WS_URL` | 前端 WebSocket 地址（默认 localhost:3100） | 否 |

### 常用命令

```bash
npm run dev        # 启动完整开发环境（前端 + Agent Server）
npm run dev:ui     # 仅启动前端
npm run dev:agent  # 仅启动 Agent Server
npm run build      # 构建前端产物
```

---

## 系统架构

### 架构总览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              运行时全景                                      │
│                                                                             │
│   Browser                           localhost                              │
│   ┌──────────────────────┐          ┌────────────────────────────┐         │
│   │                      │   WS     │                            │         │
│   │   React SPA          │◄────────►│   Agent Server (Node.js)   │         │
│   │   (Vite) :5173       │  proxy   │   Port 3100                │         │
│   │                      │          │                            │         │
│   │  ┌────────────────┐  │          │  ┌──────────────────────┐  │         │
│   │  │ useAgent()     │  │          │  │ SessionPool          │  │         │
│   │  │  sessions{}    │  │          │  │  taskId:step → Agent │  │         │
│   │  │  prompt()      │  │──────────►  │  Session             │  │         │
│   │  │  steer()       │  │◄──────────  └──────────┬───────────┘  │         │
│   │  │  getFileTree() │  │          │             │               │         │
│   │  │  readFile()    │  │          │  ┌──────────▼───────────┐  │         │
│   │  └────────────────┘  │          │  │ AgentRunner          │  │         │
│   │                      │          │  │  STEP_CONFIGS[step]  │  │         │
│   │  Vite Dev Server     │          │  │  → createSession()   │  │         │
│   │  (HMR + WS Proxy)    │          │  └──────────┬───────────┘  │         │
│   └──────────────────────┘          │             │               │         │
│                                      │  ┌──────────▼───────────┐  │         │
│                                      │  │ WorkspaceManager     │  │         │
│                                      │  │  init / tree / read  │  │         │
│                                      │  └──────────┬───────────┘  │         │
│                                      └─────────────┼──────────────┘         │
│                                                    │                        │
│                           ┌────────────────────────┼────────────────────┐   │
│                           │  Pi Agent SDK          │                    │   │
│                           │  @earendil-works/pi-coding-agent            │   │
│                           │                        │                    │   │
│                           │  AuthStorage ──────────┤                    │   │
│                           │  ModelRegistry ────────┤                    │   │
│                           │  DefaultResourceLoader ┤                    │   │
│                           │  SettingsManager ──────┘                    │   │
│                           │                                              │   │
│                           │  createAgentSession({                        │   │
│                           │    model, tools, cwd,                        │   │
│                           │    resourceLoader, authStorage,              │   │
│                           │    modelRegistry, settingsManager            │   │
│                           │  })                                          │   │
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
| **通信协议** | WebSocket (请求-响应 + 事件流) | 实时流式输出，支持双向交互 |
| **Session 策略** | 每 SOP 步骤独立 Session | 上下文干净，可回溯可分支 |

### 7 步 SOP 工作流

| 步骤 | 步骤名 | Agent 角色 | 可用工具 | 核心产出 |
|------|--------|-----------|----------|----------|
| 1 | **意图校准** | 产品经理 | read, grep, find, ls | 业务对象、角色、场景分析 |
| 2 | **范围锁定** | 技术架构师 | read, grep, find, ls | 模块拆分、依赖关系、风险提示 |
| 3 | **Spec 基线** | 技术架构师 | read, write, grep, find, ls | API 契约、数据模型、验收标准 |
| 4 | **Agent 开发** | 全栈工程师 | read, write, edit, bash, ... | 页面组件、mock 数据 |
| 5 | **质量门禁** | 质量工程师 | read, bash, grep, find, ls | 代码检视、测试报告 |
| 6 | **验证修复** | 质量工程师 | read, write, edit, bash, ... | 修复方案、复测结果 |
| 7 | **发布交付** | DevOps 工程师 | read, write, bash, ... | CHANGELOG、交付清单 |

步骤间通过 **workspace 文件系统**传递上下文：上一步的产出写入文件（如 `AGENTS.md`、`scope.md`、`src/api/openapi.yaml`），下一步的 Agent 通过 read 工具读取后继续工作。每步的 Session 在用户确认后 dispose，保障上下文干净。

### 目录结构

```
zero-one-software/
├── src/                        # 前端 React 应用
│   ├── main.tsx                # 入口
│   ├── App.tsx                 # 顶层组件（路由 home / workspace）
│   ├── agent/                  # Agent 通信层
│   │   ├── types.ts            #   类型定义
│   │   ├── ws.ts               #   WebSocket 连接管理
│   │   └── useAgent.ts         #   核心 hook（多 session 管理）
│   ├── components/             # UI 组件
│   │   ├── DecisionBoard.tsx   #   决策台（各步骤内容展示）
│   │   ├── LeftPanel.tsx       #   左侧面板（文件树 + 对话）
│   │   ├── SopNav.tsx          #   SOP 导航栏
│   │   ├── Drawer.tsx          #   右侧抽屉（文件预览）
│   │   └── ...                 #   其他组件
│   ├── data/                   # 状态管理与数据
│   │   ├── types.ts            #   应用状态类型
│   │   ├── workflowData.ts     #   工作流定义
│   │   ├── stageContent.ts     #   各步骤内容
│   │   └── taskData.ts         #   任务卡片数据
│   ├── hooks.tsx               # 流式输出动画 hook
│   ├── styles.css              # 全局样式
│   └── workspace.css           # 工作空间样式
├── server/                     # Agent Server（Node.js）
│   ├── index.ts                # 入口：HTTP + WebSocket 服务器
│   ├── AgentRunner.ts          # AgentSession 创建工厂
│   ├── SessionPool.ts          # 多 session 管理与生命周期
│   ├── WorkspaceManager.ts     # 工作区文件系统管理
│   ├── protocol.ts             # 通信协议类型定义
│   ├── config.ts               # 模型/API Key 配置
│   ├── stepConfigs.ts          # 7 步 SOP 配置（prompt/skills/tools）
│   ├── models.json             # LLM 模型配置
│   ├── prompts/                # （预留）步骤 prompt 模板
│   └── skills/                 # （预留）自定义 skill 定义
├── docs/                       # 项目文档
│   └── platform-evolution-plan.md
├── vite.config.ts              # Vite 配置（含 WS 代理）
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
```

支持的方法：

| Method | 说明 |
|--------|------|
| `session.create` | 为指定 SOP 步骤创建新 AgentSession |
| `session.prompt` | 向 Agent 发送 prompt |
| `session.steer` | 流式修正指令 |
| `session.followUp` | 追加指令 |
| `session.abort` | 中止当前操作 |
| `session.dispose` | 销毁 Session |
| `workspace.tree` | 获取工作区文件树 |
| `workspace.readFile` | 读取工作区文件 |
| `workspace.browse` | 浏览文件系统目录 |

### 关键设计要点

1. **每步独立 Session** — 7 个 SOP 步骤各有一个独立的 AgentSession，system prompt、skills、tools 均可按需配置。上一个 Session 完成后 dispose，避免上下文污染。

2. **文件即上下文** — 步骤间的上下文通过 workspace 文件传递，而非消息历史。Agent 在新 Session 中通过 read 工具读取前序产出文件（AGENTS.md、scope.md、openapi.yaml 等）即可获取完整的项目上下文。

3. **事件驱动 UI** — 前端通过 `useAgent` hook 订阅 Agent 事件（text_delta、thinking_delta、tool_execution 等），所有 UI 状态由事件流驱动，不依赖轮询或静态数据。

4. **安全的文件系统** — WorkspaceManager 限制所有文件操作在 task workspace 目录内，防止路径遍历攻击。支持托管模式（自动创建目录）和外部模式（使用用户指定的现有项目目录）。

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
| 状态持久化 | localStorage |

---

## 文档
- [AGENTS.md](./AGENTS.md) — AI 开发规范与项目约束
