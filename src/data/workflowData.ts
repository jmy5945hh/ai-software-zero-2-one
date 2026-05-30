import type { WorkflowStep, AppState, Stage, Gate, Agent } from "./types";
import { scopeLabel } from "./taskData";
import {
  MessageSquareText,
  Network,
  PanelRight,
  TestTube2,
  Rocket,
} from "lucide-react";

// ── SOP 工作流定义（新增 quality 门禁步骤） ──
export const workflow: WorkflowStep[] = [
  {
    id: "intent",
    label: "需求分析",
    detail: "AI 提炼任务目标和边界",
    userRole: "和 DevAgent 一起脑暴，将模糊需求打磨地清晰、可实现",
  },
  {
    id: "plan",
    label: "技术设计",
    detail: "选择本轮交付模块和风险边界",
    userRole: "作为 Tech Leader，评审 DevAgent 的技术详设材料",
  },
  {
    id: "coding",
    label: "编码开发",
    detail: "生成可运行代码骨架",
    userRole: "没有什么特别要参与的，喝杯咖啡歇一歇吧 :)",
  },
  {
    id: "quality",
    label: "质量QA",
    detail: "代码检视、单测、API测试、E2E 集中审查",
    userRole: "走读软件质量报告，决定放行或修复",
  },
  {
    id: "verify",
    label: "验证修复",
    detail: "授权自动修复并复测",
    userRole: "授权修复和复测",
  },
  {
    id: "release",
    label: "发布交付",
    detail: "入库、构建、发布和交付包",
    userRole: "确认发布策略",
  },
];

// ── 阶段列表 ────────────────────────────────
export function getStages(stepIndex: number): Stage[] {
  return workflow.map((step, index) => ({
    label: step.label,
    detail: step.detail,
    status: (index < stepIndex
      ? "done"
      : index === stepIndex
        ? "active"
        : "queued") as Stage["status"],
    time: index < stepIndex ? "Done" : index === stepIndex ? "Now" : "Next",
  }));
}

// ── 质量门禁数据 ────────────────────────────
export function getGates(state: AppState): Gate[] {
  const { qualityPassed, fixApproved, releaseApproved, stepIndex } = state;
  const isQuality = stepIndex >= 4;
  return [
    {
      name: "代码检视",
      value: isQuality ? 100 : stepIndex >= 4 ? 100 : 0,
      status: isQuality ? "passed" : stepIndex >= 4 ? "passed" : "queued",
    },
    {
      name: "单元测试",
      value: isQuality ? 100 : stepIndex >= 4 ? 68 : 0,
      status: isQuality ? "passed" : stepIndex >= 4 ? "running" : "queued",
    },
    {
      name: "API 测试",
      value: isQuality ? 80 : stepIndex >= 4 ? 42 : 0,
      status: isQuality ? "running" : stepIndex >= 4 ? "running" : "queued",
    },
    {
      name: "UI E2E",
      value: isQuality ? 0 : stepIndex >= 6 || fixApproved ? 100 : 72,
      status: (stepIndex >= 6 || fixApproved)
        ? "passed"
        : stepIndex >= 4
          ? "running"
          : "queued",
    },
  ];
}

// ── Agent 数据 ──────────────────────────────
export function getAgents(stepIndex: number, fixApproved: boolean): Agent[] {
  const agents: Agent[] = [
    {
      name: "Product Agent",
      role: "意图澄清",
      status: stepIndex >= 1 ? "done" : "running",
      confidence: stepIndex >= 1 ? 96 : 68,
      task: stepIndex >= 1
        ? "已沉淀业务目标、角色和边界"
        : "正在从一句话中抽取业务对象",
      icon: MessageSquareText,
    },
    {
      name: "Architect Agent",
      role: "可执行设计",
      status: stepIndex >= 2 ? "done" : stepIndex >= 1 ? "running" : "review",
      confidence: stepIndex >= 2 ? 93 : 82,
      task: stepIndex >= 2
        ? "架构、数据模型和 API 契约已生成"
        : "等待技术方案设计后生成代码",
      icon: Network,
    },
    {
      name: "Frontend Agent",
      role: "交互实现",
      status: stepIndex >= 3 ? "done" : stepIndex === 2 ? "running" : "review",
      confidence: stepIndex >= 3 ? 90 : 74,
      task: stepIndex >= 3
        ? "页面和 mock 数据已接入"
        : "准备生成列表、详情和提醒工作流",
      icon: PanelRight,
    },
    {
      name: "Test Agent",
      role: "验证矩阵",
      status: stepIndex >= 4 || fixApproved
        ? "done"
        : stepIndex >= 3
          ? "running"
          : "review",
      confidence: stepIndex >= 4 || fixApproved ? 94 : 78,
      task: stepIndex >= 4 || fixApproved
        ? "E2E、API、单测全部通过"
        : "正在把验收标准转为测试用例",
      icon: TestTube2,
    },
    {
      name: "DevOps Agent",
      role: "交付流水线",
      status: stepIndex >= 5 ? "running" : "blocked",
      confidence: stepIndex >= 5 ? 88 : 62,
      task: stepIndex >= 5
        ? "准备构建、预发验证和交付包"
        : "等待质量门禁通过",
      icon: Rocket,
    },
  ];
  return agents;
}

// ── 下一步操作提示 ──────────────────────────
export function nextMoveText(state: AppState): string {
  const step = workflow[state.stepIndex].id;
  switch (step) {
    case "intent":
      return "先确认 AI 对业务意图的理解,选择本轮交付模式。";
    case "plan":
      return "勾选本轮必须交付的模块,避免一开始范围过大。";
    case "coding":
      return state.codeConfirmed
        ? "代码结构已确认，可以让 Agent Team 开始完整开发。"
        : "检查生成的代码骨架，确认类型定义、API 接口和组件结构后再进入开发。";
    case "quality":
      return state.qualityPassed
        ? "质量门禁已通过,可以进入验证修复环节。"
        : "审查质量报告,API 测试和 E2E 还有未通过项。";
    case "verify":
      return state.fixApproved
        ? "修复已授权,可以推进到发布准备。"
        : "E2E 发现权限边界问题,授权 Agent 自动修复。";
    case "release":
      return state.releaseApproved
        ? "交付包已生成,可预览应用查看结果。"
        : "确认发布策略,让 DevOps Agent 执行 Sandbox 发布。";
    default:
      return "";
  }
}

// ── 标题推断 ────────────────────────────────
export function titleFromIntent(intent: string) {
  return "新研发任务";
}

// ── 时间格式化 ──────────────────────────────
export function formatTime(iso: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

// ── Agent 状态标签 ──────────────────────────
export function statusLabel(
  status: "running" | "review" | "blocked" | "done",
) {
  return {
    running: "运行中",
    review: "待确认",
    blocked: "阻塞",
    done: "完成",
  }[status];
}

// ── 默认应用状态 ────────────────────────────
export function createDefaultState(): AppState {
  return {
    view: "home",
    homeTab: "tasks",
    intent: "",
    workspacePath: "",
    activeStage: "intent",
    stepIndex: 0,
    scope: "mvp",
    selectedModules: ["线索池", "客户详情", "跟进提醒", "沟通记录"],
    notes: "",
    codeConfirmed: false,
    fixApproved: false,
    releaseApproved: false,
    qualityPassed: false,
    createdAt: new Date().toISOString(),
    previewTaskId: null,
    activeTaskCard: null,
    todoAnswers: {},
    initialPrompts: {},
    restoredSessions: {},
  };
}
