# PRD - 高级详情页面（/profile/advanced）

## 1. 总结概要

高级详情页面是面向企业审批/工单场景的综合信息展示页，以单据视角聚合了订单基本信息、审批流程进度、关联用户信息及操作历史记录。页面以单号为标题，在页头区域直观呈现单据状态、金额及主要操作按钮，支持移动端与桌面端两种按钮布局。页面正文通过「详情」与「规则」Tab 切换，并分设流程进度、用户信息、来电记录、操作日志四大功能区块，完整覆盖审批单据的全生命周期信息。数据通过 React Query 异步加载，响应式设计确保在不同设备上均可正常使用。

---

## 2. 业务功能说明

### 2.1 页头信息区

- **标题**：展示单号（如"单号：234231029431"）作为页面标题
- **状态与金额**（右侧 extra）：
  - 当前状态（如"待审批"）
  - 订单金额（¥568.08）
- **操作按钮**（桌面端）：
  - 「操作一」「操作二」主次操作按钮组（Space.Compact 排列）
  - 更多操作（EllipsisOutlined + Dropdown，含选项一/二/三）
  - 「主操作」主按钮（primary 类型）
- **操作按钮**（移动端）：合并为带下拉菜单的 `Dropdown.Button`，节省横向空间

### 2.2 单据基本描述

页头下方 Descriptions 展示 6 项基本信息：

| 字段 | 示例值 |
|------|--------|
| 创建人 | 曲丽丽 |
| 订购产品 | XX 服务 |
| 创建时间 | 2017-07-07 |
| 关联单据 | 可点击的单据号链接 |
| 生效日期 | 日期区间 |
| 备注 | 文本说明 |

### 2.3 Tab 切换（详情 / 规则）

通过 `PageContainer` 内置 tabList 实现，当前仅「详情」Tab 有内容渲染，「规则」Tab 预留扩展。

### 2.4 流程进度（Steps）

- 4 步审批流程：创建项目 → 部门初审 → 财务复核 → 完成
- 当前进行步骤（current=1）采用自定义 dot 渲染：弹出 Popover 显示处理人、响应状态和耗时
- 已完成步骤展示完成人姓名、钉钉图标及时间
- 进行中步骤提供「催一下」快捷催办链接

### 2.5 用户信息（User Info）

分三层 Descriptions 展示：
1. **基本用户信息**：姓名、会员卡号、身份证、联系方式、联系地址
2. **信息组**：某某数据指标及更新时间（含 Tooltip 数据说明图标）
3. **多层级信息组**（Card inner 嵌套）：
   - 组名称1：负责人、角色码、所属部门、过期时间、描述
   - 组名称2：学名（长文本描述）
   - 组名称3：负责人、角色码

### 2.6 用户近半年来电记录

空状态展示（`<Empty />`），表示该区域暂无数据，预留数据接入扩展点。

### 2.7 操作日志（Operation Tabs）

3 个操作日志 Tab（操作日志一/二/三），每个 Tab 对应一张操作记录表格：

| 列名 | 字段 | 说明 |
|------|------|------|
| 操作类型 | type | 文本 |
| 操作人 | name | 文本 |
| 执行结果 | status | Badge 渲染：agree→成功（绿），其他→驳回（红） |
| 操作时间 | updatedAt | 时间字符串 |
| 备注 | memo | 文本 |

---

## 3. UX 设计说明

### 3.1 布局结构

- 使用 `PageContainer` + `GridContent` 双层容器实现统一页面框架
- 页头：标题（左）+ 状态金额（右）+ 操作区（最右）水平三段式布局
- 基本信息描述区：响应式列数（移动端 1 列，桌面端 2 列）
- 正文内容区纵向堆叠：流程进度 → 用户信息 → 来电记录 → 操作日志，各区块间距 24px

### 3.2 流程步骤条

- 桌面端水平排列，移动端自动切换为垂直方向（`RouteContext` 适配）
- 当前进行节点使用 Popover 弹出详细信息，增强信息密度而不破坏整体步骤条视觉
- 已完成步骤附钉钉图标（`DingdingOutlined`），强调通知/协作行为

### 3.3 信息层级

- 内嵌 `Card type="inner"` 实现多层级信息组的视觉分层
- 同级组之间用 `Divider` 分隔
- 带数据说明的字段 label 内嵌 `InfoCircleOutlined` + Tooltip，减少页面说明文字冗余

### 3.4 操作区自适应

- 通过 `RouteContext.Consumer` 消费当前路由上下文的 `isMobile` 属性
- 移动端将多按钮折叠为单一 `Dropdown.Button`，符合移动端手势操作习惯

### 3.5 操作日志

- Tab 切换无需重新请求，数据在初始请求中一并返回，Tab 之间切换即时响应
- 表格禁用分页（`pagination={false}`），一次性展示全部操作记录

---

## 4. 技术设计说明

### 4.1 技术栈

| 技术 | 用途 |
|------|------|
| React 18 + TypeScript | 页面主体框架 |
| `@tanstack/react-query` | 数据异步请求与缓存 |
| `@ant-design/pro-components` `PageContainer` / `GridContent` / `RouteContext` | 页面容器与移动端适配 |
| `antd` Descriptions/Steps/Table/Card/Badge/Popover | UI 基础组件 |
| `antd-style` `createStyles` | 样式方案 |

### 4.2 数据结构

```typescript
interface AdvancedProfileData {
  advancedOperation1: OperationItem[];
  advancedOperation2: OperationItem[];
  advancedOperation3: OperationItem[];
}

interface OperationItem {
  type: string;
  name: string;
  status: 'agree' | 'reject';
  updatedAt: string;
  memo: string;
}
```

### 4.3 状态管理

```typescript
type AdvancedState = {
  operationKey: 'tab1' | 'tab2' | 'tab3'; // 操作日志激活Tab
  tabActiveKey: string;                    // 页头Tab激活key（'detail'|'rule'）
};
```

- `onTabChange`：切换详情/规则 Tab
- `onOperationTabChange`：切换操作日志 Tab

### 4.4 数据请求

| queryKey | Service 方法 | 接口路径 |
|----------|-------------|----------|
| `profile-advanced` | `queryAdvancedProfile()` | `/api/profile/advanced` |

返回数据包含 3 组操作日志数组，一次请求获取所有 Tab 数据，无需按 Tab 分开请求。

### 4.5 响应式适配

`RouteContext` 注入 `isMobile` 布尔值，用于以下两处适配：
1. 操作按钮：桌面展示完整按钮组 / 移动端折叠为 `Dropdown.Button`
2. Descriptions 列数：桌面 `column={2}` / 移动端 `column={1}`
3. Steps 方向：桌面 `horizontal` / 移动端 `vertical`

### 4.6 Mock 数据

Mock 文件：`src/pages/profile/advanced/_mock.ts`，接口路径 `/api/profile/advanced`，返回包含三组操作日志的对象。
