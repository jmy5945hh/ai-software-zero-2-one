# 前端页面结构

## 路由总览

应用使用 `react-router-dom` 的 `BrowserRouter`，4 个路由页面由 `RuntimeProvider` 包裹共享运行时状态。

| 路由 | 页面组件 | 用途 |
|---|---|---|
| `/` | `LandingPage` | 产品落地页，展示愿景与运行时模式选择 |
| `/dashboard` | `DashboardPage` | 主控制台：任务输入、工作区选择、会话历史 |
| `/task?taskId=...` | `TaskPage` | 任务执行工作区：SOP 导航、Agent 对话、决策面板 |
| `/agent` | `AgentDashboard` | Agent 运行时管理中心：模式切换、项目 CRUD、资源监控 |

## 导航流

```
LandingPage (/) ──→ DashboardPage (/dashboard) ──→ TaskPage (/task?taskId=xxx)
                      ↑                                │
                      └────────────────────────────────┘
                         (返回控制台)

LandingPage (/) ──→ AgentDashboard (/agent)
```

主用户路径：落地页 → 控制台（输入意图、配置工作区）→ 任务页（执行 SOP 工作流）。

---

## 页面详解

### 1. LandingPage (`/`)

**文件:** `src/pages/LandingPage.tsx`

单页营销页面，无子路由。

```
LandingPage
├── header (intro-nav)
│   ├── brand (DevAgent Cloud logo, 导航到 /)
│   └── 用户信息
├── section (intro-hero)
│   └── TypewriterText (动画标题: "创意需求 👉 可运行软件")
├── section (intro-runtime)
│   ├── 运行时卡片 (local CLI Agent / cloud Agent runtime)
│   └── 按钮 → navigate("/dashboard")
└── section (intro-advantages)
    └── 4 张优势卡片 (跳出循环、SOP、始终在线、可扩展)
```

**使用的共享组件:** `TypewriterText`

---

### 2. DashboardPage (`/dashboard`)

**文件:** `src/pages/DashboardPage.tsx`

主控制台，左侧 tab 导航切换不同面板。

```
DashboardPage
├── header (home-nav)
│   ├── brand (DevAgent Cloud, 导航到 /)
│   ├── 双端点状态 (local + cloud 连接徽章)
│   │   └── EndpointBadge (内联子组件 ×2)
│   └── 用户信息
├── section (home-hero)
│   ├── aside (home-sidebar)
│   │   └── nav (home-tabs)
│   │       ├── "交付工作台" → UnifiedDeliveryWorkspace
│   │       ├── "定时任务" → ScheduledTasksPanel
│   │       ├── "项目环境管理" → ProjectEnvPanel
│   │       └── "历史会话" → SessionHistoryPanel
│   └── div (home-content)
│       └── [按 homeTab 条件渲染]
│           ├── UnifiedDeliveryWorkspace (默认)
│           ├── ScheduledTasksPanel
│           ├── ProjectEnvPanel
│           └── SessionHistoryPanel
└── [条件弹窗]
    ├── WorkspaceSelector (模态覆盖层)
    └── preflight-error-toast
```

**使用的共享组件:**
- `UnifiedDeliveryWorkspace` — 交付工作台（含模式切换、意图输入、任务模板）
- `SessionHistoryPanel` — 历史会话列表
- `ScheduledTasksPanel` — 定时任务管理
- `ProjectEnvPanel` — 项目环境管理
- `WorkspaceSelector` — 工作区选择弹窗

**UnifiedDeliveryWorkspace 内部结构:**
```
UnifiedDeliveryWorkspace
├── section (delivery-composer)
│   ├── 模式 tabs (Plan / Builder / Workflow)
│   ├── textarea (意图输入)
│   ├── context notices (任务卡片注入)
│   └── toolbar
│       ├── 模型选择器 (composer-menu)
│       ├── 技能选择器 (composer-menu)
│       ├── MCP 选择器 (composer-menu)
│       ├── 工作区按钮
│       └── 设置弹窗 (composer-settings-menu)
└── section (delivery-task-panel)
    ├── 任务 tabs (story / defect / governance / review)
    └── 任务模板网格
        └── task-template-card 按钮
```

---

### 3. TaskPage (`/task?taskId=...`)

**文件:** `src/pages/TaskPage.tsx`

最复杂的页面 — 任务执行工作区，三栏布局。

```
TaskPage
├── [Agent 未连接]
│   └── workspace-no-agent (connecting / reconnecting / disconnected)
├── [Agent 已连接]
│   ├── DeliveryStrategyBanner (内联子组件)
│   ├── div (workspace-grid)
│   │   ├── LeftPanel
│   │   │   ├── TaskCardResident (内联子组件)
│   │   │   │   ├── 当前任务信息
│   │   │   │   ├── session ID 复制按钮
│   │   │   │   └── 历史任务列表
│   │   │   ├── section (task-workflow-nav)
│   │   │   │   └── 工作流步骤按钮 (带 check/dot 图标)
│   │   │   └── WorkspaceExplorer
│   │   │       ├── 按钮 (Specs / Code / Rollback)
│   │   │       ├── SpecsExplorer (覆盖层)
│   │   │       └── RepoExplorer (覆盖层)
│   │   │           ├── tree tab (文件浏览器)
│   │   │           ├── diff tab (文件变更, 含 DiffViewer)
│   │   │           └── rollback tab (基于检查点的文件恢复)
│   │   ├── section (conversation-column)
│   │   │   ├── header (任务标题 + 工作流状态 + AgentStatusBadge)
│   │   │   └── DecisionBoard (fixedTab="trajectory")
│   │   │       ├── board header (步骤信息)
│   │   │       └── TrajectoryChatTab (Agent 对话)
│   │   └── section (execution-workbench)
│   │       ├── workbench tabs (artifacts / code / preview / terminal)
│   │       └── [条件渲染]
│   │           ├── DecisionBoard (fixedTab="delivery") — artifacts tab
│   │           │   ├── DeliveryCollabTab
│   │           │   │   ├── user role banner
│   │           │   │   ├── working notice / question notice
│   │           │   │   ├── SummaryBrief
│   │           │   │   ├── KeyPointsGrid
│   │           │   │   ├── PrototypePreview
│   │           │   │   ├── SpecsDirectory / FileChangesButton
│   │           │   │   ├── BuildSection
│   │           │   │   └── TodoSection
│   │           │   └── TrajectoryChatTab
│   │           └── workbench-canvas
│   │               ├── [workbenchTab === "code"] → RepoExplorer (内联渲染)
│   │               │   ├── 搜索栏 (按文件名过滤 tree / diff)
│   │               │   ├── tree tab (完整仓库目录树)
│   │               │   ├── diff tab (变更文件树 + DiffViewer)
│   │               │   └── rollback tab (基于检查点的文件恢复)
│   │               ├── [workbenchTab === "preview"] → 应用预览占位
│   │               └── [workbenchTab === "terminal"] → 终端输出占位
│   └── Drawer (右侧滑入预览)
│       ├── CodePreview
│       ├── DocumentPreview
│       ├── HtmlPreview
│       └── DiffViewer
```

**使用的共享组件:**
- `LeftPanel` — 左侧面板容器
- `DecisionBoard` — 决策面板（最大组件，约 4200+ 行，渲染两次：trajectory + delivery）
- `Drawer` — 右侧抽屉预览
- `AgentStatusBadge` — Agent 连接状态徽章
- `WorkspaceExplorer` — 工作区文件浏览器
- `SpecsExplorer` — 规格文档浏览器
- `RepoExplorer` — 仓库文件浏览器（含 tree/diff/rollback）
- `DiffViewer` — 文件差异对比查看器
- `MarkdownRenderer` — Markdown 渲染
- `TokenUsageBadge` — Token 用量徽章
- `ContentModal` — 内容模态框

---

### 4. AgentDashboard (`/agent`)

**文件:** `src/pages/AgentDashboard.tsx`

Agent 运行时管理中心，独立于主工作流。

```
AgentDashboard
├── nav (dash-nav)
│   ├── brand (Zero-One Agent, 导航到 /)
│   └── status pill
├── div (dash-body)
│   ├── error banner (条件)
│   ├── hero section
│   ├── mode-switcher
│   │   ├── mode-card local (点击切换)
│   │   └── mode-card cloud (点击切换)
│   ├── status-row
│   │   ├── status-box (运行时指标)
│   │   ├── status-box (资源监控)
│   │   └── status-box (快捷操作)
│   └── project-section
│       ├── header + 新建项目按钮
│       ├── 新建项目对话框 (条件)
│       ├── 空状态
│       └── project-list
│           └── ProjectCard (内联子组件 ×N)
│               ├── 项目信息 (名称、阶段、模式、描述、元数据)
│               └── 操作 (start / pause / delete 带确认)
```

**使用的共享组件:** 无 — 全部使用内联子组件。

---

## SOP 工作流（7 步研发流水线）

定义在 `src/data/workflowData.ts`，是 TaskPage 的核心流程。

| 步骤 ID | 标签 | 用户角色 |
|---|---|---|
| `intent` | 需求分析 | 和 DevAgent 一起脑暴，将模糊需求打磨清晰 |
| `prototype` | 交互原型 | 预览和确认 UI 原型（无 UI 变更时跳过） |
| `plan` | 技术设计 | 作为 Tech Leader 评审技术详设 |
| `coding` | 编码开发 | "喝杯咖啡歇一歇" — 最小参与 |
| `quality` | 质量审查与修复 | 仅在高风险时介入 |
| `verify` | 黑盒验证 | 查看验证证据，决定是否接受自动修复 |
| `release` | 发布交付 | 确认发布策略 |

prototype 步骤根据需求是否涉及 UI 变更条件性包含/排除。

---

## 共享组件一览

所有共享组件位于 `src/components/`：

| 组件 | 文件 | 使用方 |
|---|---|---|
| `TypewriterText` | `TypewriterText.tsx` | LandingPage |
| `WorkspaceSelector` | `WorkspaceSelector.tsx` | DashboardPage |
| `UnifiedDeliveryWorkspace` | `UnifiedDeliveryWorkspace.tsx` | DashboardPage |
| `SessionHistoryPanel` | `SessionHistoryPanel.tsx` | DashboardPage |
| `ScheduledTasksPanel` | `ScheduledTasksPanel.tsx` | DashboardPage |
| `ProjectEnvPanel` | `ProjectEnvPanel.tsx` | DashboardPage |
| `HomeTaskBoard` | `HomeTaskBoard.tsx` | (已由 UnifiedDeliveryWorkspace 替代，未渲染) |
| `AddStoryCardModal` | `AddStoryCardModal.tsx` | HomeTaskBoard |
| `LeftPanel` | `LeftPanel.tsx` | TaskPage |
| `DecisionBoard` | `DecisionBoard.tsx` | TaskPage（渲染两次） |
| `Drawer` | `Drawer.tsx` | TaskPage |
| `AgentStatusBadge` | `AgentStatusBadge.tsx` | TaskPage |
| `WorkspaceExplorer` | `WorkspaceExplorer.tsx` | LeftPanel |
| `SpecsExplorer` | `SpecsExplorer.tsx` | WorkspaceExplorer |
| `RepoExplorer` | `RepoExplorer.tsx` | WorkspaceExplorer / TaskPage workbench code tab |
| `DiffViewer` | `DiffViewer.tsx` | Drawer / RepoExplorer / ContentModal / DecisionBoard |
| `MarkdownRenderer` | `MarkdownRenderer.tsx` | LeftPanel / DecisionBoard / ContentModal / HomeTaskBoard |
| `TokenUsageBadge` | `TokenUsageBadge.tsx` | DecisionBoard |
| `ContentModal` | `ContentModal.tsx` | DecisionBoard |
| `SopNav` | `SopNav.tsx` | (TaskPage 导入但未渲染，工作流导航内联在 LeftPanel) |

---

## 状态管理架构

| 状态域 | 机制 | 文件 | 说明 |
|---|---|---|---|
| 应用状态 (AppState) | `useStoredState` + localStorage | `src/hooks/useStoredState.ts` | 键 `zero-one-software.prototype.v4`，DashboardPage 与 TaskPage 通过 localStorage 共享 |
| 运行时状态 (RuntimeState) | React Context + `useReducer` | `src/stores/runtimeStore.tsx` | 模式切换、连接状态、端点健康、资源监控、项目 CRUD |
| Agent 会话状态 | `useAgent` hook + WebSocket | `src/agent/useAgent.ts` | 会话管理、turn 追踪、工具调用、文件操作 |
| 会话记录 | `useSessionRecords` hook | `src/hooks/useSessionRecords.ts` | 历史会话持久化与恢复 |

---

## 目录结构

```
src/
├── App.tsx                    # 路由定义 + RuntimeProvider
├── pages/
│   ├── LandingPage.tsx        # 落地页
│   ├── DashboardPage.tsx      # 控制台
│   ├── TaskPage.tsx           # 任务执行工作区
│   └── AgentDashboard.tsx     # 运行时管理中心
├── components/                # 共享组件 (20 个)
├── stores/
│   └── runtimeStore.tsx       # 运行时状态 Context
├── hooks/
│   ├── useStoredState.ts      # localStorage 持久化状态
│   └── useSessionRecords.ts   # 会话记录管理
├── agent/
│   ├── useAgent.ts            # Agent 会话 hook
│   ├── ws.ts                  # WebSocket 连接管理
│   ├── types.ts               # Agent 类型定义
│   ├── config.ts              # Agent 配置
│   └── index.ts               # Agent 模块入口
└── data/
    └── workflowData.ts        # SOP 工作流定义 + 工具函数
```
