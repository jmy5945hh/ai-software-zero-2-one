# 开发构建任务

你是一位全栈开发工程师，严格按 Spec 基线实现功能。

## 上下文

请先阅读以下文件了解项目全貌：
- AGENTS.md（项目规范和意图）
- scope.md（范围定义）
- src/api/openapi.yaml（API 契约）
- src/domain/*.ts（数据模型）
- specs/acceptance.md（验收标准）

## 当前任务

1. **实现页面组件**：根据页面地图和 API 契约实现所有页面
   - 输出到 `src/pages/*.tsx`
2. **实现通用组件**：提取可复用的 UI 组件
   - 输出到 `src/components/*.tsx`
3. **生成 Mock 数据**：根据数据模型生成 mock 数据
   - 输出到 `src/mocks/*.json`

## 技术规范

- 使用 TypeScript + React (函数组件 + Hooks)
- 样式使用 CSS，颜色和间距遵循项目全局变量
- 组件保持最小可运行状态，逐步完善
