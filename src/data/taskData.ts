import type { TaskCard, CategoryMeta, ScopeChoice } from "./types";
import { Sparkles, TriangleAlert, ShieldCheck } from "lucide-react";

// ── 任务卡片数据 ────────────────────────────
export const taskCards: TaskCard[] = [
  {
    id: "story-1",
    category: "story",
    title: "【前端】用户风险测评与产品匹配",
    summary: "实现KYC问卷→风险等级→推荐产品池的完整匹配链路",
    priority: "high",
    source: "财富管理平台 v3.2",
  },
  {
    id: "story-2",
    category: "story",
    title: "【前端】理财产品详情页重构",
    summary: "收益率多维展示、历史净值曲线、申购赎回时间轴",
    priority: "high",
    source: "财富管理平台 v3.2",
  },
  {
    id: "story-3",
    category: "story",
    title: "【后端】个性化推荐策略引擎对接",
    summary: "用户行为埋点→标签沉淀→推荐算法输出→前端展示",
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

// ── 交付模式 ─────────────────────────────────
export function scopeLabel(scope: ScopeChoice) {
  return {
    mvp: "MVP 快速交付",
    governed: "企业受控交付",
    full: "完整产品化交付",
  }[scope];
}

// ── 模块选项 ────────────────────────────────
export const moduleOptions = [
  "线索池",
  "客户详情",
  "跟进提醒",
  "沟通记录",
  "团队周报",
  "主管看板",
];

// ── Spec 资产数据 ───────────────────────────
import type { SpecItem } from "./types";
import { Boxes, Layers3, FileCode2, LockKeyhole } from "lucide-react";

export const specs: SpecItem[] = [
  {
    title: "业务对象",
    detail: "客户、销售、跟进记录、提醒、周报",
    icon: Boxes,
    accent: "cyan",
  },
  {
    title: "页面地图",
    detail: "线索列表、客户详情、提醒中心、周报仪表盘",
    icon: Layers3,
    accent: "green",
  },
  {
    title: "API 契约",
    detail: "12 个端点,覆盖 CRUD、提醒调度与报表聚合",
    icon: FileCode2,
    accent: "amber",
  },
  {
    title: "权限模型",
    detail: "销售仅看本人客户,主管可查看团队汇总",
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
    // 范围锁定
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
    // Spec 基线
    const src = base[2] as { name: string; type: "folder"; children: FileNode[] };
    src.children.push(
      { name: "domain", type: "folder", children: [
        { name: "customer.ts", type: "file", highlight: true },
        { name: "follow-up.ts", type: "file" },
        { name: "reminder.ts", type: "file" },
      ]},
      { name: "specs", type: "folder", children: [
        { name: "acceptance.md", type: "file", highlight: true },
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
