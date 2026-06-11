# Server 模块分析报告

> 生成日期：2026-06-09

## 一、整体架构

Server 是一个 **WebSocket 优先的 Agent 运行时服务**，基于 Node.js HTTP + `ws` 库构建。前端通过 WebSocket 长连接与 Agent 交互，HTTP 仅用于健康检查、文件浏览、Git diff 等辅助功能。

### 核心依赖

- `@earendil-works/pi-coding-agent` — 底层 Agent SDK（会话管理、工具执行、LLM 调用）
- `ws` — WebSocket 服务端
- `dotenv` — 环境变量加载
- LLM 提供商：**DeepSeek**（通过 OpenAI 兼容 API）

### 启动入口

`server/index.ts` 初始化 5 个核心组件，然后启动 HTTP + WebSocket 双协议服务：

```
index.ts
├── AgentRunner        ← 创建 AgentSession（按步骤配置）
├── SessionPool        ← 管理活跃 session 池
├── SummaryStore       ← 内存摘要存储（供总结链路使用）
├── WorkspaceManager   ← 工作区文件系统管理
└── SessionStore       ← 会话记录持久化
```

---

## 二、模块详解

### 1. `index.ts` — 服务入口

- 端口：`AGENT_PORT` 环境变量，默认 `3100`
- HTTP 服务：`http.createServer` + `handleHttpRequest` 路由分发
- WebSocket 服务：`wss.on("connection")` → 可选 Token 认证 → `handleWsMessage`
- 认证：通过 `AGENT_SECRET` 环境变量控制，未设置时接受所有连接

### 2. `httpRoutes.ts` — HTTP 路由

| 路由 | 方法 | 用途 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/specs-tree` | GET | 读取项目 specs 目录树 |
| `/specs-file` | GET | 读取 specs 下文件内容 |
| `/specs-save` | POST | 保存 specs 文件 |
| `/repo-tree` | GET | 读取项目仓库目录树 |
| `/repo-file` | GET | 读取仓库文件内容 |
| `/repo-diff` | GET | 获取 git diff |
| `/repo-diff-files` | GET | 按文件拆分的 git diff |
| `/project-build` | GET | 执行编译命令 |
| `/read-file` | GET | 读取任意本地文件 |
| `/step-snapshot` | GET | 读取步骤会话快照（替代 WebSocket `session.loadStep`） |
| `/qa-review` | GET | **SSE 流式**执行 QA 审查 CLI |
| `/api/*` | 多种 | Cloud Runtime REST API |

**关键设计**：`/qa-review` 使用 SSE（Server-Sent Events）实现 CLI 命令的实时流式输出，客户端断开时自动终止子进程。

### 3. `wsHandler.ts` — WebSocket 消息处理

这是 Server 最核心的文件，处理所有 Agent 交互。消息协议定义在 `protocol.ts`。

**支持的方法（共 25 个）：**

| 方法 | 用途 |
|------|------|
| `session.create` | 创建新 Agent 会话 |
| `session.prompt` | 发送用户消息触发 Agent 执行 |
| `session.steer` | 在 Agent 执行中插入引导消息 |
| `session.followUp` | 追问（同 steer 逻辑） |
| `session.abort` | 中止当前 Agent 执行 |
| `session.dispose` | 销毁会话 |
| `session.answerQuestion` | 回答 Agent 提问（Phase 1） |
| `session.continueQuestion` | 继续 Agent 执行（Phase 2） |
| `session.resumeQuestion` | 创建新会话并恢复问题回答 |
| `session.reconnect` | 重连时恢复 session 状态 |
| `session.restore` | 从历史消息恢复 session |
| `session.retry` | 重试整个 Agent 流程 |
| `summarization.save` | 保存 Agent 完成摘要 |
| `summarization.trigger` | 触发结构化总结 |
| `build.detectCommand` | 检测项目编译命令 |
| `build.trigger` | 触发编译分析 |
| `build.save` | 保存编译结果 |
| `build.fix` | 创建修复会话 |
| `workspace.tree` | 获取工作区文件树 |
| `workspace.readFile` | 读取工作区文件 |
| `workspace.browse` | 浏览文件系统目录 |
| `session.saveRecord` | 保存完整会话记录 |
| `session.loadRecord` | 加载会话记录 |
| `session.listRecords` | 列出所有会话记录 |
| `session.deleteRecord` | 删除会话记录 |
| `session.saveMeta` | 保存会话元信息 |
| `session.loadMeta` | 加载会话元信息 |

**事件流**：SDK 事件 → `mapSdkEvent()` 映射 → WebSocket 推送。支持的事件类型：`text_delta`、`thinking_delta`、`tool_execution_start/update/end`、`message_start/end`、`agent_start/end`、`turn_start/end`、`error`、`queue_update`、`compaction_start/end`、`session_snapshot`。

**关键逻辑**：
- `steer()`/`followUp()` 在 Agent 空闲时会 fallback 到 `prompt()` 直接触发新轮次，这是 WebSocket 断连重连后消息积压导致并发 Agent 运行的根因。
- **自动步骤快照**：在 `turn_end` 和 `agent_end` 事件触发时，Server 自动调用 `SessionStore.saveStep()` 持久化当前步骤的会话快照（messages + turns），不再通过 WebSocket 暴露 `session.saveStep`。
- **步骤快照读取**：`loadStep` 改为 HTTP GET `/step-snapshot?sessionId=xxx&stepId=xxx`，不依赖 WebSocket 连接。

### 4. `AgentRunner.ts` — Agent 会话工厂

根据步骤配置创建不同类型的 AgentSession：

- `createSession()` — 主流程，按 `stepConfigs.ts` 配置创建
- `createSummarizationSession()` — 独立总结会话（轻量模型 + 干净上下文）
- `createBuildCommandSession()` — 编译命令检测会话
- `createBuildSession()` — 编译分析会话

每个会话创建时注入：模型、thinkingLevel、工具白名单、customTools（如 `ask_user_question`）、skills、system prompt。

### 5. `stepConfigs.ts` — 步骤配置

定义 6 个步骤的 Agent 配置：

| 步骤 | 模型 | Thinking | 工具 | Skills |
|------|------|----------|------|--------|
| `intent` | deepseek-v4-flash | medium | read,grep,find,ls,ask_user_question,write | — |
| `plan` | deepseek-v4-flash | medium | read,grep,find,ls,ask_user_question,write | — |
| `coding` | deepseek-v4-flash | **high** | read,write,grep,find,ls,bash | frontend-dev |
| `quality` | deepseek-v4-flash | medium | read,bash,grep,find,ls | testing |
| `verify` | deepseek-v4-flash | medium | read,write,bash,grep,find,ls | testing |
| `release` | deepseek-v4-flash | **low** | read,write,bash,grep,find,ls | devops |

Skills 从 `server/skills/*.md` 文件加载，通过 `loadSkill()` 解析 Markdown 标题和 `## 能力` 段落。

### 6. `SessionPool.ts` — 会话池

- 键：`taskId:step` → `AgentSession`
- 索引：`sessionId` → `{taskId, step}`
- 自动清理：`set()` 时若已有旧 session 则 `dispose()`
- 事件订阅管理：`setUnsub()` / `clearUnsub()` 支持 WebSocket 重连时重新绑定

### 7. `SessionStore.ts` — 会话持久化

**存储位置**：
- 主存储：`~/.aiNativeDevPlatform/sessions/{sessionId}/`
- 镜像存储：`~/workspaces/{taskId}/session/`（通过 WorkspaceManager）

**目录结构**：
```
{sessionId}/
  meta.json              ← 任务元信息
  step-{workflowId}.json ← 各步骤会话快照
```

**StepSessionSnapshot** 包含：messages、turns、summary、summarizationResult、buildCommand/Result、qaStatus/OutputLines/ResultContent 等完整执行状态。

### 8. `WorkspaceManager.ts` — 工作区管理

支持三种模式：

| 模式 | 触发条件 | 工作目录 |
|------|----------|----------|
| 托管模式 | 无外部路径、无 git repo | `~/workspaces/{taskId}/` |
| 云端模式 | 提供 `gitRepo` 参数 | `~/workspaces/{taskId}/repo/` |
| 外部模式 | 提供 `workspacePath` | 用户指定目录 |

**安全措施**：
- Git clone 参数校验（URL 协议白名单、分支名正则）
- 路径遍历防护（`resolveWorkspace()` 检查前缀）
- 子进程超时（2 分钟）

### 9. `customTools.ts` — 自定义工具

实现 `ask_user_question` 工具的两阶段流程：

1. **Phase 1** (`resolveQuestion`)：用户回答问题，答案暂存，Agent 保持阻塞
2. **Phase 2** (`continueQuestion`)：用户点击继续，Promise resolve，Agent 恢复执行

超时保护：5 分钟自动取消。

### 10. `customFindTool.ts` — 自定义文件查找

纯 Node.js 实现的 `FindOperations`，替代 `fd` 命令。支持 glob 模式（`*`、`**`、`?`、`{a,b}`、`[abc]`），递归遍历目录，忽略 `.gitignore` 模式。

### 11. `SummaryStore.ts` — 摘要存储

简单的内存 Map，存储 `(taskId:step) → summary` 文本。供独立总结 Session 读取，避免通过 WebSocket 传输大文本。

### 12. `config.ts` — 配置

- `createAuthStorage()`：从 `DEEPSEEK_API_KEY` 环境变量注入 API Key
- `getDefaultProvider()`：返回 `"deepseek"`
- `getDefaultModel()`：返回 `"deepseek-v4-flash"`

### 13. `protocol.ts` — 通信协议

定义完整的 WebSocket 消息类型系统：
- `AgentMethod`：25 种方法名联合类型
- `WsMessage`：request / event / response / error / ping / pong
- `AgentEvent`：13 种事件类型
- `SessionSnapshot`：重连时推送的完整状态快照

### 14. `utils/fileOps.ts` — 文件操作工具

- `readSpecsTree()` / `readRepoTree()`：递归读取目录树
- `readFileSafe()` / `writeFileSafe()`：带路径穿越防护的文件读写
- `existsSync()`：路径存在性检查

### 15. `utils/gitOps.ts` — Git 操作工具

- `getRepoDiff()`：获取 `git diff HEAD` + `git diff --cached`
- `getRepoDiffFiles()`：按文件拆分 diff，包含未跟踪的新增文件
- `execCommand()`：在指定目录执行 shell 命令

---

## 三、数据流

### 主流程（前端 → Server → LLM）

```
前端 WebSocket
  → session.create (taskId, step)
    → AgentRunner.createSession() → AgentSession
    → SessionPool.set()
  → session.prompt (text)
    → AgentSession.prompt()
    → SDK 事件 → mapSdkEvent() → WebSocket 推送
    → turn_end / agent_end 时自动保存步骤快照
  → session.dispose
    → SessionPool.dispose()
```

### 总结链路

```
前端
  → summarization.save (summary)
    → SummaryStore.set()
  → summarization.trigger
    → AgentRunner.createSummarizationSession()
    → 读取 SummaryStore → 构建 prompt → LLM 调用
    → 结构化 JSON 输出 → WebSocket 推送
```

### 编译链路

```
前端
  → build.detectCommand
    → AgentRunner.createBuildCommandSession()
    → LLM 分析构建配置 → 返回命令
  → 前端执行编译 → build.trigger (编译结果)
    → AgentRunner.createBuildSession()
    → LLM 分析编译输出 → 结构化报告
  → build.fix (编译失败时)
    → AgentRunner.createSession() → 修复会话
```

### QA 审查链路

```
前端 HTTP GET /qa-review?path=...&sessionId=...
  → spawn("qa-review --output <file>")
  → SSE 流式输出 stdout/stderr
  → 完成后读取结果文件 → 推送 complete 事件
```

---

## 四、关键设计决策

1. **WebSocket 优先**：Agent 交互天然需要双向实时通信，HTTP 仅用于辅助功能
2. **步骤隔离**：每个步骤独立 session，通过 `SessionPool` 管理，支持并行步骤
3. **双阶段提问**：`ask_user_question` 拆为 answer + continue 两步，前端可控制恢复时机
4. **双存储策略**：主存储 + workspace 镜像，镜像写入失败不影响主流程
5. **SSE 流式 CLI**：QA 审查使用 SSE 而非 WebSocket，避免与 Agent 事件流耦合
6. **重连恢复**：`session.reconnect` 推送完整 `SessionSnapshot`，前端可重建 UI 状态

---

## 五、潜在问题

1. **WebSocket 断连重连风暴**：`steer()`/`followUp()` 在空闲时调用 `prompt()`，断连期间积压的消息会触发多个并发 Agent 运行
2. **内存泄漏风险**：`SummaryStore` 和 `pendingQuestions` 无自动清理机制，长时间运行可能累积
3. **错误处理不一致**：部分 `try/catch` 静默忽略错误（如镜像写入、目录删除），调试困难
4. **`session.resumeQuestion` 重复逻辑**：与 `session.retry` 有大量重复的 session 创建代码，可提取公共方法
5. **`build.detectCommand` 事件订阅**：在 `agent_end` 中 `unsub()` + `dispose()`，但 `session.prompt()` 是异步的，可能存在竞态
6. **无请求限流**：`/qa-review` 可被任意调用启动子进程，无并发控制
