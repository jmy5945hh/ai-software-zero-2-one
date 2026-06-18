# PRD - AI 智能对话页面（/chatbot）

## 1. 总结概要

Chatbot 页面是基于大语言模型的企业内嵌智能对话助手，提供左侧会话列表 + 右侧对话区的经典 Chat 产品布局。用户可在页面内创建多轮对话会话、按时间分组浏览历史记录，并通过流式 SSE 接口实时接收 AI 回复。页面支持 AI 深度思考内容（`<think>` 标签）的解析与折叠展示，AI 回复内容以 Markdown 格式渲染，提供打字机动效。空状态下以打字机欢迎词引导用户输入，整体交互体验对标主流 AI Chat 产品。

---

## 2. 业务功能说明

### 2.1 会话管理（左侧 Sidebar）

- **会话列表**：展示所有历史会话，按「今天 / 昨天 / 更早」时间分组显示（`groupable`）
- **新建对话**：点击「新建对话」按钮，在列表顶部创建一条草稿会话（`isDraft: true`）；发送第一条消息后，自动以消息前 20 字作为会话标题
- **切换会话**：点击列表项切换激活会话，对话区内容随之切换（不同 `conversationKey` 隔离消息历史）
- **删除会话**：每条会话项右键/更多菜单提供「删除」操作（danger 样式）；删除当前激活会话时自动切换至第一条；删除最后一条时自动创建新草稿会话

### 2.2 欢迎引导区（空状态）

- 当前会话无消息时，对话区居中展示打字机动效欢迎词（逐字符播放，间隔 80ms）
- 欢迎词内容："🤖 你好，有什么可以帮你？"
- 输入框在欢迎状态下居中底部显示（`footerCenter` 样式），有消息后沉底固定（`footer` 样式）

### 2.3 消息对话区（右侧 Main）

- 用户消息：右侧对齐，附用户图标 Avatar
- AI 回复消息：左侧对齐，附机器人 Emoji Avatar（🤖）
- AI 消息支持 Markdown 渲染（通过 `XMarkdown` 组件），流式更新时使用流式渲染模式
- AI 消息加载中显示加载动效（`loading: true`）
- 消息列表自动滚动至最新消息（`autoScroll`）
- 消息区最大宽度限制为 940px，居中显示

### 2.4 深度思考内容（Think）

- 支持解析 AI 回复中的 `<think>...</think>` 标签
- 完整 `<think>内容</think>回复` 格式：think 内容渲染在消息 `header` 区域（`<Think>` 组件）；主回复内容正常展示
- 不完整（流式传输中）的 `<think>内容` 格式：仅渲染 think 区域，主内容为空字符串，待完整数据到达后更新

### 2.5 消息输入区（Sender）

- 多行文本输入框（minRows: 4，maxRows: 8）
- 最大宽度 940px，与消息区对齐
- Enter 键发送消息，Shift+Enter 换行（框架默认行为）
- 请求进行中显示 loading 状态，并提供「取消」按钮（`abort`）中止流式请求
- 发送后清空输入框

---

## 3. UX 设计说明

### 3.1 整体布局

```
┌─────────────────────────────────────────┐
│  PageContainer（ghost 模式，无背景色）    │
│  ┌──────────────────────────────────┐   │
│  │ Card (borderless, 全高)          │   │
│  │ ┌──────────┬───────────────────┐ │   │
│  │ │  Sidebar  │     Main Area     │ │   │
│  │ │ 会话列表  │  消息区 / 输入区  │ │   │
│  │ └──────────┴───────────────────┘ │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

- `PageContainer` 使用 `ghost` 模式（透明背景），配合 `childrenContentStyle` 设置固定高度（`calc(100vh - 160px)`），消除页面内部滚动条
- 内层 Card 与 Main 区域均设置 `overflow: hidden`，通过子区域独立滚动实现消息区与输入框的分层固定

### 3.2 空状态引导

- 欢迎标题使用打字机组件（`TypewriterTitle`）逐字播放，营造动态感
- 光标闪烁效果（`|`）在打字完成前持续显示
- 输入框在空状态下垂直居中，不压迫视觉空间

### 3.3 消息气泡设计

- 双角色视觉区分：用户气泡右对齐（蓝色系），AI 气泡左对齐（白色/浅色系）
- AI 打字机动效：`typing: { effect: 'typing', step: 2, interval: 20 }`，每次渲染 2 个字符，间隔 20ms，模拟自然输入节奏
- Think 内容在气泡 header 区折叠展示，避免干扰主回复内容阅读

### 3.4 会话列表

- 时间分组标签（今天/昨天/更早）作为视觉锚点，帮助用户快速定位历史记录
- 草稿会话标签为「💬 新对话」，发送第一条消息后自动命名
- 当前激活会话高亮显示
- 悬停显示右键菜单（删除），采用 danger 样式避免误操作

### 3.5 流式体验

- 流式响应期间 Sender 显示 loading 状态并切换为「取消」按钮
- AI 消息在流式更新时使用 `STREAMING_ACTIVE` 模式（`hasNextChunk: true`），流结束后切换为 `STREAMING_IDLE`

---

## 4. 技术设计说明

### 4.1 技术栈

| 技术 | 用途 |
|------|------|
| React 18 + TypeScript | 页面主体框架 |
| `@ant-design/x` | Chat UI 组件（Bubble、Conversations、Sender、Think、XProvider） |
| `@ant-design/x-sdk` | AI 请求能力（`useXChat`、`OpenAIChatProvider`、`XRequest`） |
| `@ant-design/x-markdown` | Markdown 渲染（含流式渲染支持） |
| `@ant-design/pro-components` `PageContainer` | 页面容器 |
| `antd` Card/Avatar | UI 基础组件 |
| `antd-style` `createStyles` | 主题 token 驱动样式 |

### 4.2 数据结构

```typescript
interface ConversationItem {
  key: string;       // 唯一会话 ID
  label: string;     // 会话标题（显示文本）
  group?: string;    // 分组名（今天/昨天/更早）
  isDraft?: boolean; // 是否为未发送过消息的草稿
}

type ParsedMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; thinkContent?: string };
```

### 4.3 AI 请求架构

```
用户发送消息
  └─→ onRequest({ messages: [{ role: 'user', content }] })
        └─→ OpenAIChatProvider
              └─→ XRequest (SSE)
                    └─→ POST {CHAT_API_URL}
                          └─→ model: glm-4.5-flash, stream: true
```

- 接口地址：`process.env.CHAT_API_URL` 或默认 `https://api.x.ant.design/api/big_model_glm-4.5-flash`
- `OpenAIChatProvider` 内部处理 SSE 流解析和多轮对话历史累积
- `useXChat` 通过 `conversationKey` 隔离不同会话的消息状态，切换会话时无需手动维护消息数组

### 4.4 消息解析（parser）

```
输入: { content: string, role: string }
输出: ParsedMessage

解析逻辑：
- role !== 'assistant' → { role: 'user', content }
- 匹配 <think>...</think>回复内容 → { role:'assistant', thinkContent, content: 回复 }
- 匹配 <think>...(流式未完成) → { role:'assistant', thinkContent, content: '' }
- 其他 → { role: 'assistant', content }
```

### 4.5 状态管理

| 状态 | 类型 | 说明 |
|------|------|------|
| `conversations` | `ConversationItem[]` | 会话列表，包含预设示例及动态创建的会话 |
| `activeKey` | `string` | 当前激活会话的 key |
| `inputValue` | `string` | 输入框受控值 |
| `isRequesting` | `boolean` | 由 `useXChat` 返回，流请求进行中为 true |
| `parsedMessages` | `ParsedMessage[]` | 当前会话的完整消息列表，由 `useXChat` 管理 |

### 4.6 ID 生成

使用 `useRef` 持有自增计数器（`idCounter`），通过 `generateId()` 生成会话 key（格式：`conv-N`），确保同一组件生命周期内唯一性，不依赖外部 UUID 库。

## 5. 交付标准

- [ ] `/chatbot` 路由可访问，左侧菜单出现对应入口
- [ ] 中英文菜单翻译正确
- [ ] 能创建会话、发送消息、接收 AI 流式回复
- [ ] 切换/删除会话功能正常
- [ ] AI 回复中的 Markdown 正确渲染
- [ ] Think 标签被正确解析与展示
- [ ] 空状态引导打字机动效正常
- [ ] 请求可被取消，取消后 UI 恢复正常
- [ ] `npm run lint` + `npm run tsc` 无新增错误
- [ ] 提交历史清晰，commit message 符合规范（如 Conventional Commits）