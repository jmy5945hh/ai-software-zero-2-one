import type { WorkflowStep, AppState, Stage, Gate, Agent } from "./types";
import {
  MessageSquareText,
  Network,
  PanelRight,
  TestTube2,
  Rocket,
  LayoutTemplate,
} from "lucide-react";

// ── SOP 工作流定义（新增 quality 门禁步骤） ──
export const workflow: WorkflowStep[] = [
  {
    id: "intent",
    label: "需求分析",
    detail: "AI 提炼任务目标和边界",
    detailLong: "基于用户输入的需求意图，详细分析代码仓库，产出需求规格文档以及需求检查清单",
    userRole: "和 DevAgent 一起脑暴，将模糊需求打磨地清晰、可实现",
  },
  {
    id: "prototype",
    label: "交互原型",
    detail: "生成中低保真 HTML 原型确认交互",
    detailLong: "分析需求中的 UI 变化点，生成可交互的 HTML 原型，帮助用户在编码前确认页面结构和交互流程",
    userRole: "预览和确认 UI 原型，确保交互符合预期",
  },
  {
    id: "plan",
    label: "技术设计",
    detail: "选择本轮交付模块和风险边界",
    detailLong: "基于需求范围和代码仓库现状，进行模块依赖分析、技术方案选型，产出可执行的技术设计文档",
    userRole: "作为 Tech Leader，评审 DevAgent 的技术详设材料",
  },
  {
    id: "coding",
    label: "编码开发",
    detail: "生成可运行代码骨架",
    detailLong: "根据技术设计自动生成类型定义、API 服务层、页面组件等代码模块，并完成项目编译验证",
    userRole: "没有什么特别要参与的，喝杯咖啡歇一歇吧 :)",
  },
  {
    id: "quality",
    label: "质量QA",
    detail: "代码检视、单测、API测试、E2E 集中审查",
    detailLong: "自动触发质量门禁，执行代码检视、单元测试、API 测试和 UI E2E 测试，汇总质量报告供用户决策",
    userRole: "走读软件质量报告，决定放行或修复",
  },
  {
    id: "verify",
    label: "验证修复",
    detail: "授权自动修复并复测",
    detailLong: "分析质量门禁中的失败项，生成修复方案，授权 Agent 自动修复并重新执行测试验证",
    userRole: "授权修复和复测",
  },
  {
    id: "release",
    label: "发布交付",
    detail: "入库、构建、发布和交付包",
    detailLong: "合并代码变更、执行生产构建、部署 Sandbox 预览环境，生成交付包和发布记录",
    userRole: "确认发布策略",
  },
];

export function getTaskWorkflow(prototype: AppState["prototype"]): WorkflowStep[] {
  const includesPrototype = prototype.mode !== "none" && prototype.status !== "skipped";
  return includesPrototype ? workflow : workflow.filter((step) => step.id !== "prototype");
}

export function getWorkflowStepIndex(
  stepId: string | undefined,
  fallback?: number,
  steps: WorkflowStep[] = workflow,
): number {
  const index = steps.findIndex((step) => step.id === stepId);
  if (index >= 0) return index;
  return Math.max(0, Math.min(fallback ?? 0, steps.length - 1));
}

// ── 阶段列表 ────────────────────────────────
export function getStages(stepIndex: number, steps: WorkflowStep[] = workflow): Stage[] {
  return steps.map((step, index) => ({
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
  const { fixApproved, stepIndex } = state;
  const steps = getTaskWorkflow(state.prototype);
  const qualityIndex = getWorkflowStepIndex("quality", undefined, steps);
  const releaseIndex = getWorkflowStepIndex("release", undefined, steps);
  const isQuality = stepIndex >= qualityIndex;
  return [
    {
      name: "代码检视",
      value: isQuality ? 100 : 0,
      status: isQuality ? "passed" : "queued",
    },
    {
      name: "单元测试",
      value: isQuality ? 100 : 0,
      status: isQuality ? "passed" : "queued",
    },
    {
      name: "API 测试",
      value: isQuality ? 80 : 0,
      status: isQuality ? "running" : "queued",
    },
    {
      name: "UI E2E",
      value: stepIndex >= releaseIndex || fixApproved ? 100 : isQuality ? 72 : 0,
      status: (stepIndex >= releaseIndex || fixApproved)
        ? "passed"
        : isQuality
          ? "running"
          : "queued",
    },
  ];
}

// ── Agent 数据 ──────────────────────────────
export function getAgents(
  stepIndex: number,
  fixApproved: boolean,
  steps: WorkflowStep[] = workflow,
): Agent[] {
  const hasPrototype = steps.some((step) => step.id === "prototype");
  const prototypeIndex = getWorkflowStepIndex("prototype", undefined, steps);
  const planIndex = getWorkflowStepIndex("plan", undefined, steps);
  const codingIndex = getWorkflowStepIndex("coding", undefined, steps);
  const qualityIndex = getWorkflowStepIndex("quality", undefined, steps);
  const releaseIndex = getWorkflowStepIndex("release", undefined, steps);
  const intentCompletionIndex = hasPrototype ? prototypeIndex : planIndex;
  const agents: Agent[] = [
    {
      name: "Product Agent",
      role: "意图澄清",
      status: stepIndex >= intentCompletionIndex ? "done" : "running",
      confidence: stepIndex >= intentCompletionIndex ? 96 : 68,
      task: stepIndex >= intentCompletionIndex
        ? "已沉淀业务目标、角色和边界"
        : "正在从一句话中抽取业务对象",
      icon: MessageSquareText,
    },
    {
      name: "Prototype Agent",
      role: "交互原型",
      status: stepIndex >= planIndex ? "done" : stepIndex === prototypeIndex ? "running" : "review",
      confidence: stepIndex >= planIndex ? 88 : 72,
      task: stepIndex >= planIndex
        ? "HTML 原型和交接文档已生成"
        : "准备分析 UI 变化并生成交互原型",
      icon: LayoutTemplate,
    },
    {
      name: "Architect Agent",
      role: "可执行设计",
      status: stepIndex >= codingIndex ? "done" : stepIndex >= planIndex ? "running" : "review",
      confidence: stepIndex >= codingIndex ? 93 : 82,
      task: stepIndex >= codingIndex
        ? "架构、数据模型和 API 契约已生成"
        : "等待技术方案设计后生成代码",
      icon: Network,
    },
    {
      name: "Frontend Agent",
      role: "交互实现",
      status: stepIndex >= qualityIndex ? "done" : stepIndex === codingIndex ? "running" : "review",
      confidence: stepIndex >= qualityIndex ? 90 : 74,
      task: stepIndex >= qualityIndex
        ? "页面和 mock 数据已接入"
        : "准备生成列表、详情和提醒工作流",
      icon: PanelRight,
    },
    {
      name: "Test Agent",
      role: "验证矩阵",
      status: stepIndex >= qualityIndex || fixApproved
        ? "done"
        : stepIndex >= codingIndex
          ? "running"
          : "review",
      confidence: stepIndex >= qualityIndex || fixApproved ? 94 : 78,
      task: stepIndex >= qualityIndex || fixApproved
        ? "E2E、API、单测全部通过"
        : "正在把验收标准转为测试用例",
      icon: TestTube2,
    },
    {
      name: "DevOps Agent",
      role: "交付流水线",
      status: stepIndex >= releaseIndex ? "running" : "blocked",
      confidence: stepIndex >= releaseIndex ? 88 : 62,
      task: stepIndex >= releaseIndex
        ? "准备构建、预发验证和交付包"
        : "等待质量门禁通过",
      icon: Rocket,
    },
  ];
  return hasPrototype ? agents : agents.filter((agent) => agent.name !== "Prototype Agent");
}

// ── 下一步操作提示 ──────────────────────────
export function nextMoveText(state: AppState): string {
  const step = getTaskWorkflow(state.prototype)[state.stepIndex]?.id;
  switch (step) {
    case "intent":
      return "先确认 AI 对业务意图的理解,选择本轮交付模式。";
    case "prototype":
      return "AI 已识别需求中的 UI 变化，建议生成 HTML 原型进行确认。";
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
    runtimeMode: "local",
    gitRepo: undefined,
    activeStage: "intent",
    stepIndex: 0,
    notes: "",
    codeConfirmed: false,
    fixApproved: false,
    releaseApproved: false,
    qualityPassed: false,
    createdAt: new Date().toISOString(),
    sessionId: "",
    previewTaskId: null,
    activeTaskCard: null,
    todoAnswers: {},
    initialPrompts: {},
    prototype: {
      mode: "none",
      status: "pending",
      htmlPath: "",
      handoffPath: "",
    },
    qaReview: {
      status: "idle",
      outputLines: [],
      resultFilePath: "",
      resultContent: "",
    },
    restoredSessions: {},
  };
}
