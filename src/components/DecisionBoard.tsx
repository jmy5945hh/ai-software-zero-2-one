import { useState, useRef, useEffect } from "react";
import {
  Bot,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Loader2,
  Wrench,
  Globe,
  Puzzle,
  Users,
  Terminal,
  ArrowRight,
  Eye,
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
import type { SessionState, ToolCallCategory, ToolCallRecord, Turn } from "../agent/types";
import {
  IntentDecision,
  ScopeDecision,
  SpecDecision,
  BuildDecision,
  QualityDecision,
  VerifyDecision,
  ReleaseDecision,
} from "./StageDecisions";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { TokenUsageBadge } from "./TokenUsageBadge";

type BoardTab = "delivery" | "trajectory";

type DecisionBoardProps = {
  state: AppState;
  onPatch: (patch: Partial<AppState>) => void;
  onContinue: () => void;
  onPreview: (content: DrawerContent) => void;
  agentSessions: Record<string, SessionState>;
  agentSteer: (step: string, text: string) => void;
  agentPrompt: (step: string, text: string) => Promise<void>;
  isAgentConnected: boolean;
};

export function DecisionBoard({
  state,
  onPatch,
  onContinue,
  onPreview,
  agentSessions,
  agentSteer,
  agentPrompt,
  isAgentConnected,
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
            agentSession={agentSessions[step.id]}
            isAgentConnected={isAgentConnected}
          />
        )}
        {activeTab === "trajectory" && (
          <TrajectoryChatTab
            trajectory={content.trajectory}
            stepIndex={state.stepIndex}
            stepId={step.id}
            agentSteer={agentSteer}
            agentPrompt={agentPrompt}
            agentSession={agentSessions[step.id]}
            isAgentConnected={isAgentConnected}
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
  agentSession,
  isAgentConnected,
}: {
  content: StageContent;
  state: AppState;
  onPatch: (patch: Partial<AppState>) => void;
  onContinue: () => void;
  onPreview: (content: DrawerContent) => void;
  onSwitchToTrajectory: () => void;
  agentSession?: SessionState;
  isAgentConnected: boolean;
}) {
  // Agent 是否已完成本轮工作
  const agentCompleted = isAgentConnected && agentSession?.completed && !agentSession?.isStreaming;
  const agentWorking = isAgentConnected && agentSession && !agentCompleted;

  return (
    <div className="tab-panel panel-delivery">
      {/* Agent 工作中：显示提示 */}
      {agentWorking && (
        <div className="delivery-working-notice">
          <div className="working-notice-icon">
            <Loader2 size={22} className="spin-icon" />
          </div>
          <div className="working-notice-body">
            <strong>DevAgent 全力以赴工作中...</strong>
            <button
              className="working-notice-link"
              type="button"
              onClick={onSwitchToTrajectory}
            >
              <Eye size={13} />
              <span>点此查看实时状态</span>
              <ArrowRight size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Agent 已完成：展示交付内容 */}
      {!agentWorking && (
        <>
          <div className="delivery-summary">
            <p>
              {isAgentConnected && agentSession ? (
                <>
                  {agentSession.streamingText || (
                    agentSession.messages
                      .filter((m) => m.role === "assistant")
                      .slice(-1)
                      .map((m) => m.content)
                      .join("")
                  ) || content.summary}
                </>
              ) : (
                <StreamText text={content.summary} speed={18} />
              )}
            </p>
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
        </>
      )}
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

// ── Tab 2: AI 任务轨迹（按轮次展示） ──────────
function TrajectoryChatTab({
  trajectory,
  stepIndex,
  stepId,
  agentSteer,
  agentPrompt,
  agentSession,
  isAgentConnected,
}: {
  trajectory: TrajectoryTurn[];
  stepIndex: number;
  stepId: string;
  agentSteer: (step: string, text: string) => void;
  agentPrompt: (step: string, text: string) => Promise<void>;
  agentSession?: SessionState;
  isAgentConnected: boolean;
}) {
  const [input, setInput] = useState("");
  const [selectedToolCall, setSelectedToolCall] = useState<ToolCallRecord | null>(null);
  const [rightTab, setRightTab] = useState<"io" | "diff" | "preview" | "dashboard">("io");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  });

  // 构建展示用的轮次列表
  const displayTurns = buildDisplayTurns(agentSession, trajectory, isAgentConnected);

  // 从所有轮次中收集事件时间线（扁平化）
  const timeline = useTimeline(displayTurns, isAgentConnected, agentSession);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    if (isAgentConnected) {
      agentSteer(stepId, text);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 点击工具调用 → 右侧展示详情
  const handleSelectTool = (tc: ToolCallRecord) => {
    setSelectedToolCall(tc);
    setRightTab("io");
  };

  // 点击 Diff 事件 → 右侧展示 Diff
  const handleSelectDiff = (tc: ToolCallRecord) => {
    setSelectedToolCall(tc);
    setRightTab("diff");
  };

  // 点击文本消息 → 右侧展示预览
  const handleSelectPreview = (text: string) => {
    // use a virtual tool call to hold text content
    setSelectedToolCall({
      id: "msg-preview",
      name: "消息",
      status: "done",
      category: "unknown",
      outputFragments: [text],
    });
    setRightTab("preview");
  };

  // 是否显示右侧面板
  const showRightPanel = selectedToolCall !== null;

  return (
    <div className="tab-panel panel-trajectory-v2">
      {/* ── 中间：事件流 ──────────────────── */}
      <div className={`trajectory-stream ${showRightPanel ? "has-panel" : ""}`}>
        {/* 信息条 */}
        {displayTurns.length > 0 && (
          <div className="trajectory-infobar">
            <TokenUsageBadge usage={null} />
            <span className="trajectory-turn-summary">
              {agentSession?.turns.length || displayTurns.length} 轮对话
            </span>
          </div>
        )}

        <div className="trajectory-rounds">
          {displayTurns.length === 0 && !isAgentConnected && (
            <div className="trajectory-empty">
              <Bot size={24} />
              <p>连接 Agent 后将在此展示实时工作轨迹</p>
            </div>
          )}
          {displayTurns.length === 0 && isAgentConnected && (
            <div className="trajectory-waiting">
              <Loader2 size={20} className="spin-icon" />
              <p>等待 Agent 开始工作...</p>
            </div>
          )}

          {/* 按事件时间线渲染 */}
          {timeline.map((event, ei) => (
            <TimelineEvent
              key={event.id}
              event={event}
              index={ei}
              onSelectTool={handleSelectTool}
              onSelectDiff={handleSelectDiff}
              onSelectPreview={handleSelectPreview}
            />
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

      {/* ── 右侧：详情面板 ────────────────── */}
      {showRightPanel && (
        <TrajectoryDetailPanel
          selected={selectedToolCall}
          tab={rightTab}
          onTabChange={setRightTab}
          onClose={() => setSelectedToolCall(null)}
          turnCount={displayTurns.length}
        />
      )}
    </div>
  );
}

// ── 构建展示轮次 ────────────────────────────
function buildDisplayTurns(
  agentSession: SessionState | undefined,
  staticTrajectory: TrajectoryTurn[],
  isAgentConnected: boolean,
): Turn[] {
  // Agent 模式：使用实际轮次
  if (isAgentConnected && agentSession?.turns && agentSession.turns.length > 0) {
    return agentSession.turns;
  }

  // 无 agent 连接或不活动时，显示静态轨迹（仅用于展示概念）
  if (!isAgentConnected) {
    return staticTrajectory.map((t) => ({
      id: t.id,
      index: staticTrajectory.indexOf(t),
      status: "done" as const,
      textContent: t.action + (t.output ? `\n→ ${t.output}` : ""),
      thinking: "",
      toolCalls: [],
    }));
  }

  return [];
}

// ── 工具参数提取 ───────────────────────────

/** 从工具调用的 JSON 参数中提取人类可读的关键信息 */
function extractToolArgsSummary(input: string, toolName: string): string {
  try {
    const args = JSON.parse(input);
    const name = toolName.toLowerCase();
    // 文件操作类：显示路径
    if (["read", "write", "edit", "find", "grep", "ls", "bash", "glob"].includes(name)) {
      if (args.path) return args.path as string;
      if (args.command) return (args.command as string).slice(0, 80);
      if (args.pattern) return (args.pattern as string).slice(0, 80);
      if (args.dir) return args.dir as string;
    }
    // web 类
    if (["web_search", "web_fetch"].includes(name)) {
      if (args.query) return `查询: ${(args.query as string).slice(0, 60)}`;
      if (args.url) return (args.url as string).slice(0, 60);
    }
    // 子代理类
    if (["fork", "subagent"].includes(name)) {
      if (args.task) return `任务: ${(args.task as string).slice(0, 60)}`;
    }
    // 通用：取第一个字符串值
    const firstStr = Object.values(args).find((v) => typeof v === "string") as string | undefined;
    if (firstStr) return firstStr.slice(0, 80);
    // 否则显示键值对
    const entries = Object.entries(args).slice(0, 2);
    return entries.map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(", ").slice(0, 80);
  } catch {
    return input.slice(0, 80);
  }
}

/** 检测内容是否需要折叠（超过阈值行数） */
function shouldCollapseOutput(text: string, maxLines = 8): boolean {
  return text.split("\n").length > maxLines;
}

// ── 构建事件时间线 ─────────────────────────
type TimelineEvent =
  | { type: "user"; id: string; content: string }
  | { type: "thought"; id: string; content: string; status: "running" | "done" }
  | { type: "message"; id: string; content: string; status: "running" | "done" }
  | { type: "tool"; id: string; toolCall: ToolCallRecord }
  | { type: "diff"; id: string; toolCall: ToolCallRecord; file: string; additions: number; deletions: number }
  | { type: "complete"; id: string; summary: string }
  | { type: "error"; id: string; message: string }
  | { type: "round-divider"; id: string; roundIndex: number; status: "running" | "done" };

function useTimeline(
  turns: Turn[],
  isAgentConnected: boolean,
  agentSession?: SessionState,
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // 用户消息从 session.messages 中提取
  const userMessages = agentSession?.messages.filter((m) => m.role === "user") || [];
  let userMsgIdx = 0;

  for (let ri = 0; ri < turns.length; ri++) {
    const turn = turns[ri];

    // 在每个轮次前插入用户消息（如果有的话）
    if (userMsgIdx < userMessages.length) {
      events.push({
        type: "user",
        id: `user-${ri}`,
        content: userMessages[userMsgIdx].content,
      });
      userMsgIdx++;
    }

    // 轮次分隔线
    events.push({
      type: "round-divider",
      id: `div-${turn.id}`,
      roundIndex: ri + 1,
      status: turn.status,
    });

    // Thinking
    if (turn.thinking) {
      events.push({
        type: "thought",
        id: `thought-${turn.id}`,
        content: turn.thinking,
        status: turn.status === "running" && !turn.textContent ? "running" : "done",
      });
    }

    // 工具调用（扁平每个调用为独立事件）
    for (const tc of turn.toolCalls) {
      const output = tc.outputFragments.join("");
      if (isDiffContent(output) && tc.status === "done") {
        const summary = parseDiffSummary(output);
        const addMatch = summary.match(/\+(\d+)/);
        const delMatch = summary.match(/-(\d+)/);
        const fileMatch = summary.match(/^(.+?)·/);
        events.push({
          type: "diff",
          id: `diff-${tc.id}`,
          toolCall: tc,
          file: fileMatch ? fileMatch[1].trim() : tc.name,
          additions: addMatch ? parseInt(addMatch[1]) : 0,
          deletions: delMatch ? parseInt(delMatch[1]) : 0,
        });
      } else {
        events.push({
          type: "tool",
          id: `tool-${tc.id}`,
          toolCall: tc,
        });
      }
    }

    // 文本输出
    if (turn.textContent) {
      events.push({
        type: "message",
        id: `msg-${turn.id}`,
        content: turn.textContent,
        status: turn.status === "running" ? "running" : "done",
      });
    }
  }

  // 剩余的用户消息（如 steer 消息）
  while (userMsgIdx < userMessages.length) {
    events.push({
      type: "user",
      id: `user-extra-${userMsgIdx}`,
      content: userMessages[userMsgIdx].content,
    });
    userMsgIdx++;
  }

  // 如果 agent 正在 streaming 但轮次里没有 textContent 也没有 turn
  if (isAgentConnected && agentSession?.isStreaming && agentSession.streamingText && turns.length === 0) {
    events.push({
      type: "round-divider",
      id: "div-streaming",
      roundIndex: 1,
      status: "running",
    });
    events.push({
      type: "message",
      id: "msg-streaming",
      content: agentSession.streamingText,
      status: "running",
    });
  }

  // Agent 完成后添加完成事件
  if (isAgentConnected && agentSession?.completed && !agentSession?.isStreaming) {
    const summary = agentSession.summary || agentSession.messages
      .filter((m) => m.role === "assistant")
      .slice(-1)[0]?.content || "";
    if (summary) {
      events.push({
        type: "complete",
        id: "complete",
        summary: summary.slice(0, 500),
      });
    }
  }

  // Agent 出错时添加错误事件
  if (isAgentConnected && agentSession?.error) {
    events.push({
      type: "error",
      id: "error",
      message: agentSession.error,
    });
  }

  return events;
}

// ── 单条事件渲染 ───────────────────────────
function TimelineEvent({
  event,
  index,
  onSelectTool,
  onSelectDiff,
  onSelectPreview,
}: {
  event: TimelineEvent;
  index: number;
  onSelectTool: (tc: ToolCallRecord) => void;
  onSelectDiff: (tc: ToolCallRecord) => void;
  onSelectPreview: (text: string) => void;
}) {
  switch (event.type) {
    case "user":
      return (
        <div className="timeline-user">
          <div className="tl-user-bubble">
            <p>{event.content}</p>
          </div>
          <div className="tl-user-avatar">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
        </div>
      );

    case "round-divider":
      return (
        <div className={`timeline-round-divider ${event.status === "running" ? "running" : ""}`}>
          <div className="trd-index">
            {event.status === "running" ? (
              <Loader2 size={12} className="spin-icon" />
            ) : (
              <span>{event.roundIndex}</span>
            )}
          </div>
          <span className="trd-label">
            Round {event.roundIndex}
            {event.status === "running" ? " — 进行中" : ""}
          </span>
        </div>
      );

    case "thought":
      return (
        <div className={`timeline-thought ${event.status === "running" ? "streaming" : ""}`}>
          <div className="tl-thought-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a6 6 0 0 0-6 6c0 3.3 2.7 6 6 6a5.93 5.93 0 0 0 3-5 6 6 0 0 0-3-7Z" />
              <path d="M12 14a4 4 0 0 0-4 4v2h8v-2a4 4 0 0 0-4-4Z" />
            </svg>
          </div>
          <div className="tl-thought-text">
            <span className={event.status === "running" ? "typing-cursor" : ""}>
              {event.content.slice(-500)}
            </span>
          </div>
        </div>
      );

    case "message":
      return (
        <div className="timeline-message cursor-pointer" onClick={() => onSelectPreview(event.content)}>
          <MarkdownRenderer className="tl-message-content">
            {event.content}
          </MarkdownRenderer>
        </div>
      );

    case "diff": {
      const tc = event.toolCall;
      return (
        <div
          className="timeline-tool done"
          onClick={() => onSelectDiff(tc)}
        >
          <div className="tl-tool-card">
            <span className="tl-tool-icon cat-tool">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            </span>
            <div className="tl-tool-info">
              <div className="tl-tool-meta">
                <span className="tl-tool-cat cat-tool">diff</span>
                <span className="tl-tool-name">{event.file}</span>
              </div>
              <span className="tl-tool-subtitle">
                <span style={{ color: "var(--color-success, #22c55e)" }}>+{event.additions}</span>{" "}
                <span style={{ color: "var(--color-danger, #ef4444)" }}>-{event.deletions}</span>
              </span>
            </div>
            <span className="tl-tool-status done">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </span>
            <span className="tl-tool-chevron">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </span>
          </div>
        </div>
      );
    }

    case "complete":
      return (
        <div className="timeline-complete">
          <div className="tl-complete-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div className="tl-complete-body">
            <strong>任务完成</strong>
            <p>{event.summary}</p>
          </div>
        </div>
      );

    case "error":
      return (
        <div className="timeline-error">
          <div className="tl-error-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          </div>
          <div className="tl-error-body">
            <strong>执行出错</strong>
            <p>{event.message}</p>
          </div>
        </div>
      );

    case "tool": {
      const tc = event.toolCall;
      // 提取工具参数摘要
      const argsSummary = tc.input ? extractToolArgsSummary(tc.input, tc.name) : "";
      // 合并结果文本
      const resultText = tc.result || tc.outputFragments.join("");
      const showResultPreview = tc.status === "done" && resultText.trim();
      const longResult = showResultPreview && shouldCollapseOutput(resultText);

      return (
        <div
          className={`timeline-tool ${tc.status} ${showResultPreview ? "has-result" : ""}`}
          onClick={() => onSelectTool(tc)}
        >
          <div className="tl-tool-card">
            <span className={`tl-tool-icon cat-${tc.category}`}>
              {getToolIconSvg(tc.category)}
            </span>
            <div className="tl-tool-info">
              <div className="tl-tool-meta">
                <span className={`tl-tool-cat cat-${tc.category}`}>{getToolCategoryLabel(tc.category)}</span>
                <span className="tl-tool-name">{tc.name}</span>
              </div>
              {argsSummary && (
                <span className="tl-tool-subtitle">{argsSummary}</span>
              )}
            </div>
            <span className={`tl-tool-status ${tc.status}`}>
              {tc.status === "running" ? (
                <Loader2 size={12} className="spin-icon" />
              ) : tc.status === "done" ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              )}
            </span>
            <span className="tl-tool-chevron">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </span>
          </div>
          {/* 折叠式结果预览 */}
          {showResultPreview && (
            <div className={`tl-tool-result-preview ${longResult ? "collapsed" : ""}`}>
              <pre className="tl-tool-result-pre"><code>{longResult ? resultText.split("\n").slice(0, 8).join("\n") + "\n..." : resultText}</code></pre>
            </div>
          )}
        </div>
      );
    }

    default:
      return null;
  }
}

// ── 右侧详情面板 ───────────────────────────
function TrajectoryDetailPanel({
  selected,
  tab,
  onTabChange,
  onClose,
  turnCount,
}: {
  selected: ToolCallRecord;
  tab: "io" | "diff" | "preview" | "dashboard";
  onTabChange: (t: "io" | "diff" | "preview" | "dashboard") => void;
  onClose: () => void;
  turnCount: number;
}) {
  // 优先使用 result（完整结果），其次合并 outputFragments（流式片段）
  const fullOutput = selected.result || selected.outputFragments.join("");
  const isDiff = isDiffContent(fullOutput);
  const hasInput = !!selected.input;
  const hasOutput = !!fullOutput;

  // 自适应 tab 显示
  const availableTabs: { id: "io" | "diff" | "preview" | "dashboard"; label: string; icon: React.ReactNode }[] = [];
  if (hasInput || hasOutput) {
    availableTabs.push({ id: "io", label: "I/O 数据", icon: <span style={{fontSize:12}}>{"{ }"}</span> });
  }
  if (isDiff) {
    availableTabs.push({ id: "diff", label: "文件变更", icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> });
  }
  if (hasOutput) {
    availableTabs.push({ id: "preview", label: "预览", icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> });
  }

  return (
    <div className="trajectory-detail-panel">
      {/* Tab Bar */}
      <div className="tdp-tabs">
        <div className="tdp-tab-list">
          {availableTabs.map((t) => (
            <button
              key={t.id}
              className={`tdp-tab ${tab === t.id ? "active" : ""}`}
              type="button"
              onClick={() => onTabChange(t.id)}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        <button className="tdp-close-btn" type="button" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {/* Content */}
      <div className="tdp-content">
        {tab === "io" && (
          <div className="tdp-io">
            {selected.input && (
              <div className="tdp-section">
                <h4 className="tdp-section-title">输入参数</h4>
                <pre className="tdp-code-block"><code>{formatJsonOrText(selected.input)}</code></pre>
              </div>
            )}
            <div className="tdp-section">
              <h4 className="tdp-section-title">输出结果</h4>
              <pre className="tdp-code-block"><code>{formatJsonOrText(fullOutput)}</code></pre>
            </div>
          </div>
        )}

        {tab === "diff" && (
          <div className="tdp-diff">
            <div className="tdp-diff-header">
              <span className="tdp-diff-summary">{parseDiffSummary(fullOutput)}</span>
              <span className="tdp-diff-badge">Unified Diff</span>
            </div>
            <div className="tdp-diff-content">
              {parseDiffLines(fullOutput).map((line, li) => (
                <div key={li} className={`diff-line ${line.type}`}>
                  <span className="diff-num">{li + 1}</span>
                  <span className="diff-text">{line.content}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "preview" && (
          <div className="tdp-preview">
            <MarkdownRenderer>
              {fullOutput}
            </MarkdownRenderer>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Diff 检测与解析工具 ────────────────────
function isDiffContent(text: string): boolean {
  if (!text) return false;
  // 检测 unified diff 格式：包含 @@ ... @@ 头部或 +++/--- 前缀
  return /@@\s+-\d+.*@@/.test(text) || /^[-+]{3}\s/.test(text.slice(0, 200));
}

function parseDiffSummary(text: string): string {
  const lines = text.split("\n");
  let adds = 0;
  let dels = 0;
  for (const line of lines) {
    if (line.startsWith("+") && !line.startsWith("+++")) adds++;
    if (line.startsWith("-") && !line.startsWith("---")) dels++;
  }
  // 尝试提取文件名
  const fileMatch = text.match(/^[-+]{3}\s+[ab]\/(.+)$/m);
  const file = fileMatch ? fileMatch[1] : "变更文件";
  return `${file} · +${adds} -${dels}`;
}

type DiffLine = { type: "add" | "del" | "ctx"; content: string };

function parseDiffLines(text: string): DiffLine[] {
  return text.split("\n").map((line) => {
    if (line.startsWith("+") && !line.startsWith("+++")) return { type: "add", content: line };
    if (line.startsWith("-") && !line.startsWith("---")) return { type: "del", content: line };
    return { type: "ctx", content: line };
  });
}

function formatJsonOrText(text: string): string {
  try {
    const parsed = JSON.parse(text);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return text;
  }
}

// ── 工具图标 SVG ───────────────────────────
function getToolIconSvg(category: ToolCallCategory): React.ReactNode {
  switch (category) {
    case "tool":
      return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>;
    case "mcp":
      return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 18l6-6-6-6"/></svg>;
    case "skill":
      return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>;
    case "subagent":
      return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
    default:
      return <Wrench size={14} />;
  }
}

// ── 保留原有 ToolCallGroup 组件（供其他地方使用） ──
function ToolCallGroup({
  toolCalls,
  defaultExpanded = false,
}: {
  toolCalls: ToolCallRecord[];
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const doneCount = toolCalls.filter((tc) => tc.status === "done").length;
  const runningCount = toolCalls.filter((tc) => tc.status === "running").length;
  const hasActive = runningCount > 0;

  // 自动展开：有运行中的工具时
  useEffect(() => {
    if (hasActive) setExpanded(true);
  }, [hasActive]);

  return (
    <div className={`tool-call-group ${expanded ? "expanded" : ""} ${hasActive ? "has-active" : ""}`}>
      <button
        className="tool-call-group-trigger"
        type="button"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="tcg-icon">
          {hasActive ? (
            <Loader2 size={13} className="spin-icon" />
          ) : (
            <Wrench size={13} />
          )}
        </span>
        <span className="tcg-label">
          {toolCalls.length} 个工具调用
          {hasActive && `（${runningCount} 进行中）`}
          {!hasActive && doneCount === toolCalls.length && " · 已完成"}
        </span>
        <span className="tcg-chevron">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>

      {expanded && (
        <div className="tool-call-group-content">
          {toolCalls.map((tc) => (
            <div
              key={tc.id}
              className={`round-tool-call ${tc.status} category-${tc.category}`}
            >
              <span className="rtc-icon">
                {getToolIconSvg(tc.category)}
              </span>
              <span className="rtc-name">{tc.name}</span>
              <span className="rtc-category">{getToolCategoryLabel(tc.category)}</span>
              <span className={`rtc-status ${tc.status}`}>
                {tc.status === "running" ? (
                  <Loader2 size={10} className="spin-icon" />
                ) : tc.status === "done" ? (
                  "✓"
                ) : (
                  "✗"
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 工具类别标签（中文）─────────────────────
function getToolCategoryLabel(category: ToolCallCategory): string {
  switch (category) {
    case "tool": return "工具";
    case "mcp": return "MCP";
    case "skill": return "技能";
    case "subagent": return "SubAgent";
    default: return "调用";
  }
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
