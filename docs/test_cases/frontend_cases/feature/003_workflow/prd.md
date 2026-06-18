# PRD - 高级详情页（/profile/advanced）

## 1. 总结概要

高级详情页是一个典型的 B 端业务详情展示页面，用于展示某业务单据的完整信息。页面采用 PageContainer 多 Tab 容器布局，包含单据概要、流程进度、用户信息、来电记录、操作日志等模块。数据通过 React Query（`@tanstack/react-query`）异步请求获取，页面整体支持移动端响应式适配。该页面与已有的 `/profile/basic`（基础详情页）同属 profile 模块，是 ProComponents 进阶使用的综合考察范例。

---

## 2. 业务功能说明

### 2.1 单据概要区（PageContainer 头部）

- **标题**：显示单据编号「单号：234231029431」
- **操作按钮区**（`extra`）：
  - 桌面端：左侧显示「操作一」「操作二」按钮 + 下拉更多菜单（`<EllipsisOutlined />`，包含「选项一/二/三」），右侧显示主操作按钮（`type="primary"`，文案「主操作」）
  - 移动端：合并为 `Dropdown.Button`（`type="primary"`），下拉菜单包含「操作一/二/三」
  - 使用 `RouteContext.Consumer` 获取 `isMobile` 判断当前设备
- **描述区**（`content`）：使用 `Descriptions` 组件（`size="small"`）展示单据概要信息，桌面 2 列、移动端 1 列
  - 创建人、订购产品、创建时间、关联单据（链接）、生效日期（时间段）、备注
- **统计区**（`extraContent`）：使用 `Statistic` 组件展示「状态：待审批」和「订单金额：¥568.08」
- **页面级 Tab**（`tabList`）：顶部显示「详情」/「规则」两个 Tab，默认选中「详情」

### 2.2 流程进度卡片

- 使用 `Card` 组件，标题「流程进度」
- 内嵌 `Steps` 步骤条，`current={1}`（当前在第二步「部门初审」）
  - 四个步骤：创建项目 → 部门初审 → 财务复核 → 完成
- **自定义步骤图标**（`iconRender` / `customDot`）：当前激活步骤的圆点替换为 `Popover`，悬浮展示处理人信息（姓名「吴加号」、状态 Badge「未响应」、耗时「2小时25分钟」）
- **步骤描述**（`content` / `description`）：每步下方显示处理人姓名 + `DingdingOutlined` 图标 + 时间/操作链接
- 桌面端水平布局，移动端垂直布局（通过 `RouteContext.Consumer` 获取 `isMobile`）

### 2.3 用户信息卡片

- 使用 `Card`（`variant="borderless"`），标题「用户信息」
- **基础信息**：`Descriptions` 组件展示用户姓名、会员卡号、身份证、联系方式、联系地址
- **信息组一**：`Descriptions` 带标题「信息组」，包含：
  - 某某数据（数值）、该数据更新时间
  - 某某数据（带 `Tooltip` 说明图标 `<InfoCircleOutlined />`）、该数据更新时间
- **信息组二**：`h4` 标题「信息组」+ `Card`（`type="inner"`，标题「多层级信息组」）内嵌三层 `Descriptions`：
  - 组一（负责人、角色码、所属部门、过期时间、描述）
  - 组二（`Divider` 分隔，单列布局，学名）
  - 组三（`Divider` 分隔，负责人、角色码）

### 2.4 来电记录卡片

- 使用 `Card`（`variant="borderless"`），标题「用户近半年来电记录」
- 内容为 `Empty` 空状态组件

### 2.5 操作日志卡片

- 使用 `Card`（`variant="borderless"`），内嵌 Tab 切换（`tabList` + `onTabChange`）
- 三个 Tab：「操作日志一」「操作日志二」「操作日志三」
- 每个 Tab 内嵌 `Table`，列定义：
  - 操作类型、操作人、执行结果（`Badge` 渲染：`agree` → 绿色「成功」、其他 → 红色「驳回」）、操作时间、备注
- `pagination={false}`，表格 `loading` 状态与数据请求联动
- 三个 Tab 分别对应接口返回的 `advancedOperation1`、`advancedOperation2`、`advancedOperation3` 数据

---

## 3. UX 设计说明

### 3.1 整体布局

```
┌─────────────────────────────────────────────────┐
│  PageContainer                                  │
│  ┌─────────────────────────────────────────┐    │
│  │ 标题: 单号：234231029431    [操作按钮区]  │    │
│  │ [描述信息区]              [统计数字区]    │    │
│  │ [详情 | 规则] (Tab)                      │    │
│  └─────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────┐    │
│  │  GridContent                            │    │
│  │  ┌───────────────────────────────────┐  │    │
│  │  │ Card: 流程进度 (Steps)             │  │    │
│  │  └───────────────────────────────────┘  │    │
│  │  ┌───────────────────────────────────┐  │    │
│  │  │ Card: 用户信息                     │  │    │
│  │  │  ├ Descriptions: 基础信息          │  │    │
│  │  │  ├ Descriptions: 信息组            │  │    │
│  │  │  └ Card(inner): 多层级信息组       │  │    │
│  │  └───────────────────────────────────┘  │    │
│  │  ┌───────────────────────────────────┐  │    │
│  │  │ Card: 用户近半年来电记录 (Empty)    │  │    │
│  │  └───────────────────────────────────┘  │    │
│  │  ┌───────────────────────────────────┐  │    │
│  │  │ Card: [操作日志一|二|三] (Tabs)    │  │    │
│  │  │  └ Table (操作日志表格)            │  │    │
│  │  └───────────────────────────────────┘  │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

### 3.2 响应式设计

- 使用 `RouteContext.Consumer` 获取 `isMobile` 判断设备类型
- 移动端：操作按钮合并为 `Dropdown.Button`；步骤条切换为垂直布局；描述列表切换为单列
- Card 之间使用 `marginBottom: 24` 统一间距
- PageContainer 的 `extra` 区域在移动端有特定样式适配（`antd-style` 媒体查询）

### 3.3 视觉规范

- 步骤条 Popover 宽度 160px，箭头居中对齐（`pointAtCenter: true`）
- 表格状态列使用 `Badge` 的 `status` 属性（`success` / `error`）
- 信息提示图标（`InfoCircleOutlined`）颜色 `rgba(0, 0, 0, 0.43)`，左边距 4px
- `DingdingOutlined` 图标在步骤描述中用于标识可联系的处理人

---

## 4. 技术设计说明

### 4.1 技术栈

| 技术 | 用途 |
|------|------|
| React 18 + TypeScript | 页面主体框架 |
| `@ant-design/pro-components` `PageContainer` / `GridContent` / `RouteContext` | 页面容器、栅格内容区、路由上下文 |
| `antd` Card / Descriptions / Steps / Table / Statistic / Badge / Popover / Divider / Empty / Dropdown / Button / Space / Tooltip | UI 组件 |
| `@ant-design/icons` DingdingOutlined / DownOutlined / EllipsisOutlined / InfoCircleOutlined | 图标 |
| `@tanstack/react-query` `useQuery` | 数据请求与缓存管理 |
| `@umijs/max` `request` | HTTP 请求客户端 |
| `antd-style` `createStyles` | CSS-in-JS 样式方案（主题 token 驱动） |

### 4.2 数据结构

```typescript
// 操作日志条目（三种类型的结构相同）
type AdvancedOperation = {
  key: string;
  type: string;       // 操作类型（如"订购关系生效"）
  name: string;       // 操作人
  status: string;     // 执行结果（"agree" | "reject"）
  updatedAt: string;  // 操作时间
  memo: string;       // 备注
};

// 接口返回数据
interface AdvancedProfileData {
  advancedOperation1?: AdvancedOperation[];
  advancedOperation2?: AdvancedOperation[];
  advancedOperation3?: AdvancedOperation[];
}
```

### 4.3 数据流

```
页面挂载
  └─→ useQuery({ queryKey: ['profile-advanced'], queryFn })
        └─→ queryAdvancedProfile()
              └─→ request('/api/profile/advanced')
                    └─→ GET /api/profile/advanced
                          └─→ 返回 { data: { advancedOperation1,2,3 } }
                                └─→ 三个 Tab 分别消费对应数组
```

- 使用 `useQuery` 的 `isLoading` 作为 Table 的 `loading` 状态
- `queryKey` 为 `['profile-advanced']`，确保缓存键唯一

### 4.4 Mock 数据

```typescript
// 放在 src/pages/profile/advanced/_mock.ts
// Express 风格 handler
function getProfileAdvancedData(_req: Request, res: Response) {
  const result = {
    data: {
      advancedOperation1: [...],  // 5 条记录
      advancedOperation2: [...],  // 1 条记录
      advancedOperation3: [...],  // 1 条记录
    },
  };
  return res.json(result);
}

export default {
  'GET  /api/profile/advanced': getProfileAdvancedData,
};
```

### 4.5 状态管理

| 状态 | 类型 | 说明 |
|------|------|------|
| `tabStatus.tabActiveKey` | `string` | PageContainer 级 Tab 激活项（`'detail'` / `'rule'`） |
| `tabStatus.operationKey` | `'tab1' \| 'tab2' \| 'tab3'` | 操作日志 Card 内 Tab 激活项 |
| `data` | `AdvancedProfileData` | 接口返回数据，默认值 `{}` |
| `loading` | `boolean` | 数据加载状态，来自 `useQuery` |

### 4.6 目录结构

```
src/pages/profile/advanced/
├── index.tsx        # 页面主组件
├── service.ts       # API 请求函数
├── data.d.ts        # TypeScript 类型定义
├── _mock.ts         # Mock 数据
└── style.style.ts   # antd-style 样式文件
```

### 4.7 路由配置

在 `config/routes.ts` 的 profile 路由组中添加：

```typescript
{
  name: 'advanced',
  icon: 'crown',
  path: '/profile/advanced',
  component: './profile/advanced',
}
```

---

## 5. 交付标准

- [ ] `/profile/advanced` 路由可访问，左侧菜单 profile 下出现「高级详情页」入口
- [ ] 中英文菜单翻译正确（`menu.profile.advanced`）
- [ ] PageContainer 头部操作栏在桌面端和移动端正确渲染
- [ ] 流程进度 Steps 正常展示，Popover 悬浮交互正常
- [ ] 用户信息区多层 Descriptions + 嵌套 Card 渲染正确
- [ ] 操作日志三个 Tab 切换正常，Table 正确显示数据
- [ ] 数据通过 `useQuery` 异步获取，loading 状态正确
- [ ] Mock 数据可用，`npm start` 下页面可正常访问
- [ ] 移动端 Steps 切换为垂直布局
- [ ] `npm run lint` + `npm run tsc` 无新增错误
- [ ] 提交历史清晰，commit message 符合 Conventional Commits 规范
