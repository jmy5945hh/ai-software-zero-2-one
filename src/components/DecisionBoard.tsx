import { useState, useRef, useEffect, useCallback } from "react";
import {
  Bot,
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
  FileText,
  ListChecks,
  FolderOpen,
  CheckCircle2,
  PlusCircle,
  Edit3,
  HelpCircle,
  RotateCcw,
  X,
} from "lucide-react";
import type { DrawerContent, AppState, AgentSummary, KeyPoint, TodoItem, FileChange } from "../data/types";
import { useStepKey } from "../hooks";
import { workflow, getContentForStage } from "../data";
import type {
  TrajectoryTurn,
} from "../data/stageContent";
import type { SessionState, ToolCallCategory, ToolCallRecord, Turn } from "../agent/types";
import { extractFileChanges } from "../agent/useAgent";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { TokenUsageBadge } from "./TokenUsageBadge";
import { ContentModal } from "./ContentModal";
import type { ModalContent } from "./ContentModal";

type BoardTab = "delivery" | "trajectory";

type DecisionBoardProps = {
  state: AppState;
  onPatch: (patch: Partial<AppState>) => void;
  onContinue: () => void;
  onPreview: (content: DrawerContent) => void;
  agentSessions: Record<string, SessionState>;
  agentSteer: (step: string, text: string) => void;
  agentPrompt: (step: string, text: string) => Promise<void>;
  agentAnswerQuestion: (step: string, answer: string) => Promise<void>;
  agentRetry: (step: string, text: string, initialPrompt?: string, worktreePath?: string) => Promise<void>;
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
  agentAnswerQuestion,
  agentRetry,
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
            state={state}
            onPatch={onPatch}
            onContinue={onContinue}
            onPreview={onPreview}
            onSwitchToTrajectory={() => setActiveTab("trajectory")}
            agentSession={agentSessions[step.id]}
            isAgentConnected={isAgentConnected}
            stepId={step.id}
            agentAnswerQuestion={agentAnswerQuestion}
            agentPrompt={agentPrompt}
            agentRetry={agentRetry}
          />
        )}
        {activeTab === "trajectory" && (
          <TrajectoryChatTab
            trajectory={content.trajectory}
            stepIndex={state.stepIndex}
            stepId={step.id}
            agentSteer={agentSteer}
            agentPrompt={agentPrompt}
            agentAnswerQuestion={agentAnswerQuestion}
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
  state,
  onPatch,
  onContinue,
  onPreview,
  onSwitchToTrajectory,
  agentSession,
  isAgentConnected,
  stepId,
  agentAnswerQuestion,
  agentPrompt,
  agentRetry,
}: {
  state: AppState;
  onPatch: (patch: Partial<AppState>) => void;
  onContinue: () => void;
  onPreview: (content: DrawerContent) => void;
  onSwitchToTrajectory: () => void;
  agentSession?: SessionState;
  isAgentConnected: boolean;
  stepId: string;
  agentAnswerQuestion: (step: string, answer: string) => Promise<void>;
  agentPrompt: (step: string, text: string) => Promise<void>;
  agentRetry: (step: string, text: string, initialPrompt?: string, worktreePath?: string) => Promise<void>;
}) {
  const agentCompleted = isAgentConnected && agentSession?.completed && !agentSession?.isStreaming;
  const agentWorking = isAgentConnected && agentSession && !agentCompleted;

  // 结构化总结状态
  const summaryResult = agentSession?.summarizationResult;
  const summaryLoading = agentSession?.summarizationStatus === "loading";
  const summaryError = agentSession?.summarizationStatus === "error";
  const hasSummary = agentSession?.summarizationStatus === "done" && summaryResult;

  // 文件变更（从 session turns 中统计）
  const fileChanges: FileChange[] = agentSession?.turns
    ? extractFileChanges(agentSession.turns)
    : [];

  // 点击文件变更 → 打开右侧抽屉查看详情
  const handleFileClick = useCallback(
    (fc: FileChange) => {
      if (fc.action === "modify" && fc.diffContent) {
        onPreview({
          type: "diff",
          title: fc.path.split("/").pop() || fc.path,
          path: fc.path,
          content: fc.diffContent,
          additions: fc.additions || 0,
          deletions: fc.deletions || 0,
        });
      } else if (fc.action === "create" && fc.diffContent) {
        onPreview({
          type: "code",
          title: fc.path.split("/").pop() || fc.path,
          language: getLanguageFromPath(fc.path),
          content: fc.diffContent,
        });
      }
    },
    [onPreview],
  );

  const currentStep = workflow.find(s => s.id === stepId);

  return (
    <div className="tab-panel panel-delivery">
      {/* 👤 用户协作角色提示 */}
      {currentStep?.userRole && (
        <div className="delivery-user-role-banner">
          <div className="user-role-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <div className="user-role-content">
            <span className="user-role-label">你的协作角色</span>
            <span className="user-role-text">{currentStep.userRole}</span>
          </div>
        </div>
      )}

      {/* Agent 工作中 */}
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

      {/* Agent 已完成：展示真实交付内容 */}
      {!agentWorking && isAgentConnected && agentCompleted && (
        <>
          {/* 总结加载中 */}
          {summaryLoading && (
            <div className="summary-loading">
              <Loader2 size={20} className="spin-icon" />
              <span>正在结构化总结 Agent 产出...</span>
            </div>
          )}

          {/* 总结失败：展示原始 summary（Markdown） */}
          {summaryError && agentSession?.summary && (
            <div className="delivery-summary">
              <div className="summary-section-header">
                <FileText size={15} />
                <span>核心摘要</span>
              </div>
              <MarkdownRenderer>{agentSession.summary}</MarkdownRenderer>
            </div>
          )}

          {/* 总结成功：分板块展示 */}
          {hasSummary && summaryResult && (
            <>
              <SummaryBrief brief={summaryResult.brief} />
              <KeyPointsGrid keyPoints={summaryResult.key_points} />
              <FileChangesList files={fileChanges} onFileClick={handleFileClick} />
              <TodoSection
                todos={summaryResult.todos ?? []}
                todoAnswers={state.todoAnswers}
                onPatch={onPatch}
                stepId={stepId}
                agentPrompt={agentPrompt}
                onContinue={onContinue}
                stepIndex={state.stepIndex}
              />
            </>
          )}

          {/* 无总结结果但有 summary（idle/pending 状态下尚未触发） */}
          {!summaryLoading && !hasSummary && !summaryError && agentSession?.summary && (
            <div className="delivery-summary">
              <MarkdownRenderer>{agentSession.summary}</MarkdownRenderer>
            </div>
          )}

          <div className="collab-section">
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
              <RetryButton
                stepId={stepId}
                agentRetry={agentRetry}
                initialPrompt={state.initialPrompts?.[stepId] || ""}
                worktreePath={state.worktreePaths?.[stepId]}
              />
            </div>
          </div>
        </>
      )}

      {/* 未连接 Agent 时：空白态 */}
      {!isAgentConnected && (
        <div className="delivery-empty">
          <Bot size={24} />
          <p>连接 Agent 后将在此展示交付产出</p>
        </div>
      )}

      {/* 已连接但无当前步骤 session */}
      {isAgentConnected && !agentSession && !agentWorking && (
        <div className="delivery-empty">
          <Bot size={24} />
          <p>请通过任务轨迹创建 Agent 会话来开始本阶段工作</p>
        </div>
      )}
    </div>
  );
}

// ── 摘要卡片 ────────────────────────────────
function SummaryBrief({ brief }: { brief: string }) {
  return (
    <div className="delivery-summary">
      <div className="summary-section-header">
        <FileText size={15} />
        <span>核心摘要</span>
      </div>
      <p>{brief}</p>
    </div>
  );
}

// ── 关键产出要点 ─────────────────────────────
function KeyPointsGrid({ keyPoints }: { keyPoints: KeyPoint[] }) {
  if (keyPoints.length === 0) return null;

  return (
    <div className="summary-section keypoints-section">
      <div className="summary-section-header">
        <ListChecks size={15} />
        <span>关键产出</span>
        <em className="summary-section-count">{keyPoints.length} 项</em>
      </div>
      <div className="keypoints-grid">
        {keyPoints.map((kp, i) => (
          <div key={i} className="keypoint-card">
            <strong className="keypoint-title">{kp.title}</strong>
            <p className="keypoint-summary">{kp.summary}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 文件变更列表 ─────────────────────────────
function FileChangesList({ files, onFileClick }: { files: FileChange[]; onFileClick: (file: FileChange) => void }) {
  if (files.length === 0) return null;

  const totalAdditions = files.reduce((sum, f) => sum + (f.additions || 0), 0);
  const totalDeletions = files.reduce((sum, f) => sum + (f.deletions || 0), 0);

  const actionIcon = (action: FileChange["action"]) => {
    switch (action) {
      case "create": return <PlusCircle size={13} />;
      case "modify": return <Edit3 size={13} />;
      case "delete": return <Edit3 size={13} />;
    }
  };

  const actionLabel = (action: FileChange["action"]) => {
    switch (action) {
      case "create": return "新增";
      case "modify": return "修改";
      case "delete": return "删除";
    }
  };

  const actionClass = (action: FileChange["action"]) => `file-action-${action}`;

  return (
    <div className="summary-section filechanges-section">
      <div className="summary-section-header">
        <FolderOpen size={15} />
        <span>文件变更</span>
        <em className="summary-section-count">{files.length} 项</em>
      </div>

      {/* 汇总行 */}
      <div className="filechanges-summary">
        <span className="filechanges-summary-text">{files.length} 个文件变更</span>
        {totalAdditions > 0 && (
          <span className="filechanges-summary-add">+{totalAdditions}</span>
        )}
        {totalDeletions > 0 && (
          <span className="filechanges-summary-del">-{totalDeletions}</span>
        )}
      </div>

      <div className="filechanges-list">
        {files.map((fc, i) => {
          const hasStats = fc.additions !== undefined && fc.deletions !== undefined;
          const hasContent = !!fc.diffContent;
          const canClick = hasContent && fc.action !== "delete";

          return (
            <div
              key={i}
              className={`filechange-item${canClick ? " clickable" : ""}`}
              onClick={() => canClick && onFileClick(fc)}
              title={canClick ? "点击查看变更详情" : undefined}
            >
              <span className={`filechange-action ${actionClass(fc.action)}`}>
                {actionIcon(fc.action)}
                <span>{actionLabel(fc.action)}</span>
              </span>
              <span className="filechange-path">{fc.path}</span>
              {hasStats && (fc.additions! > 0 || fc.deletions! > 0) && (
                <span className="filechange-stats">
                  {fc.additions! > 0 && <span className="filechange-stat-add">+{fc.additions}</span>}
                  {fc.deletions! > 0 && <span className="filechange-stat-del">-{fc.deletions}</span>}
                </span>
              )}
              {canClick && (
                <span className="filechange-chevron">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 待决策事项 ───────────────────────────────
function TodoSection({
  todos,
  todoAnswers,
  onPatch,
  stepId,
  agentPrompt,
  onContinue,
  stepIndex,
}: {
  todos: TodoItem[];
  todoAnswers: Record<number, string | string[]>;
  onPatch: (patch: Partial<AppState>) => void;
  stepId: string;
  agentPrompt: (step: string, text: string) => Promise<void>;
  onContinue: () => void;
  stepIndex: number;
}) {
  if (todos.length === 0) return null;

  // 检查是否所有待决策项都已作答
  const allAnswered = todos.every((_, ti) => {
    const answer = todoAnswers[ti];
    return answer !== undefined && (typeof answer === "string" ? answer.trim() !== "" : answer.length > 0);
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!allAnswered || submitting) return;
    setSubmitting(true);
    try {
      // 检查是否所有 choice 都选了"进入下一阶段"
      const choiceIndices = todos
        .map((t, i) => (t.type === "choice" ? i : -1))
        .filter((i) => i >= 0);
      const allChoiceAdvance = choiceIndices.length > 0 && choiceIndices.every((ti) => {
        const answer = todoAnswers[ti];
        if (!answer) return false;
        const selected = Array.isArray(answer) ? answer : [answer];
        return selected.some((opt) => opt.includes("进入下一阶段"));
      });

      if (allChoiceAdvance) {
        onContinue();
        return;
      }

      // fill 类型：将输入内容作为提示词发给 Agent 继续对话
      const lines = todos.map((todo, ti) => {
        const answer = todoAnswers[ti];
        const answerText = Array.isArray(answer) ? answer.join("、") : answer;
        return `【${todo.task}】\n回答：${answerText}`;
      });
      const message = `以下是对待决策事项的回答：\n\n${lines.join("\n\n")}`;
      await agentPrompt(stepId, message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="summary-section todo-section">
      <div className="summary-section-header">
        <CheckCircle2 size={15} />
        <span>待决策</span>
        <em className="summary-section-count">{todos.length} 项</em>
      </div>

      <div className="todo-list">
        {todos.map((todo, ti) => (
          <TodoItemCard
            key={ti}
            todo={todo}
            index={ti}
            answer={todoAnswers[ti]}
            onAnswerChange={(answer) => onPatch({ todoAnswers: { ...todoAnswers, [ti]: answer } })}
          />
        ))}
      </div>

      {allAnswered && (
        <div className="todo-submit-row">
          <button
            className="todo-submit-btn"
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <><Loader2 size={14} className="spin-icon" /> 提交中...</>
            ) : (
              <><CheckCircle2 size={14} /> 确认决策，继续推进</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function TodoItemCard({
  todo,
  index,
  answer,
  onAnswerChange,
}: {
  todo: TodoItem;
  index: number;
  answer: string | string[] | undefined;
  onAnswerChange: (answer: string | string[]) => void;
}) {
  const [selectedChoices, setSelectedChoices] = useState<string[]>(
    Array.isArray(answer) ? answer as string[] : answer ? [answer as string] : []
  );
  const [fillValue, setFillValue] = useState(
    typeof answer === "string" && todo.type === "fill" ? answer : ""
  );

  // 当外部 answer 变化时同步本地状态（如切换步骤后重新加载）
  useEffect(() => {
    if (todo.type === "choice") {
      setSelectedChoices(
        Array.isArray(answer) ? answer as string[] : answer ? [answer as string] : []
      );
    } else {
      setFillValue(typeof answer === "string" ? answer : "");
    }
  }, [answer, todo.type]);

  const toggleChoice = (option: string) => {
    if (todo.type === "fill") return;

    let next: string[];
    if (todo.multiSelect) {
      next = selectedChoices.includes(option)
        ? selectedChoices.filter((c) => c !== option)
        : [...selectedChoices, option];
    } else {
      next = selectedChoices.includes(option) ? [] : [option];
    }
    setSelectedChoices(next);
    onAnswerChange(todo.multiSelect ? next : next[0] || "");
  };

  const handleFillBlur = () => {
    onAnswerChange(fillValue);
  };

  const handleFillKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className="todo-card">
      <div className="todo-task-header">
        <span className="todo-index">{index + 1}</span>
        <span className="todo-task-text">{todo.task}</span>
        {todo.type === "choice" && (
          <span className="todo-type-badge">
            {todo.multiSelect ? "多选" : "单选"}
          </span>
        )}
        {todo.type === "fill" && (
          <span className="todo-type-badge fill">填空</span>
        )}
      </div>

      {todo.type === "choice" && todo.choices.length > 0 && (
        <div className="todo-choices">
          {todo.choices.map((choice, ci) => {
            const isSelected = selectedChoices.includes(choice.option);
            return (
              <button
                key={ci}
                className={`todo-choice-btn ${isSelected ? "selected" : ""}`}
                type="button"
                onClick={() => toggleChoice(choice.option)}
              >
                <span className="todo-choice-dot">
                  {isSelected && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  )}
                </span>
                <div className="todo-choice-body">
                  <strong>{choice.option}</strong>
                  {choice.description && <span>{choice.description}</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {todo.type === "fill" && (
        <div className="todo-fill">
          <input
            className="todo-fill-input"
            type="text"
            value={fillValue}
            onChange={(e) => setFillValue(e.target.value)}
            onBlur={handleFillBlur}
            onKeyDown={handleFillKeyDown}
            placeholder={todo.placeholder || "输入你的回答..."}
          />
        </div>
      )}
    </div>
  );
}

// ── 重试按钮 + 提示词输入弹窗 ──────────────
function RetryButton({
  stepId,
  agentRetry,
  initialPrompt,
  worktreePath,
}: {
  stepId: string;
  agentRetry: (step: string, text: string, initialPrompt?: string, worktreePath?: string) => Promise<void>;
  initialPrompt: string;
  worktreePath?: string;
}) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [retrying, setRetrying] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 打开时自动聚焦
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const handleRetry = async () => {
    if (!prompt.trim() || retrying) return;
    setRetrying(true);
    try {
      await agentRetry(stepId, prompt.trim(), initialPrompt, worktreePath);
      setOpen(false);
      setPrompt("");
    } finally {
      setRetrying(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleRetry();
    }
  };

  return (
    <>
      <button
        className="ghost-button retry-btn"
        type="button"
        onClick={() => setOpen(true)}
        title="传入新的提示词，重试整个 Agent 流程"
      >
        <RotateCcw size={13} />
        <span>重试</span>
      </button>

      {open && (
        <div className="retry-overlay" onClick={() => setOpen(false)}>
          <div className="retry-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="retry-dialog-header">
              <RotateCcw size={15} />
              <span>重试 Agent 流程</span>
              <button
                className="retry-dialog-close"
                type="button"
                onClick={() => setOpen(false)}
              >
                <X size={14} />
              </button>
            </div>
            <div className="retry-dialog-body">
              <p className="retry-dialog-hint">
                输入的提示词将<strong>替换</strong>当前步骤的系统提示词，Agent 将以此作为全新指令重新开始工作。
              </p>
              <textarea
                ref={inputRef}
                className="retry-dialog-input"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入新的系统提示词，描述你希望 Agent 如何重新执行..."
                rows={4}
                disabled={retrying}
              />
            </div>
            <div className="retry-dialog-footer">
              <button
                className="ghost-button"
                type="button"
                onClick={() => setOpen(false)}
                disabled={retrying}
              >
                取消
              </button>
              <button
                className="retry-dialog-submit"
                type="button"
                onClick={handleRetry}
                disabled={!prompt.trim() || retrying}
              >
                {retrying ? (
                  <><Loader2 size={14} className="spin-icon" /> 重试中...</>
                ) : (
                  <><RotateCcw size={14} /> 开始重试</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Tab 2: AI 任务轨迹（单栏·固定高度轮次） ──
function TrajectoryChatTab({
  trajectory,
  stepIndex,
  stepId,
  agentSteer,
  agentPrompt,
  agentAnswerQuestion,
  agentSession,
  isAgentConnected,
}: {
  trajectory: TrajectoryTurn[];
  stepIndex: number;
  stepId: string;
  agentSteer: (step: string, text: string) => void;
  agentPrompt: (step: string, text: string) => Promise<void>;
  agentAnswerQuestion: (step: string, answer: string) => Promise<void>;
  agentSession?: SessionState;
  isAgentConnected: boolean;
}) {
  const [input, setInput] = useState("");
  const [expandedRoundIds, setExpandedRoundIds] = useState<Set<string>>(new Set());
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [modalContent, setModalContent] = useState<ModalContent | null>(null);
  // final round 在最后一轮完成时自动展开
  const lastExpandedRef = useRef<string | null>(null);

  // 构建展示用的轮次列表
  const displayTurns = buildDisplayTurns(agentSession, trajectory, isAgentConnected);

  // 从所有轮次中收集事件时间线（扁平化）
  const timeline = useTimeline(displayTurns, isAgentConnected, agentSession);

  // 将事件按轮次分组
  const roundGroups = useRoundGroups(timeline);

  // 最后一轮 running 时自动展开，完成后自动折叠
  useEffect(() => {
    if (roundGroups.length > 0) {
      const lastGroup = roundGroups[roundGroups.length - 1];
      if (lastGroup.status === "running" && lastGroup.id !== lastExpandedRef.current) {
        setExpandedRoundIds((prev) => new Set([...prev, lastGroup.id]));
        lastExpandedRef.current = lastGroup.id;
      } else if (lastGroup.status === "done" && lastGroup.id === lastExpandedRef.current) {
        // 完成后保持展开，不自动折叠
      }
    }
  }, [roundGroups]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    if (!isAgentConnected) {
      return; // 不清空输入，让用户知道未连接
    }
    setInput("");
    agentSteer(stepId, text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 切换轮次展开/折叠
  const toggleRound = (roundId: string) => {
    setExpandedRoundIds((prev) => {
      const next = new Set(prev);
      if (next.has(roundId)) {
        next.delete(roundId);
      } else {
        next.add(roundId);
      }
      return next;
    });
  };

  // 打开弹窗
  const openModal = (mc: ModalContent) => setModalContent(mc);
  const closeModal = () => setModalContent(null);

  return (
    <div className="tab-panel panel-trajectory-v2">
      <div className="trajectory-stream">
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

          {/* 按轮次分组渲染 */}
          {roundGroups.map((group) => {
            const isExpanded = expandedRoundIds.has(group.id);
            const reasoningPreview = getReasoningPreview(group.events);
            return (
            <div
              key={group.id}
              className={`trajectory-round-group ${group.status === "running" ? "running" : ""} ${isExpanded ? "expanded" : "collapsed"}`}
            >
              {/* 轮次头部 */}
              <div className="round-group-header" onClick={() => toggleRound(group.id)}>
                <div className="round-group-index">
                  {group.status === "running" ? (
                    <Loader2 size={12} className="spin-icon" />
                  ) : (
                    <span>{group.index}</span>
                  )}
                </div>
                <div className="round-group-title-area">
                  <span className="round-group-label">
                    Round {group.index}
                    {group.status === "running" ? " — 进行中" : ""}
                  </span>
                  {!isExpanded && reasoningPreview && (
                    <span className="round-group-preview">{reasoningPreview}</span>
                  )}
                </div>
                <div className="round-group-header-right">
                  {group.toolCount > 0 && (
                    <span className="round-group-badge">
                      <Wrench size={10} />
                      {group.toolCount} 工具
                    </span>
                  )}
                  <span className={`round-group-chevron ${isExpanded ? "open" : ""}`}>
                    <ChevronRight size={16} />
                  </span>
                </div>
              </div>

              {/* 轮次内部：可滚动 */}
              {isExpanded && (
              <div className="round-group-body">
                {group.events.map((event) => (
                  <TimelineEventV2
                    key={event.id}
                    event={event}
                    stepId={stepId}
                    agentAnswerQuestion={agentAnswerQuestion}
                    isExpanded={event.type === "tool" || event.type === "diff"}
                    onToggleExpand={() => {}}
                    onOpenModal={openModal}
                  />
                ))}
              </div>
              )}
            </div>
          );})}

          {/* 独立事件（完成/错误） */}
          {timeline
            .filter((e) => e.type === "complete" || e.type === "error")
            .length > 0 && (
            <div className="trajectory-post-events">
              {timeline
                .filter((e) => e.type === "complete" || e.type === "error")
                .map((event) => (
                  <TimelineEventV2
                    key={event.id}
                    event={event}
                    isExpanded={expandedPostId === event.id}
                    onToggleExpand={() =>
                      setExpandedPostId((prev) =>
                        prev === event.id ? null : event.id,
                      )
                    }
                    onOpenModal={openModal}
                  />
                ))}
            </div>
          )}

        </div>

        {/* 对话输入框：固定在任务轨迹区域底部 */}
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

      {/* 内容弹窗 */}
      <ContentModal content={modalContent} onClose={closeModal} />
    </div>
  );
}

/** 从轮次事件中提取决策内容预览（一行截断） */
function getReasoningPreview(events: TimelineEvent[]): string {
  // 优先取 message（Agent 决策输出）
  for (const e of events) {
    if (e.type === "message" && e.content) {
      const firstLine = e.content.split("\n")[0].trim();
      if (firstLine) return firstLine.slice(0, 120);
    }
  }
  // 回退取 thought（推理过程）
  for (const e of events) {
    if (e.type === "thought" && e.content) {
      const firstLine = e.content.split("\n")[0].trim();
      if (firstLine) return firstLine.slice(0, 120);
    }
  }
  return "";
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
        summary,
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

// ── 轮次分组 ───────────────────────────────
type RoundGroup = {
  id: string;
  index: number;
  status: "running" | "done";
  events: TimelineEvent[];
  toolCount: number;
};

function useRoundGroups(timeline: TimelineEvent[]): RoundGroup[] {
  // 找到所有 round-divider 的位置
  const dividerPositions: { pos: number; event: Extract<TimelineEvent, { type: "round-divider" }> }[] = [];
  for (let i = 0; i < timeline.length; i++) {
    if (timeline[i].type === "round-divider") {
      dividerPositions.push({ pos: i, event: timeline[i] as unknown as Extract<TimelineEvent, { type: "round-divider" }> });
    }
  }

  if (dividerPositions.length === 0) return [];

  const groups: RoundGroup[] = [];

  for (let gi = 0; gi < dividerPositions.length; gi++) {
    const { pos, event: divider } = dividerPositions[gi];
    const nextPos = gi < dividerPositions.length - 1 ? dividerPositions[gi + 1].pos : timeline.length;

    // 取从该 divider 到下一个 divider 之间的所有事件
    const allEvents = timeline.slice(pos, nextPos);

    // 过滤掉 complete、error 和 round-divider（它们由头部或外部渲染）
    const events = allEvents.filter(
      (e) => e.type !== "complete" && e.type !== "error" && e.type !== "round-divider",
    );

    const toolCount = events.filter((e) => e.type === "tool" || e.type === "diff").length;

    groups.push({
      id: `group-${divider.roundIndex}`,
      index: divider.roundIndex,
      status: divider.status,
      events,
      toolCount,
    });
  }

  return groups;
}

// ── ask_user_question 卡片 ─────────────────
function AskUserQuestionCard({
  toolCall: tc,
  stepId,
  agentAnswerQuestion,
  isExpanded,
  onToggleExpand,
  onOpenModal,
}: {
  toolCall: ToolCallRecord;
  stepId?: string;
  agentAnswerQuestion?: (step: string, answer: string) => Promise<void>;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onOpenModal: (mc: ModalContent) => void;
}) {
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 从 input 中解析 question 字段
  let question = "";
  try {
    const parsed = JSON.parse(tc.input);
    question = parsed.question || tc.input;
  } catch {
    question = tc.input;
  }

  // 如果已有 result（已回答过），显示结果
  const alreadyAnswered = tc.status === "done" && tc.result;

  const handleSubmit = async () => {
    if (!answer.trim() || !stepId || !agentAnswerQuestion) return;
    setSubmitting(true);
    try {
      await agentAnswerQuestion(stepId, answer.trim());
      setSubmitted(true);
    } catch {
      // 错误由 ws 层处理
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className={`timeline-tool ${tc.status} ${isExpanded ? "expanded" : ""} ask-question-tool`}>
      <div className="tl-tool-card" onClick={onToggleExpand}>
        <span className="tl-tool-icon cat-tool">
          <HelpCircle size={14} />
        </span>
        <div className="tl-tool-info">
          <div className="tl-tool-meta">
            <span className="tl-tool-cat cat-tool">工具</span>
            <span className="tl-tool-name">向您提问</span>
          </div>
          <span className="tl-tool-subtitle">
            {alreadyAnswered ? "已回答" : "等待您的回答"}
          </span>
        </div>
        <span className={`tl-tool-status ${tc.status}`}>
          {submitted ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          ) : tc.status === "running" ? (
            <Loader2 size={12} className="spin-icon" />
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          )}
        </span>
        <span className={`tl-tool-chevron ${isExpanded ? "open" : ""}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </span>
      </div>

      {isExpanded && (
        <div className="tl-tool-expand">
          <div className="tl-tool-expand-section ask-question-body">
            <div className="tl-tool-expand-title">
              <HelpCircle size={12} />
              <span>问题</span>
            </div>
            <div className="ask-question-text">{question}</div>

            {alreadyAnswered ? (
              <div className="ask-question-answered">
                <div className="ask-question-answer-label">您的回答：</div>
                <div className="ask-question-answer-value">{tc.result}</div>
              </div>
            ) : (
              <div className="ask-question-input-area">
                <textarea
                  ref={inputRef}
                  className="ask-question-textarea"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入您的回答..."
                  rows={3}
                  disabled={submitting}
                />
                <button
                  className="ask-question-submit"
                  type="button"
                  onClick={handleSubmit}
                  disabled={!answer.trim() || submitting}
                >
                  {submitting ? (
                    <Loader2 size={14} className="spin-icon" />
                  ) : (
                    <Send size={14} />
                  )}
                  <span>提交回答</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 单条事件渲染（V2：支持内联展开 + 弹窗）─
function TimelineEventV2({
  event,
  stepId,
  agentAnswerQuestion,
  isExpanded,
  onToggleExpand,
  onOpenModal,
}: {
  event: TimelineEvent;
  stepId?: string;
  agentAnswerQuestion?: (step: string, answer: string) => Promise<void>;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onOpenModal: (mc: ModalContent) => void;
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
      return null; // round-divider 已抽取到轮次头部

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
        <div className="timeline-message">
          <div className="tl-message-content">
            <MarkdownRenderer>
              {event.content}
            </MarkdownRenderer>
          </div>
          {/* 弹窗按钮 */}
          <div className="tl-event-actions">
            <button
              className="ghost-button small"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenModal({
                  type: "markdown",
                  title: "Agent 输出",
                  content: event.content,
                });
              }}
            >
              弹窗查看
            </button>
          </div>
        </div>
      );

    case "diff": {
      const tc = event.toolCall;
      const resultText = tc.result || tc.outputFragments.join("");

      return (
        <div className={`timeline-tool done ${isExpanded ? "expanded" : ""}`}>
          <div className="tl-tool-card" onClick={onToggleExpand}>
            <span className="tl-tool-icon cat-tool">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            </span>
            <div className="tl-tool-info">
              <div className="tl-tool-meta">
                <span className="tl-tool-cat cat-tool">diff</span>
                <span className="tl-tool-name">{event.file}</span>
              </div>
              <span className="tl-tool-subtitle">
                <span style={{ color: "#2D6A4F" }}>+{event.additions}</span>{" "}
                <span style={{ color: "#A05A4A" }}>-{event.deletions}</span>
              </span>
            </div>
            <span className="tl-tool-status done">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </span>
            <span className={`tl-tool-chevron ${isExpanded ? "open" : ""}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </span>
          </div>

          {/* 内联展开：Diff 内容 */}
          {isExpanded && (
            <div className="tl-tool-expand">
              <div className="tl-tool-expand-section">
                <div className="tl-tool-expand-title">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <span>文件变更 · {parseDiffSummary(resultText)}</span>
                </div>
                <div className="tl-tool-expand-pre">
                  {parseDiffLines(resultText).slice(0, 40).map((line, li) => (
                    <div key={li} className={`cm-diff-line ${line.type}`}>
                      <span className="cm-diff-num">{li + 1}</span>
                      <span className="cm-diff-text">{line.content}</span>
                    </div>
                  ))}
                  {resultText.split("\n").length > 40 && (
                    <div style={{ padding: "6px 0", color: "var(--muted)", fontStyle: "italic" }}>
                      ... 共 {resultText.split("\n").length} 行，弹窗查看完整内容
                    </div>
                  )}
                </div>
              </div>
              <div className="tl-tool-expand-action">
                <button
                  className="ghost-button"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenModal({
                      type: "diff",
                      title: `变更: ${event.file}`,
                      content: resultText,
                    });
                  }}
                >
                  弹窗查看完整变更
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }

    case "complete": {
      return (
        <div className="timeline-complete">
          <div className="tl-complete-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div className="tl-complete-right">
            <div className="tl-complete-body">
              <strong>任务完成</strong>
              <div className="tl-complete-markdown">
                <MarkdownRenderer>{event.summary}</MarkdownRenderer>
              </div>
            </div>
            <div className="tl-complete-actions">
              <button
                className="ghost-button small"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenModal({
                    type: "markdown",
                    title: "任务完成 · 完整输出",
                    content: event.summary,
                  });
                }}
              >
                弹窗查看
              </button>
            </div>
          </div>
        </div>
      );
    }

    case "error": {
      return (
        <div className="timeline-error">
          <div className="tl-error-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          </div>
          <div className="tl-complete-right">
            <div className="tl-error-body">
              <strong>执行出错</strong>
              <div className="tl-complete-markdown">
                <MarkdownRenderer>{event.message}</MarkdownRenderer>
              </div>
            </div>
            <div className="tl-complete-actions">
              <button
                className="ghost-button small"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenModal({
                    type: "markdown",
                    title: "错误信息",
                    content: event.message,
                  });
                }}
              >
                弹窗查看
              </button>
            </div>
          </div>
        </div>
      );
    }

    case "tool": {
      const tc = event.toolCall;

      // ── ask_user_question 特殊渲染 ──
      if (tc.name === "ask_user_question") {
        return <AskUserQuestionCard
          toolCall={tc}
          stepId={stepId}
          agentAnswerQuestion={agentAnswerQuestion}
          isExpanded={isExpanded}
          onToggleExpand={onToggleExpand}
          onOpenModal={onOpenModal}
        />;
      }

      const argsSummary = tc.input ? extractToolArgsSummary(tc.input, tc.name) : "";
      const resultText = tc.result || tc.outputFragments.join("");
      const hasInput = !!tc.input;
      const hasOutput = tc.status !== "running" && resultText.trim();

      return (
        <div className={`timeline-tool ${tc.status} ${isExpanded ? "expanded" : ""}`}>
          <div className="tl-tool-card" onClick={onToggleExpand}>
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
            <span className={`tl-tool-chevron ${isExpanded ? "open" : ""}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </span>
          </div>

          {/* 内联展开：输入/输出 */}
          {isExpanded && (hasInput || hasOutput) && (
            <div className="tl-tool-expand">
              {hasInput && (
                <div className="tl-tool-expand-section">
                  <div className="tl-tool-expand-title">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                    <span>输入参数</span>
                  </div>
                  <pre className="tl-tool-expand-pre"><code>{formatJsonOrText(tc.input)}</code></pre>
                </div>
              )}
              {hasOutput && (
                <div className={`tl-tool-expand-section${tc.status === "error" ? " tl-tool-expand-error" : ""}`}>
                  <div className="tl-tool-expand-title">
                    {tc.status === "error" ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                    )}
                    <span>{tc.status === "error" ? "错误信息" : "输出结果"}</span>
                  </div>
                  <pre className="tl-tool-expand-pre"><code>{formatJsonOrText(resultText)}</code></pre>
                </div>
              )}
              {hasOutput && (
                <div className="tl-tool-expand-action">
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenModal({
                        type: "json",
                        title: `${tc.name} · 输出结果`,
                        content: resultText,
                      });
                    }}
                  >
                    弹窗查看完整输出
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    default:
      return null;
  }
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

// ── 工具函数 ────────────────────────────────
function getLanguageFromPath(path: string): string {
  const ext = path.split(".").pop() || "";
  const map: Record<string, string> = {
    ts: "TypeScript", tsx: "TSX", js: "JavaScript", jsx: "JSX",
    json: "JSON", yaml: "YAML", yml: "YAML", md: "Markdown",
    css: "CSS", html: "HTML",
  };
  return map[ext] || ext;
}

function getPlaceholderForStage(stepIndex: number): string {
  const prompts = [
    "补充更多业务背景或边界条件...",
    "说明本轮交付的特殊约束...",
    "对生成的代码结构有什么调整意见？",
    "对 Agent 进展有什么额外要求？",
    "对质量报告有任何疑问？",
    "补充修复策略或优先级调整...",
    "发布前的最后补充说明...",
  ];
  return prompts[stepIndex] || "";
}
