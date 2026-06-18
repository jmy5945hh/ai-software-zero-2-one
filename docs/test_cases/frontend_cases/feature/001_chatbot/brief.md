新增 /chatbot 页面：提供基于大模型的内嵌智能对话助手能力，整体交互体验对标主流 AI Chat 产品。
1. 左侧会话列表 + 右侧对话区的经典 Chat 产品布局
2. AI 回复内容以 Markdown 格式渲染，sse流式打字机动效，支持深度思考内容（`<think>` 标签）的解析与折叠展示
3. 支持多轮会话（短期记忆携带历史对话内容）
4. 空状态下以打字机欢迎词引导用户输入

LLM 接入信息
| 配置项 | 值 |
|--------|-----|
| API 地址 | `https://api.x.ant.design/api/big_model_glm-4.5-flash` |
| 模型 | `glm-4.5-flash` |
| 请求方式 | POST，SSE 流式响应（`stream: true`） |
| 请求格式 | OpenAI Chat Completions 兼容格式 |
