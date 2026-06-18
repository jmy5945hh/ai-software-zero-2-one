# PRD - 数据分析仪表盘（/dashboard/analysis）

## 1. 总结概要

分析页是一个电商运营数据分析仪表盘，呈现企业核心运营指标的可视化概览。页面采用卡片式布局，自上而下分为五大功能区域：指标概览行、销售额趋势、搜索分析、品类占比、门店转化监控。所有数据通过单个 GET 接口获取，使用 `@tanstack/react-query` 管理请求状态。页面组件按需加载（`Suspense`），加载中展示骨架屏或 Loading 动效。

---

## 2. 业务功能说明

### 2.1 指标概览行（IntroduceRow）

水平 4 列响应式卡片布局（`xs:24, sm:12, xl:6`），展示核心运营 KPI：

- **总销售额卡片**
  - 总值显示为 `¥ 126,560` 格式（需货币格式化函数）
  - Footer 显示「日销售额 ¥12,423」
  - 内含周同比 12%（上升绿色箭头）+ 日同比 11%（下降红色箭头）
  - 带有指标说明 Tooltip 图标

- **访问量卡片**
  - 总数 8,846，Footer 显示「日访问量 1,234」
  - 内含 Area 迷你面积图（渐变紫色填充 `linear-gradient(-90deg, white 0%, #975FE4 100%)`）
  - 数据来源 `visitData`（x 轴日期 + y 轴数值）

- **支付笔数卡片**
  - 总数 6,560，Footer 显示「转化率 60%」
  - 内含 Column 迷你柱状图
  - 与访问量卡片共用 `visitData` 数据源

- **运营活动效果卡片**
  - 总值「78%」
  - 内含 Progress 进度条（渐变绿色 `#108ee9 → #87d068`）
  - Footer 显示周同比 12% ↑ / 日同比 11% ↓

每张卡片使用 ChartCard 组件，支持 `loading` 态。数字格式化（千分位）使用 `formatNumber` 工具函数。

### 2.2 销售额趋势与排名（SalesCard）

- **Tab 切换**：销售额 / 访问量两个 Tab 页
- **TabBar 右侧控件**：
  - 快捷时间按钮组：`今日` / `本周` / `本月` / `本年`（当前选中的按钮高亮为主题色）
  - RangePicker 日期区间选择器，受控组件，默认选中「本年」范围
- **图表区域**：Column 柱状图（高度 300px），x 轴为月份（1-12 月），y 轴为数值，带 Tooltip
- **排名列表**：右侧展示「门店销售额/访问量排名」Top 7，前三名序号高亮（深色圆底白字，其余浅灰底色）

### 2.3 线上热门搜索（TopSearch）

左侧 12 列 + 右侧 12 列的等分布局，卡片包含：

- **搜索用户数指标**：数值 12,321 + 上升箭头 + 17.1%，下方迷你 Area 面积图
- **人均搜索次数指标**：数值 2.7 + 下降箭头 + 26.2%，下方迷你 Area 面积图
- **搜索关键词表格**：5 列（排名、搜索关键词（链接样式）、用户数（可排序）、周涨幅（可排序，渲染为升降 Trend 箭头）），分页 pageSize=5
- 卡片右上角提供 Dropdown 下拉菜单（占位操作项）

### 2.4 销售额类别占比（ProportionSales）

左侧 12 列，卡片包含：

- 右上角 Dropdown 菜单 + **Segmented 分段控制器**：「全部渠道」「线上」「门店」
- 根据选中类型切换饼图数据源（`salesTypeData` / `salesTypeDataOnline` / `salesTypeDataOffline`）
- 环形饼图（内径 0.5，半径 0.8），显示品类名称 + 格式化后的数值标签
- 卡片标题上方显示「销售额」文字

### 2.5 门店转化率监控（OfflineData）

全宽卡片，包含：

- **自定义 Tab 标签**：横向 Tab 切换门店，每个 Tab 标签为两列布局：
  - 左列：门店名称 + 「转化率」副标题 + 转化率百分比（如 `10%`）
  - 右列：Tiny.Ring 环形进度图（高度 60px，颜色 `#E8EEF4` / `#5FABF4`）
  - 当前激活 Tab 的样式为主题色
- **图表区域**：Line 折线图（高度 400px），x 轴时间（HH:mm 格式），y 轴数值，颜色按 `type` 分组（「客流量」「支付笔数」两条线），带下方滑块（`slider: { x: true }`），图例居中
- 默认激活第一个门店 Tab

---

## 3. UX 设计说明

### 3.1 整体布局

```
┌──────────────────────────────────────────────────────┐
│  GridContent                                          │
│  ┌──────────────────────────────────────────────────┐ │
│  │  IntroduceRow (4 cols)                            │ │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐            │ │
│  │  │ 总销售│ │ 访问量│ │支付笔数│ │ 运营  │            │ │
│  │  └──────┘ └──────┘ └──────┘ └──────┘            │ │
│  └──────────────────────────────────────────────────┘ │
│                                                       │
│  ┌──────────────────────────────────────────────────┐ │
│  │  SalesCard (Tabs: 销售额 | 访问量)                 │ │
│  │  [今日][本周][本月][本年]  [DateRangePicker]       │ │
│  │  ┌──────────────────────┬──────────────┐         │ │
│  │  │  Chart (Column)      │  排名列表    │         │ │
│  │  └──────────────────────┴──────────────┘         │ │
│  └──────────────────────────────────────────────────┘ │
│                                                       │
│  ┌───────────────────┐ ┌───────────────────┐         │ │
│  │  TopSearch        │ │ ProportionSales   │         │ │
│  │  (线上热门搜索)    │ │ (销售额类别占比)   │         │ │
│  │  ┌─────────────┐  │ │ [全部][线上][门店] │         │ │
│  │  │ 指标+迷你图  │  │ │    ┌───────┐     │         │ │
│  │  │ 搜索表格     │  │ │    │  Pie   │     │         │ │
│  │  └─────────────┘  │ │    └───────┘     │         │ │
│  └───────────────────┘ └───────────────────┘         │ │
│                                                       │
│  ┌──────────────────────────────────────────────────┐ │
│  │  OfflineData (Tabs: 门店切换)                      │ │
│  │  [门店0] [门店1] ...[门店9]                        │ │
│  │  ┌──────────────────────────────────────────────┐ │ │
│  │  │  Line Chart (客流量 + 支付笔数)              │ │ │
│  │  └──────────────────────────────────────────────┘ │ │
│  └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

### 3.2 卡片风格

- 所有卡片采用 `variant="borderless"` 无边框风格
- 卡片之间纵向间距 24px（`marginTop: 24`），横向网格间距 24px（`gutter={24}`）
- 卡片标题左侧对齐，右上角操作区放置 Tooltip / Dropdown

### 3.3 趋势指示

- 上升 / 下降使用 `Trend` 组件展示，含 CaretUp / CaretDown 图标
- 上升默认绿色，下降默认红色
- 「周同比」「日同比」文字 + 百分比数值紧跟 Trend 组件

### 3.4 Loading 态

- 数据加载期间各卡片 `loading={true}`，antd Card 自动展示骨架屏
- 图表区域无骨架时使用 `<Spin size="large" />` 居中展示（PageLoading）

### 3.5 响应式

- IntroduceRow：`xs:24 → sm:12 → xl:6`（手机 1 列 → 平板 2 列 → 桌面 4 列）
- SalesCard 图表 + 排名：`xl: 16/8, lg: 12/12`（大屏左右分栏，中小屏上下堆叠）
- TopSearch / ProportionSales：`xl: 12/12, lg: 24/24`（均等宽，小屏纵向堆叠）
- SalesTab 右侧快捷按钮在小屏下隐藏（`screenSM` 断点）

---

## 4. 技术设计说明

### 4.1 技术栈

| 技术 | 用途 |
|------|------|
| React 18 + TypeScript | 页面框架 |
| `@ant-design/plots` | 图表组件（Area、Column、Pie、Line、Tiny.Ring） |
| `@ant-design/pro-components` `GridContent` | 页面栅格容器 |
| `antd` (Card, Tabs, Table, Row, Col, Segmented, Dropdown, DatePicker, Tooltip, Progress, Button) | UI 基础组件 |
| `@ant-design/icons` | 图标（InfoCircleOutlined, EllipsisOutlined, CaretUpOutlined, CaretDownOutlined） |
| `@tanstack/react-query` `useQuery` | 数据请求与缓存管理 |
| `dayjs` | 日期处理 |
| `antd-style` `createStyles` | 组件样式 |
| `clsx` | 条件类名拼接 |

### 4.2 目录结构

```
src/pages/dashboard/analysis/
├── index.tsx                  # 页面入口，数据获取与组件编排
├── data.d.ts                  # 类型定义（DataItem, VisitDataType, SearchDataType, OfflineDataType, OfflineChartData, RadarData, AnalysisData）
├── service.ts                 # API 请求函数
├── _mock.ts                   # Mock 数据与接口
├── style.style.ts             # 页面级样式
├── utils/
│   ├── utils.ts               # fixedZero, getTimeDistance
│   └── Yuan.tsx               # 货币格式化组件
└── components/
    ├── IntroduceRow.tsx       # 指标概览行
    ├── SalesCard.tsx          # 销售额趋势与排名卡片
    ├── TopSearch.tsx          # 热门搜索卡片
    ├── ProportionSales.tsx   # 品类占比卡片
    ├── OfflineData.tsx        # 门店转化率卡片
    ├── PageLoading/index.tsx  # 加载态组件
    ├── Trend/
    │   ├── index.tsx          # 趋势指示组件
    │   └── index.style.ts     # Trend 样式
    ├── NumberInfo/
    │   ├── index.tsx          # 数值指标展示组件
    │   └── index.style.ts     # NumberInfo 样式
    └── Charts/
        ├── index.tsx          # Charts 工具模块（yuan 导出、ChartCard、Field）
        ├── index.style.ts     # Charts 样式
        ├── ChartCard/
        │   ├── index.tsx      # 图表卡片容器组件
        │   └── index.style.ts # ChartCard 样式
        └── Field/
            ├── index.tsx      # 字段标签-值对组件
            └── index.style.ts # Field 样式
```

### 4.3 数据结构

```typescript
export interface DataItem {
  [field: string]: string | number | number[] | null | undefined;
}

export interface VisitDataType {
  x: string;
  y: number;
}

export type SearchDataType = {
  index: number;
  keyword: string;
  count: number;
  range: number;
  status: number;
};

export type OfflineDataType = {
  name: string;
  cvr: number;
};

export interface OfflineChartData {
  date: number;
  type: number;
  value: number;
}

export type RadarData = {
  name: string;
  label: string;
  value: number;
};

export interface AnalysisData {
  visitData: DataItem[];
  visitData2: DataItem[];
  salesData: DataItem[];
  searchData: DataItem[];
  offlineData: OfflineDataType[];
  offlineChartData: DataItem[];
  salesTypeData: DataItem[];
  salesTypeDataOnline: DataItem[];
  salesTypeDataOffline: DataItem[];
  radarData: RadarData[];
}
```

### 4.4 数据请求

```
页面入口组件挂载
  └─→ useQuery({ queryKey: ['dashboard-analysis'], queryFn: fakeChartData })
        └─→ GET /api/fake_analysis_chart_data
              └─→ 返回 { data: AnalysisData }
```

- 使用 `@tanstack/react-query` 的 `useQuery`，`queryKey` 为 `['dashboard-analysis']`
- `service.ts` 导出 `fakeChartData()` 函数，调用 `request('/api/fake_analysis_chart_data')`
- 返回的 `AnalysisData` 作为 `data` 通过 Suspense 边界分发到各子组件

### 4.5 关键工具函数

**`getTimeDistance(type: 'today' | 'week' | 'month' | 'year')`**
- 返回 `[dayjs, dayjs]` 元组作为 RangePicker 的值
- `today`：当日 00:00:00 → 23:59:59
- `week`：本周一 00:00:00 → 周日 23:59:59
- `month`：本月首日 00:00:00 → 次月首日减 1 秒
- `year`：本年 1 月 1 日 00:00:00 → 12 月 31 日 23:59:59

**`fixedZero(val: number)`**
- 个位数前补零，返回字符串。如 `fixedZero(3) → '03'`

**`Yuan` 组件**
- 接收 `children`（字符串或数字），渲染为 `¥ 1,234` 格式
- 使用 `yuan()` 函数格式化（该函数从 Charts 模块导出，实际引用 `@/utils/format` 的 `formatYuan`）

### 4.6 状态管理

| 状态 | 类型 | 说明 |
|------|------|------|
| `loading` / `data` | `useQuery` 返回值 | 全局图表数据加载状态与结果 |
| `salesType` | `'all' \| 'online' \| 'stores'` | 品类占比 Segmented 选中值 |
| `currentTabKey` | `string` | 门店转化率 Tab 激活 key |
| `rangePickerValue` | `RangePickerProps['value']` | 日期区间选择器受控值，默认「本年」 |

### 4.7 Mock 数据规范

Mock 文件 `_mock.ts` 需要 mock `GET /api/fake_analysis_chart_data` 接口并提供完整的 `AnalysisData` 结构数据：

- `visitData`：17 条日级别数据（x: YYYY-MM-DD, y: 随机数值）
- `visitData2`：7 条日级别数据
- `salesData`：12 条月级别数据（x: "1月"~"12月", y: 200~1200 随机值）
- `searchData`：50 条搜索关键词数据（含 index, keyword, count, range, status）
- `salesTypeData`：6 个品类占比数据（家用电器 4544, 食用酒水 3321, ...）
- `salesTypeDataOnline`：6 个品类线上数据
- `salesTypeDataOffline`：5 个品类门店数据
- `offlineData`：10 个门店转化率数据（name: "Stores 0"~"Stores 9", cvr: 0~0.9）
- `offlineChartData`：40 条时间序列数据（20 个时间点 × 2 种 type，HH:mm 格式，value: 10~110 随机值）
- `radarData`：3 个维度（个人/团队/部门）× 5 个指标（引用/口碑/产量/贡献/热度）

需导入 `dayjs` 和 `express` 的 `Request/Response` 类型。

---

## 5. 交付标准

- [ ] `/dashboard/analysis` 路由可访问，左侧 Dashboard 菜单下出现「分析页」入口（含 barChart 图标）
- [ ] `/` 根路径和 `/dashboard` 均重定向到 `/dashboard/analysis`
- [ ] 中英文等 8 种语言的菜单翻译正确（`menu.dashboard.analysis`）
- [ ] 5 大功能区域完整渲染：IntroduceRow、SalesCard、TopSearch、ProportionSales、OfflineData
- [ ] 所有图表（Area、Column、Pie、Line、Tiny.Ring）加载并正确渲染数据
- [ ] 日期筛选（今日/本周/本月/本年 + RangePicker）功能正常，图表联动
- [ ] Segmented 切换（全部/线上/门店）饼图数据正确切换
- [ ] 门店 Tab 切换折线图数据正确切换
- [ ] 搜索关键词表格分页、排序功能正常
- [ ] Loading 状态正常（各 Card 的 loading 属性和 PageLoading 组件）
- [ ] 响应式布局适配（桌面/平板/手机）
- [ ] `npm run lint` + `npm run tsc` 无新增错误
- [ ] 提交历史清晰，commit message 符合 Conventional Commits 规范
