# PRD - 数据分析页面（/dashboard/analysis）

## 1. 总结概要

数据分析页面是面向运营和管理层的核心数据看板，集中展示销售额、访问量、支付笔数、运营活动效果等关键业务指标。页面通过多维图表（柱状图、折线图、饼图）对销售趋势、搜索热词、门店转化率进行可视化呈现，支持按今日/本周/本月/本年及自定义日期范围筛选数据。整合线上与线下数据通道，为业务决策提供多渠道数据依据。页面采用响应式布局，适配宽屏及移动端场景。

---

## 2. 业务功能说明

### 2.1 核心指标概览（IntroduceRow）

展示 4 张关键指标卡片，每张卡片均包含主指标值、日指标值及同比趋势箭头：

| 指标名称 | 说明 |
|----------|------|
| 总销售额 | 展示累计销售金额（人民币），含日销售额、周同比、日同比 |
| 访问量 | 展示总访问人次及日访问量，含访问量趋势面积图 |
| 支付笔数 | 展示总支付笔数及支付转化率，含支付频次柱状图 |
| 运营活动效果 | 展示运营效果综合评分（百分比），含进度条及同比趋势 |

### 2.2 销售趋势卡片（SalesCard）

- **销售额 Tab**：柱状图展示选定时间范围内的每日/每周销售额趋势，右侧展示门店销售额排名（Top 7）
- **访问量 Tab**：柱状图展示对应时间范围内的访问量趋势，右侧展示门店访问量排名（Top 7）
- **时间筛选**：支持今日、本周、本月、本年快捷选项，以及自定义日期区间（RangePicker）

### 2.3 线上热门搜索（TopSearch）

- 展示搜索用户数和人均搜索次数两项指标，各附趋势折线图
- 关键词排名表格：展示排名、关键词、用户数、周涨幅，支持按用户数/周涨幅排序
- 涨幅以红绿箭头趋势图标直观标注

### 2.4 销售类别占比（ProportionSales）

- 环形饼图展示各销售类别占比
- 支持切换「全部渠道 / 线上 / 线下门店」三种视角

### 2.5 线下门店数据（OfflineData）

- 多门店 Tab 切换，每个 Tab 标签显示门店名称、转化率及微型环形图
- 选中门店展示过去一段时间的流量与支付数量双折线趋势图，支持 X 轴滑动条缩放

---

## 3. UX 设计说明

### 3.1 布局结构

- 全页采用 `GridContent` 容器，提供统一的内容宽度约束与居中对齐
- 顶部 4 栏等宽指标卡片区（xl:6 / lg:12 / xs:24 响应式分列），卡片底部附迷你图表
- 销售趋势卡片全宽展示，Tab 与时间筛选控件置于右上角
- 热门搜索与销售占比各占 1/2 宽度，水平并排（大屏）/ 垂直堆叠（小屏）
- 线下门店数据独占一行，底部通栏展示

### 3.2 数据状态

- 所有卡片在数据加载中时显示骨架屏（Card loading 态），避免布局跳动
- 指标卡片右上角统一放置 `InfoCircleOutlined` 图标，鼠标悬浮显示指标说明 Tooltip
- 销售额使用人民币符号格式化显示（Yuan 工具组件）

### 3.3 交互细节

- 时间快捷选项选中时高亮（`currentDate` 样式类），与 RangePicker 双向联动
- 门店排名 Top 3 序号以高亮颜色区分（`rankingItemNumberActive`）
- 趋势值通过 `Trend` 组件（up/down 箭头+颜色）直观传达涨跌方向
- 操作更多下拉菜单（`EllipsisOutlined` + Dropdown）置于各卡片右上角，可扩展自定义操作

### 3.4 响应式

- 4 栏指标卡：xl(4列) → lg(2列) → xs(1列)
- 搜索/占比模块：xl(各半宽) → xs(全宽堆叠)
- 销售图与排名列表：xl(8:4) → sm(各半) → xs(全宽堆叠)

---

## 4. 技术设计说明

### 4.1 技术栈

| 技术 | 用途 |
|------|------|
| React 18 + TypeScript | 页面主体框架 |
| `@tanstack/react-query` | 数据异步请求与缓存（queryKey: `dashboard-analysis`） |
| `@ant-design/plots` | 图表渲染（Area / Column / Line / Tiny.Ring） |
| `@ant-design/pro-components` `GridContent` | 内容布局容器 |
| `antd` Row/Col/Card/Tabs/DatePicker | UI 基础组件 |
| `antd-style` `createStyles` | 主题 token 驱动的样式方案 |

### 4.2 数据结构

```typescript
interface AnalysisData {
  visitData: DataItem[];        // 访问量时序数据
  visitData2: DataItem[];       // 搜索用户数时序数据
  salesData: DataItem[];        // 销售额时序数据
  searchData: DataItem[];       // 搜索关键词排名数据
  offlineData: OfflineDataType[]; // 门店列表（含转化率）
  offlineChartData: DataItem[]; // 门店折线图数据
  salesTypeData: DataItem[];    // 全渠道销售占比
  salesTypeDataOnline: DataItem[];  // 线上销售占比
  salesTypeDataOffline: DataItem[]; // 线下销售占比
}
```

### 4.3 状态管理

- `salesType`（`'all' | 'online' | 'stores'`）：控制销售占比饼图数据源切换
- `currentTabKey`：控制线下门店 Tab 选中项，默认取第一个门店名称
- `rangePickerValue`：日期范围状态，初始化为当年全年区间（`getTimeDistance('year')`）

### 4.4 数据请求

- 通过 `fakeChartData()` Service 方法向 `/api/fake_chart_data` 发起 GET 请求
- 使用 React Query 缓存结果，避免重复请求
- 组件使用 `React.Suspense` 进行懒加载分块，提升首屏性能

### 4.5 组件拆分

```
Analysis (index.tsx)
├── IntroduceRow       — 4个核心指标卡片
├── SalesCard          — 销售/访问量趋势+排名
├── TopSearch          — 热门搜索关键词
├── ProportionSales    — 销售类别占比饼图
├── OfflineData        — 线下门店趋势数据
└── Charts/
    ├── ChartCard      — 指标卡片容器
    ├── Field          — 底部标注字段
    └── Trend          — 涨跌趋势指示器
```

### 4.6 Mock 数据

Mock 文件：`src/pages/dashboard/analysis/_mock.ts`，接口路径 `/api/fake_chart_data`，返回完整 `AnalysisData` 对象，支持本地开发联调。
