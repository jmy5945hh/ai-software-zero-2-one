import type { TaskCard, CategoryMeta } from "./types";
import { Sparkles, TriangleAlert, ShieldCheck } from "lucide-react";

// ── 任务卡片数据 ────────────────────────────
// 使用 let 以便运行时新增卡片
export let taskCards: TaskCard[] = [
  {
    id: "story-1",
    category: "story",
    title: "【前端】新增审批流综合页面",
    summary: `高级详情页面是面向企业审批/工单场景的综合信息展示页，以单据视角聚合了订单基本信息、审批流程进度、关联用户信息及操作历史记录。
    1. 页面以单号为标题
    2. 在页头区域直观呈现单据状态、金额及主要操作按钮
    3. 支持移动端与桌面端两种按钮布局
    4. 页面正文通过「详情」与「规则」Tab 切换
    5. 分设流程进度、用户信息、来电记录、操作日志四大功能区块，完整覆盖审批单据的全生命周期信息。
    接口信息
| 配置项 | 值 |
|--------|-----|
| 数据接口 | \`GET /api/profile/advanced\` |
| 返回格式 | \`{ data: { advancedOperation1, advancedOperation2, advancedOperation3 } }\` |
| 请求方式 | GET，返回 JSON |`,
    priority: "high",
    source: "财富管理平台 v3.2",
  },
  {
    id: "story-2",
    category: "story",
    title: "【前端】数据分析Web实现",
    summary: `新增 /dashboard/analysis 页面：提供数据分析仪表盘，展示销售额、访问量、热门搜索、品类占比、门店转化等核心电商运营指标。
1. 顶部 4 张指标概览卡片（总销售额、访问量、支付笔数、运营活动效果），每张卡片包含 KPI 数值、同比/环比趋势、迷你趋势图和指标说明
2. 销售额趋势卡片，支持 Tab 切换「销售额/访问量」，右上角快速时间筛选（今日/本周/本月/本年 + 自定义日期范围），附带门店排名列表
3. 线上热门搜索卡片，展示搜索指标 + 迷你面积图 + 搜索关键词表格（排名、关键词、用户数、周涨幅升降指示）
4. 销售额类别占比环形图，支持「全部渠道/线上/门店」切换
5. 门店转化率卡片，横向 Tab 切换门店，每个 Tab 显示转化率 + TinyRing，下方为客流量/支付笔数折线图

数据接口
| 配置项 | 值 |
|--------|-----|
| API 地址 | \`GET /api/fake_analysis_chart_data\` |
| 请求方式 | GET |
| 响应格式 | \`{ data: AnalysisData }\`，AnalysisData 结构需自行推断并定义 |
| Mock 数据 | 需自行编写 \`_mock.ts\` 提供接口 mock |`,
    priority: "high",
    source: "财富管理平台 v3.2",
  },
  {
    id: "story-3",
    category: "story",
    title: "【前端】AI Chat 支持大模型对话",
    summary: `新增 /chatbot 页面：提供基于大模型的内嵌智能对话助手能力，整体交互体验对标主流 AI Chat 产品。
1. 左侧会话列表 + 右侧对话区的经典 Chat 产品布局
2. AI 回复内容以 Markdown 格式渲染，sse流式打字机动效，支持深度思考内容（\`<think>\` 标签）的解析与折叠展示
3. 支持多轮会话（短期记忆携带历史对话内容）
4. 空状态下以打字机欢迎词引导用户输入

LLM 接入信息
| 配置项 | 值 |
|--------|-----|
| API 地址 | \`https://api.x.ant.design/api/big_model_glm-4.5-flash\` |
| 模型 | \`glm-4.5-flash\` |
| 请求方式 | POST，SSE 流式响应（\`stream: true\`） |
| 请求格式 | OpenAI Chat Completions 兼容格式 |`,
    docs: "~/code/ant-design-pro/docs/prd-chatbot.md",
    priority: "high",
    source: "财富管理平台 v3.2",
  },
  
  {
    id: "story-5",
    category: "story",
    title: "【后端】DevAgent 技能市场",
    summary: `版本：V1.0

范围：第一期 MVP

核心能力：Skill 基础管理能力及下载

管理员能力：创建、编辑、删除、检索 Skill

普通用户能力：浏览、检索、下载 Skill

暂不支持：Agents、Commands、Hooks 等能力，仅保留入口并展示"敬请期待"

---

## 1. 项目背景

DevAgent CLI 需要在建设一个轻量级插件市场，用于集中管理和分发可复用的 Skills。

第一期 MVP 不提供完整插件生态能力，只聚焦 Skills 的最小闭环：

1. 管理员在后台创建 Skill。
2. 管理员维护 Skill 信息与下载文件。
3. 用户在前台浏览 Skill。
4. 用户通过 Skill 名称模糊搜索方式查找 Skill。
5. 用户进入详情页查看说明。
6. 用户下载 Skill 文件或复制安装/使用说明。

Agents、Commands、Hooks 等能力暂不开放，仅在页面中保留入口，点击后提示"敬请期待"。

---

## 2. MVP 建设目标

### 2.1 业务目标

1. 建立企业内网 Skills 统一展示与分发入口。
2. 让管理员能够手工维护 Skill 内容和下载文件。
3. 让用户能够快速浏览、检索和下载所需 Skill。
4. 为后续扩展 Skill 分类、标签、Agents、Commands、Hooks 等能力预留信息架构。
5. 避免第一期引入复杂的用户投稿、审核流、版本治理、自动采集、分类管理和标签管理能力。

### 2.2 产品目标

第一期只实现以下能力：

1. 首页入口。
2. Skills 列表页。
3. 按 Skill 名称模糊搜索。
4. Skill 详情页。
5. Skill 下载。
6. 管理员后台创建、编辑、删除、检索 Skill。
7. Agents / Commands / Hooks 页面入口占位。

---

## 3. 用户角色

### 3.1 普通用户

普通用户可使用前台能力：

1. 浏览 Skills 列表。
2. 按 Skill 名称检索 Skills。
3. 查看 Skill 详情。
4. 下载 Skill 文件。
5. 复制安装命令或使用说明。
6. 访问 Agents / Commands / Hooks 入口，但点击后仅展示"敬请期待"。

普通用户不可：

1. 创建 Skill。
2. 编辑 Skill。
3. 删除 Skill。
4. 访问管理后台。

### 3.2 管理员

管理员可使用后台能力：

1. 创建 Skill。
2. 编辑 Skill。
3. 删除 Skill。
4. 检索 Skill。
5. 上传或替换 Skill 文件。
6. 查看 Skill 下载次数。
7. 查看基础操作日志。

第一期不提供复杂审核流、分类管理、标签管理、Agents 管理、Commands 管理和 Hooks 管理。

---

## 4. 第一阶段功能范围

### 4.1 本期支持
| 模块 | 是否支持 | 说明 |
|-------|-----:|-----------|
| Skills 目录 | 支持 | 第一阶段核心功能 |
| Skill 名称搜索 | 支持 | 支持按 Skill 名称模糊搜索 |
| Skill 详情页 | 支持 | 展示说明、文件、下载入口 |
| Skill 下载 | 支持 | 用户可下载 Skill 文件 |
| 管理员创建 Skill | 支持 | 后台手工录入 |
| 管理员编辑 Skill | 支持 | 可维护已创建 Skill |
| 管理员删除 Skill | 支持 | 可删除 Skill |
| 管理员检索 Skill | 支持 | 支持后台按名称检索 |
| Agents | 占位 | 点击提示"敬请期待" |
| Commands | 占位 | 点击提示"敬请期待" |
| Hooks | 占位 | 点击提示"敬请期待" |

### 4.2 本期不支持

1. Skill 分类管理。
2. Skill 标签管理。
3. 按分类检索 Skill。
4. 按标签检索 Skill。
5. 用户投稿和审核流程。
6. Agents / Commands / Hooks 的真实列表、详情、创建和下载能力。

---

## 5. 信息架构

### 5.1 前台导航

前台导航包含：

1. 首页
2. Skills
3. Agents
4. Commands
5. Hooks

其中：

1. Skills 页面正常可用。
2. Agents 页面点击后展示占位页。
3. Commands 页面点击后展示占位页。
4. Hooks 页面点击后展示占位页。

占位页文案：

该能力正在建设中，敬请期待。

可补充说明：

当前版本仅支持 Skills 浏览、检索与下载。Agents、Commands、Hooks 将在后续版本开放。

### 5.2 首页

首页展示内容：

1. 顶部搜索框。
2. Skills 入口卡片。
3. Agents 入口卡片，占位。
4. Commands 入口卡片，占位。
5. Hooks 入口卡片，占位。
6. 最新发布的 Skills。
7. 热门下载 Skills。

首页交互：

1. 用户点击 Skills 进入 Skills 列表。
2. 用户点击具体 Skill 进入详情页。
3. 用户点击 Agents / Commands / Hooks，进入占位页或弹窗提示"敬请期待"。
4. 用户在首页搜索框输入 Skill 名称关键词后，跳转到 Skills 搜索结果页。

---

## 6. Skills 前台功能需求

### 6.1 Skills 列表页

#### 6.1.1 页面目标

用于展示所有可用 Skills，用户可以通过 Skill 名称快速查找目标 Skill。

#### 6.1.2 列表展示字段

每个 Skill 卡片展示：

1. Skill 名称。
2. Skill 简短描述。
3. 当前版本。
4. 更新时间。
5. 下载次数。
6. 文件大小。
7. 查看详情按钮。
8. 下载按钮。

#### 6.1.3 搜索功能

支持关键词搜索，搜索范围包括：

1. Skill 名称。

搜索结果要求：

1. 支持 Skill 名称模糊搜索。
2. 无结果时展示空状态。
3. 搜索条件可清空。
4. 搜索结果默认按相关性排序。
5. 可按更新时间、下载次数排序。

#### 6.1.4 空状态

当没有任何 Skill 时展示：暂无可用 Skills。

当搜索无结果时展示：未找到匹配的 Skill，请尝试更换关键词。

### 6.2 Skill 详情页

#### 6.2.1 页面目标

向用户展示 Skill 的完整说明、使用方式和下载入口。

#### 6.2.2 页面字段

详情页展示：

1. Skill 名称。
2. Skill 简短描述。
3. Skill 详细描述。
4. 当前版本。
5. 更新时间。
6. 文件大小。
7. 下载次数。
8. 适用场景。
9. 使用说明。
10. 安装说明。
11. 文件列表。
12. 下载按钮。
13. 复制安装命令按钮，可选。

#### 6.2.3 下载能力

用户点击下载后：

1. 下载 Skill 文件包。
2. 系统记录下载次数。
3. 下载失败时提示错误。
4. 未登录用户不可下载，若系统要求登录。

下载文件格式建议：.zip、.tar.gz 或平台约定的 Skill 包格式。

#### 6.2.4 复制安装命令

建议前端不自行拼接安装命令，由后端返回 install_command 字段。

---

## 7. 管理后台功能需求

### 7.1 管理后台入口

仅管理员可访问管理后台。

后台菜单包括：

1. Skill 管理
2. 下载统计
3. 操作日志

### 7.2 Skill 管理列表

#### 7.2.1 列表字段

后台 Skill 列表展示：

1. Skill 名称。
2. Slug。
3. 当前版本。
4. 下载次数。
5. 创建时间。
6. 更新时间。
7. 操作按钮。

#### 7.2.2 检索能力

管理员可通过 Skill 名称进行模糊搜索。

#### 7.2.3 支持操作

管理员可执行：新建、编辑、删除、查看详情、下载文件、查看下载统计。

### 7.3 新建 / 编辑 Skill

#### 7.3.1 基础字段

1. Skill 名称，必填。
2. Slug，必填且唯一。
3. 简短描述，必填。
4. 详细描述，必填。
5. 当前版本，必填。
6. 适用 DevAgent CLI 版本，可选。
7. 适用场景，可选。
8. 使用说明，必填。
9. 安装说明，可选。
10. 排序权重，可选。
11. 是否推荐，可选。

#### 7.3.2 文件字段

管理员需要上传：Skill 文件包（必填）、封面图或图标（可选）、README 文件（可选）。

#### 7.3.3 校验规则

1. 名称不能为空。
2. Slug 不能为空且全局唯一。
3. 简短描述不能为空。
4. 详细描述不能为空。
5. 版本号不能为空。
6. Skill 必须上传文件包。
7. Skill 必须有使用说明。
8. 上传文件大小不得超过限制。
9. 文件类型必须符合白名单。

#### 7.3.4 Slug 规则

仅支持小写字母、数字和中划线，不允许空格、中文，不允许以下划线开头或结尾。

### 7.4 删除 Skill

管理员删除 Skill 时：系统需二次确认，删除后不再出现在前台，删除操作需记录操作日志，可采用软删除。

### 7.5 下载统计

第一期统计维度：Skill 总下载次数、下载时间、下载来源（列表页/详情页/后台）。

---

## 8. Agents / Commands / Hooks 占位需求

### 8.1 占位入口

前台保留 Agents、Commands、Hooks 入口，可在导航栏、首页卡片中展示。

### 8.2 点击行为

用户点击后展示占位页面，内容统一为"该能力正在建设中，敬请期待。"，补充说明"当前 MVP 版本仅开放 Skills 能力。Agents、Commands、Hooks 将在后续版本中逐步开放。"

### 8.3 占位页面要求

不展示假数据、搜索框、创建按钮、下载按钮。可提供返回首页按钮和跳转 Skills 页面按钮。

---

## 9. 页面清单

### 9.1 前台页面
| 页面 | 路径 | MVP 状态 |
|--------|------|-----|
| 首页 | / | 支持 |
| Skills 列表页 | /skills | 支持 |
| Skill 详情页 | /skills/:slug | 支持 |
| Agents 占位页 | /agents | 占位 |
| Commands 占位页 | /commands | 占位 |
| Hooks 占位页 | /hooks | 占位 |

### 9.2 管理后台页面
| 页面 | 路径 | MVP 状态 |
|-------|----------|-----|
| 管理后台首页 | /admin | 支持 |
| Skill 管理列表 | /admin/skills | 支持 |
| 新建 Skill | /admin/skills/new | 支持 |
| 编辑 Skill | /admin/skills/:id/edit | 支持 |
| 下载统计 | /admin/stats/downloads | 简化支持 |
| 操作日志 | /admin/audit-logs | 简化支持 |`,
    priority: "high",
    source: "DevAgent 技能市场项目",
  },
  {
    id: "story-4",
    category: "story",
    title: "【后端】退货原因字典管理",
    summary: `背景：用户在商城下单购买商品后，因商品质量问题、错发漏发、七天无理由等原因需要退货时，需在售后流程中选择一个退货原因。退货原因由运营人员在后台统一维护，前端用户在退货时从下拉列表中选择。

功能概述：支持后台运营人员在后台管理"退货原因"字典数据，支持新增、修改、删除、查询、批量设置显示状态。`,
    priority: "high",
    source: "商城项目",
  },
  {
    id: "story-3",
    category: "story",
    title: "【后端】todo",
    summary: "todo",
    priority: "medium",
    source: "财富管理平台 v3.2",
  },
  {
    id: "defect-1",
    category: "defect",
    title: "【性能问题】净值曲线加载超时",
    summary: "单产品3年以上净值数据接口响应>3s,影响用户浏览体验",
    priority: "critical",
    source: "行情数据服务",
  },
  {
    id: "defect-2",
    category: "defect",
    title: "【ST Bug】推荐结果重复展示",
    summary: "同一用户多次刷新出现重复产品,去重逻辑缺失",
    priority: "high",
    source: "推荐引擎",
  },
  {
    id: "defect-3",
    category: "defect",
    title: "【检视问题】申购金额校验精度丢失",
    summary: "大额申购时前端浮点数计算偏差导致校验不一致",
    priority: "medium",
    source: "交易模块",
  },
  {
    id: "gov-1",
    category: "governance",
    title: "资管新规合规校验",
    summary: "确保产品展示页满足投资者适当性管理披露要求",
    priority: "high",
    source: "合规审查",
  },
  {
    id: "gov-2",
    category: "governance",
    title: "用户数据脱敏审计",
    summary: "埋点数据中的手机号未脱敏,需全链路排查修复",
    priority: "critical",
    source: "安全审计",
  },
  {
    id: "gov-3",
    category: "governance",
    title: "推荐策略可解释性报告",
    summary: "面向监管生成推荐逻辑的白盒说明文档",
    priority: "medium",
    source: "监管报送",
  },
];

// ── 分类元数据 ──────────────────────────────
export const categoryMeta: Record<string, CategoryMeta> = {
  story: { label: "故事卡", icon: Sparkles, accent: "sage" },
  defect: { label: "问题 / 缺陷", icon: TriangleAlert, accent: "terracotta" },
  governance: { label: "治理任务", icon: ShieldCheck, accent: "amber" },
};

// ── 优先级标签 ──────────────────────────────
export function priorityLabel(priority: TaskCard["priority"]) {
  return (
    {
      critical: "紧急",
      high: "高",
      medium: "中",
      low: "低",
    }[priority]
  );
}

// ── 代码资产数据 ───────────────────────────
import type { CodeItem } from "./types";
import { Boxes, Layers3, FileCode2, LockKeyhole } from "lucide-react";

export const codeModules: CodeItem[] = [
  {
    title: "类型定义",
    detail: "Customer、FollowUp、Reminder、Report 实体 + API 类型",
    icon: Boxes,
    accent: "cyan",
  },
  {
    title: "API 服务层",
    detail: "12 个接口函数，覆盖 CRUD、提醒调度与报表聚合",
    icon: Layers3,
    accent: "green",
  },
  {
    title: "页面组件",
    detail: "客户列表、客户详情、提醒中心、周报仪表盘",
    icon: FileCode2,
    accent: "amber",
  },
  {
    title: "路由配置",
    detail: "4 条路由映射，集成权限守卫与导航布局",
    icon: LockKeyhole,
    accent: "rose",
  },
];

// ── 测试数据 ────────────────────────────────
import type { TestRow } from "./types";

export const testRows: TestRow[] = [
  ["线索创建", "销售录入客户信息后进入待跟进池", "API + UI", "Ready"],
  ["自动提醒", "超过 3 天未跟进时生成提醒", "Unit + E2E", "Ready"],
  ["沟通记录", "记录电话、微信、邮件与下一步动作", "UI", "Ready"],
  ["周报生成", "每周一按团队生成销售进展摘要", "API", "Review"],
];

// ── 工作空间文件树（各阶段模拟） ────────────
import type { FileNode } from "./types";

export function getFileTreeForStage(stepIndex: number): FileNode[] {
  const base: FileNode[] = [
    { name: "README.md", type: "file" },
    { name: "package.json", type: "file" },
    { name: "src", type: "folder", children: [
      { name: "index.ts", type: "file" },
      { name: "app.tsx", type: "file" },
    ]},
  ];

  if (stepIndex >= 1) {
    // 技术方案设计
    const src = base[2] as { name: string; type: "folder"; children: FileNode[] };
    src.children.push(
      { name: "pages", type: "folder", children: [
        { name: "lead-list.tsx", type: "file" },
        { name: "customer-detail.tsx", type: "file" },
      ]},
      { name: "api", type: "folder", children: [
        { name: "openapi.yaml", type: "file", highlight: true },
      ]},
    );
  }

  if (stepIndex >= 2) {
    // 代码编写 — 代码生成
    const src = base[2] as { name: string; type: "folder"; children: FileNode[] };
    src.children.push(
      { name: "types", type: "folder", children: [
        { name: "customer.ts", type: "file", highlight: true },
        { name: "follow-up.ts", type: "file" },
        { name: "reminder.ts", type: "file" },
        { name: "report.ts", type: "file" },
      ]},
      { name: "api", type: "folder", children: [
        { name: "customer.ts", type: "file", highlight: true },
        { name: "reminder.ts", type: "file" },
        { name: "report.ts", type: "file" },
      ]},
      { name: "pages", type: "folder", children: [
        { name: "CustomerList.tsx", type: "file", highlight: true },
        { name: "CustomerDetail.tsx", type: "file" },
        { name: "ReminderCenter.tsx", type: "file" },
        { name: "WeeklyDashboard.tsx", type: "file" },
      ]},
    );
  }

  if (stepIndex >= 3) {
    // Agent 开发
    const src = base[2] as { name: string; type: "folder"; children: FileNode[] };
    src.children.push(
      { name: "components", type: "folder", children: [
        { name: "reminder-center.tsx", type: "file", highlight: true },
        { name: "weekly-report.tsx", type: "file" },
      ]},
      { name: "hooks", type: "folder", children: [
        { name: "use-follow-up.ts", type: "file", highlight: true },
      ]},
      { name: "mocks", type: "folder", children: [
        { name: "leads.json", type: "file", highlight: true },
        { name: "customers.json", type: "file", highlight: true },
      ]},
    );
  }

  if (stepIndex >= 4) {
    // 质量门禁
    base.push(
      { name: "tests", type: "folder", children: [
        { name: "unit", type: "folder", children: [
          { name: "reminder.test.ts", type: "file" },
          { name: "weekly-report.test.ts", type: "file" },
        ]},
        { name: "e2e", type: "folder", children: [
          { name: "lead-flow.spec.ts", type: "file" },
        ]},
      ]},
      { name: "coverage", type: "folder", children: [
        { name: "lcov-report", type: "folder", children: [] },
      ]},
    );
  }

  if (stepIndex >= 5) {
    // 验证修复
    const tests = base[3] as { name: string; type: "folder"; children: FileNode[] };
    tests.children.push(
      { name: "reports", type: "folder", children: [
        { name: "test-report.html", type: "file", highlight: true },
        { name: "fix-log.md", type: "file", highlight: true },
      ]},
    );
  }

  if (stepIndex >= 6) {
    // 发布
    base.push(
      { name: ".github", type: "folder", children: [
        { name: "workflows", type: "folder", children: [
          { name: "deploy.yml", type: "file", highlight: true },
        ]},
      ]},
      { name: "CHANGELOG.md", type: "file", highlight: true },
      { name: "DELIVERY.md", type: "file", highlight: true },
    );
  }

  return base;
}

// ── 运行时新增卡片 ──────────────────────────
let nextId = 100;
export function addTaskCard(card: Omit<TaskCard, "id">): TaskCard {
  const newCard: TaskCard = { ...card, id: `story-${nextId++}` };
  taskCards = [newCard, ...taskCards];
  return newCard;
}
