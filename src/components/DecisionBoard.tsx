import { useState, useRef, useEffect } from "react";
import {
  Bot,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Activity,
  Package,
  MessageSquare,
  Send,
} from "lucide-react";
import type { DrawerContent, AppState } from "../data/types";
import { StreamText, useStepKey } from "../hooks";
import { workflow, getContentForStage } from "../data";
import type {
  StageContent,
  DeliverableCard,
  TrajectoryTurn,
} from "../data/stageContent";
import {
  IntentDecision,
  ScopeDecision,
  SpecDecision,
  BuildDecision,
  QualityDecision,
  VerifyDecision,
  ReleaseDecision,
} from "./StageDecisions";

type BoardTab = "delivery" | "trajectory";

type DecisionBoardProps = {
  state: AppState;
  onPatch: (patch: Partial<AppState>) => void;
  onContinue: () => void;
  onPreview: (content: DrawerContent) => void;
};

export function DecisionBoard({
  state,
  onPatch,
  onContinue,
  onPreview,
}: DecisionBoardProps) {
  const step = workflow[state.stepIndex];
  const stepKey = useStepKey(state.stepIndex);
  const content = getContentForStage(state.stepIndex);
  const [activeTab, setActiveTab] = useState<BoardTab>("delivery");

  return (
    <section className="decision-board" key={stepKey}>
      <div className="board-compact-header">
        <div className="board-header-left">
          <span className="board-step-id">{step.id.toUpperCase()}</span>
          <span className="board-step-label">{step.label}</span>
          <span className="board-step-sep">·</span>
          <span className="board-step-detail">{step.detail}</span>
        </div>
        <div className="board-user-role-compact">
          <Sparkles size={13} />
          <span>{step.userRole}</span>
        </div>
      </div>

      <div className="board-tabs">
        <button
          className={`board-tab ${activeTab === "delivery" ? "active" : ""}`}
          type="button"
          onClick={() => setActiveTab("delivery")}
        >
          <Package size={14} />
          <span>交付 & 协作</span>
        </button>
        <button
          className={`board-tab ${activeTab === "trajectory" ? "active" : ""}`}
          type="button"
          onClick={() => setActiveTab("trajectory")}
        >
          <MessageSquare size={14} />
          <span>任务轨迹</span>
        </button>
      </div>

      <div className="board-tab-panels">
        {activeTab === "delivery" && (
          <DeliveryCollabTab
            content={content}
            state={state}
            onPatch={onPatch}
            onContinue={onContinue}
            onPreview={onPreview}
            onSwitchToTrajectory={() => setActiveTab("trajectory")}
          />
        )}
        {activeTab === "trajectory" && (
          <TrajectoryChatTab
            trajectory={content.trajectory}
            stepIndex={state.stepIndex}
          />
        )}
      </div>
    </section>
  );
}

// ── Tab 1: 交付 & 协作 ──────────────────────
function DeliveryCollabTab({
  content,
  state,
  onPatch,
  onContinue,
  onPreview,
  onSwitchToTrajectory,
}: {
  content: StageContent;
  state: AppState;
  onPatch: (patch: Partial<AppState>) => void;
  onContinue: () => void;
  onPreview: (content: DrawerContent) => void;
  onSwitchToTrajectory: () => void;
}) {
  return (
    <div className="tab-panel panel-delivery">
      <div className="delivery-summary">
        <p><StreamText text={content.summary} speed={18} /></p>
      </div>

      <div className="delivery-cards">
        {content.deliverables.map((card) => (
          <DeliverableCardItem
            key={card.id}
            card={card}
            onPreview={onPreview}
          />
        ))}
      </div>

      <div className="collab-section">
        <DecisionArea
          state={state}
          onPatch={onPatch}
          onContinue={onContinue}
          onPreview={onPreview}
        />

        <div className="collab-input-row">
          <textarea
            className="board-input"
            value={state.notes}
            onChange={(e) => onPatch({ notes: e.target.value })}
            placeholder={getPlaceholderForStage(state.stepIndex)}
            rows={2}
          />
        </div>

        <div className="collab-footer">
          <button
            className="ghost-button switch-trajectory-btn"
            type="button"
            onClick={onSwitchToTrajectory}
          >
            <MessageSquare size={13} />
            <span>对结果不满意？和 AI 继续对话</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 可展开交付卡片 ───────────────────────────
function DeliverableCardItem({
  card,
  onPreview,
}: {
  card: DeliverableCard;
  onPreview: (content: DrawerContent) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = !!card.expandedContent;

  return (
    <div className={`deliverable-card ${hasDetail ? "expandable" : ""} ${expanded ? "expanded" : ""}`}>
      <button
        className="deliverable-card-header"
        type="button"
        onClick={() => hasDetail && setExpanded(!expanded)}
      >
        <div className="deliverable-card-main">
          <span className={`deliverable-tag tag-${getTagVariant(card.tag)}`}>
            {card.tag}
          </span>
          <div className="deliverable-card-text">
            <strong>{card.title}</strong>
            <span>{card.detail}</span>
          </div>
        </div>
        {hasDetail && (
          <span className="deliverable-expand-icon">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        )}
      </button>
      {expanded && card.expandedContent && (
        <div className="deliverable-card-detail">
          <button
            className="ghost-button"
            type="button"
            onClick={() =>
              onPreview({
                type: card.expandedContent!.type as DrawerContent extends { type: infer T } ? T : never,
                title: card.expandedContent!.title,
                content: card.expandedContent!.content,
                language: card.expandedContent!.type === "code" ? "yaml" : "markdown",
                html: card.expandedContent!.type === "html" ? card.expandedContent!.content : "",
                path: "",
              } as DrawerContent)
            }
          >
            在侧栏查看完整内容 →
          </button>
          <pre className="deliverable-code-preview">
            {card.expandedContent.content.slice(0, 300)}
            {card.expandedContent.content.length > 300 ? "…" : ""}
          </pre>
        </div>
      )}
    </div>
  );
}

function getTagVariant(tag?: string): string {
  if (!tag) return "default";
  const map: Record<string, string> = {
    "分析": "analysis", "建议": "suggest", "风险": "risk",
    "契约": "contract", "权限": "permission", "模型": "model",
    "代码": "code", "数据": "data", "测试": "test",
    "文档": "doc", "通过": "pass", "未通过": "fail",
    "修复": "fix", "预览": "preview", "安全": "safe",
  };
  return map[tag] || "default";
}

// ── Tab 2: AI 任务轨迹（Chat 风格） ──────────
function TrajectoryChatTab({
  trajectory,
  stepIndex,
}: {
  trajectory: TrajectoryTurn[];
  stepIndex: number;
}) {
  const [messages, setMessages] = useState<Array<{ id: string; role: "agent" | "user"; content: string; agent?: string }>>(
    trajectory.map((t) => ({
      id: t.id,
      role: "agent" as const,
      content: t.action + (t.output ? `\n\n→ ${t.output}` : ""),
      agent: t.agent,
    })),
  );
  const [input, setInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    const userMsg = {
      id: `user-${Date.now()}`,
      role: "user" as const,
      content: text,
    };
    const aiReply = {
      id: `ai-${Date.now()}`,
      role: "agent" as const,
      content: getAIReply(text, stepIndex),
      agent: "Product Agent",
    };
    setMessages((prev) => [...prev, userMsg, aiReply]);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="tab-panel panel-trajectory">
      <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-bubble ${msg.role}`}>
            {msg.role === "agent" && (
              <div className="chat-bubble-avatar">
                <Bot size={14} />
              </div>
            )}
            <div className="chat-bubble-body">
              {msg.role === "agent" && msg.agent && (
                <span className="chat-bubble-agent">{msg.agent}</span>
              )}
              <p>{msg.content}</p>
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <div className="chat-input-bar">
        <textarea
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息，和 AI 继续对话…"
          rows={1}
        />
        <button
          className="chat-send-btn"
          type="button"
          onClick={handleSend}
          disabled={!input.trim()}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

function getAIReply(userInput: string, stepIndex: number): string {
  const step = workflow[stepIndex]?.id;
  const replies: Record<string, string[]> = {
    intent: [
      "收到，我重新审视了你的需求。核心业务对象不变，但我会调整场景优先级。",
      "明白，让我重新分析意图。你觉得哪个场景是最优先的？",
      "好的，我调整了理解。你提到的边界条件我会纳入考虑。",
    ],
    scope: [
      "收到，我重新评估了模块范围。可以调整依赖关系，先做你关注的部分。",
      "明白，范围可以灵活调整。你想先聚焦哪个模块？",
    ],
    spec: [
      "收到反馈，我会调整 Spec 中对应的定义。请告诉我具体哪些部分需要修改。",
      "好的，我来修正。你觉得 API 契约还是权限模型需要优先调整？",
    ],
    build: [
      "收到，我会调整构建策略。当前进度可以暂停，等你确认后继续。",
      "明白，我来检查当前构建产出的问题。请描述你期望的调整方向。",
    ],
    quality: [
      "收到，我会重新审查质量门禁结果。你想让我优先修复哪个问题？",
      "好的，我来调整质量检查策略。哪些指标你觉得需要重新评估？",
    ],
    verify: [
      "收到，我重新评估修复方案。可以调整修复优先级和范围。",
      "明白，我来调整修复策略。你有更倾向的修复方向吗？",
    ],
    release: [
      "收到，我会调整发布策略。你想修改哪些发布配置？",
      "好的，我来重新评估发布方案。请告诉我你的顾虑。",
    ],
  };
  const pool = replies[step] || replies.intent;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── 决策操作区 ───────────────────────────────
function DecisionArea({
  state,
  onPatch,
  onContinue,
  onPreview,
}: {
  state: AppState;
  onPatch: (p: Partial<AppState>) => void;
  onContinue: () => void;
  onPreview: (c: DrawerContent) => void;
}) {
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
