# 会话记录系统

## 概述

会话记录系统用于持久化保存用户的研发任务会话，支持：
- 自动保存任务执行过程中的关键状态
- 在首页"历史会话"标签页查看所有历史记录
- 点击"继续执行"从历史断点恢复任务
- 删除不再需要的会话记录

## 存储位置

所有会话记录存储在 `~/.aiNativeDevPlatform/sessions/` 目录下。

### 目录结构

每个会话一个目录，目录名 = 32 位 `sessionId`：

```
~/.aiNativeDevPlatform/sessions/
  {sessionId}/
    meta.json              ← 任务元信息
    step-intent.json       ← 需求分析步骤的对话快照
    step-plan.json         ← 技术设计步骤的对话快照
    step-coding.json       ← 编码开发步骤的对话快照
    step-quality.json      ← 质量QA步骤的对话快照
    step-verify.json       ← 验证修复步骤的对话快照
    step-release.json      ← 发布交付步骤的对话快照
```

### 设计原则

- **按步骤独立存储**：每个 SOP 步骤的对话数据独立存储为 `step-{workflowId}.json`，支持按需加载和独立更新
- **元信息与对话数据分离**：`meta.json` 仅存储任务元信息（intent、workspacePath、stepIndex 等），不含对话数据
- **列表查询高效**：历史会话列表仅加载 `meta.json`，无需读取完整的对话数据

## 数据模型

### SessionMeta（任务元信息）

```typescript
type SessionMeta = {
  sessionId: string;                    // 32 位唯一标识
  taskId: string;                       // 兼容旧版 taskId（task-{timestamp}）
  intent: string;                       // 用户意图/需求描述
  workspacePath: string;                // 工作空间路径
  stepIndex: number;                    // 当前步骤索引 (0-5)
  activeStage: string;                  // 当前活动阶段
  notes: string;                        // 用户备注
  todoAnswers: Record<number, ...>;     // 待决策事项的回答
  initialPrompts: Record<string, string>; // 各步骤初始提示词
  codeConfirmed: boolean;
  fixApproved: boolean;
  releaseApproved: boolean;
  qualityPassed: boolean;
  createdAt: string;                    // 创建时间 (ISO)
  updatedAt: string;                    // 最后更新时间 (ISO)
  status: "active" | "completed";
  stepSummaries: Record<string, string>; // 各步骤的 Agent 总结摘要
};
```

### StepSessionSnapshot（步骤会话快照）

```typescript
type StepSessionSnapshot = {
  messages: Array<{ role: string; content: string }>;  // 该步骤的对话消息
  turns: Turn[];                                        // Agent 执行轮次
  summary: string;                                      // Agent 生成的步骤摘要
  summarizationResult?: AgentSummary | null;            // 结构化总结结果
};
```

### SessionRecord（完整记录 = 元信息 + 所有步骤对话数据）

```typescript
type SessionRecord = SessionMeta & {
  stepSessions: Record<string, StepSessionSnapshot>;
};
```

## 架构

### 服务端

- **`server/SessionStore.ts`** — 文件系统持久化存储，提供：
  - `save/saveMeta/saveStep` — 保存元信息或某步骤的会话快照
  - `load/loadMeta/loadStep` — 加载完整记录、元信息或某步骤快照
  - `list` — 列出所有会话元信息（按更新时间倒序）
  - `delete` — 删除整个会话目录
  - `generateSessionId()` — 生成 32 位随机 sessionId
- **`server/index.ts`** — 通过 WebSocket 暴露方法：
  - `session.saveRecord` — 保存完整会话记录（内部拆分为 meta + step 文件）
  - `session.loadRecord` — 按 sessionId 加载完整记录
  - `session.listRecords` — 列出所有记录的元信息
  - `session.deleteRecord` — 删除指定会话
  - `session.saveStep` — 保存某步骤的会话快照
  - `session.loadStep` — 加载某步骤的会话快照
  - `session.saveMeta` — 保存任务元信息
  - `session.loadMeta` — 加载任务元信息

### 前端

- **`src/hooks/useSessionRecords.ts`** — React Hook，封装与服务端的通信，提供：
  - `records` — 会话元信息列表（`SessionMeta[]`）
  - `saveRecord` — 保存完整记录（兼容旧接口）
  - `saveStep` — 保存某步骤的会话快照
  - `saveMeta` — 保存任务元信息
  - `loadRecord` — 按 sessionId 加载完整记录
  - `loadStep` — 按 sessionId + stepId 加载某步骤快照
  - `deleteRecord` — 删除会话
- **`src/components/SessionHistoryPanel.tsx`** — 历史会话面板组件
- **`src/pages/HomePage.tsx`** — 集成"历史会话"标签页，创建任务时生成 32 位 sessionId
- **`src/pages/WorkspacePage.tsx`** — 关键状态变化时自动触发保存

## sessionId 生成

在 `HomePage` 创建任务时（`requestStartTask`），生成 32 位十六进制随机字符串作为 `sessionId`：

```typescript
const sessionId = Array.from({ length: 32 }, () =>
  Math.floor(Math.random() * 16).toString(16)
).join("");
```

`sessionId` 存储在 `AppState.sessionId` 中，贯穿整个任务生命周期。

## 自动保存触发条件

在 WorkspacePage 中，以下状态变化会触发自动保存（2 秒防抖）：
- `stepIndex` — 步骤切换
- `activeStage` — 活动阶段变化
- `notes` — 备注变化
- `todoAnswers` — 待决策回答变化
- `codeConfirmed/fixApproved/releaseApproved/qualityPassed` — 审批状态变化
- `workspacePath` — 工作空间路径变化

## 从历史恢复流程

1. 用户在首页点击"历史会话"标签
2. 展开某条记录，在"补充需求"文本框中输入对原有需求的补充或修改（可选）
3. 点击"继续执行"
4. 系统加载完整记录（含 stepSessions 对话数据）
5. 将记录的字段恢复到 `AppState`，包括 `sessionId` 和 `restoredSessions`
6. 设置 `view: "workspace"` 并导航到 `/workspace`
7. WorkspacePage 检测到 `restoredSessions` 非空，自动为每个有历史记录的步骤创建 Agent session 并通过 `steer` 注入历史对话上下文
8. 后续保存仍使用原始 `sessionId`，确保数据追加到同一会话目录

## 对话快照捕获

在 WorkspacePage 中，每次自动保存时（防抖 2s），会从 Agent 实例获取当前步骤的对话消息、轮次和摘要，保存到对应的 `step-{workflowId}.json` 文件中。这样在恢复时，Agent 能够感知之前的对话上下文，实现无缝继续。

## 新增的 WebSocket 协议方法

```typescript
// protocol.ts 新增
type AgentMethod =
  // ... 原有方法
  | "session.saveRecord"
  | "session.loadRecord"
  | "session.listRecords"
  | "session.deleteRecord"
  // 按步骤独立存储
  | "session.saveStep"
  | "session.loadStep"
  | "session.saveMeta"
  | "session.loadMeta";
```
