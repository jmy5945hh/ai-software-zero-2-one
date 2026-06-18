# 前端开发能力评分表 — /profile/advanced 高级详情页复现评估

> 评估对象完成 `/profile/advanced` 高级详情页的复现。
> **评估原则**：重点考察 ProComponents 高级用法、antd 组件组合能力、数据流管理以及响应式设计实践。具体视觉样式（配色、间距、字号、圆角等）允许自由发挥，只要整体协调、层次清晰即可。评分时功能正确性优先于视觉还原度。
> 评分标准：每项 **1–5 分**（1=未实现/严重错误, 3=基本达标, 5=超出预期/优雅实现），总分 **80 分**。

---

## 一、项目结构与约定遵守（12 分）

| # | 评估维度 | 评分要点 | 得分 | 备注 |
|---|---------|---------|------|------|
| 1.1 | **路由配置** | 在 `config/routes.ts` 的 profile 路由组中正确声明 `/profile/advanced` 路由，`name` 字段与 i18n key 一致（`advanced`），`icon` 配置正确（`crown`） | /5 | |
| 1.2 | **页面目录规范** | 文件放在 `src/pages/profile/advanced/` 下，遵循"页面自包含"规范（`index.tsx` + `service.ts` + `data.d.ts` + `_mock.ts` + `style.style.ts`），各文件职责分明 | /5 | |
| 1.3 | **i18n 国际化** | `src/locales/en-US/menu.ts` 和 `zh-CN/menu.ts` 添加 `menu.profile.advanced` 条目，中英文翻译正确（中文「高级详情页」/ 英文「Advanced Profile」） | /2 | |

---

## 二、UI 布局与组件实现（25 分）

| # | 评估维度 | 评分要点 | 得分 | 备注 |
|---|---------|---------|------|------|
| 2.1 | **PageContainer 头部** | 标题「单号：234231029431」正确显示；`extra` 操作栏桌面端展示 Button 组 + Dropdown + 主操作按钮，移动端合并为 Dropdown.Button；`tabList` 包含「详情」「规则」两个 Tab，默认选中「详情」 | /5 | |
| 2.2 | **PageContainer 描述与统计** | `content` 区使用 `Descriptions`（`size="small"`）展示 6 项单据概要信息（创建人、订购产品、创建时间、关联单据链接、生效日期、备注）；`extraContent` 区使用 `Statistic` 展示「状态：待审批」和「订单金额：¥568.08」；移动端 Descriptions 切换为单列 | /4 | |
| 2.3 | **流程进度 Steps** | Card 标题「流程进度」内嵌 `Steps` 组件（`current={1}`）；4 个步骤（创建项目→部门初审→财务复核→完成）；自定义 `iconRender`：当前激活步骤圆点替换为 Popover，悬浮展示处理人信息（姓名、状态 Badge、耗时）；步骤描述区显示处理人 + DingdingOutlined + 时间/操作链接；移动端切换垂直布局 | /5 | |
| 2.4 | **用户信息区** | Card（`variant="borderless"`）标题「用户信息」内：基础信息 Descriptions（5 项）；信息组一 Descriptions 带标题（含 Tooltip + InfoCircleOutlined）；h4「信息组」+ Card（`type="inner"`）内三层 Descriptions 用 Divider 分隔，第二组为单列布局 | /5 | |
| 2.5 | **来电记录** | Card（`variant="borderless"`）标题「用户近半年来电记录」，内容为 `Empty` 组件 | /2 | |
| 2.6 | **操作日志 Tabs + Table** | Card（`variant="borderless"`）包含 3 个 Tab（操作日志一/二/三），每个 Tab 内嵌 Table（`pagination={false}`），列：操作类型、操作人、执行结果（Badge 渲染 agree=成功/绿色，其他=驳回/红色）、操作时间、备注 | /4 | |

---

## 三、数据流与状态管理（12 分）

| # | 评估维度 | 评分要点 | 得分 | 备注 |
|---|---------|---------|------|------|
| 3.1 | **数据请求** | 使用 `@tanstack/react-query` 的 `useQuery` 发起请求；`queryKey` 为 `['profile-advanced']`；`queryFn` 调用 `queryAdvancedProfile()`；service 层使用 `@umijs/max` 的 `request` 调用 `GET /api/profile/advanced` | /4 | |
| 3.2 | **数据消费** | 接口返回的 `advancedOperation1/2/3` 正确分发到三个 Tab 的 Table `dataSource`；`isLoading` 绑定到 Table 的 `loading` 属性 | /3 | |
| 3.3 | **Mock 数据** | `_mock.ts` 中 Express handler 正确返回 `GET /api/profile/advanced` 的数据结构；三个 operation 数组各有至少一条 mock 数据；`npm start` 下可正常访问 | /3 | |
| 3.4 | **状态管理** | `tabStatus` 状态正确管理 PageContainer Tab 和操作日志 Card Tab 的切换；`useState` 类型标注完整 | /2 | |

---

## 四、类型定义与 TypeScript（10 分）

| # | 评估维度 | 评分要点 | 得分 | 备注 |
|---|---------|---------|------|------|
| 4.1 | **数据结构类型** | `data.d.ts` 中定义 `AdvancedProfileData` 接口及操作日志类型（`AdvancedOperation` 或等效定义），字段类型正确 | /4 | |
| 4.2 | **组件类型** | `TabStatus` 状态类型有联合类型约束（如 `operationKey: 'tab1' \| 'tab2' \| 'tab3'`）；Step items 使用 `StepsProps['items']` 类型；Descriptions items 使用 `DescriptionsProps['items']` 类型；无显式 `any` 滥用 | /3 | |
| 4.3 | **类型安全** | 类型文件从 `./data.d` 正确导入；`npm run tsc` 无新增类型错误 | /3 | |

---

## 五、样式实现（8 分）

| # | 评估维度 | 评分要点 | 得分 | 备注 |
|---|---------|---------|------|------|
| 5.1 | **样式方案** | 使用 `antd-style` 的 `createStyles` 创建样式，基于主题 token（如 `token.screenSM` 用于媒体查询断点） | /4 | |
| 5.2 | **响应式适配** | PageContainer extra 区移动端样式适配（`flexDirection: 'column'`）；Step 描述在移动端 `left: 8px` 偏移；Descriptions 行间距调整（`paddingBottom: 8px`）；使用 `@media` 查询与 `token.screenSM` 配合 | /4 | |

---

## 六、响应式与移动端适配（7 分）

| # | 评估维度 | 评分要点 | 得分 | 备注 |
|---|---------|---------|------|------|
| 6.1 | **RouteContext 使用** | 正确使用 `RouteContext.Consumer` 获取 `isMobile` 判断设备类型；在 action 按钮区、Steps 布局、Descriptions 列数三处应用 | /4 | |
| 6.2 | **移动端体验** | 移动端操作按钮不挤压布局；Steps 垂直布局下 Popover 交互正常；Descriptions 单列展示信息不截断 | /3 | |

---

## 七、代码质量与工程实践（6 分）

| # | 评估维度 | 评分要点 | 得分 | 备注 |
|---|---------|---------|------|------|
| 7.1 | **规范遵守** | Conventional commit 消息格式；代码通过 Biome 检查（`npm run lint`）和 TypeScript 检查（`npm run tsc`） | /3 | |
| 7.2 | **代码可读性** | 组件命名清晰（`Advanced`）；数据配置项（`descriptionItems`、`columns` 等）提取为组件外常量；`contentList` 用对象映射替代冗长的条件渲染；文件职责划分符合项目规范 | /3 | |

---

## 总分汇总

| 维度 | 满分 | 得分 | 占比 |
|------|------|------|------|
| 一、项目结构与约定遵守 | 12 | | 15% |
| 二、UI 布局与组件实现 | 25 | | 31.25% |
| 三、数据流与状态管理 | 12 | | 15% |
| 四、类型定义与 TypeScript | 10 | | 12.5% |
| 五、样式实现 | 8 | | 10% |
| 六、响应式与移动端适配 | 7 | | 8.75% |
| 七、代码质量与工程实践 | 6 | | 7.5% |
| **总分** | **80** | | **100%** |

## 评级参考

| 总分范围 | 评级 | 解读 |
|---------|------|------|
| 70–80 | ⭐ 优秀 | 对 ProComponents 和 antd 组件组合有深入理解，工程素养扎实，可直接参与核心业务模块开发 |
| 56–69 | ✅ 良好 | 能独立完成复杂页面开发，少数细节（如边界 case、移动端适配）有提升空间 |
| 40–55 | ⚠️ 一般 | 基本能完成任务，但组件组合能力和数据流管理需加强，需较多 code review |
| < 40 | 🔴 待提升 | 对 ProComponents / React Query / TypeScript 需要系统性学习和练习 |

---

## 加分项（额外参考，不计入总分）

| # | 加分项 | 说明 |
|---|-------|------|
| + | **单元测试** | 为 `queryAdvancedProfile` service 或组件渲染编写 Jest 测试 |
| + | **错误处理** | 请求失败时显示友好的错误提示（如 `message.error`）或使用 ErrorBoundary |
| + | **Loading 骨架屏** | Table 以外的区域（如 Steps、Descriptions）在数据加载中显示 Skeleton 占位 |
| + | **无障碍** | 为 Popover、Dropdown、Steps 等交互组件添加合适的 ARIA 属性 |
| + | **TypeScript 严格模式** | 使用 `satisfies` 操作符校验数据配置项类型，无类型断言（`as`）滥用 |
| + | **自定义 Hooks** | 将 `isMobile` 逻辑或数据获取逻辑抽离为自定义 Hook |
