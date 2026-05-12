import { useState } from "react";
import { Bot, Sparkles, ChevronRight, ChevronDown, Activity } from "lucide-react";
import type { DrawerContent, AppState } from "../data/types";
import { StreamText, useStepKey, useStreamingList } from "../hooks";
import { workflow, getContentForStage } from "../data";
import type { StageContentBlock } from "../data/stageContent";
import {
  IntentDecision,
  ScopeDecision,
  SpecDecision,
  BuildDecision,
  QualityDecision,
  VerifyDecision,
  ReleaseDecision,
} from "./StageDecisions";

type DecisionBoardProps = {
  state: AppState;
  onPatch: (patch: Partial<AppState>) => void;
  onContinue: () => void;
  onPreview: (content: DrawerContent) => void;
};

/**
 * 人机协作决策台 —— 主视觉区域。
 * 四层结构：
 * ① AI 工作摘要 / 可视化呈现
 * ② 人类决策操作区
 * ③ AI 补充输入区
 * ④ 可折叠 Chat History
 */
export function DecisionBoard({
  state,
  onPatch,
  onContinue,
  onPreview,
}: DecisionBoardProps) {
  const step = workflow[state.stepIndex];
  const stepKey = useStepKey(state.stepIndex);
  const contentBlocks = getContentForStage(state.stepIndex);
  const [chatExpanded, setChatExpanded] = useState(false);

  const handleBlockClick = (block: StageContentBlock) => {
    if (block.clickable && block.target) {
      onPreview({
        type: block.target.type as DrawerContent extends { type: infer T } ? T : never,
        title: block.target.title,
        content: block.target.content,
        language: block.target.type === "code" ? "yaml" : "markdown",
        html: block.target.type === "html" ? block.target.content : "",
        path: "",
      } as DrawerContent);
    }
  };

  return (
    <section className="decision-board" key={stepKey}>
      <div className="board-stage-header">
        <div>
          <span className="eyebrow">{step.id.toUpperCase()} · AI Native 协作</span>
          <h1>{step.label}</h1>
          <p>{step.detail}</p>
        </div>
        <div className="board-user-role">
          <Sparkles size={16} />
          <div>
            <span>你的角色</span>
            <strong>{step.userRole}</strong>
          </div>
        </div>
      </div>

      {/* ① AI 工作摘要 + 可视化 */}
      <div className="board-layer layer-summary">
        <div className="layer-label">
          <Bot size={14} />
          <span>AI 工作摘要</span>
        </div>
        <SummaryArea blocks={contentBlocks} onBlockClick={handleBlockClick} />
        <VisualArea stepIndex={state.stepIndex} blocks={contentBlocks} onBlockClick={handleBlockClick} />
      </div>

      {/* ② 决策操作区 */}
      <div className="board-layer layer-decision">
        <DecisionArea state={state} onPatch={onPatch} onContinue={onContinue} onPreview={onPreview} />
      </div>

      {/* ③ AI 补充输入区 */}
      <div className="board-layer layer-input">
        <div className="layer-label">
          <Activity size={14} />
          <span>补充说明（可选）</span>
        </div>
        <textarea
          className="board-input"
          value={state.notes}
          onChange={(e) => onPatch({ notes: e.target.value })}
          placeholder={getPlaceholderForStage(state.stepIndex)}
          rows={2}
        />
      </div>

      {/* ④ Chat History（可折叠） */}
      <div className="board-layer layer-chat">
        <button
          className="chat-toggle"
          type="button"
          onClick={() => setChatExpanded(!chatExpanded)}
        >
          {chatExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span>Agent 原始对话记录</span>
          <em>审计底稿</em>
        </button>
        {chatExpanded && (
          <div className="chat-history">
            <div className="chat-message agent">
              <Bot size={14} />
              <div><StreamText text="正在分析你的研发意图...从输入中抽取核心业务对象和角色。" speed={20} /></div>
            </div>
            <div className="chat-message agent">
              <Bot size={14} />
              <div><StreamText text="识别到关键实体：客户、跟进记录、提醒规则、周报。角色：销售、主管。建议MVP模式跑通主流程。" speed={18} /></div>
            </div>
            <div className="chat-message agent">
              <Bot size={14} />
              <div><StreamText text="正在生成可执行 Spec，包括 API 契约、数据模型、权限矩阵..." speed={16} /></div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ── ① AI 摘要区 ─────────────────────────────
function SummaryArea({ blocks, onBlockClick }: { blocks: StageContentBlock[]; onBlockClick: (b: StageContentBlock) => void }) {
  const summaryBlocks = blocks.filter((b) => b.type === "summary" || b.type === "finding");
  return (
    <div className="summary-grid">
      {summaryBlocks.map((block) => (
        <button key={block.id} className={`summary-card ${block.clickable ? "clickable" : ""}`} type="button" onClick={() => onBlockClick(block)}>
          <strong><StreamText text={block.title} speed={30} /></strong>
          <p><StreamText text={block.detail} speed={22} /></p>
          {block.clickable && <span className="summary-hint">点击查看详情 →</span>}
        </button>
      ))}
    </div>
  );
}

// ── ① 可视化区域 ────────────────────────────
function VisualArea({ stepIndex, blocks, onBlockClick }: { stepIndex: number; blocks: StageContentBlock[]; onBlockClick: (b: StageContentBlock) => void }) {
  const visualBlocks = blocks.filter((b) => b.type === "visual" || b.type === "event");
  if (visualBlocks.length === 0) return null;
  return (
    <div className="visual-area">
      <div className="layer-label"><Activity size={14} /><span>实时状态</span></div>
      {stepIndex === 3 && <BuildProgressPanel blocks={visualBlocks} />}
      {stepIndex === 4 && <QualityRadarPanel />}
      {stepIndex !== 3 && stepIndex !== 4 && (
        <div className="event-list">
          {visualBlocks.map((block) => (
            <button key={block.id} className={`event-item ${block.clickable ? "clickable" : ""}`} type="button" onClick={() => onBlockClick(block)}>
              <div className="event-dot" />
              <div>
                <strong><StreamText text={block.title} speed={25} /></strong>
                <span>{block.detail}</span>
              </div>
              {block.clickable && <ChevronRight size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Agent 开发：构建进展看板 ─────────────────
function BuildProgressPanel({ blocks }: { blocks: StageContentBlock[] }) {
  const events = blocks.filter((b) => b.type === "event");
  const taskNames = events.map((e) => e.title);
  const { items: done, allDone } = useStreamingList(taskNames, 900);
  const lastRunning = taskNames.findIndex((t) => !done.includes(t));
  return (
    <div className="build-progress">
      {taskNames.map((name, i) => {
        const isDone = done.includes(name);
        const isRunning = !isDone && (allDone ? false : i === lastRunning);
        return (
          <div key={name} className={`progress-row ${isRunning ? "running" : ""}`}>
            <div className="progress-indicator">
              {isDone ? <span className="indicator-done">✓</span> : isRunning ? <Activity size={14} className="spin-icon" /> : <span className="indicator-queued">○</span>}
            </div>
            <span className="progress-name">{name}</span>
            <span className="progress-status">{isDone ? "Done" : isRunning ? "Running" : "Queued"}</span>
            <div className={`progress-bar ${isRunning ? "animating" : isDone ? "filled" : ""}`}>
              <span style={{ width: isDone ? "100%" : isRunning ? "68%" : "0%" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 质量门禁：雷达图 ────────────────────────
function QualityRadarPanel() {
  const items = [
    { label: "代码检视", value: 100, status: "passed" as const },
    { label: "单元测试", value: 100, status: "passed" as const },
    { label: "API 测试", value: 80, status: "running" as const },
    { label: "UI E2E", value: 0, status: "running" as const },
  ];
  return (
    <div className="quality-radar">
      <div className="radar-grid">
        {items.map((item) => (
          <div key={item.label} className={`radar-item ${item.status}`}>
            <div className="radar-ring">
              <svg viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="32" fill="none" stroke="var(--secondary)" strokeWidth="6" />
                <circle cx="40" cy="40" r="32" fill="none" stroke={item.status === "passed" ? "var(--primary)" : "#C27B66"} strokeWidth="6" strokeDasharray={`${(item.value / 100) * 200} 200`} strokeLinecap="round" transform="rotate(-90 40 40)" />
              </svg>
              <div className="radar-value"><strong>{item.value}%</strong></div>
            </div>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── ② 决策操作区 ────────────────────────────
function DecisionArea({ state, onPatch, onContinue, onPreview }: { state: AppState; onPatch: (p: Partial<AppState>) => void; onContinue: () => void; onPreview: (c: DrawerContent) => void }) {
  const step = workflow[state.stepIndex].id;
  const actions: Record<string, React.ReactNode> = {
    intent: <IntentDecision state={state} onPatch={onPatch} onContinue={onContinue} />,
    scope: <ScopeDecision state={state} onPatch={onPatch} onContinue={onContinue} />,
    spec: <SpecDecision state={state} onPatch={onPatch} onContinue={onContinue} onPreview={onPreview} />,
    build: <BuildDecision onContinue={onContinue} />,
    quality: <QualityDecision state={state} onPatch={onPatch} onContinue={onContinue} onPreview={onPreview} />,
    verify: <VerifyDecision state={state} onPatch={onPatch} onContinue={onContinue} onPreview={onPreview} />,
    release: <ReleaseDecision state={state} onPatch={onPatch} />,
  };
  return <div className="decision-actions">{actions[step] ?? null}</div>;
}

// ── 工具函数 ────────────────────────────────
function getPlaceholderForStage(stepIndex: number): string {
  const prompts = [
    "补充更多业务背景或边界条件...",
    "说明本轮交付的特殊约束...",
    "对 AI 生成的 Spec 有什么修正意见？",
    "对 Agent 进展有什么额外要求？",
    "对质量报告有任何疑问？",
    "补充修复策略或优先级调整...",
    "发布前的最后补充说明...",
  ];
  return prompts[stepIndex] || "";
}
