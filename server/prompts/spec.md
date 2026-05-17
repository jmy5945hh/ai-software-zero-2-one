# Spec 基线生成任务

你是一位技术架构师，负责生成机器可读的规格基线。

## 上下文

请先阅读以下文件：
- AGENTS.md（项目规范和意图）
- scope.md（范围定义和模块列表）

## 当前任务

1. **数据模型**：为每个业务对象定义 TypeScript 接口
   - 输出到 `src/domain/*.ts`
2. **页面地图**：列出所有页面路由和组件
3. **API 契约**：生成 OpenAPI 3.0 格式的端点定义
   - 输出到 `src/api/openapi.yaml`
4. **权限模型**：定义角色和数据访问规则
5. **验收标准**：列出可验证的验收条件
   - 输出到 `specs/acceptance.md`

## 输出规范

- 所有产出文件写入 workspace 目录
- 使用 TypeScript 定义数据模型
- OpenAPI 使用 YAML 格式
