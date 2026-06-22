/**
 * 提示词构建函数 — 集中管理所有 Agent 提示词
 */

/** 构造总结 Agent 的 prompt */
export function buildSummarizationPrompt(summary: string): string {
  return `你是一个任务总结专家。请严格基于下面的 Agent 工作摘要，生成结构化总结。

要求：
1. 忠于原文，不添加原文中没有的内容，不自由发挥
2. 仅输出 JSON，不要有任何额外说明文字

输出 JSON schema：
{
  "brief": "核心总结，不超过200字",
  "key_points": [
    { "title": "具体描述产出的核心内容，不超过50字", "summary": "要点内容，不超过200字" }
  ],
  "todos": [
    {
      "task": "需要用户决策或讨论的问题",
      "type": "choice" | "fill",
      "multiSelect": true/false,
      "choices": [{ "option": "选项名", "description": "选项描述" }],
      "placeholder": "填空题占位文本"
    }
  ]
}

注意：
- key_points 数量不限，提取核心要点
- todos 为待决策事项，字段必填，且type字段必填
- 若无待决策问题，则type为choice，且仅包含一个选项:需求已明确，进入下一阶段
- 必须包含type字段，并且仅支持choice 和fill 两种类型
- type=choice 时 choices 必填，type=fill 时 choices 可为空数组、placeholder 必填
- multiSelect 仅 type=choice 时有效，默认 false
- type=choice 时，必须包含一个选项:需求已明确，进入下一阶段
- brief 使用中文

**标题要求（重要）**：
- 标题应该具体描述产出的核心内容，让用户一目了然
- 标题应该反映"产出了什么"或"做了什么"，而不是"总结了什么"
- 避免使用事务性词汇如"已生成"、"已明确"、"已清晰"、"已覆盖"等
- 好标题例子：基于微服务架构的服务设计、用户点击-弹窗-填写工作流、WorkTree分支回退机制、采用DDD领域驱动设计、API接口规范文档、前端组件库设计
- 坏标题例子：文档已全部生成、关键设计决策明确、交付范围清晰、原型8项约束已覆盖、需求分析完成、技术方案确定

以下是 Agent 工作摘要：
---
${summary}
---`;
}

/** 构建编译分析 prompt */
export function buildBuildPrompt(buildResult: {
  command: string;
  success: boolean;
  output: string;
  timestamp: string;
}): string {
  return `你是一个项目编译分析专家。请严格基于下面的编译输出，生成结构化的编译报告。

要求：
1. 忠于原文，不添加原文中没有的内容，不自由发挥
2. 仅输出 JSON，不要有任何额外说明文字（不要加 markdown 代码块）

输出 JSON schema：
{
  "command": "编译命令（必须原样保留，不要修改）",
  "success": true/false,
  "output": "编译输出（完整保留原始输出，不要截断）",
  "timestamp": "编译时间戳",
  "retryCount": 0,
  "building": false,
  "fixing": false
}

注意：
- success 字段必须严格根据编译结果判断
- output 字段必须完整保留原始编译输出，不要做任何修改或截断
- **command 字段必须原样使用下面传入的命令，不要做任何修改**

以下是编译输出：
---
命令: ${buildResult.command}
时间: ${buildResult.timestamp}
状态: ${buildResult.success ? "成功" : "失败"}
输出:
${buildResult.output}
---`;
}

/** 构建编译命令检测 prompt */
export function buildDetectCommandPrompt(): string {
  return `请分析当前项目的构建配置文件（如 package.json、Makefile、Cargo.toml、build.gradle、CMakeLists.txt 等），输出正确的编译命令。

要求：
1. 只输出编译命令本身，不要有任何额外说明文字
2. 例如：npm run build、npm run compile、make、go build ./...、cargo build 等
3. 如果找不到任何构建配置，输出 npm run build 作为默认值`;
}
