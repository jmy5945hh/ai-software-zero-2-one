# Server 模块代码分析

> 生成日期：2026-06-02
> 基于当前代码库的静态分析，描述 server 模块的架构、组件职责、数据流和关键设计决策。

---

## 一、概述

Server 模块是一个 **AI Agent 工作流引擎**，为前端提供 WebSocket + HTTP 双协议的后端服务。核心职责：

1. **管理多步骤 AI Agent 工作流**（需求分析 → 技术设计 → 编码 → 质量检查 → 验证 → 发布）
2. **维护 Agent 会话生命周期**（创建、提示、中断、重试、销毁）
3. **持久化会话记录**（对话历史、步骤快照、元信息）
4. **管理隔离的工作空间**（每个任务一个独立目录）
5. **提供项目文件浏览、Spec 编辑、编译等辅助能力**

技术栈：TypeScript + Node.js + WebSocket (ws) + `@earendil-works/pi-coding-agent` SDK

---

## 二、目录结构

```
server/
├── index.ts              # 入口：HTTP + WebSocket 服务器，路由所有请求
├── protocol.ts           # WebSocket 通信协议类型定义
├── config.ts             # LLM 提供商配置（AuthStorage、API Key 注入）
├── models.json           # LLM 模型注册表（DeepSeek V4 Flash）
├── AgentRunner.ts        # AgentSession 工厂，按步骤配置创建会话
├── SessionPool.ts        # 内存 Session 池（taskId:step → AgentSession）
├── SessionStore.ts       # 会话持久化存储（文件系统）
├── SummaryStore.ts       # 内存摘要存储（供总结 Agent 跨会话传递）
├── WorkspaceManager.ts   # 工作空间文件系统管理器
├── stepConfigs.ts        # 步骤配置（模型、工具、System Prompt、Skill）
├── customTools.ts        # 自定义工具：ask_user_question（两阶段问答）
├── customFindTool.ts     # 自定义 FindOperations（Node.js fs 实现 glob）
├── prompts/              # 各步骤的 System Prompt（Markdown）
│   ├── intent.md
│   ├── plan.md
│   ├── coding.md
│   ├── quality.md
│   ├── verify.md
│   └── release.md
├── skills/               # Skill 定义（Markdown）
│   ├── product-analysis.md
│   ├── architecture-design.md
│   ├── frontend-dev.md
│   ├── testing.md
│   └── devops.md
└── workspaces/           # 托管工作空间目录（按 taskId 隔离）
    ├── task-xxx/
    └── ...
```

---

## 三、核心组件详解

### 3.1 `index.ts` — 入口与路由

**职责**：创建 HTTP 服务器（端口 3100，可配置 `AGENT_PORT` 环境变量），挂载 WebSocket 服务器（路径 `/agent`），处理所有 HTTP REST 端点和 WebSocket 消息路由。

**HTTP 端点**：

| 端点 | 方法 | 用途 |
|------|------|------|
| `/health` | GET | 健康检查，返回 `{ status: "ok", timestamp }` |
| `/specs-tree` | GET | 读取项目 `specs/` 目录树 |
| `/specs-file` | GET | 读取 `specs/` 下某个文件内容 |
| `/specs-save` | POST | 保存内容到 `specs/` 下文件 |
| `/repo-tree` | GET | 读取项目源码目录树（排除 specs、.git、node_modules） |
| `/repo-file` | GET | 读取项目任意文件 |
| `/repo-diff` | GET | 执行 `git diff HEAD` + `git diff --cached` |
| `/project-build` | GET | 执行编译命令 |

**WebSocket 方法**（通过 `msg.method` 路由）：

| 方法 | 用途 |
|------|------|
| `session.create` | 创建 AgentSession，订阅 SDK 事件并转发到 WebSocket |
| `session.prompt` | 向会话发送用户提示 |
| `session.steer` | 入队引导消息（streaming 中用 steer，空闲时用 prompt） |
| `session.followUp` | 入队追问消息（同 steer 的 streaming/空闲判断） |
| `session.abort` | 中断正在运行的会话 |
| `session.dispose` | 销毁会话 |
| `session.retry` | 销毁旧会话 → 用用户输入替换 system prompt → 重新创建 → 发送初始 prompt |
| `session.answerQuestion` | 阶段一：存储用户回答（Agent 保持阻塞） |
| `session.continueQuestion` | 阶段二：用存储的回答解阻塞 Agent |
| `session.resumeQuestion` | 从历史恢复后重建会话并继续问答 |
| `summarization.save` | 保存 Agent 摘要文本到 SummaryStore |
| `summarization.trigger` | 创建总结 AgentSession，发送摘要进行结构化 JSON 输出 |
| `build.detectCommand` | 创建编译命令检测 AgentSession |
| `build.trigger` | 创建编译分析 AgentSession |
| `build.save` | 将编译结果保存到步骤快照 |
| `build.fix` | 创建修复会话（复用 coding 步骤配置） |
| `workspace.tree` | 返回工作空间文件树 |
| `workspace.readFile` | 读取工作空间文件 |
| `workspace.browse` | 浏览文件系统目录（前端目录选择器） |
| `session.saveRecord` / `loadRecord` / `listRecords` / `deleteRecord` | 会话记录 CRUD |
| `session.saveStep` / `loadStep` | 按步骤的会话快照 CRUD |
| `session.saveMeta` / `loadMeta` | 会话元信息 CRUD |

**关键辅助函数**：

- `buildSummarizationPrompt(summary)` — 构造总结 Agent 的 prompt，要求输出结构化 JSON（brief、key_points、todos）
- `buildBuildPrompt(buildResult)` — 构造编译分析 prompt
- `buildDetectCommandPrompt()` — 构造编译命令检测 prompt
- `extractTextFromContent(result)` — 从 SDK tool result content 数组中提取文本
- `extractAgentSummary(messages)` — 从消息列表中提取最后一条 assistant 消息的文本
- `ensureSubscription(pool, taskId, step, ws, msgId)` — WebSocket 重连后重新注册事件订阅
- `mapSdkEvent(raw)` — 将 SDK `AgentSessionEvent` 映射为前端 `AgentEvent` 类型
- `readSpecsTree(dir)` / `readRepoTree(dir)` — 递归目录树读取器

**设计要点**：

- `session.steer` 和 `session.followUp` 有 **streaming 状态判断**：streaming 中调用 `steer()`/`followUp()` 入队，空闲时调用 `prompt()` 直接触发新轮次。这是关键修复，避免消息入队后永不执行。
- `session.retry` 的流程：用户输入作为 `systemPromptOverride` 传给 `createSession`，步骤原本的 `initialPrompt` 作为 user prompt 发送。这样用户可给 Agent 新指令，同时保留原始任务上下文。
- `build.detectCommand` 不广播中间事件到前端，避免污染 coding session 的 turns/messages。

---

### 3.2 `protocol.ts` — 通信协议

**职责**：定义前端与 Agent Server 之间 WebSocket 通信的全部 TypeScript 类型。

**核心类型**：

- `AgentMethod` — 所有 22 个方法名的联合类型
- `WsMessage` — 6 种消息格式：`request`、`event`、`response`、`error`、`ping`、`pong`
- `AgentEvent` — 所有 Agent 事件的联合类型：
  - `text_delta` / `thinking_delta` — 流式文本
  - `tool_execution_start` / `update` / `end` — 工具调用生命周期
  - `message_start` / `end`、`agent_start` / `end`、`turn_start` / `end` — 会话生命周期
  - `error` — 错误事件
  - `queue_update` — 队列状态（steering、followUp 数组）
  - `compaction_start` / `end`、`auto_retry_start` / `end` — 内部事件

**依赖**：无（纯类型定义）

---

### 3.3 `config.ts` — LLM 配置

**职责**：初始化 AuthStorage，从环境变量注入 DeepSeek API Key。

**导出**：

- `createAuthStorage()` — 创建 AuthStorage，注入 `DEEPSEEK_API_KEY` 环境变量
- `getDefaultProvider()` — 返回 `"deepseek"`（若未设置则抛错）
- `getDefaultModel()` — 返回 `"deepseek-v4-flash"`

**依赖**：`@earendil-works/pi-coding-agent` (AuthStorage)

---

### 3.4 `models.json` — 模型注册表

**内容**：定义 DeepSeek 提供商和模型配置。

```json
{
  "providers": {
    "deepseek": {
      "baseUrl": "https://api.deepseek.com",
      "api": "openai-completions",
      "models": [{
        "id": "deepseek-v4-flash",
        "name": "DeepSeek V4 Flash",
        "reasoning": true,
        "input": ["text"],
        "contextWindow": 256000,
        "maxTokens": 8192,
        "compat": { "thinkingFormat": "deepseek" }
      }]
    }
  }
}
```

**关键参数**：
- 推理模式：启用（`reasoning: true`）
- 上下文窗口：256K tokens
- 最大输出：8192 tokens
- 思考格式：DeepSeek 原生格式

---

### 3.5 `AgentRunner.ts` — Agent 会话工厂

**职责**：创建 `AgentSession` 实例，管理 SDK 基础设施（AuthStorage、ModelRegistry、SettingsManager）。

**构造函数**：接收 `modelsJsonPath`，初始化 AuthStorage、ModelRegistry、SettingsManager（禁用 compaction，启用 retry 最多 2 次）。

**方法**：

| 方法 | 用途 | 模型 | 工具 |
|------|------|------|------|
| `createSession(taskId, step, workspaceDir, systemPromptOverride?)` | 按步骤配置创建主 AgentSession | 按 stepConfig | 按 stepConfig |
| `createSummarizationSession(workspaceDir)` | 创建总结 AgentSession | deepseek-v4-flash, low thinking | 无工具 |
| `createBuildCommandSession(workspaceDir)` | 创建编译命令检测 AgentSession | deepseek-v4-flash, low thinking | read, grep, find, ls |
| `createBuildSession(workspaceDir)` | 创建编译分析 AgentSession | deepseek-v4-flash, low thinking | 无工具 |

**设计要点**：
- 每次 `createSession` 调用都会重新设置 API Key（确保环境变量变更后生效）
- 通过 `skillsOverride` 将步骤配置的 Skill 注入到 ResourceLoader 中
- 仅当步骤配置包含 `"ask_user_question"` 工具时才创建自定义工具

**依赖**：`config.ts`、`stepConfigs.ts`、`customTools.ts`、`@earendil-works/pi-coding-agent`

---

### 3.6 `SessionPool.ts` — 内存 Session 池

**职责**：管理多个活跃 `AgentSession` 实例，以 `taskId:step` 为键。确保同一 `(taskId, step)` 对只有一个活跃 session。

**方法**：

| 方法 | 用途 |
|------|------|
| `set(taskId, step, session)` | 存入 session（若已存在则先 dispose 旧的） |
| `get(taskId, step)` | 获取 session |
| `setUnsub(taskId, step, unsub)` | 设置事件订阅取消函数 |
| `clearUnsub(taskId, step)` | 清除事件订阅（取消旧订阅，保留 session） |
| `dispose(taskId, step)` | 销毁指定 session（取消订阅 + dispose） |
| `disposeAll()` | 销毁全部 session |

**设计要点**：
- `unsub` 与 `session` 分开管理，支持 WebSocket 重连时只重新订阅而不重建 session
- `set()` 自动 dispose 旧 session，防止内存泄漏

**依赖**：`@earendil-works/pi-coding-agent` (AgentSession)

---

### 3.7 `SessionStore.ts` — 会话持久化存储

**职责**：将会话记录持久化到文件系统 `~/.aiNativeDevPlatform/sessions/`。每个会话一个目录，目录名 = sessionId。

**目录结构**：
```
{sessionId}/
  meta.json              ← 任务元信息
  step-{workflowId}.json ← 各步骤的独立会话快照
```

**核心类型**：

- `StepSessionSnapshot` — 单步骤快照：messages、turns（含 textContent、thinking、toolCalls）、summary、summarizationResult、buildCommand、buildResult
- `SessionMeta` — 任务元信息：sessionId、taskId、intent、workspacePath、stepIndex、activeStage、scope、selectedModules、notes、todoAnswers、initialPrompts、codeConfirmed、fixApproved、releaseApproved、qualityPassed、timestamps、status、stepSummaries
- `SessionRecord` — 完整记录 = SessionMeta + stepSessions map

**方法**：

| 方法 | 用途 |
|------|------|
| `generateSessionId()` | 生成 32 位 hex session ID |
| `saveMeta(meta)` | 保存会话元信息 |
| `loadMeta(sessionId)` | 加载会话元信息 |
| `saveStep(sessionId, stepId, snapshot)` | 保存某步骤的会话快照 |
| `loadStep(sessionId, stepId)` | 加载某步骤的会话快照 |
| `save(record)` | 保存完整记录（拆分为 meta + step 文件） |
| `load(sessionId)` | 加载完整记录 |
| `list()` | 列出所有会话（按 updatedAt 倒序） |
| `delete(sessionId)` | 删除会话目录 |

**设计要点**：
- 元信息和步骤数据分离存储，支持按需加载（前端只需 meta 时不必加载全部对话数据）
- `save()` 兼容旧接口，内部拆分为 `saveMeta` + 逐步骤 `saveStep`

**依赖**：Node.js `fs`、`path`、`os`、`crypto`

---

### 3.8 `SummaryStore.ts` — 内存摘要存储

**职责**：简单的内存键值存储，以 `taskId:step` 为键存储 Agent 完成摘要文本。用于在主 Agent 会话和总结 Agent 会话之间传递大文本，避免通过 WebSocket 传输。

**方法**：`set`、`get`、`delete`、`deleteAll(taskId)`

**依赖**：无

---

### 3.9 `WorkspaceManager.ts` — 工作空间管理器

**职责**：为每个任务维护隔离的工作目录。支持两种模式：

1. **托管模式**：在 `server/workspaces/{taskId}/` 下创建子目录，写入 `AGENTS.md`（含 intent、编码规范）和 `package.json`
2. **外部模式**：直接使用用户指定的现有目录（如 Git 项目）

**核心类型**：`FileNode`（name, type, children）、`BrowseEntry`（name, type, path）

**方法**：

| 方法 | 用途 |
|------|------|
| `initWorkspace(taskId, intent)` | 创建托管 workspace 目录 |
| `setExternalWorkspace(taskId, dirPath)` | 注册外部目录（含存在性检查、~ 展开） |
| `getFileTree(taskId)` | 返回递归文件树（隐藏 dotfiles、node_modules） |
| `readFile(taskId, filePath)` | 安全读取文件（支持绝对路径和 workspace 相对路径） |
| `browseDir(dirPath)` | 浏览文件系统（前端目录选择器） |
| `getDir(taskId)` | 获取 workspace 根目录 |

**安全设计**：
- `readFile` 的 workspace 相对路径有路径遍历防护（`resolveWorkspace` 检查结果是否以 workspace 目录开头）
- `browseDir` 和 `getFileTree` 过滤隐藏文件和 `node_modules`

**依赖**：Node.js `path`、`fs`、`os`

---

### 3.10 `stepConfigs.ts` — 步骤配置

**职责**：定义工作流各步骤的配置（模型、推理深度、工具白名单、System Prompt、Skill）。从 `prompts/*.md` 加载 System Prompt，从 `skills/*.md` 加载 Skill 定义。

**核心类型**：`StepConfig` — modelId、modelProvider、thinkingLevel、tools[]、systemPrompt、skills[]

**步骤配置一览**：

| 步骤 | 模型 | 推理深度 | 工具 | Skill |
|------|------|----------|------|-------|
| `intent` | deepseek-v4-flash | medium | read, grep, find, ls, ask_user_question, write | — |
| `plan` | deepseek-v4-flash | medium | read, grep, find, ls, ask_user_question, write | — |
| `coding` | deepseek-v4-flash | high | read, write, grep, find, ls, bash | frontend-dev |
| `quality` | deepseek-v4-flash | medium | read, bash, grep, find, ls | testing |
| `verify` | deepseek-v4-flash | medium | read, write, bash, grep, find, ls | testing |
| `release` | deepseek-v4-flash | low | read, write, bash, grep, find, ls | devops |

**辅助函数**：
- `loadPrompt(step)` — 读取 `prompts/{step}.md`
- `loadSkill(fileName)` — 读取 `skills/{fileName}.md`，从 `#` 标题提取 name，从 `## 能力` 段落提取 description

**依赖**：Node.js `fs`、`path`、`url`；`@earendil-works/pi-coding-agent` (Skill, createSyntheticSourceInfo)

---

### 3.11 `customTools.ts` — 自定义问答工具

**职责**：实现两阶段问答流程的 `ask_user_question` 自定义工具。

**流程**：
1. Agent 调用 `ask_user_question` → 创建 Promise 阻塞 Agent
2. 用户回答问题（`session.answerQuestion`）→ 答案存储，Agent 保持阻塞
3. 用户点击"继续"（`session.continueQuestion`）→ Promise resolve，Agent 恢复执行

**核心导出**：

| 导出 | 用途 |
|------|------|
| `pendingQuestions` | 全局 `Map<"taskId:step", PendingQuestion>` |
| `resolveQuestion(taskId, step, answer)` | 阶段一：存储答案 |
| `continueQuestion(taskId, step)` | 阶段二：解阻塞 Agent |
| `rejectQuestion(taskId, step, err)` | 拒绝 pending 问题（abort/dispose 时调用） |
| `createAskUserQuestionTool(taskId, step)` | 创建 `defineTool` 实例 |

**设计要点**：
- 5 分钟超时保护，超时后自动 reject
- 新问题会 reject 旧问题（防止多个 pending 问题堆积）
- 两阶段分离使前端可以展示问题、等待用户输入、再手动触发继续

**依赖**：`typebox` (Type)、`@earendil-works/pi-coding-agent` (defineTool)

---

### 3.12 `customFindTool.ts` — 自定义文件查找

**职责**：提供基于 Node.js `fs` API 的 `FindOperations` 实现，替代 `fd` 命令。用于 Agent 的文件系统 glob 匹配操作。

**核心导出**：
- `nodeFindOperations` — 包含 `exists(absolutePath)` 和 `glob(pattern, cwd, options)` 方法
- `globToRegex(pattern)` — 将 glob 模式转换为 RegExp（支持 `*`、`**`、`?`、`{a,b}`、`[abc]`）
- `walk(dir, regex, baseDir, ignoreSet, limit, results)` — 递归目录遍历

**设计要点**：
- 支持忽略模式（ignoreSet）
- 有结果数量限制（limit），防止大目录下无限遍历
- 不可读目录/文件静默跳过

**依赖**：Node.js `fs`、`fs/promises`、`path`；`@earendil-works/pi-coding-agent` (FindOperations)

---

## 四、数据流

### 4.1 主工作流（6 步骤）

```
前端 WebSocket → index.ts → AgentRunner.createSession() → AgentSession
                                                              ↓
                                                    SDK 事件 → mapSdkEvent() → 前端
                                                              ↓
                                                    agent_end → SummaryStore.set()
                                                              ↓
                                                    前端触发 summarization.trigger
                                                              ↓
                                                    AgentRunner.createSummarizationSession()
                                                              ↓
                                                    结构化 JSON 输出 → 前端
```

### 4.2 用户问答流程

```
Agent 调用 ask_user_question → Promise 阻塞 Agent
         ↓
前端收到 tool_execution_start → 展示问题
         ↓
用户输入答案 → session.answerQuestion → resolveQuestion() 存储答案
         ↓
用户点击"继续" → session.continueQuestion → continueQuestion() resolve Promise
         ↓
Agent 恢复执行 → 继续后续工具调用
```

### 4.3 编译修复流程

```
前端触发编译 → /project-build HTTP 端点
         ↓
编译失败 → build.save → 保存编译结果到 step 快照
         ↓
build.fix → AgentRunner.createSession(coding 步骤配置)
         ↓
Agent 分析编译错误 → 修复代码 → 重新编译
```

### 4.4 会话持久化流程

```
前端定期保存 → session.saveRecord / session.saveStep / session.saveMeta
         ↓
SessionStore → 写入 ~/.aiNativeDevPlatform/sessions/{sessionId}/
         ↓
前端恢复 → session.loadRecord / session.loadStep / session.loadMeta
         ↓
SessionStore → 从文件系统读取
```

---

## 五、关键设计决策

### 5.1 两阶段问答

`ask_user_question` 工具采用两阶段设计（存储答案 → 手动触发继续），而非一次性回答。原因是前端需要展示问题给用户、等待用户输入、再让用户确认"继续"。这给了用户完整的控制权。

### 5.2 Streaming 状态感知的入队策略

`session.steer` 和 `session.followUp` 根据 `session.isStreaming` 状态决定行为：
- **Streaming 中**：调用 `steer()`/`followUp()` 入队（SDK 会在当前轮次结束后自动处理）
- **空闲时**：调用 `prompt()` 直接触发新轮次

这是关键修复，避免消息入队后因 Agent 已空闲而永不执行。

### 5.3 重试时 System Prompt 替换

`session.retry` 将用户输入作为 `systemPromptOverride` 传给 `createSession`，而非作为 user prompt。这样用户可给 Agent 全新的指令（如"用更简单的方式实现"），同时保留原始任务上下文（`initialPrompt` 作为 user prompt 发送）。

### 5.4 元信息与对话数据分离存储

`SessionStore` 将会话元信息（`meta.json`）和步骤对话数据（`step-{stepId}.json`）分开存储。前端列表页只需加载元信息，无需加载全部对话数据，提升性能。

### 5.5 摘要传递的中间存储

`SummaryStore` 作为内存中间层，在主 Agent 会话和总结 Agent 会话之间传递大文本摘要。避免通过 WebSocket 传输大文本，减少网络开销和序列化成本。

### 5.6 路径遍历防护

`WorkspaceManager.readFile` 和 HTTP 端点的 specs/repo 文件读取都有路径遍历防护，确保解析后的绝对路径以允许的基路径开头。

---

## 六、依赖关系图

```
index.ts
  ├── AgentRunner.ts
  │     ├── config.ts
  │     ├── stepConfigs.ts
  │     │     ├── prompts/*.md
  │     │     └── skills/*.md
  │     └── customTools.ts
  ├── SessionPool.ts
  ├── SummaryStore.ts
  ├── WorkspaceManager.ts
  ├── SessionStore.ts
  ├── customTools.ts
  └── protocol.ts

customFindTool.ts (独立，被 SDK 引用)
```

---

## 七、配置与环境变量

| 变量 | 默认值 | 用途 |
|------|--------|------|
| `AGENT_PORT` | `3100` | HTTP/WebSocket 服务器端口 |
| `DEEPSEEK_API_KEY` | — | DeepSeek API 密钥（必需） |

---

## 八、启动方式

```bash
# 确保 DEEPSEEK_API_KEY 已设置
export DEEPSEEK_API_KEY=sk-xxx

# 启动 Agent Server
npx tsx server/index.ts

# 输出示例：
# Agent Server starting...
#   Model provider: DeepSeek (via DEEPSEEK_API_KEY)
#   Port: 3100
# Agent Server listening on ws://0.0.0.0:3100/agent
#   Health check: http://0.0.0.0:3100/health
```
