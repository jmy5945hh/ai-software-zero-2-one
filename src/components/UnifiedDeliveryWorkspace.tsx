import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Bot,
  Bug,
  Check,
  ChevronDown,
  Code2,
  GitBranch,
  ListChecks,
  MonitorCog,
  Plug,
  SearchCode,
  Settings2,
  ShieldCheck,
  Sparkles,
  Workflow,
  Wrench,
} from "lucide-react";
import type {
  AppState,
  DeliveryConfig,
  DeliveryInteractionMode,
  TaskCard,
  TaskCategory,
} from "../data/types";
import { priorityLabel, taskCards } from "../data";

type TaskPanelTab = TaskCategory | "review";
type ComposerMenu = "model" | "skills" | "mcp" | "settings";

type UnifiedDeliveryWorkspaceProps = {
  state: AppState;
  onPatch: (patch: Partial<AppState>) => void;
  onStart: () => void;
  onOpenWorkspace: () => void;
  workspaceLabel: string;
};

type ReviewTemplate = {
  id: string;
  title: string;
  summary: string;
  source: string;
};

const interactionModes: Array<{
  value: DeliveryInteractionMode;
  label: string;
  icon: typeof ListChecks;
}> = [
  { value: "plan", label: "Plan", icon: ListChecks },
  { value: "builder", label: "Builder", icon: Code2 },
  { value: "workflow", label: "Workflow", icon: Workflow },
];

const taskTabs: Array<{
  value: TaskPanelTab;
  label: string;
  icon: typeof Sparkles;
  category?: TaskCategory;
}> = [
  { value: "story", label: "故事卡开发", icon: Sparkles, category: "story" },
  { value: "defect", label: "Bugfix", icon: Bug, category: "defect" },
  { value: "governance", label: "治理任务", icon: ShieldCheck, category: "governance" },
  { value: "review", label: "检视问题", icon: SearchCode },
];

const specializedAgentLabels: Record<TaskCategory, string> = {
  story: "故事卡开发",
  defect: "Bugfix",
  governance: "治理任务",
};

const modelOptions = [
  { value: "auto", label: "Auto", detail: "按节点配置和策略自动选择" },
  { value: "deepseek-v4-flash", label: "DeepSeek V4 Flash", detail: "当前运行时已配置模型" },
] as const;

const skillOptions = ["Web E2E", "API Contract", "Code Review", "Release Check"] as const;
const mcpOptions = ["GitHub", "Browser", "Database"] as const;

const reviewTemplates: ReviewTemplate[] = [
  {
    id: "review-uncommitted",
    title: "检视当前未提交变更",
    summary: "从正确性、回归风险、可维护性和测试缺口四个维度检视当前代码变更。",
    source: "当前工作区",
  },
  {
    id: "review-architecture",
    title: "扫描架构与依赖风险",
    summary: "识别模块边界、循环依赖、重复实现和不必要的技术复杂度，给出可落地调整建议。",
    source: "代码治理模板",
  },
  {
    id: "review-evidence",
    title: "检查交付测试证据",
    summary: "核对构建、API、Web 主路径和业务验收证据，明确失败、阻塞与未覆盖范围。",
    source: "质量门禁模板",
  },
];

const taskPresets: Record<TaskPanelTab, Partial<DeliveryConfig>> = {
  story: {
    interactionMode: "builder",
    mode: "project-change",
    verification: "full",
    modelPolicy: "balanced",
  },
  defect: {
    interactionMode: "workflow",
    mode: "bugfix",
    verification: "api-web",
    modelPolicy: "balanced",
  },
  governance: {
    interactionMode: "workflow",
    mode: "project-change",
    verification: "full",
    modelPolicy: "quality",
  },
  review: {
    interactionMode: "plan",
    mode: "verification",
    verification: "full",
    modelPolicy: "quality",
  },
};

function toggleValue(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function stripTaskTag(title: string): string {
  return title.replace(/【.+?】\s?/, "");
}

export function UnifiedDeliveryWorkspace({
  state,
  onPatch,
  onStart,
  onOpenWorkspace,
  workspaceLabel,
}: UnifiedDeliveryWorkspaceProps) {
  const [activeTaskTab, setActiveTaskTab] = useState<TaskPanelTab>("story");
  const [openMenu, setOpenMenu] = useState<ComposerMenu | null>(null);
  const composerRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const activeTab = taskTabs.find((tab) => tab.value === activeTaskTab) || taskTabs[0];
  const visibleTaskCards = activeTab.category
    ? taskCards.filter((card) => card.category === activeTab.category)
    : [];

  useEffect(() => {
    if (!openMenu) return;

    const closeMenuOutsideComposer = (event: PointerEvent) => {
      if (!composerRef.current?.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };

    document.addEventListener("pointerdown", closeMenuOutsideComposer);
    return () => document.removeEventListener("pointerdown", closeMenuOutsideComposer);
  }, [openMenu]);

  const patchDeliveryConfig = (patch: Partial<DeliveryConfig>) => {
    onPatch({
      deliveryConfig: {
        ...state.deliveryConfig,
        ...patch,
      },
    });
  };

  const injectTask = (intent: string, taskCard: TaskCard | null) => {
    onPatch({
      intent,
      activeTaskCard: taskCard,
      deliveryConfig: {
        ...state.deliveryConfig,
        ...taskPresets[activeTaskTab],
      },
    });
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  return (
    <div className="unified-delivery-workspace">
      <section ref={composerRef} className="delivery-composer" aria-label="AI 研发任务输入">
        <div className="composer-mode-tabs" aria-label="执行模式">
          {interactionModes.map(({ value, label, icon: Icon }) => (
            <button
              type="button"
              key={value}
              className={state.deliveryConfig.interactionMode === value ? "active" : ""}
              onClick={() => patchDeliveryConfig({ interactionMode: value })}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        <textarea
          ref={inputRef}
          id="intent"
          value={state.intent}
          onChange={(event) => onPatch({ intent: event.target.value })}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              onStart();
            }
          }}
          placeholder="描述要交付的软件任务，也可以从下方选择任务模板后继续微调..."
          rows={5}
        />

        {state.activeTaskCard && (
          <>
            <div className="composer-context-notice">
              <Check size={13} />
              已注入任务上下文：{stripTaskTag(state.activeTaskCard.title)}
            </div>
            <div className="composer-context-notice">
              <Bot size={13} />
              已为您自动配置【{specializedAgentLabels[state.activeTaskCard.category]}专精 Agent】
            </div>
          </>
        )}

        <div className="composer-toolbar">
          <div className="composer-tools">
            <details className="composer-menu" open={openMenu === "model"}>
              <summary onClick={(event) => {
                event.preventDefault();
                setOpenMenu((current) => current === "model" ? null : "model");
              }}>
                <Bot size={15} />
                {modelOptions.find((option) => option.value === state.deliveryConfig.modelId)?.label || state.deliveryConfig.modelId}
                <ChevronDown size={13} />
              </summary>
              <div className="composer-popover">
                <span className="composer-popover-title">模型策略</span>
                {modelOptions.map((option) => (
                  <button
                    type="button"
                    key={option.value}
                    className={state.deliveryConfig.modelId === option.value ? "selected" : ""}
                    onClick={() => {
                      patchDeliveryConfig({ modelId: option.value });
                      setOpenMenu(null);
                    }}
                  >
                    <span>
                      <strong>{option.label}</strong>
                      <small>{option.detail}</small>
                    </span>
                    {state.deliveryConfig.modelId === option.value && <Check size={14} />}
                  </button>
                ))}
              </div>
            </details>

            <details className="composer-menu" open={openMenu === "skills"}>
              <summary onClick={(event) => {
                event.preventDefault();
                setOpenMenu((current) => current === "skills" ? null : "skills");
              }}>
                <Wrench size={15} />
                Skills{state.deliveryConfig.skills.length ? ` ${state.deliveryConfig.skills.length}` : ""}
                <ChevronDown size={13} />
              </summary>
              <div className="composer-popover">
                <span className="composer-popover-title">挂载 Skills</span>
                {skillOptions.map((skill) => {
                  const selected = state.deliveryConfig.skills.includes(skill);
                  return (
                    <button
                      type="button"
                      key={skill}
                      className={selected ? "selected" : ""}
                      onClick={() => patchDeliveryConfig({
                        skills: toggleValue(state.deliveryConfig.skills, skill),
                      })}
                    >
                      <span><strong>{skill}</strong></span>
                      {selected && <Check size={14} />}
                    </button>
                  );
                })}
              </div>
            </details>

            <details className="composer-menu" open={openMenu === "mcp"}>
              <summary onClick={(event) => {
                event.preventDefault();
                setOpenMenu((current) => current === "mcp" ? null : "mcp");
              }}>
                <Plug size={15} />
                MCP{state.deliveryConfig.mcpServers.length ? ` ${state.deliveryConfig.mcpServers.length}` : ""}
                <ChevronDown size={13} />
              </summary>
              <div className="composer-popover">
                <span className="composer-popover-title">连接 MCP</span>
                {mcpOptions.map((server) => {
                  const selected = state.deliveryConfig.mcpServers.includes(server);
                  return (
                    <button
                      type="button"
                      key={server}
                      className={selected ? "selected" : ""}
                      onClick={() => patchDeliveryConfig({
                        mcpServers: toggleValue(state.deliveryConfig.mcpServers, server),
                      })}
                    >
                      <span><strong>{server}</strong></span>
                      {selected && <Check size={14} />}
                    </button>
                  );
                })}
              </div>
            </details>

            <button
              className="composer-tool-button workspace"
              type="button"
              onClick={() => {
                setOpenMenu(null);
                onOpenWorkspace();
              }}
            >
              <GitBranch size={15} />
              <span>{workspaceLabel}</span>
            </button>

            <details className="composer-menu composer-settings-menu" open={openMenu === "settings"}>
              <summary
                aria-label="交付设置"
                title="交付设置"
                onClick={(event) => {
                  event.preventDefault();
                  setOpenMenu((current) => current === "settings" ? null : "settings");
                }}
              >
                <Settings2 size={16} />
              </summary>
              <div className="composer-popover composer-settings-popover">
                <span className="composer-popover-title">交付设置</span>
                <label>
                  模型路由策略
                  <select
                    value={state.deliveryConfig.modelPolicy}
                    onChange={(event) => patchDeliveryConfig({
                      modelPolicy: event.target.value as DeliveryConfig["modelPolicy"],
                    })}
                  >
                    <option value="balanced">质量与成本平衡</option>
                    <option value="quality">质量优先</option>
                    <option value="cost">成本优先</option>
                  </select>
                </label>
                <label>
                  自治等级
                  <select
                    value={state.deliveryConfig.autonomy}
                    onChange={(event) => patchDeliveryConfig({
                      autonomy: event.target.value as DeliveryConfig["autonomy"],
                    })}
                  >
                    <option value="fast">极速交付</option>
                    <option value="collaborative">关键决策确认</option>
                    <option value="strict">严格审查</option>
                  </select>
                </label>
                <label>
                  验证范围
                  <select
                    value={state.deliveryConfig.verification}
                    onChange={(event) => patchDeliveryConfig({
                      verification: event.target.value as DeliveryConfig["verification"],
                    })}
                  >
                    <option value="full">完整验证</option>
                    <option value="api-web">API + Web</option>
                    <option value="smoke">冒烟验证</option>
                  </select>
                </label>
                <label className="composer-checkbox">
                  <input
                    type="checkbox"
                    checked={state.deliveryConfig.autoRepair}
                    onChange={(event) => patchDeliveryConfig({ autoRepair: event.target.checked })}
                  />
                  失败后自动修复并复测
                </label>
                <label className="composer-checkbox">
                  <input
                    type="checkbox"
                    checked={state.deliveryConfig.confirmRiskyActions}
                    onChange={(event) => patchDeliveryConfig({
                      confirmRiskyActions: event.target.checked,
                    })}
                  />
                  高风险操作前确认
                </label>
              </div>
            </details>
          </div>

          <button
            className="composer-submit"
            type="button"
            onClick={onStart}
            disabled={!state.intent.trim()}
            aria-label="开始执行"
            title="开始执行"
          >
            <ArrowUp size={18} />
          </button>
        </div>
      </section>

      <section className="delivery-task-panel" aria-label="任务模板">
        <div className="task-panel-heading">
          <div>
            <span className="eyebrow">待办工作</span>
            <h2>从团队任务开始</h2>
          </div>
          <span>选择卡片后会自动注入上下文和推荐配置，可在上方继续调整</span>
        </div>

        <div className="task-panel-tabs" role="tablist" aria-label="任务类型">
          {taskTabs.map(({ value, label, icon: Icon }) => (
            <button
              type="button"
              role="tab"
              aria-selected={activeTaskTab === value}
              key={value}
              className={activeTaskTab === value ? "active" : ""}
              onClick={() => setActiveTaskTab(value)}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        <div className="task-template-grid" role="tabpanel">
          {activeTaskTab === "review"
            ? reviewTemplates.map((template) => (
                <button
                  className="task-template-card"
                  type="button"
                  key={template.id}
                  onClick={() => injectTask(`${template.title}：${template.summary}`, null)}
                >
                  <div className="task-template-icon review"><SearchCode size={16} /></div>
                  <div className="task-template-content">
                    <strong>{template.title}</strong>
                    <p>{template.summary}</p>
                    <span>{template.source}</span>
                  </div>
                  <ArrowUp className="task-template-inject" size={15} />
                </button>
              ))
            : visibleTaskCards.map((card, index) => (
                <button
                  className="task-template-card"
                  type="button"
                  key={`${card.category}-${card.id}-${index}`}
                  onClick={() => injectTask(`${card.title}：${card.summary}`, card)}
                >
                  <div className={`task-template-icon ${activeTaskTab}`}>
                    {activeTaskTab === "story"
                      ? <Sparkles size={16} />
                      : activeTaskTab === "defect"
                        ? <Bug size={16} />
                        : <MonitorCog size={16} />}
                  </div>
                  <div className="task-template-content">
                    <strong>{stripTaskTag(card.title)}</strong>
                    <p>{card.summary}</p>
                    <span>{card.source} · {priorityLabel(card.priority)}优先级</span>
                  </div>
                  <ArrowUp className="task-template-inject" size={15} />
                </button>
              ))}
        </div>
      </section>
    </div>
  );
}
