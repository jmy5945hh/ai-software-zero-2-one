# 会话记录系统

## 概述

会话记录系统用于持久化保存用户的研发任务会话，支持：
- 自动保存任务执行过程中的关键状态
- 在首页"历史会话"标签页查看所有历史记录
- 点击"继续执行"从历史断点恢复任务
- 删除不再需要的会话记录

## 存储位置

所有会话记录存储在 `~/.aiNativeDevPlatform/sessions/` 目录下，每个会话一个 JSON 文件。

## 数据模型

```typescript
type StepSessionSnapshot = {
  messages: Array<{ role: string; content: string }>;  // 该步骤的对话消息
  turnCount: number;                                     // 对话轮次
  summary: string;                                       // Agent 生成的步骤摘要
};

type SessionRecord = {
  taskId: string;                    // 唯一标识
  intent: string;                    // 用户意图/需求描述
  workspacePath: string;             // 工作空间路径
  stepIndex: number;                 // 当前步骤索引 (0-5)
  activeStage: string;               // 当前活动阶段 (intent/plan/coding/quality/verify/release)
  scope: string;                     // 交付范围 (mvp/governed/full)
  selectedModules: string[];         // 已选功能模块
  notes: string;                     // 用户备注
  todoAnswers: Record<number, string | string[]>;  // 待决策事项的回答
  initialPrompts: Record<string, string>;           // 各步骤初始提示词
  codeConfirmed: boolean;            // 代码确认状态
  fixApproved: boolean;              // 修复授权状态
  releaseApproved: boolean;          // 发布确认状态
  qualityPassed: boolean;            // 质量门禁状态
  createdAt: string;                 // 创建时间 (ISO)
  updatedAt: string;                 // 最后更新时间 (ISO)
  status: "active" | "completed";   // 会话状态
  stepSummaries: Record<string, string>;  // 各步骤的 Agent 总结摘要
  stepSessions: Record<string, StepSessionSnapshot>;  // 各步骤的完整对话快照
};
```

## 架构

### 服务端

- **`server/SessionStore.ts`** — 文件系统持久化存储，提供 `save/load/list/delete` 方法
- **`server/index.ts`** — 通过 WebSocket 暴露 4 个方法：
  - `session.saveRecord` — 保存/更新会话记录
  - `session.loadRecord` — 按 taskId 加载单条记录
  - `session.listRecords` — 列出所有记录（按更新时间倒序）
  - `session.deleteRecord` — 删除指定记录

### 前端

- **`src/hooks/useSessionRecords.ts`** — React Hook，封装与服务端的通信，提供 `records/saveRecord/loadRecord/deleteRecord/refreshRecords`
- **`src/components/SessionHistoryPanel.tsx`** — 历史会话面板组件，展示记录列表、展开详情、继续执行/删除操作
- **`src/pages/HomePage.tsx`** — 集成"历史会话"标签页
- **`src/pages/WorkspacePage.tsx`** — 关键状态变化时自动触发保存（防抖 2s）

## 自动保存触发条件

在 WorkspacePage 中，以下状态变化会触发自动保存（2 秒防抖）：
- `stepIndex` — 步骤切换
- `activeStage` — 活动阶段变化
- `scope` — 交付范围变化
- `selectedModules` — 模块选择变化
- `notes` — 备注变化
- `todoAnswers` — 待决策回答变化
- `codeConfirmed/fixApproved/releaseApproved/qualityPassed` — 审批状态变化
- `workspacePath` — 工作空间路径变化

## 从历史恢复流程

1. 用户在首页点击"历史会话"标签
2. 展开某条记录，在"补充需求"文本框中输入对原有需求的补充或修改（可选）
3. 点击"继续执行"
4. 系统将记录的字段恢复到 `AppState`，包括 `restoredSessions`（各步骤的对话快照）
5. 设置 `view: "workspace"` 并导航到 `/workspace`
6. WorkspacePage 检测到 `restoredSessions` 非空，自动为每个有历史记录的步骤创建 Agent session 并通过 `steer` 注入历史对话上下文
7. 如果用户输入了补充需求，该内容会追加到原始 intent 后，作为新的需求描述

## 对话快照捕获

在 WorkspacePage 中，每次自动保存时（防抖 2s），会从 Agent 实例获取当前步骤的对话消息、轮次和摘要，保存到 `stepSessions` 字段中。这样在恢复时，Agent 能够感知之前的对话上下文，实现无缝继续。

## 新增的 WebSocket 协议方法

```typescript
// protocol.ts 新增
type AgentMethod =
  // ... 原有方法
  | "session.saveRecord"
  | "session.loadRecord"
  | "session.listRecords"
  | "session.deleteRecord";
```
