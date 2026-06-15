# Agent Server API 文档

> 本文档覆盖 Agent Server（`server/index.ts`）提供的所有接口，包括 WebSocket 和 HTTP 两类通信方式。

---

## 基础信息

| 项目 | 值 |
|------|-----|
| 服务端口 | `3100`（可通过 `AGENT_PORT` 环境变量覆盖） |
| WebSocket 端点 | `ws://host:3100/agent` |
| HTTP 端点 | `http://host:3100/...` |
| 认证方式 | 可选 Token 认证（`AGENT_SECRET` 环境变量），WebSocket 连接时通过 `?token=...` 传递 |
| LLM 提供商 | DeepSeek（通过 `DEEPSEEK_API_KEY` 环境变量配置） |

---

## 1. WebSocket 协议

### 1.1 连接

```
ws://host:3100/agent
```

若服务端设置了 `AGENT_SECRET`，连接时必须携带 `?token=<AGENT_SECRET>` 查询参数，否则会被关闭（关闭码 `4001`）。

### 1.2 消息格式

所有消息遵循统一的 `WsMessage` 类型：

```typescript
// 请求（客户端 → 服务端）
{ type: "request", id: string, method: string, params: object }

// 成功响应（服务端 → 客户端）
{ type: "response", id: string, result: object }

// 错误响应（服务端 → 客户端）
{ type: "error", id: string, error: { code: string, message: string } }

// 事件推送（服务端 → 客户端，流式输出）
{ type: "event", id: string, event: AgentEvent }

// 心跳
{ type: "ping", ts: number }       // 客户端 → 服务端
{ type: "pong", ts: number }       // 服务端 → 客户端
```

### 1.3 心跳

客户端定期发送 `ping`，服务端回复 `pong`。

```json
// 请求
{ "type": "ping", "ts": 1718000000000 }

// 响应
{ "type": "pong", "ts": 1718000000000 }
```

### 1.4 Agent 事件流

在请求执行过程中，服务端会推送一系列 `AgentEvent` 事件：

| 事件类型 | 字段 | 说明 |
|---------|------|------|
| `text_delta` | `delta: string` | 流式文本输出片段 |
| `thinking_delta` | `delta: string` | 流式思考/推理输出片段 |
| `tool_execution_start` | `toolName, toolCallId, input` | 工具开始执行 |
| `tool_execution_update` | `toolCallId, output` | 工具执行中间输出 |
| `tool_execution_end` | `toolCallId, result, isError` | 工具执行结束 |
| `message_start` | — | Agent 消息开始 |
| `message_end` | — | Agent 消息结束 |
| `agent_start` | — | Agent 开始运行 |
| `agent_end` | `summary: string` | Agent 运行结束，附带摘要 |
| `turn_start` | — | 一轮交互开始 |
| `turn_end` | — | 一轮交互结束 |
| `error` | `message: string` | 错误发生 |
| `queue_update` | `steering: string[], followUp: string[]` | 队列状态更新 |
| `compaction_start` | — | 上下文压缩开始 |
| `compaction_end` | — | 上下文压缩结束 |
| `session_snapshot` | `session: SessionSnapshot` | 完整 session 状态快照（重连时推送） |

### 1.5 请求方法

#### 1.5.1 Session 管理

##### `session.create`

创建新的 Agent session。

**Params:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `taskId` | string | 是 | 任务 ID |
| `step` | string | 是 | 步骤名称（如 `intent`, `plan`, `coding` 等） |
| `intent` | string | 否 | 任务意图描述 |
| `workspacePath` | string | 否 | 本地工作目录路径（本地模式） |
| `gitRepo` | object | 否 | Git 仓库信息（云端模式）：`{ url: string, branch: string }` |

**Result:**

```json
// 正常
{ "sessionId": "sess_xxx", "workspaceDir": "/path/to/workspace" }

// workspace 正在初始化（git clone 进行中）
{ "status": "workspace_initializing", "initStatus": { "stage": "cloning", ... }, "workspaceDir": "/path/to/workspace" }
```

---

##### `session.steer`

向已有 session 发送用户输入。若 session 不存在则自动创建。

**Params:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `taskId` | string | 是 | 任务 ID |
| `step` | string | 是 | 步骤名称 |
| `text` | string | 是 | 用户输入文本 |
| `intent` | string | 否 | 任务意图（session 不存在时用于创建） |
| `workspacePath` | string | 否 | 本地工作目录路径 |
| `gitRepo` | object | 否 | Git 仓库信息 |

**行为：**
- 若 session 正在流式输出（`isStreaming === true`），调用 `steer()` 入队
- 若 session 空闲（`isStreaming === false`），调用 `prompt()` 触发新一轮 LLM 调用

---

##### `session.abort`

中止当前正在运行的 Agent session。

**Params:** `{ taskId: string, step: string }`

---

##### `session.dispose`

销毁 session，释放资源。

**Params:** `{ taskId: string, step: string }`

---

##### `session.reconnect`

通过 `sessionId` 重连到已有 session，恢复状态。

**Params:** `{ sessionId: string }`

**Result:**

```json
{ "found": true }
```

随后服务端会推送一个 `session_snapshot` 事件，包含完整的 `SessionSnapshot`：

```typescript
{
  sessionId: string;
  taskId: string;
  step: string;
  isStreaming: boolean;
  completed: boolean;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  turns: Array<{
    id: string;
    index: number;
    status: "running" | "done";
    textContent: string;
    thinking: string;
    toolCalls: Array<{
      id: string;
      name: string;
      status: "running" | "done" | "error";
      category: string;
      input: string;
      result?: string;
      outputFragments: string[];
    }>;
  }>;
  hasPendingQuestion: boolean;
  pendingQuestion?: { question: string; options?: string[] };
}
```

若 session 未找到，返回 `{ found: false }`。

---

##### `session.restore`

从历史消息恢复 session（创建新 session + 回放历史消息）。

**Params:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `taskId` | string | 是 | 任务 ID |
| `step` | string | 是 | 步骤名称 |
| `messages` | array | 否 | 历史消息列表：`[{ role: "user"|"assistant", content: string }]` |
| `intent` | string | 否 | 任务意图 |
| `workspacePath` | string | 否 | 本地工作目录路径 |
| `gitRepo` | object | 否 | Git 仓库信息 |

**行为：** 先销毁已有 session，创建新 session，然后通过 `steer()` 回放所有历史用户消息（不触发模型执行）。

---

##### `session.answerQuestion`

回答 Agent 提出的问题（第一阶段：存储答案，Agent 保持阻塞）。

**Params:** `{ taskId: string, step: string, answer: string }`

---

##### `session.continueQuestion`

继续执行被问题阻塞的 Agent（第二阶段：解除阻塞）。

**Params:** `{ taskId: string, step: string }`

---

##### `session.resumeQuestion`

合并操作：创建新 session，拒绝旧 pending question，立即用答案提示 Agent。

**Params:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `taskId` | string | 是 | 任务 ID |
| `step` | string | 是 | 步骤名称 |
| `answer` | string | 是 | 用户回答 |
| `intent` | string | 否 | 任务意图 |
| `workspacePath` | string | 否 | 本地工作目录路径 |
| `gitRepo` | object | 否 | Git 仓库信息 |

---

#### 1.5.2 总结（Summarization）

##### `summarization.save`

保存原始总结文本到内存中的 SummaryStore。

**Params:** `{ taskId: string, step: string, summary: string }`

---

##### `summarization.trigger`

触发总结 Agent session，读取已保存的总结文本并生成结构化 JSON 输出。完成后自动销毁 session。

**Params:** `{ taskId: string, step: string }`

---

#### 1.5.3 编译（Build）

##### `build.detectCommand`

启动轻量 Agent 分析项目配置文件，检测编译命令。

**Params:** `{ workspacePath?: string, taskId?: string }`

**Result:** `{ command: string }`（如 `"npm run build"`）

---

##### `build.trigger`

分析编译结果，生成结构化编译报告。完成后自动销毁 session。

**Params:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `taskId` | string | 是 | 任务 ID |
| `step` | string | 是 | 步骤名称 |
| `buildResult` | object | 是 | `{ command, success, output, timestamp }` |

---

##### `build.save`

保存编译结果元数据到 session store。

**Params:** `{ taskId, sessionId, stepId, buildResult }`

---

##### `build.fix`

创建新 session 修复编译错误。

**Params:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `taskId` | string | 是 | 任务 ID |
| `step` | string | 是 | 步骤名称 |
| `sessionId` | string | 是 | 当前 session ID |
| `buildOutput` | string | 是 | 编译错误输出 |
| `workspacePath` | string | 否 | 本地工作目录路径 |
| `gitRepo` | object | 否 | Git 仓库信息 |

---

#### 1.5.4 会话记录持久化

##### `session.saveStep`

保存步骤快照到磁盘。

**Params:** `{ taskId, sessionId, stepId, snapshot: StepSessionSnapshot }`

---

##### `session.saveRecord`

保存完整会话记录（元数据 + 所有步骤快照）。

**Params:** 完整的 `SessionRecord` 对象

---

##### `session.loadRecord`

从磁盘加载完整会话记录。

**Params:** `{ sessionId: string }`

**Result:** `{ record: SessionRecord }`

---

##### `session.listRecords`

列出所有会话记录（仅元数据，不含对话内容）。

**Result:** `{ records: SessionMeta[] }`

---

##### `session.deleteRecord`

删除会话记录。

**Params:** `{ sessionId: string }`

---

## 2. HTTP REST API

所有 HTTP 接口均设置 CORS 头（允许跨域访问）。

### 2.1 健康检查

```
GET /health
```

**Response:** `{ status: "ok", timestamp: number }`

---

### 2.2 Specs 管理

#### 获取 specs 目录树

```
GET /specs-tree?path=<projectPath>&taskId=<taskId>
```

**查询参数：** `path` 或 `taskId` 二选一

**Response:** 目录树结构数组（若目录不存在返回空数组 `[]`）

---

#### 读取 specs 文件

```
GET /specs-file?path=<projectPath>&file=<filePath>&taskId=<taskId>
```

**查询参数：** `path` 或 `taskId` 二选一，`file` 必填

**Response:** `{ content: string, isMarkdown: boolean }`

---

#### 保存 specs 文件

```
POST /specs-save
Content-Type: application/json

{ "path": "<projectPath>", "file": "<filePath>", "content": "<content>", "taskId": "<taskId>" }
```

**Body 字段：** `path` 或 `taskId` 二选一，`file` 和 `content` 必填

**Response:** `{ success: true }`（路径穿越保护，非法路径返回 403）

---

### 2.3 仓库操作

#### 获取仓库文件树

```
GET /repo-tree?path=<projectPath>&taskId=<taskId>
```

排除 `.git`、`node_modules`、`specs`、隐藏文件等。

**Response:** 文件树数组

---

#### 读取仓库文件

```
GET /repo-file?path=<projectPath>&file=<filePath>&taskId=<taskId>
```

**Response:** `{ content: string }`

---

#### 获取 Git Diff

```
GET /repo-diff?path=<projectPath>&taskId=<taskId>
```

返回工作区和暂存区的变更。

**Response:** `{ diff: string }`

---

#### 获取按文件拆分的 Git Diff

```
GET /repo-diff-files?path=<projectPath>&taskId=<taskId>
```

**Response:**

```json
{
  "files": [
    { "path": "src/file.ts", "diff": "...", "additions": 10, "deletions": 2, "changeType": "modified" }
  ]
}
```

---

### 2.4 Workspace 操作

#### 获取 workspace 文件树

```
GET /workspace-tree?taskId=<taskId>
```

**Response:** `{ tree: [...] }`

---

#### 读取 workspace 文件

```
GET /workspace-read-file?taskId=<taskId>&filePath=<filePath>
```

支持 `~` 展开为 HOME 目录。

**Response:** `{ content: string }`

---

#### 浏览目录

```
GET /workspace-browse?dirPath=<dirPath>
```

用于前端目录选择器。返回排序后的条目（目录在前）。

**Response:** `{ entries: [...] }`

---

### 2.5 任务 & Session 管理

#### 初始化任务环境

```
POST /task/init
Content-Type: application/json

{
  "taskId": "string",
  "intent": "string",
  "runtimeMode": "local" | "cloud",
  "workspacePath": "string",       // 本地模式必填
  "gitRepo": { "url": "string", "branch": "string" },  // 云端模式必填
  "scope": "mvp",
  "selectedModules": [],
  "notes": "",
  "todoAnswers": {},
  "initialPrompts": {}
}
```

**行为：** 根据 `runtimeMode` 初始化 workspace（本地模式使用外部目录，云端模式异步 git clone），保存 `SessionMeta` 到磁盘。

**Response:** `{ success: true }`

---

#### 保存 Session 元数据

```
POST /session/save-meta
Content-Type: application/json

{ /* 完整的 SessionMeta 对象 */ }
```

**Response:** `{ success: true }`

---

#### 读取步骤快照

```
GET /step-snapshot?sessionId=<sessionId>&stepId=<stepId>
```

**Response:** `{ snapshot: StepSessionSnapshot }`

---

### 2.6 编译 & QA

#### 执行项目编译

```
GET /project-build?path=<projectPath>&command=<command>&taskId=<taskId>
```

在项目目录下执行指定的编译命令。

**Response:**

```json
{ "success": true, "output": "...", "command": "npm run build" }
```

---

#### QA 质量审查（SSE 流式）

```
GET /qa-review?path=<projectPath>&sessionId=<sessionId>&taskId=<taskId>
```

执行本地 `qa-review` CLI 命令，通过 Server-Sent Events 流式输出结果。

**Response（SSE 事件流）：**

```
data: {"type":"start","message":"QA 审查开始执行...","outputFile":"/path/to/quality_result.toml"}

data: {"type":"output","line":"审查输出行..."}

data: {"type":"complete","exitCode":0,"outputFile":"...","resultContent":"...","fullOutput":"..."}
```

---

#### 读取任意文件

```
GET /read-file?file=<filePath>
```

支持 `~` 展开为 HOME 目录。

**Response:** `{ content: string }`

---

### 2.7 Cloud Runtime API

#### 获取系统资源

```
GET /api/resources
```

**Response:**

```json
{
  "cpu": 35,
  "memory": 20,
  "disk": 40,
  "activeQueues": 2,
  "monthlyTokens": { "used": 125000, "total": 1000000 }
}
```

---

#### 列出项目

```
GET /api/projects
```

**Response:** 项目数组，每个项目包含 `id, name, description, status, progress, lastActivity`。

---

#### 创建项目

```
POST /api/projects
Content-Type: application/json

{ "name": "string", "description": "string" }
```

**Response:** 创建的项目对象（201 Created）

---

#### 删除项目

```
DELETE /api/projects/:id
```

**Response:** `{ success: true }`

---

#### 启动/暂停项目

```
POST /api/projects/:id/start
POST /api/projects/:id/pause
```

**Response:** `{ success: true }`（当前为 stub 实现）

---

## 3. 数据模型

### SessionMeta（持久化元数据）

```typescript
{
  sessionId: string;
  taskId: string;
  intent: string;
  workspacePath: string;
  runtimeMode: "local" | "cloud";
  gitRepo?: { url: string; branch: string; subdirectory?: string };
  stepIndex: number;
  activeStage: string;
  scope: string;
  notes: string;
  selectedModules: string[];
  todoAnswers: Record<number, string | string[]>;
  initialPrompts: Record<string, string>;
  codeConfirmed: boolean;
  fixApproved: boolean;
  releaseApproved: boolean;
  qualityPassed: boolean;
  createdAt: string;
  updatedAt: string;
  status: "active" | "completed";
  stepSummaries: Record<string, string>;
  qaReview?: { status: "idle" | "running" | "done" | "error" };
}
```

### StepSessionSnapshot（步骤快照）

```typescript
{
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  turns: Array<{
    id: string;
    index: number;
    status: "running" | "done";
    textContent: string;
    thinking: string;
    userInput?: string;
    toolCalls: Array<{ ... }>;
  }>;
  summary: string;
  summarizationResult?: object | null;
  buildCommand?: string | null;
  buildResult?: {
    command: string;
    success: boolean;
    output: string;
    timestamp: string;
    retryCount: number;
    building: boolean;
    fixing: boolean;
  } | null;
  completed?: boolean;
  summarizationStatus?: "idle" | "pending" | "loading" | "done" | "error";
  buildStatus?: "idle" | "pending" | "detecting" | "loading" | "done" | "error";
  qaStatus?: "idle" | "running" | "done" | "error";
  qaOutputLines?: string[];
  qaResultFilePath?: string;
  qaResultContent?: string;
  qaError?: string;
}
```

---

## 4. 工作流步骤（SOP）

| 步骤 | 模型 | 思考强度 | 可用工具 | 技能 |
|------|------|---------|---------|------|
| `intent` | deepseek-v4-flash | medium | read, grep, find, ls, ask_user_question, write | — |
| `plan` | deepseek-v4-flash | medium | read, grep, find, ls, ask_user_question, write | — |
| `coding` | deepseek-v4-flash | high | read, write, grep, find, ls, bash | frontend-dev |
| `quality` | deepseek-v4-flash | medium | read, bash, grep, find, ls | testing |
| `verify` | deepseek-v4-flash | medium | read, write, bash, grep, find, ls | testing |
| `release` | deepseek-v4-flash | low | read, write, bash, grep, find, ls | devops |

---

## 5. 错误码

| Code | 说明 |
|------|------|
| `AUTH_FAILED` | WebSocket Token 认证失败 |
| `INTERNAL` | 服务端内部错误 |
| `400` | 请求参数缺失或无效 |
| `403` | 路径穿越保护拒绝写入 |
| `404` | 文件或资源未找到 |
| `413` | 请求体过大 |
| `500` | 服务端处理失败 |
