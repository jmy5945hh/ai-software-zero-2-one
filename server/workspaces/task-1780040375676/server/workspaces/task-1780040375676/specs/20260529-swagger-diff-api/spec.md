# Feature Specification: Swagger Diff API

**Feature Branch**: `001-swagger-diff-api`

**Created**: 2026-05-29

**Status**: Draft

**Input**: User description: "项目重构，支持以接口调用形式进行swagger diff的生成。入参为两个swagger 文档。"

## User Scenarios & Testing

### User Story 1 - 提交两个 Swagger 文档进行 Diff (Priority: P1)

用户在前端页面上传或粘贴两个 Swagger/OpenAPI 文档（JSON/YAML 格式），系统自动对比并展示差异结果。

**Why this priority**: 这是核心功能，没有这个入口整个功能无法使用。P1 确保最小可用产品能交付基本价值。

**Independent Test**: 可以独立测试：用户输入两个有效的 Swagger 文档，系统输出结构化的差异对比结果。即使没有其他功能，用户已能完成核心任务。

**Acceptance Scenarios**:

1. **Given** 用户已打开 Diff 页面，**When** 用户在"源文档"和"目标文档"输入框中分别粘贴两个有效的 Swagger JSON/YAML 文档，**Then** 系统能够正确解析且不报错
2. **Given** 用户已输入两个有效的 Swagger 文档，**When** 用户点击"对比"按钮，**Then** 系统在 5 秒内展示结构化的差异结果
3. **Given** 用户输入的文档格式无效，**When** 用户点击"对比"按钮，**Then** 系统提示"文档格式无效，请检查 JSON/YAML 格式"并提供具体的解析错误位置

---

### User Story 2 - 查看结构化的 Diff 结果 (Priority: P1)

系统将两个 Swagger 文档的差异按类别（新增、删除、修改）分组展示，用户可以清晰看到每个变更的具体内容。

**Why this priority**: 展示差异结果是核心输出，与 P1 的 Story 1 共同构成 MVP。

**Independent Test**: 可以独立测试：给定已知差异的两个 Swagger 文档，验证 diff 结果的三类分组是否正确完整。

**Acceptance Scenarios**:

1. **Given** 两个 Swagger 文档已完成对比，**When** 差异结果展示页面加载完成，**Then** 结果按"新增（Added）"、"删除（Removed）"、"修改（Changed）"三类分组展示
2. **Given** 差异结果已分组展示，**When** 用户查看"新增"分组，**Then** 每个新增项显示完整的路径和内容
3. **Given** 差异结果已分组展示，**When** 用户查看"修改"分组，**Then** 每个修改项同时显示旧值和新值，并高亮变化的字段
4. **Given** 两个文档完全相同，**When** 对比完成，**Then** 系统显示"两个文档完全一致，无差异"

---

### User Story 3 - 按路径/节点筛选查看差异 (Priority: P2)

当两个 Swagger 文档差异较多时，用户可以通过搜索路径或选择节点类型（paths、schemas、parameters 等）来筛选查看特定范围的变更。

**Why this priority**: 提升大型文档的可用性，但在差异较少时不是必需功能。

**Independent Test**: 可以独立测试：加载有大量差异的文档，验证筛选功能能否正确过滤显示指定路径/类型的变更。

**Acceptance Scenarios**:

1. **Given** 差异结果已展示，**When** 用户在搜索框中输入路径关键词（如 "/users"），**Then** 结果只显示包含该路径的变更
2. **Given** 差异结果已展示，**When** 用户选择筛选条件"paths"节点类型，**Then** 只显示 endpoints（路径）相关的变更
3. **Given** 筛选条件已应用，**When** 用户清除筛选条件，**Then** 恢复显示全部差异

---

### User Story 4 - 导出 Diff 报告 (Priority: P3)

用户可以将 Diff 结果导出为 JSON 或 Markdown 格式的报告，便于存档或分享。

**Why this priority**: 增强功能，非核心体验。在 MVP 确认核心价值后可迭代添加。

**Independent Test**: 可以独立测试：生成 diff 后，点击导出按钮，验证导出的文件内容与实际 diff 结果一致。

**Acceptance Scenarios**:

1. **Given** 差异结果已展示，**When** 用户点击"导出为 JSON"，**Then** 下载一个包含完整 diff 信息的 JSON 文件
2. **Given** 差异结果已展示，**When** 用户点击"导出为 Markdown"，**Then** 下载一个可读性良好的 Markdown 报告文件

### Edge Cases

- 当输入的 Swagger 文档之一为空或内容为空对象 `{}` 时，系统如何处理？
- 当 Swagger 版本不同（如 Swagger 2.0 vs OpenAPI 3.0）时，是否需要支持跨版本对比？
- 两个文档完全相同时，差异结果为空，界面如何展示？
- 当文档体积非常大（包含数百个 endpoints）时，对比性能和展示性能如何保证？
- 当文档格式正确但语义不符合 Swagger 规范时（如缺少必要字段），系统如何处理？

## Requirements

### Functional Requirements

- **FR-001**: 系统 MUST 支持用户以 JSON 或 YAML 格式输入两个 Swagger/OpenAPI 文档
- **FR-002**: 系统 MUST 在提交后自动解析并对比两个文档的结构差异
- **FR-003**: 系统 MUST 将差异结果按"新增（Added）"、"删除（Removed）"、"修改（Changed）"三类进行分组展示
- **FR-004**: 对于"修改"类型的差异，系统 MUST 同时展示旧值和新值
- **FR-005**: 系统 MUST 对 Swagger 文档进行**完整字段级深度对比**，包括但不限于：
  - paths（接口路径及方法）的新增/删除/修改
  - schemas/components（数据模型）的新增/删除/修改
  - 每个字段的元数据变化（description、type、format、required、enum、default 等）
  - parameters（参数）的增删改
  - responses（响应）的状态码及结构变化
  - securityDefinitions/securitySchemes 的变化
- **FR-006**: 系统 MUST 在输入文档格式无效时给出明确的错误提示
- **FR-007**: 系统 MUST 在本地缓存最近 5 次的 Diff 记录和结果，以便用户查看历史对比
- **FR-008**: 系统 MUST 支持从本地上传 Swagger 文档文件（JSON 或 YAML 格式）作为输入
- **FR-009**: 系统 MUST 支持在文本编辑区直接粘贴 Swagger 文档内容作为输入
- **FR-010**: 系统 MUST 在前端完成全部逻辑处理，无需后端服务（本地存储 + 浏览器端计算）
- **FR-011**: 当两个文档完全相同时，系统 MUST 清晰提示用户"无差异"
- **FR-012**: 系统 SHOULD 支持用户在差异结果中按路径关键词搜索筛选
- **FR-013**: 系统 SHOULD 支持用户按节点类型（paths、schemas/components 等）筛选差异结果
- **FR-014**: 系统 COULD 支持将 Diff 结果导出为 JSON 格式文件
- **FR-015**: 系统 COULD 支持将 Diff 结果导出为 Markdown 格式报告

### Key Entities

- **Swagger Document**: 一个 Swagger/OpenAPI 规范文档，包含 paths、definitions/schemas、info 等节点。输入源，可以是 JSON 或 YAML 格式。
- **Diff Record**: 一次对比操作的完整记录，包含源文档标识、目标文档标识、对比时间戳、差异结果集。
- **Diff Result**: 两个 Swagger 文档的差异结果集，按操作类型（Add/Remove/Change）分组，每个差异项包含路径、旧值（如适用）、新值（如适用）。
- **Comparison Session**: 一次用户发起的对比会话，包含输入的两个文档、解析状态、对比状态和结果。

## Success Criteria

### Measurable Outcomes

- **SC-001**: 用户从提交两个文档到看到结构化差异结果，整个过程不超过 5 秒（文档大小不超过 500KB 时）
- **SC-002**: 对比结果正确率 100%——人工验证已知差异的文档对，系统能100%识别所有差异且无误报
- **SC-003**: 用户首次使用即可在不查看帮助文档的情况下完成一次完整的对比流程（任务完成率 ≥ 90%）
- **SC-004**: 无效文档输入时，用户收到的错误提示明确指出了问题位置和原因，用户据此修正后能成功完成对比（首次修正成功率 ≥ 80%）
- **SC-005**: 单个 Swagger 文档大小不超过 2MB 时，页面操作保持流畅无卡顿（无明显渲染延迟）

## Assumptions

- 两个 Swagger 文档使用相同的 OpenAPI 规范版本（跨版本对比为增强需求，暂不纳入 v1 范围）
- 用户输入的两个文档均已通过基本语法校验（JSON/YAML 格式合法），系统仅在应用层做格式校验
- 前端本地完成所有逻辑处理，无后端 API 依赖——若未来需迁移到后端，diff 核心逻辑应保持可复用
- 对比的文档大小在典型范围内（几十 KB 到几百 KB），超大规模文档性能优化为后续迭代
- 用户使用现代浏览器（Chrome/Firefox/Edge/Safari 近两个大版本），支持基本的 ES6+ 和 File API 特性
- 对比会话的状态和结果通过浏览器本地存储管理，确保刷新后最近记录不丢失
- 对比深度采用**完整字段级深度对比**（默认方案），覆盖 paths、schemas/components、parameters、responses 等所有结构层级的字段级变更
