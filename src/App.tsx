import { useEffect, useMemo, useState } from "react";
import { StreamText, useStreamingList, useStepKey } from "./hooks";
import {
  Activity,
  ArrowRight,
  Bot,
  Boxes,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Cloud,
  Code2,
  Database,
  Eye,
  FileCode2,
  GitBranch,
  GitPullRequest,
  Layers3,
  ListTodo,
  LockKeyhole,
  MessageSquareText,
  Network,
  PanelRight,
  Play,
  Radar,
  Rocket,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  TestTube2,
  TimerReset,
  TriangleAlert,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type StageStatus = "done" | "active" | "queued";
type AgentStatus = "running" | "review" | "blocked" | "done";
type View = "home" | "workspace";
type HomeTab = "tasks" | "build";
type ScopeChoice = "mvp" | "governed" | "full";
type TaskCategory = "story" | "defect" | "governance";

type TaskCard = {
  id: string;
  category: TaskCategory;
  title: string;
  summary: string;
  priority: "critical" | "high" | "medium" | "low";
  source: string;
};

type WorkflowId = "intent" | "scope" | "spec" | "build" | "verify" | "release";

type WorkflowStep = {
  id: WorkflowId;
  label: string;
  detail: string;
  userRole: string;
  tab: string;
};

type Stage = {
  label: string;
  detail: string;
  status: StageStatus;
  time: string;
};

type Agent = {
  name: string;
  role: string;
  status: AgentStatus;
  confidence: number;
  task: string;
  icon: LucideIcon;
};

type Gate = {
  name: string;
  value: number;
  status: "passed" | "running" | "queued";
};

type SpecItem = {
  title: string;
  detail: string;
  icon: LucideIcon;
  accent: string;
};

type AppState = {
  view: View;
  homeTab: HomeTab;
  intent: string;
  activeTab: string;
  stepIndex: number;
  scope: ScopeChoice;
  selectedModules: string[];
  notes: string;
  specConfirmed: boolean;
  fixApproved: boolean;
  releaseApproved: boolean;
  createdAt: string;
  previewTaskId: string | null;
};

const STORAGE_KEY = "zero-one-software.prototype.v2";

const examples = [
  "为销售团队生成客户跟进系统,支持提醒、沟通记录和周报。",
  "做一个采购审批工具,支持预算校验、多人审批和异常提醒。",
  "搭建客服工单系统,自动分派、追踪 SLA,并生成复盘报告。",
];

const taskCards: TaskCard[] = [
  { id: "story-1", category: "story", title: "用户风险测评与产品匹配", summary: "实现KYC问卷→风险等级→推荐产品池的完整匹配链路", priority: "high", source: "财富管理平台 v3.2" },
  { id: "story-2", category: "story", title: "理财产品详情页重构", summary: "收益率多维展示、历史净值曲线、申购赎回时间轴", priority: "high", source: "财富管理平台 v3.2" },
  { id: "story-3", category: "story", title: "个性化推荐策略引擎对接", summary: "用户行为埋点→标签沉淀→推荐算法输出→前端展示", priority: "medium", source: "财富管理平台 v3.2" },
  { id: "defect-1", category: "defect", title: "净值曲线加载超时", summary: "单产品3年以上净值数据接口响应>3s,影响用户浏览体验", priority: "critical", source: "行情数据服务" },
  { id: "defect-2", category: "defect", title: "推荐结果重复展示", summary: "同一用户多次刷新出现重复产品,去重逻辑缺失", priority: "high", source: "推荐引擎" },
  { id: "defect-3", category: "defect", title: "申购金额校验精度丢失", summary: "大额申购时前端浮点数计算偏差导致校验不一致", priority: "medium", source: "交易模块" },
  { id: "gov-1", category: "governance", title: "资管新规合规校验", summary: "确保产品展示页满足投资者适当性管理披露要求", priority: "high", source: "合规审查" },
  { id: "gov-2", category: "governance", title: "用户数据脱敏审计", summary: "埋点数据中的手机号未脱敏,需全链路排查修复", priority: "critical", source: "安全审计" },
  { id: "gov-3", category: "governance", title: "推荐策略可解释性报告", summary: "面向监管生成推荐逻辑的白盒说明文档", priority: "medium", source: "监管报送" },
];

const categoryMeta: Record<TaskCategory, { label: string; icon: LucideIcon; accent: string }> = {
  story: { label: "故事卡", icon: Sparkles, accent: "sage" },
  defect: { label: "问题 / 缺陷", icon: TriangleAlert, accent: "terracotta" },
  governance: { label: "治理任务", icon: ShieldCheck, accent: "amber" },
};

function priorityLabel(priority: TaskCard["priority"]) {
  return { critical: "紧急", high: "高", medium: "中", low: "低" }[priority];
}

const tabs = ["AI 引导", "需求画布", "架构视图", "数据模型", "测试矩阵", "应用预览"];

const workflow: WorkflowStep[] = [
  {
    id: "intent",
    label: "意图校准",
    detail: "AI 提炼目标、用户和边界",
    userRole: "确认方向是否正确",
    tab: "AI 引导",
  },
  {
    id: "scope",
    label: "范围锁定",
    detail: "选择本轮交付模块和风险边界",
    userRole: "决定这次先做什么",
    tab: "需求画布",
  },
  {
    id: "spec",
    label: "Spec 基线",
    detail: "生成可执行规格与验收标准",
    userRole: "确认设计基线",
    tab: "需求画布",
  },
  {
    id: "build",
    label: "Agent 开发",
    detail: "Agent Team 并行生成代码、测试和文档",
    userRole: "监控进展,处理阻塞",
    tab: "架构视图",
  },
  {
    id: "verify",
    label: "验证修复",
    detail: "质量门禁、E2E 验证和自动修复",
    userRole: "授权修复和复测",
    tab: "测试矩阵",
  },
  {
    id: "release",
    label: "发布交付",
    detail: "入库、构建、发布和交付包",
    userRole: "确认发布策略",
    tab: "应用预览",
  },
];

const moduleOptions = ["线索池", "客户详情", "跟进提醒", "沟通记录", "团队周报", "主管看板"];

const specs: SpecItem[] = [
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

const testRows = [
  ["线索创建", "销售录入客户信息后进入待跟进池", "API + UI", "Ready"],
  ["自动提醒", "超过 3 天未跟进时生成提醒", "Unit + E2E", "Ready"],
  ["沟通记录", "记录电话、微信、邮件与下一步动作", "UI", "Ready"],
  ["周报生成", "每周一按团队生成销售进展摘要", "API", "Review"],
];

function createDefaultState(): AppState {
  return {
    view: "home",
    homeTab: "tasks",
    intent: examples[0],
    activeTab: tabs[0],
    stepIndex: 0,
    scope: "mvp",
    selectedModules: ["线索池", "客户详情", "跟进提醒", "沟通记录"],
    notes: "",
    specConfirmed: false,
    fixApproved: false,
    releaseApproved: false,
    createdAt: new Date().toISOString(),
    previewTaskId: null,
  };
}

function useStoredState() {
  const [state, setState] = useState<AppState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...createDefaultState(), ...JSON.parse(saved) } : createDefaultState();
    } catch {
      return createDefaultState();
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  return [state, setState] as const;
}

function statusLabel(status: AgentStatus) {
  return {
    running: "运行中",
    review: "待确认",
    blocked: "阻塞",
    done: "完成",
  }[status];
}

function titleFromIntent(intent: string) {
  if (intent.includes("采购")) return "采购审批工具";
  if (intent.includes("客服") || intent.includes("工单")) return "客服工单系统";
  if (intent.includes("销售") || intent.includes("客户")) return "销售线索跟进系统";
  return "新研发任务";
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function getStages(stepIndex: number): Stage[] {
  return workflow.map((step, index) => ({
    label: step.label,
    detail: step.detail,
    status: index < stepIndex ? "done" : index === stepIndex ? "active" : "queued",
    time: index < stepIndex ? "Done" : index === stepIndex ? "Now" : "Next",
  }));
}

function getGates(state: AppState): Gate[] {
  const { stepIndex, fixApproved, releaseApproved } = state;
  return [
    {
      name: "Spec 完整性",
      value: stepIndex >= 2 ? 100 : stepIndex === 1 ? 64 : 22,
      status: stepIndex >= 2 ? "passed" : "running",
    },
    {
      name: "代码检视",
      value: stepIndex >= 4 ? 100 : stepIndex === 3 ? 76 : 0,
      status: stepIndex >= 4 ? "passed" : stepIndex === 3 ? "running" : "queued",
    },
    {
      name: "单元测试",
      value: stepIndex >= 4 ? 100 : stepIndex === 3 ? 68 : 0,
      status: stepIndex >= 4 ? "passed" : stepIndex === 3 ? "running" : "queued",
    },
    {
      name: "API 测试",
      value: stepIndex >= 4 ? 100 : stepIndex === 3 ? 42 : 0,
      status: stepIndex >= 4 ? "passed" : stepIndex === 3 ? "running" : "queued",
    },
    {
      name: "UI E2E",
      value: stepIndex >= 5 || fixApproved ? 100 : stepIndex === 4 ? 72 : 0,
      status: stepIndex >= 5 || fixApproved ? "passed" : stepIndex === 4 ? "running" : "queued",
    },
    {
      name: "发布检查",
      value: releaseApproved ? 100 : stepIndex === 5 ? 85 : 0,
      status: releaseApproved ? "passed" : stepIndex === 5 ? "running" : "queued",
    },
  ];
}

function getAgents(stepIndex: number, fixApproved: boolean): Agent[] {
  return [
    {
      name: "Product Agent",
      role: "意图澄清",
      status: stepIndex >= 1 ? "done" : "running",
      confidence: stepIndex >= 1 ? 96 : 68,
      task: stepIndex >= 1 ? "已沉淀业务目标、角色和边界" : "正在从一句话中抽取业务对象",
      icon: MessageSquareText,
    },
    {
      name: "Architect Agent",
      role: "可执行设计",
      status: stepIndex >= 3 ? "done" : stepIndex >= 1 ? "running" : "review",
      confidence: stepIndex >= 3 ? 93 : 82,
      task: stepIndex >= 3 ? "架构、数据模型和 API 契约已生成" : "等待范围锁定后生成 Spec",
      icon: Network,
    },
    {
      name: "Frontend Agent",
      role: "交互实现",
      status: stepIndex >= 4 ? "done" : stepIndex === 3 ? "running" : "review",
      confidence: stepIndex >= 4 ? 90 : 74,
      task: stepIndex >= 4 ? "页面和 mock 数据已接入" : "准备生成列表、详情和提醒工作流",
      icon: PanelRight,
    },
    {
      name: "Test Agent",
      role: "验证矩阵",
      status: stepIndex >= 5 || fixApproved ? "done" : stepIndex >= 3 ? "running" : "review",
      confidence: stepIndex >= 5 || fixApproved ? 94 : 78,
      task: stepIndex >= 5 || fixApproved ? "E2E、API、单测全部通过" : "正在把验收标准转为测试用例",
      icon: TestTube2,
    },
    {
      name: "DevOps Agent",
      role: "交付流水线",
      status: stepIndex >= 5 ? "running" : "blocked",
      confidence: stepIndex >= 5 ? 88 : 62,
      task: stepIndex >= 5 ? "准备构建、预发验证和交付包" : "等待质量门禁通过",
      icon: Rocket,
    },
  ];
}

function scopeLabel(scope: ScopeChoice) {
  return {
    mvp: "MVP 快速交付",
    governed: "企业受控交付",
    full: "完整产品化交付",
  }[scope];
}

export function App() {
  const [state, setState] = useStoredState();
  const taskTitle = useMemo(() => titleFromIntent(state.intent), [state.intent]);
  const currentStep = workflow[state.stepIndex];
  const stages = getStages(state.stepIndex);
  const gates = getGates(state);
  const agents = getAgents(state.stepIndex, state.fixApproved);
  const progress = Math.round(((state.stepIndex + (state.releaseApproved ? 1 : 0)) / workflow.length) * 100);

  function patchState(patch: Partial<AppState>) {
    setState((previous) => ({ ...previous, ...patch }));
  }

  function startTask() {
    if (!state.intent.trim()) return;
    setState((previous) => ({
      ...createDefaultState(),
      intent: previous.intent.trim(),
      view: "workspace",
      createdAt: new Date().toISOString(),
    }));
    window.scrollTo({ top: 0 });
  }

  function startTaskFromCard(card: TaskCard) {
    const fullIntent = `${card.title}：${card.summary}`;
    setState((previous) => ({
      ...createDefaultState(),
      intent: fullIntent,
      notes: previous.notes.trim(),
      view: "workspace",
      createdAt: new Date().toISOString(),
    }));
    window.scrollTo({ top: 0 });
  }

  function continueTask() {
    const nextIndex = Math.min(state.stepIndex + 1, workflow.length - 1);
    patchState({
      stepIndex: nextIndex,
      activeTab: workflow[nextIndex].tab,
      specConfirmed: state.specConfirmed || state.stepIndex >= 2,
    });
    window.scrollTo({ top: 0 });
  }

  function resetDemo() {
    localStorage.removeItem(STORAGE_KEY);
    setState(createDefaultState());
    window.scrollTo({ top: 0 });
  }

  function setStep(index: number) {
    patchState({ stepIndex: index, activeTab: workflow[index].tab });
    window.scrollTo({ top: 0 });
  }

  if (state.view === "home") {
    const previewTask = state.previewTaskId ? taskCards.find((t) => t.id === state.previewTaskId) : null;

    return (
      <main className="home-shell">
        <header className="home-nav">
          <div className="brand">
            <div className="brand-mark">
              <Sparkles size={18} />
            </div>
            <div>
              <strong>Zero One Software</strong>
              <span>AI Native Delivery OS</span>
            </div>
          </div>
          <div className="home-signal">
            <span>Local Workspace</span>
            <strong>Agent Team Online</strong>
          </div>
        </header>

        <section className="home-hero">
          <div className="home-copy">
            <span className="eyebrow">AI Native 研发平台</span>
            <h1>创意👉可运行软件</h1>
            <p>
              没关系，就让我们从"一句话需求"开始
            </p>
          </div>

          <div className="home-tabs">
            <button
              className={`home-tab ${state.homeTab === "tasks" ? "active" : ""}`}
              type="button"
              onClick={() => patchState({ homeTab: "tasks", previewTaskId: null })}
            >
              <ListTodo size={18} />
              从任务开始
            </button>
            <button
              className={`home-tab ${state.homeTab === "build" ? "active" : ""}`}
              type="button"
              onClick={() => patchState({ homeTab: "build", previewTaskId: null })}
            >
              <Sparkles size={18} />
              从想法开始
            </button>
          </div>

          {state.homeTab === "tasks" ? (
            <>
              <div className="task-board">
                {(["story", "defect", "governance"] as TaskCategory[]).map((category) => {
                  const meta = categoryMeta[category];
                  const Icon = meta.icon;
                  const cards = taskCards.filter((c) => c.category === category);
                  return (
                    <div className={`task-swimlane ${meta.accent}`} key={category}>
                      <div className="swimlane-header">
                        <Icon size={16} />
                        <strong>{meta.label}</strong>
                        <span>{cards.length} 项</span>
                      </div>
                      <div className="swimlane-cards">
                        {cards.map((card) => (
                          <div className="task-card" key={card.id}>
                            <div className="task-card-body">
                              <h3>{card.title}</h3>
                              <p>{card.summary}</p>
                            </div>
                            <div className="task-card-meta">
                              <span className={`priority-tag ${card.priority}`}>{priorityLabel(card.priority)}</span>
                              <span className="source-tag">{card.source}</span>
                            </div>
                            <div className="task-card-overlay">
                              <button
                                className="overlay-btn primary"
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  patchState({ intent: `${card.title}：${card.summary}`, previewTaskId: null });
                                  startTaskFromCard(card);
                                }}
                              >
                                <Play size={15} />
                                直接开始!
                              </button>
                              <button
                                className="overlay-btn secondary"
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  patchState({ previewTaskId: card.id });
                                }}
                              >
                                <Eye size={15} />
                                查看
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div className="example-strip" aria-label="示例需求">
                {examples.map((example) => (
                  <button type="button" key={example} onClick={() => patchState({ intent: example })}>
                    <Sparkles size={15} />
                    {example}
                  </button>
                ))}
              </div>

              <div className="launch-panel">
                <label htmlFor="intent">Hi, 今天想创造点什么？</label>
                <textarea
                  id="intent"
                  value={state.intent}
                  onChange={(event) => patchState({ intent: event.target.value })}
                  rows={4}
                />
                <div className="launch-actions">
                  <button className="primary-action" type="button" onClick={startTask}>
                    <Play size={17} />
                    开始研发任务
                  </button>
                  <span>状态会自动保存到浏览器 storage</span>
                </div>
              </div>
            </>
          )}

          <div className="home-proof">
            <div>
              <strong>Guided Loop</strong>
              <span>AI 每一步告诉你正在做什么、需要你决定什么</span>
            </div>
            <div>
              <strong>ChangeSet Memory</strong>
              <span>需求、决策、Agent 动作和质量结果统一沉淀</span>
            </div>
            <div>
              <strong>Human Control</strong>
              <span>关键节点确认，复杂劳动交给 Agent Team</span>
            </div>
          </div>
        </section>

        {previewTask && (
          <div className="preview-backdrop" onClick={() => patchState({ previewTaskId: null })}>
            <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
              <div className="preview-modal-header">
                <div>
                  <span className="eyebrow">{categoryMeta[previewTask.category].label}</span>
                  <h2>{previewTask.title}</h2>
                </div>
                <button className="ghost-button" type="button" onClick={() => patchState({ previewTaskId: null })}>
                  Esc
                </button>
              </div>
              <div className="preview-modal-body">
                <div className="preview-meta-grid">
                  <div>
                    <span>来源</span>
                    <strong>{previewTask.source}</strong>
                  </div>
                  <div>
                    <span>优先级</span>
                    <strong className={`priority-text ${previewTask.priority}`}>{priorityLabel(previewTask.priority)}</strong>
                  </div>
                  <div>
                    <span>当前状态</span>
                    <strong>待处理</strong>
                  </div>
                </div>
                <div className="preview-desc">
                  <span>任务描述</span>
                  <p>{previewTask.summary}</p>
                </div>
                <div className="preview-notes">
                  <span>补充备注（可选）</span>
                  <textarea
                    value={state.notes}
                    onChange={(event) => patchState({ notes: event.target.value })}
                    placeholder="例如：需要先确认合规口径；UI 需适配移动端。"
                    rows={3}
                  />
                </div>
              </div>
              <div className="preview-modal-actions">
                <button className="primary-action wide" type="button" onClick={() => startTaskFromCard(previewTask)}>
                  <Rocket size={16} />
                  确认并开始任务
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="app-shell guided-shell">
      <section className="topbar guided-topbar">
        <button className="ghost-button" type="button" onClick={() => patchState({ view: "home" })}>
          <ChevronLeft size={17} />
          新任务
        </button>
        <div className="workspace-title">
          <span>CS-2026-0518 · {formatTime(state.createdAt)}</span>
          <strong>{taskTitle}</strong>
        </div>
        <div className="top-progress" aria-label="全局进度">
          <div>
            <span>{currentStep.label}</span>
            <strong>{progress}%</strong>
          </div>
          <div className="progress-track">
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
        <button className="ghost-button danger-lite" type="button" onClick={resetDemo}>
          重置演示
        </button>
      </section>

      <section className="guided-grid">
        <aside className="journey-panel panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Journey</span>
              <h2>研发任务导航</h2>
            </div>
            <GitBranch size={18} />
          </div>

          <div className="changeset-summary">
            <div>
              <span>当前职责</span>
              <strong>{currentStep.userRole}</strong>
            </div>
            <div>
              <span>交付模式</span>
              <strong>{scopeLabel(state.scope)}</strong>
            </div>
          </div>

          <ol className="stage-list">
            {stages.map((stage, index) => (
              <li key={stage.label}>
                <button className={`stage-item journey-button ${stage.status}`} type="button" onClick={() => setStep(index)}>
                  <div className="stage-dot">
                    {stage.status === "done" ? <Check size={12} /> : <CircleDot size={12} />}
                  </div>
                  <div>
                    <div className="stage-title">
                      <strong>{stage.label}</strong>
                      <span>{stage.time}</span>
                    </div>
                    <p>{stage.detail}</p>
                  </div>
                </button>
              </li>
            ))}
          </ol>
        </aside>

        <section className="session-column">
          <section className="session-panel panel">
            <div className="session-header">
              <div>
                <span className="eyebrow">AI Guided Session</span>
                <h1>{currentStep.label}</h1>
                <p>{currentStep.detail}</p>
              </div>
              <div className="save-pill">
                <CheckCircle2 size={15} />
                已自动保存
              </div>
            </div>

            <GuidedStep
              state={state}
              taskTitle={taskTitle}
              onPatch={patchState}
              onContinue={continueTask}
            />
          </section>

          <section className="artifact-dock panel">
            <div className="asset-tabs">
              {tabs.map((item) => (
                <button
                  className={state.activeTab === item ? "active" : ""}
                  type="button"
                  key={item}
                  onClick={() => patchState({ activeTab: item })}
                >
                  {item}
                </button>
              ))}
            </div>
            <ActiveAsset tab={state.activeTab} taskTitle={taskTitle} />
          </section>
        </section>

        <aside className="right-stack">
          <section className="control-card panel">
            <div className="panel-heading compact">
              <div>
                <span className="eyebrow">Your Next Move</span>
                <h2>当前你需要做什么</h2>
              </div>
              <Sparkles size={18} />
            </div>
            <p>{nextMoveText(state)}</p>
            <button className="primary-action wide" type="button" onClick={continueTask}>
              {state.stepIndex >= workflow.length - 1 ? "查看交付结果" : "继续推进"}
              <ChevronRight size={16} />
            </button>
          </section>

          <section className="agent-panel panel">
            <div className="panel-heading compact">
              <div>
                <span className="eyebrow">Agent Team</span>
                <h2>协同执行平面</h2>
              </div>
              <Bot size={18} />
            </div>
            <div className="agent-list compact-list">
              {agents.map((agent) => {
                const Icon = agent.icon;
                return (
                  <article className={`agent-card ${agent.status}`} key={agent.name}>
                    <div className="agent-head">
                      <div className="agent-icon">
                        <Icon size={18} />
                      </div>
                      <div>
                        <strong>{agent.name}</strong>
                        <span>{agent.role}</span>
                      </div>
                      <em>{statusLabel(agent.status)}</em>
                    </div>
                    <p>{agent.task}</p>
                    <div className="confidence">
                      <span style={{ width: `${agent.confidence}%` }} />
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="audit-panel panel">
            <div className="panel-heading compact">
              <div>
                <span className="eyebrow">Decision Log</span>
                <h2>决策记录</h2>
              </div>
              <ShieldCheck size={18} />
            </div>
            <div className="audit-log">
              <div>
                <TimerReset size={16} />
                <span>{formatTime(state.createdAt)} 创建 ChangeSet</span>
              </div>
              <div>
                <CheckCircle2 size={16} />
                <span>选择交付模式:{scopeLabel(state.scope)}</span>
              </div>
              <div>
                <GitPullRequest size={16} />
                <span>已选模块:{state.selectedModules.join("、")}</span>
              </div>
            </div>
          </section>
        </aside>
      </section>

      <section className="quality-bar">
        <div className="release-state">
          <Rocket size={18} />
          <div>
            <strong>Quality Gates</strong>
            <span>每一步都会留下可追溯证据,失败项可授权 Agent 自动修复</span>
          </div>
        </div>
        <div className="gate-list">
          {gates.map((gate) => (
            <div className={`gate ${gate.status}`} key={gate.name}>
              <div className="gate-copy">
                {gate.status === "passed" ? <CheckCircle2 size={16} /> : <TriangleAlert size={16} />}
                <span>{gate.name}</span>
              </div>
              <div className="gate-track">
                <span style={{ width: `${gate.value}%` }} />
              </div>
              <strong>{gate.value}%</strong>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function nextMoveText(state: AppState) {
  const step = workflow[state.stepIndex].id;
  if (step === "intent") return "先确认 AI 对业务意图的理解,选择本轮交付模式。";
  if (step === "scope") return "勾选本轮必须交付的模块,避免一开始范围过大。";
  if (step === "spec") return state.specConfirmed ? "Spec 已确认,可以让 Agent Team 开始拆任务。" : "检查可执行规格和验收标准,确认后再进入开发。";
  if (step === "build") return "观察 Agent 进展和阻塞项,必要时调整策略。";
  if (step === "verify") return state.fixApproved ? "修复已授权,可以推进到发布准备。" : "E2E 发现权限边界问题,授权 Agent 自动修复。";
  return state.releaseApproved ? "交付包已生成,可切到应用预览查看结果。" : "确认发布策略,让 DevOps Agent 执行 Sandbox 发布。";
}

function GuidedStep({
  state,
  taskTitle,
  onPatch,
  onContinue,
}: {
  state: AppState;
  taskTitle: string;
  onPatch: (patch: Partial<AppState>) => void;
  onContinue: () => void;
}) {
  const step = workflow[state.stepIndex].id;
  const stepKey = useStepKey(state.stepIndex);

  if (step === "intent") {
    return (
      <div className="guided-body">
        <article className="ai-card streaming" key={stepKey}>
          <Bot size={18} />
          <div>
            <strong>
              <StreamText text="我已经从你的描述中抽取出一个初始研发意图。" speed={40} />
            </strong>
            <p>
              <StreamText
                text={`目标是生成「${taskTitle}」,核心对象包括客户、跟进记录、提醒规则和周报。当前建议先做可演示的 MVP,再把权限、发布和运行态反馈接入完整闭环。`}
                speed={28}
              />
            </p>
          </div>
        </article>
        <div className="decision-grid">
          {[
            ["mvp", "MVP 快速交付", "先跑通主流程,最适合融资演示"],
            ["governed", "企业受控交付", "加入权限、审计和质量门禁"],
            ["full", "完整产品化交付", "覆盖多角色、报表和发布策略"],
          ].map(([value, title, detail]) => (
            <button
              className={`choice-card ${state.scope === value ? "selected" : ""}`}
              type="button"
              key={value}
              onClick={() => onPatch({ scope: value as ScopeChoice })}
            >
              <strong>{title}</strong>
              <span>{detail}</span>
            </button>
          ))}
        </div>
        <div className="session-actions">
          <button className="primary-action" type="button" onClick={onContinue}>
            确认方向,进入范围定义
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  if (step === "scope") {
    return (
      <div className="guided-body">
        <article className="ai-card streaming" key={stepKey}>
          <Bot size={18} />
          <div>
            <strong>
              <StreamText text="我建议把这次变更收敛成一个端到端业务场景。" speed={40} />
            </strong>
            <p>
              <StreamText text="选择模块后,我会生成页面地图、领域模型、接口契约和测试矩阵。未选模块会进入后续迭代建议。" speed={28} />
            </p>
          </div>
        </article>
        <div className="module-grid">
          {moduleOptions.map((module) => {
            const selected = state.selectedModules.includes(module);
            return (
              <button
                className={`module-chip ${selected ? "selected" : ""}`}
                type="button"
                key={module}
                onClick={() =>
                  onPatch({
                    selectedModules: selected
                      ? state.selectedModules.filter((item) => item !== module)
                      : [...state.selectedModules, module],
                  })
                }
              >
                {selected ? <CheckCircle2 size={16} /> : <CircleDot size={16} />}
                {module}
              </button>
            );
          })}
        </div>
        <label className="notes-box">
          <span>补充边界或偏好</span>
          <textarea
            value={state.notes}
            onChange={(event) => onPatch({ notes: event.target.value })}
            placeholder="例如:先不接真实 CRM;需要保留主管视角;UI 适合销售每天使用。"
          />
        </label>
        <div className="session-actions">
          <button className="primary-action" type="button" onClick={onContinue}>
            锁定范围,生成 Spec
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  if (step === "spec") {
    return (
      <div className="guided-body">
        <article className="ai-card streaming" key={stepKey}>
          <Bot size={18} />
          <div>
            <strong>
              <StreamText text="可执行 Spec 已生成,下面是我需要你确认的基线。" speed={40} />
            </strong>
            <p>
              <StreamText text="这些不是普通文档,而是后续代码、测试、发布和回滚的事实来源。确认后,Agent Team 会基于它拆任务并生成实现。" speed={28} />
            </p>
          </div>
        </article>
        <div className="spec-review-grid">
          <div>
            <span>验收标准</span>
            <strong>8 条</strong>
          </div>
          <div>
            <span>API 契约</span>
            <strong>12 个</strong>
          </div>
          <div>
            <span>风险项</span>
            <strong>3 个</strong>
          </div>
          <div>
            <span>人工确认点</span>
            <strong>2 个</strong>
          </div>
        </div>
        <div className="session-actions">
          <button
            className="primary-action"
            type="button"
            onClick={() => {
              onPatch({ specConfirmed: true });
              onContinue();
            }}
          >
            确认 Spec 基线,启动 Agent Team
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  if (step === "build") {
    return (
      <div className="guided-body">
        <article className="ai-card streaming" key={stepKey}>
          <Bot size={18} />
          <div>
            <strong>
              <StreamText text="Agent Team 已根据 ChangeSet 拆解任务。" speed={40} />
            </strong>
            <p>
              <StreamText text="前端、接口契约、mock 数据、测试用例和文档正在同一个上下文里生成。你可以关注阻塞项,而不需要逐文件盯代码。" speed={28} />
            </p>
          </div>
        </article>
        <StreamBuildBoard key={stepKey} />
        <div className="session-actions">
          <button className="primary-action" type="button" onClick={onContinue}>
            查看验证结果
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  if (step === "verify") {
    return (
      <div className="guided-body">
        <article className="ai-card warning-card streaming" key={stepKey}>
          <TriangleAlert size={18} />
          <div>
            <strong>
              <StreamText text="UI E2E 发现一个权限边界问题。" speed={45} />
            </strong>
            <p>
              <StreamText text="主管视图下,团队外客户可能出现在搜索结果中。建议授权 Frontend Agent 和 Test Agent 自动修复并复测。" speed={28} />
            </p>
          </div>
        </article>
        <div className="fix-card">
          <strong>{state.fixApproved ? "自动修复已完成" : "建议修复方案"}</strong>
          <span>
            {state.fixApproved
              ? "权限过滤已下沉到数据访问层,UI E2E 和 API 测试已重新通过。"
              : "补充团队边界过滤、增加 API 断言、追加主管视图 E2E 用例。"}
          </span>
        </div>
        <div className="session-actions">
          {!state.fixApproved ? (
            <button className="primary-action" type="button" onClick={() => onPatch({ fixApproved: true })}>
              授权 Agent 自动修复
              <Sparkles size={16} />
            </button>
          ) : (
            <button className="primary-action" type="button" onClick={onContinue}>
              复测通过,进入发布准备
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="guided-body">
      <article className="ai-card streaming" key={stepKey}>
        <Bot size={18} />
        <div>
          <strong>
            <StreamText text="交付包已经准备好,等待你的发布确认。" speed={40} />
          </strong>
          <p>
            <StreamText text="本次交付包含源码 diff、可执行 Spec、测试报告、发布记录、风险摘要和回滚方案。" speed={28} />
          </p>
        </div>
      </article>
      <div className="delivery-grid">
        {["在线预览地址", "测试报告", "变更摘要", "回滚方案"].map((item) => (
          <div key={item}>
            <CheckCircle2 size={16} />
            <strong>{item}</strong>
          </div>
        ))}
      </div>
      <div className="session-actions">
        <button className="primary-action" type="button" onClick={() => onPatch({ releaseApproved: true, activeTab: "应用预览" })}>
          {state.releaseApproved ? "已发布到 Sandbox" : "确认发布到 Sandbox"}
          <Rocket size={16} />
        </button>
      </div>
    </div>
  );
}

/**
 * 构建步骤的流式任务面板 -- 模拟 Agent 逐步完成各项任务。
 */
function StreamBuildBoard() {
  const buildTasks = ["生成页面结构", "生成 OpenAPI 契约", "写入 mock 数据", "生成单元测试", "更新变更日志"];
  const { items: done, allDone } = useStreamingList(buildTasks, 900);
  const lastRunning = buildTasks.findIndex((t) => !done.includes(t));

  return (
    <div className="run-board">
      {buildTasks.map((item, index) => {
        const isDone = done.includes(item);
        const isRunning = !isDone && (allDone ? false : index === lastRunning);
        return (
          <div className={`run-item ${isRunning ? "streaming-run" : ""}`} key={item}>
            {isDone ? (
              <CheckCircle2 size={16} />
            ) : isRunning ? (
              <Activity size={16} className="spin-icon" />
            ) : (
              <CircleDot size={16} />
            )}
            <span>{item}</span>
            <strong>{isDone ? "Done" : isRunning ? "Running" : "Queued"}</strong>
          </div>
        );
      })}
    </div>
  );
}

function ActiveAsset({ tab, taskTitle }: { tab: string; taskTitle: string }) {
  if (tab === "AI 引导") {
    return (
      <div className="asset-summary">
        <div>
          <strong>当前工作区由 ChangeSet 驱动</strong>
          <span>所有讨论、Spec、Agent 动作、测试结果都会持续沉淀,刷新后仍然保留。</span>
        </div>
        <div>
          <strong>你始终掌握关键决策</strong>
          <span>AI 负责推演和执行,人类确认方向、范围、基线、修复和发布。</span>
        </div>
      </div>
    );
  }

  if (tab === "应用预览") {
    return (
      <section className="preview-panel workspace-panel">
        <div className="panel-heading compact">
          <div>
            <span className="eyebrow">Runtime Preview</span>
            <h2>{taskTitle}</h2>
          </div>
          <div className="live-pill">Live Mock</div>
        </div>
        <div className="app-preview large">
          <div className="preview-sidebar">
            <span />
            <span />
            <span />
          </div>
          <div className="preview-content">
            <div className="preview-toolbar">
              <strong>今日线索</strong>
              <button type="button">新增客户</button>
            </div>
            {["杭州云启科技", "上海星河制造", "深圳蓝芯智能"].map((name, index) => (
              <button className="lead-row" type="button" key={name}>
                <div>
                  <strong>{name}</strong>
                  <span>{index === 0 ? "3 天未跟进" : "下次沟通已安排"}</span>
                </div>
                <ChevronRight size={16} />
              </button>
            ))}
            <div className="report-strip">
              <Radar size={18} />
              周报将在周一 09:00 自动生成
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (tab === "测试矩阵") {
    return (
      <section className="test-panel workspace-panel">
        <div className="panel-heading compact">
          <div>
            <span className="eyebrow">Verification Matrix</span>
            <h2>需求即测试</h2>
          </div>
          <SearchCheck size={18} />
        </div>
        <div className="test-table">
          {testRows.map(([scenario, assertion, kind, state]) => (
            <div className="test-row" key={scenario}>
              <strong>{scenario}</strong>
              <span>{assertion}</span>
              <em>{kind}</em>
              <b>{state}</b>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (tab === "架构视图" || tab === "数据模型") {
    return (
      <section className="spec-panel workspace-panel">
        <div className="panel-heading compact">
          <div>
            <span className="eyebrow">{tab === "架构视图" ? "Architecture" : "Domain Model"}</span>
            <h2>{tab === "架构视图" ? "端到端执行链路" : "核心业务对象"}</h2>
          </div>
          {tab === "架构视图" ? <Network size={18} /> : <Database size={18} />}
        </div>
        <div className="flow-map tall">
          <div className="flow-node active">
            <Database size={18} />
            Intent Store
          </div>
          <ArrowRight size={16} />
          <div className="flow-node">
            <Activity size={18} />
            Spec Engine
          </div>
          <ArrowRight size={16} />
          <div className="flow-node">
            <Bot size={18} />
            Agent Team
          </div>
          <ArrowRight size={16} />
          <div className="flow-node">
            <Cloud size={18} />
            Runtime
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="spec-panel workspace-panel">
      <div className="panel-heading compact">
        <div>
          <span className="eyebrow">Spec Assets</span>
          <h2>机器可读研发资产</h2>
        </div>
        <Code2 size={18} />
      </div>
      <div className="spec-grid">
        {specs.map((spec) => {
          const Icon = spec.icon;
          return (
            <article className={`spec-card ${spec.accent}`} key={spec.title}>
              <Icon size={19} />
              <strong>{spec.title}</strong>
              <p>{spec.detail}</p>
            </article>
          );
        })}
      </div>
      <div className="flow-map">
        <div className="flow-node active">
          <Database size={18} />
          Lead DB
        </div>
        <ArrowRight size={16} />
        <div className="flow-node">
          <Activity size={18} />
          Follow-up API
        </div>
        <ArrowRight size={16} />
        <div className="flow-node">
          <Eye size={18} />
          Sales UI
        </div>
        <ArrowRight size={16} />
        <div className="flow-node">
          <Cloud size={18} />
          Runtime
        </div>
      </div>
    </section>
  );
}
