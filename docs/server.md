# Server 模块分析报告

> 生成日期：2026-06-14

## 一、整体架构

Server 是一个 **WebSocket 优先的 Agent 运行时服务**，基于 Node.js HTTP + `ws` 库构建。前端通过 WebSocket 长连接与 Agent 交互，HTTP 用于健康检查、文件浏览、Git diff、任务初始化、Cloud Runtime API 等辅助功能。

### 核心依赖

- `@earendil-works/pi-coding-agent` — 底层 Agent SDK（会话管理、工具执行、LLM 调用）
- `ws` — WebSocket 服务端
- `dotenv` — 环境变量加载
- LLM 提供商：**DeepSeek**（通过 OpenAI 兼容 API，模型配置在 `models.json`）

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
- WebSocket 服务：`wss.on("connection")` → Token 认证 → `handleWsMessage`
- WebSocket 路径：`/agent`（通过 `WebSocketServer` 的 `path` 选项限定）
- 认证：通过 `AGENT_SECRET` 环境变量控制，未设置时接受所有连接。认证方式为 URL query 参数 `?token=xxx`

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
| `/repo-diff-files` | GET | 按文件拆分的 git diff（含未跟踪新增文件） |
| `/project-build` | GET | 执行编译命令（支持 `command` 参数由模型提供） |
| `/read-file` | GET | 读取任意本地文件（支持 `~` 展开） |
| `/step-snapshot` | GET | 读取步骤会话快照（替代 WebSocket `session.loadStep`） |
| `/qa-review` | GET | **SSE 流式**执行 QA 审查 CLI |
| `/workspace-tree` | GET | 获取 workspace 文件树（替代 WebSocket `workspace.tree`） |
| `/workspace-read-file` | GET | 读取 workspace 文件（替代 WebSocket `workspace.readFile`） |
| `/workspace-browse` | GET | 浏览文件系统目录（用于前端目录选择器） |
| `/task/init` | POST | 初始化任务环境（替代 WebSocket `task.init`） |
| `/session/save-meta` | POST | 保存会话元信息（替代 WebSocket `session.saveMeta`） |
| `/api/resources` | GET | Cloud Runtime 资源监控（CPU/内存/磁盘/队列） |
| `/api/projects` | GET | Cloud Runtime 项目列表 |
| `/api/projects` | POST | Cloud Runtime 创建项目 |
| `/api/projects/:id` | DELETE | Cloud Runtime 删除项目 |
| `/api/projects/:id/start` | POST | Cloud Runtime 启动项目 |
| `/api/projects/:id/pause` | POST | Cloud Runtime 暂停项目 |

**关键设计**：
- `/qa-review` 使用 SSE（Server-Sent Events）实现 CLI 命令的实时流式输出，客户端断开时自动终止子进程
- `/workspace-*` 和 `/task/init` 将原本 WebSocket 的 workspace 操作迁移到 HTTP，减少 WebSocket 消息耦合
- Cloud Runtime API 为 `CloudRuntimeConnector` 提供项目和资源数据，使用模拟数据

### 3. `wsHandler.ts` — WebSocket 消息处理

这是 Server 最核心的文件，处理所有 Agent 交互。消息协议定义在 `protocol.ts`。

**支持的方法（共 21 个，含 wsHandler 内部处理但未在类型中声明的）：**

| 方法 | 用途 |
|------|------|
| `session.create` | 创建新 Agent 会话 |
| `session.steer` | 在 Agent 执行中插入引导消息（空闲时 fallback 到 `prompt()`） |
| `session.abort` | 中止当前 Agent 执行 |
| `session.dispose` | 销毁会话 |
| `session.answerQuestion` | 回答 Agent 提问（Phase 1） |
| `session.continueQuestion` | 继续 Agent 执行（Phase 2） |
| `session.resumeQuestion` | 创建新会话并恢复问题回答（含旧问题清理） |
| `session.reconnect` | 重连时恢复 session 状态（含 pending question 检测） |
| `session.restore` | 从历史消息恢复 session（创建新 session + 回放历史消息） |
| `session.saveStep` | 保存步骤快照（兼容旧前端调用） |
| `summarization.save` | 保存 Agent 完成摘要 |
| `summarization.trigger` | 触发结构化总结 |
| `build.detectCommand` | 检测项目编译命令 |
| `build.trigger` | 触发编译分析 |
| `build.save` | 保存编译结果到步骤快照 |
| `build.fix` | 创建修复会话 |
| `session.saveRecord` | 保存完整会话记录 |
| `session.loadRecord` | 加载会话记录 |
| `session.listRecords` | 列出所有会话记录 |
| `session.deleteRecord` | 删除会话记录 |

**相比旧版的变化**：
- 移除了 `session.prompt`、`session.followUp`、`session.saveMeta` 方法（`prompt` 和 `followUp` 逻辑合并到 `steer` 中，`saveMeta` 迁移到 HTTP）
- 新增 `session.restore`、`session.resumeQuestion`、`session.saveStep`、`build.save`、`build.fix`
**事件流**：SDK 事件 → `mapSdkEvent()` 映射 → WebSocket 推送。支持的事件类型：`text_delta`、`thinking_delta`、`tool_execution_start/update/end`、`message_start/end`、`agent_start/end`、`turn_start/end`、`error`、`queue_update`、`compaction_start/end`、`session_snapshot`。

**新增事件类型**：`auto_retry_start`、`auto_retry_end`（当前被映射为 `null`，即忽略）。

**关键逻辑**：
- `steer()` 在 Agent 空闲时会 fallback 到 `prompt()` 直接触发新轮次，这是 WebSocket 断连重连后消息积压导致并发 Agent 运行的根因
- **自动步骤快照**：在 `turn_end` 和 `agent_end` 事件触发时，Server 自动调用 `SessionStore.saveStep()` 持久化当前步骤的会话快照（messages + turns），不再通过 WebSocket 暴露 `session.saveStep`
- **步骤快照读取**：`loadStep` 改为 HTTP GET `/step-snapshot?sessionId=xxx&stepId=xxx`，不依赖 WebSocket 连接
- **Prompt 构建函数**：`buildSummarizationPrompt()`、`buildBuildPrompt()`、`buildDetectCommandPrompt()` 内联在 wsHandler 中，分别用于总结、编译分析、编译命令检测

### 4. `AgentRunner.ts` — Agent 会话工厂

根据步骤配置创建不同类型的 AgentSession：

- `createSession()` — 主流程，按 `stepConfigs.ts` 配置创建，支持 `systemPromptOverride`
- `createSummarizationSession()` — 独立总结会话（轻量模型 + 干净上下文）
- `createBuildCommandSession()` — 编译命令检测会话
- `createBuildSession()` — 编译分析会话

每个会话创建时注入：模型、thinkingLevel、工具白名单、customTools（如 `ask_user_question`）、skills、system prompt。

**构造函数**：接收 `modelsJsonPath` 参数，初始化 `AuthStorage`、`ModelRegistry`、`SettingsManager`。

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

**Skills 加载机制**：Skills 从 `server/skills/*.md` 文件加载，通过 `loadSkill()` 解析 Markdown 标题（`# 标题`）和 `## 能力` 段落。当前有 5 个 skill 文件：
- `product-analysis.md` — 产品分析
- `architecture-design.md` — 架构设计
- `frontend-dev.md` — 前端开发
- `testing.md` — 测试
- `devops.md` — DevOps

**System Prompt 加载**：从 `server/prompts/{step}.md` 文件加载，每个步骤一个独立的 prompt 文件。

### 6. `SessionPool.ts` — 会话池

- 键：`taskId:step` → `AgentSession`
- 索引：`sessionId` → `{taskId, step}`
- 自动清理：`set()` 时若已有旧 session 则 `dispose()`
- 事件订阅管理：`setUnsub()` / `clearUnsub()` 支持 WebSocket 重连时重新绑定
- 新增 `getActiveCount()` 方法，用于 Cloud Runtime API 统计

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

**相比旧版的变化**：
- `saveStep()` 改为按 `taskId` 目录组织（`~/.aiNativeDevPlatform/sessions/{taskId}/step-{stepId}.json`），而非按 `sessionId`
- 新增 `saveMetaMirror()` 和 `saveStepMirror()` 方法，镜像写入失败不影响主流程
- `delete()` 同时清理主存储和 workspace 镜像
- `list()` 仅以主存储为准扫描

### 8. `WorkspaceManager.ts` — 工作区管理

支持三种模式：

| 模式 | 触发条件 | 工作目录 |
|------|----------|----------|
| 托管模式 | 无外部路径、无 git repo | `~/workspaces/{taskId}/` |
| 云端模式 | 提供 `gitRepo` 参数 | `~/workspaces/{taskId}/repo/` |
| 外部模式 | 提供 `workspacePath` | 用户指定目录 |

**相比旧版的变化**：
- 新增 `browseDir()` — 浏览文件系统目录（用于前端目录选择器），支持排序（目录在前）
- 新增 `getFileTree()` — 获取 workspace 文件树
- 新增 `readFile()` — 安全读取文件，支持绝对路径和 workspace 相对路径
- 新增 `getSessionDir()` — 获取 workspace 下的 session 目录路径
- 新增 `listTaskDirs()` — 列出所有 workspace 下的任务目录
- 新增 `initCloudWorkspace()` — 从 Git 仓库克隆代码，支持子目录指定
- 新增 `GitRepoConfig` 类型（`url`、`branch`、`subdirectory?`）
- 新增 `BrowseEntry` 类型

**安全措施**：
- Git clone 参数校验（URL 协议白名单、分支名正则、子目录路径正则）
- 路径遍历防护（`resolveWorkspace()` 检查前缀）
- 子进程超时（2 分钟）
- `browseDir()` 跳过隐藏文件和 `node_modules`

### 9. `customTools.ts` — 自定义工具

实现 `ask_user_question` 工具的两阶段流程：

1. **Phase 1** (`resolveQuestion`)：用户回答问题，答案暂存，Agent 保持阻塞
2. **Phase 2** (`continueQuestion`)：用户点击继续，Promise resolve，Agent 恢复执行

超时保护：5 分钟自动取消。

**新增**：`rejectQuestion()` 方法，在 session 中止/销毁时清理 pending question。

### 10. `customFindTool.ts` — 自定义文件查找（新增）

纯 Node.js 实现的 `FindOperations`，替代 `fd` 命令。支持 glob 模式（`*`、`**`、`?`、`{a,b}`、`[abc]`），递归遍历目录，忽略 `.gitignore` 模式。

**关键实现**：
- `globToRegex()` — 将 glob 模式转换为 RegExp
- `walk()` — 递归遍历目录，支持忽略模式和结果数量限制
- `isBasenameOnly()` — 优化：仅匹配文件名时使用快速路径

### 11. `SummaryStore.ts` — 摘要存储

简单的内存 Map，存储 `(taskId:step) → summary` 文本。供独立总结 Session 读取，避免通过 WebSocket 传输大文本。

**新增**：`deleteAll(taskId)` 方法，销毁 task 下所有 step 的摘要。

### 12. `config.ts` — 配置

- `createAuthStorage()`：从 `DEEPSEEK_API_KEY` 环境变量注入 API Key
- `getDefaultProvider()`：返回 `"deepseek"`
- `getDefaultModel()`：返回 `"deepseek-v4-flash"`

### 13. `models.json` — 模型配置（新增）

定义 DeepSeek 模型配置：

```json
{
  "providers": {
    "deepseek": {
      "baseUrl": "https://api.deepseek.com",
      "api": "openai-completions",
      "models": [
        {
          "id": "deepseek-v4-flash",
          "name": "DeepSeek V4 Flash",
          "reasoning": true,
          "input": ["text"],
          "contextWindow": 256000,
          "maxTokens": 8192,
          "compat": {
            "thinkingFormat": "deepseek"
          }
        }
      ]
    }
  }
}
```

### 14. `protocol.ts` — 通信协议

定义完整的 WebSocket 消息类型系统：
- `AgentMethod`：19 种方法名联合类型（相比旧版移除了 `session.prompt`、`session.followUp`、`session.saveMeta`、`session.resumeQuestion`，新增 `session.restore`）
- `WsMessage`：request / event / response / error / ping / pong
- `AgentEvent`：13 种事件类型（新增 `session_snapshot`）
- `SessionSnapshot`：重连时推送的完整状态快照（含 `hasPendingQuestion` 和 `pendingQuestion`）

### 15. `utils/fileOps.ts` — 文件操作工具

- `readSpecsTree()` / `readRepoTree()`：递归读取目录树
- `readFileSafe()` / `writeFileSafe()`：带路径穿越防护的文件读写
- `existsSync()`：路径存在性检查

### 16. `utils/gitOps.ts` — Git 操作工具

- `getRepoDiff()`：获取 `git diff HEAD` + `git diff --cached`
- `getRepoDiffFiles()`：按文件拆分 diff，包含未跟踪的新增文件（通过 `git ls-files --others --exclude-standard` 检测）
- `execCommand()`：在指定目录执行 shell 命令

---

## 三、数据流

### 主流程（前端 → Server → LLM）

```
前端 WebSocket
  → session.create (taskId, step)
    → AgentRunner.createSession() → AgentSession
    → SessionPool.set()
  → session.steer (text)
    → AgentSession.steer() 或 AgentSession.prompt()（空闲时）
    → SDK 事件 → mapSdkEvent() → WebSocket 推送
    → turn_end / agent_end 时自动保存步骤快照
  → session.dispose
    → SessionPool.dispose()
```

### 重连恢复流程

```
前端 WebSocket 重连
  → session.reconnect (sessionId)
    → SessionPool.findBySessionId()
    → 重新绑定事件订阅（ensureSubscription）
    → 提取 messages + turns + pendingQuestion
    → 推送 SessionSnapshot 事件
```

### 历史恢复流程

```
前端
  → session.restore (taskId, step, messages)
    → 销毁旧 session
    → AgentRunner.createSession()
    → 回放历史用户消息（steer 入队，不触发模型执行）
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
    → agent_end 时自动 dispose session + 清理 SummaryStore
```

### 编译链路

```
前端
  → build.detectCommand
    → AgentRunner.createBuildCommandSession()
    → LLM 分析构建配置 → 返回命令
    → agent_end 时自动 dispose session
  → 前端执行编译 → build.trigger (编译结果)
    → AgentRunner.createBuildSession()
    → LLM 分析编译输出 → 结构化报告
    → agent_end 时自动 dispose session
  → build.save (保存编译结果到步骤快照)
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

### 任务初始化流程

```
前端 HTTP POST /task/init
  → 根据 runtimeMode 初始化 workspace（cloud → git clone / local → setExternalWorkspace）
  → 构建 SessionMeta 并持久化
```

---

## 四、关键设计决策

1. **WebSocket 优先**：Agent 交互天然需要双向实时通信，HTTP 仅用于辅助功能
2. **步骤隔离**：每个步骤独立 session，通过 `SessionPool` 管理，支持并行步骤
3. **双阶段提问**：`ask_user_question` 拆为 answer + continue 两步，前端可控制恢复时机
4. **双存储策略**：主存储 + workspace 镜像，镜像写入失败不影响主流程
5. **SSE 流式 CLI**：QA 审查使用 SSE 而非 WebSocket，避免与 Agent 事件流耦合
6. **重连恢复**：`session.reconnect` 推送完整 `SessionSnapshot`，前端可重建 UI 状态
7. **HTTP 迁移**：workspace 操作（tree/readFile/browse）和任务初始化从 WebSocket 迁移到 HTTP，减少 WebSocket 消息耦合
8. **Node.js 原生文件查找**：`customFindTool.ts` 替代 `fd` 命令，减少外部依赖
9. **模型配置外部化**：`models.json` 将模型定义从代码中分离，便于调整
10. **Skills 文件化**：Skills 从 `server/skills/*.md` 加载，支持独立编辑和扩展

---

## 五、潜在问题

1. **WebSocket 断连重连风暴**：`steer()` 在空闲时调用 `prompt()`，断连期间积压的消息会触发多个并发 Agent 运行
2. **内存泄漏风险**：`SummaryStore` 和 `pendingQuestions` 无自动清理机制，长时间运行可能累积
3. **错误处理不一致**：部分 `try/catch` 静默忽略错误（如镜像写入、目录删除），调试困难
4. **`session.resumeQuestion` 重复逻辑**：与已移除的 `session.retry` 有大量重复的 session 创建代码，可提取公共方法
5. **`build.detectCommand` 事件订阅**：在 `agent_end` 中 `unsub()` + `dispose()`，但 `session.prompt()` 是异步的，可能存在竞态
6. **无请求限流**：`/qa-review` 可被任意调用启动子进程，无并发控制
7. **`protocol.ts` 类型不完整**：`session.resumeQuestion` 和 `session.saveStep` 在 wsHandler 中有处理逻辑，但未在 `AgentMethod` 类型中声明
8. **Cloud Runtime API 使用模拟数据**：`/api/resources` 的 CPU 和 disk 数据使用 `Math.random()` 生成，非真实采集
