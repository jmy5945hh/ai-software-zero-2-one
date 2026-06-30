import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { agentFetch } from "../agent/config";
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
  Square,
  FileText,
  ListChecks,
  FolderOpen,
  CheckCircle2,
  PlusCircle,
  Edit3,
  HelpCircle,
  Play,
  Info,
  File,
  Folder,
  Code2,
  AlertTriangle,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import type { DrawerContent, AppState, AgentSummary, KeyPoint, TodoItem, FileChange } from "../data/types";
import { useStepKey } from "../hooks";
import { workflow, getContentForStage, getTaskWorkflow, parsePrototypeManifest } from "../data";
import type {
  TrajectoryTurn,
} from "../data/stageContent";
import type { SessionState, ToolCallCategory, ToolCallRecord, Turn, WorkspaceInitStatus } from "../agent/types";
import { extractFileChanges } from "../agent/useAgent";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { TokenUsageBadge } from "./TokenUsageBadge";
import { ContentModal } from "./ContentModal";
import type { ModalContent } from "./ContentModal";
import type { StepSessionSnapshot } from "../hooks/useSessionRecords";
import { DiffViewer } from "./DiffViewer";
import type { RepoTab } from "./RepoExplorer";

type BoardTab = "delivery" | "trajectory";

type DecisionBoardProps = {
  fixedTab?: BoardTab;
  state: AppState;
  onPatch: (patch: Partial<AppState>) => void;
  onContinue: () => void;
  onPreview: (content: DrawerContent) => void;
  agentSessions: Record<string, SessionState>;
  restoredSessions: Record<string, {
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    turns: Array<{
      id: string;
      index: number;
      status: "running" | "done";
      textContent: string;
      thinking: string;
      toolCalls: Array<{
        id: string;
        name: string;
        status: "running" | "done" | "error";
        category: string;
        input: string;
        result?: string;
      }>;
    }>;
    summary: string;
    summarizationResult?: import("../data/types").AgentSummary | null;
    buildCommand?: string | null;
    buildResult?: import("../data/types").BuildResult | null;
    completed?: boolean;
    summarizationStatus?: "idle" | "pending" | "loading" | "done" | "error";
    buildStatus?: "idle" | "pending" | "detecting" | "loading" | "done" | "error";
  }>;
  /** 各步骤的 Agent 总结摘要（stepId → brief） */
  stepSummaries: Record<string, string>;
  agentSteer: (step: string, text: string, intent?: string) => void;
  agentAbort: (step: string) => void;
  agentPrompt: (step: string, text: string) => Promise<void>;
  agentAnswerQuestion: (step: string, answer: string) => Promise<void>;
  agentContinueQuestion: (step: string) => Promise<void>;
  agentResumeQuestion?: (step: string, answer: string) => Promise<void>;
  isAgentConnected: boolean;
  /** 项目编译 */
  triggerBuild: (workspacePath: string, command?: string) => Promise<{ success: boolean; output: string; command: string }>;
  /** 重新检测编译命令 */
  detectBuildCommand?: (workspacePath: string) => Promise<string>;
  taskId: string | null;
  /** 打开 Workspace 项目代码仓库 */
  onOpenRepoExplorer?: (tab: RepoTab) => void;
  /** 编译数据持久化回调 */
  onBuildUpdate?: (stepId: string, command: string, result: import("../data/types").BuildResult) => void;
  /** QA 一键修复回调 */
  onFixIssues?: (report: string) => void;
  /** Workspace 初始化状态（云端模式 git clone 进度） */
  workspaceInitStatus?: WorkspaceInitStatus;
  /** 重试克隆回调（云端模式 clone 失败后） */
  onRetryClone?: () => void;
};

export function DecisionBoard({
  fixedTab,
  state,
  onPatch,
  onContinue,
  onPreview,
  agentSessions,
  restoredSessions,
  stepSummaries,
  agentSteer,
  agentAbort,
  agentPrompt,
  agentAnswerQuestion,
  agentContinueQuestion,
  agentResumeQuestion,
  isAgentConnected,
  triggerBuild,
  detectBuildCommand,
  taskId,
  onOpenRepoExplorer,
  onBuildUpdate,
  onFixIssues,
  workspaceInitStatus,
  onRetryClone,
}: DecisionBoardProps) {
  const taskWorkflow = getTaskWorkflow(state.prototype);
  const step = taskWorkflow[state.stepIndex];
  const stepKey = useStepKey(state.stepIndex);
  const content = getContentForStage(state.stepIndex, taskWorkflow);
  const hasRestoredHistory = useMemo(
    () => Object.values(restoredSessions).some((s) => s.messages.length > 0),
    [restoredSessions],
  );
  const [activeTab, setActiveTab] = useState<BoardTab>(
    hasRestoredHistory ? "trajectory" : "delivery",
  );
  const visibleTab = fixedTab ?? activeTab;
  const [pendingAutoMessage, setPendingAutoMessage] = useState<string | null>(null);
  const [scrollToRound, setScrollToRound] = useState<number | null>(null);

  // 包装 onBuildUpdate，注入当前 stepId
  const handleBuildUpdate = useCallback(
    (command: string, result: import("../data/types").BuildResult) => {
      onBuildUpdate?.(step.id, command, result);
    },
    [onBuildUpdate, step.id],
  );

  const handleSwitchToTrajectory = (msg?: string, roundIndex?: number) => {
    setActiveTab("trajectory");
    if (roundIndex != null) {
      setScrollToRound(roundIndex);
    }
    if (msg) {
      setPendingAutoMessage(msg);
    }
  };

  return (
    <section className="decision-board" key={stepKey}>
      <div className="board-compact-header">
        <div className="board-header-left">
          <span className="board-step-id">{step.id.toUpperCase()}</span>
          <span className="board-step-label">{step.label}</span>
          <span className="board-step-sep">·</span>
          <span className="board-step-detail">{step.detail}</span>
        </div>
        <div className="board-header-tooltip">
          <div className="board-tooltip-label">{step.label}</div>
          <div className="board-tooltip-desc">{step.detailLong}</div>
        </div>
      </div>

      {!fixedTab && <div className="board-tabs">
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
      </div>}

      <div className="board-tab-panels">
        {visibleTab === "delivery" && (
          <DeliveryCollabTab
            state={state}
            onPatch={onPatch}
            onContinue={onContinue}
            onPreview={onPreview}
            onSwitchToTrajectory={() => {
              const roundIdx = findLatestQuestionRound(agentSessions[step.id]);
              handleSwitchToTrajectory(state.notes, roundIdx ?? undefined);
            }}
            agentSession={agentSessions[step.id]}
            isAgentConnected={isAgentConnected}
            stepId={step.id}
            agentAnswerQuestion={agentAnswerQuestion}
            agentContinueQuestion={agentContinueQuestion}
            agentResumeQuestion={agentResumeQuestion}
            agentPrompt={agentPrompt}
            agentSteer={agentSteer}
            agentAbort={agentAbort}
            triggerBuild={triggerBuild}
            detectBuildCommand={detectBuildCommand}
            restoredSession={restoredSessions[step.id]}
            onOpenRepoExplorer={onOpenRepoExplorer}
            onBuildUpdate={handleBuildUpdate}
            onFixIssues={onFixIssues}
            qualitySession={agentSessions["quality"]}
          />
        )}
        {visibleTab === "trajectory" && (
          <TrajectoryChatTab
            trajectory={content.trajectory}
            stepIndex={state.stepIndex}
            stepId={step.id}
            agentSteer={agentSteer}
            agentAbort={agentAbort}
            agentPrompt={agentPrompt}
            agentAnswerQuestion={agentAnswerQuestion}
            agentContinueQuestion={agentContinueQuestion}
            agentResumeQuestion={agentResumeQuestion}
            agentSession={agentSessions[step.id]}
            restoredSession={restoredSessions[step.id]}
            isAgentConnected={isAgentConnected}
            pendingAutoMessage={pendingAutoMessage}
            onConsumeAutoMessage={() => setPendingAutoMessage(null)}
            scrollToRound={scrollToRound}
            onConsumeScrollToRound={() => setScrollToRound(null)}
            intent={state.intent}
            initialPrompts={state.initialPrompts}
            stepSummaries={stepSummaries}
            workspaceInitStatus={workspaceInitStatus}
            onRetryClone={onRetryClone}
            onOpenRollback={() => onOpenRepoExplorer?.("rollback")}
          />
        )}
      </div>
    </section>
  );
}

// ── 检测 session 中是否有正在问答的 ask_user_question ──
function hasPendingQuestion(session: SessionState | undefined): boolean {
  if (!session) return false;
  for (const turn of session.turns || []) {
    for (const tc of turn.toolCalls || []) {
      if (tc.name === "ask_user_question" && tc.status === "running") {
        return true;
      }
    }
  }
  return false;
}

/** 找到最新一轮 ask_user_question 的 round index */
function findLatestQuestionRound(session: SessionState | undefined): number | null {
  if (!session) return null;
  // 从后往前遍历，找到第一个 ask_user_question 所在的轮次
  for (let ti = session.turns.length - 1; ti >= 0; ti--) {
    const turn = session.turns[ti];
    for (const tc of turn.toolCalls || []) {
      if (tc.name === "ask_user_question") {
        return ti + 1; // round index 从 1 开始
      }
    }
  }
  return null;
}

/** 获取 session 的最新轮次索引（1-based） */
function latestRoundIndex(session: SessionState | undefined): number | null {
  if (!session || session.turns.length === 0) return null;
  return session.turns.length;
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
  agentContinueQuestion,
  agentResumeQuestion,
  agentPrompt,
  agentSteer,
  agentAbort,
  triggerBuild,
  detectBuildCommand,
  restoredSession,
  onOpenRepoExplorer,
  onBuildUpdate,
  onFixIssues,
  qualitySession,
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
  agentContinueQuestion: (step: string) => Promise<void>;
  agentResumeQuestion?: (step: string, answer: string) => Promise<void>;
  agentPrompt: (step: string, text: string) => Promise<void>;
  agentSteer: (step: string, text: string, intent?: string) => void;
  agentAbort: (step: string) => void;
  triggerBuild: (workspacePath: string, command?: string) => Promise<{ success: boolean; output: string; command: string }>;
  detectBuildCommand?: (workspacePath: string) => Promise<string>;
  /** 从历史记录恢复的当前步骤会话快照 */
  restoredSession?: {
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    turns: Array<{
      id: string;
      index: number;
      status: "running" | "done";
      textContent: string;
      thinking: string;
      userInput?: string;
      toolCalls: Array<{
        id: string;
        name: string;
        status: "running" | "done" | "error";
        category: string;
        input: string;
        result?: string;
      }>;
    }>;
    summary: string;
    summarizationResult?: import("../data/types").AgentSummary | null;
    buildCommand?: string | null;
    buildResult?: import("../data/types").BuildResult | null;
    /** Agent 是否执行完成 */
    completed?: boolean;
    /** 结构化总结状态 */
    summarizationStatus?: "idle" | "pending" | "loading" | "done" | "error";
    /** 项目编译状态 */
    buildStatus?: "idle" | "pending" | "detecting" | "loading" | "done" | "error";
  } | null;
  onOpenRepoExplorer?: (tab: RepoTab) => void;
  onBuildUpdate?: (command: string, result: import("../data/types").BuildResult) => void;
  onFixIssues?: (report: string) => void;
  qualitySession?: import("../agent/types").SessionState;
}) {
  const agentCompleted = isAgentConnected && agentSession?.completed && !agentSession?.isStreaming;
  const agentWorking = isAgentConnected && agentSession && !agentCompleted;
  const pendingQuestion = hasPendingQuestion(agentSession);

  // 结构化总结状态（优先 live session，fallback 到 restored session）
  const summaryResult = agentSession?.summarizationResult ?? restoredSession?.summarizationResult ?? undefined;
  const summaryLoading = agentSession?.summarizationStatus === "loading";
  const summaryError = agentSession?.summarizationStatus === "error";
  const hasSummary = (agentSession?.summarizationStatus === "done" || restoredSession?.summarizationStatus === "done" || !!restoredSession?.summarizationResult) && !!summaryResult;

  // 从历史恢复且无 live session 时的状态判断
  // 只要有 restoredSession 数据且 agentSession 尚未产生新 turn，就视为历史恢复场景
  const hasRestoredData = !!restoredSession && (restoredSession?.turns?.length ?? 0) > 0;
  const hasLiveProgress = !!agentSession && (agentSession.turns?.length ?? 0) > 0;
  // 使用持久化的 completed/summarizationStatus 判断，fallback 到 summarizationResult
  // 注意：completed === true 但 summary 未完成时，不算 restoredCompleted
  const restoredCompleted = hasRestoredData && !hasLiveProgress && (
    restoredSession?.summarizationStatus === "done"
    || !!restoredSession?.summarizationResult
  );
  const restoredIncomplete = hasRestoredData && !hasLiveProgress && !restoredCompleted;
  // agent 已完成但 summary 未完成（需要自动触发总结）
  const restoredPendingSummary = hasRestoredData && !hasLiveProgress
    && !restoredCompleted
    && restoredSession?.completed === true
    && !!restoredSession?.summary;

  // agent 已连接但尚未产生新 turn（刚 resume 或刚进入历史会话页面）
  // 此时应显示"未完成"提示让用户点击继续执行
  const restoredPendingResume = isAgentConnected
    && !!restoredSession
    && !restoredCompleted
    && !restoredPendingSummary
    && (restoredSession?.turns?.length ?? 0) > 0
    && (!agentSession || agentSession.turns.length === 0);

  // 文件变更（优先 live session，fallback 到 restored session）
  const fileChanges: FileChange[] = agentSession?.turns
    ? extractFileChanges(agentSession.turns)
    : restoredSession?.turns
      ? extractFileChanges(restoredSession.turns as Turn[])
      : [];

  // 点击文件变更 → 全屏弹窗查看详情
  const [modalContent, setModalContent] = useState<ModalContent | null>(null);

  const handleFileClick = useCallback(
    (fc: FileChange) => {
      const fileName = fc.path.split("/").pop() || fc.path;
      const isMarkdown = /\.md$/i.test(fc.path);

      if (fc.action === "modify" && fc.diffContent) {
        // .md 文件的 diff 也以 markdown 渲染展示（更直观）
        setModalContent({
          type: isMarkdown ? "markdown" : "diff",
          title: fileName,
          content: fc.diffContent,
        });
      } else if (fc.action === "create" && fc.diffContent) {
        setModalContent({
          type: isMarkdown ? "markdown" : "code",
          title: fileName,
          content: fc.diffContent,
          language: isMarkdown ? undefined : getLanguageFromPath(fc.path),
        });
      }
    },
    [],
  );

  // 点击 Spec 文件 → 从 server 读取文件内容并弹窗展示
  const handleSpecFileClick = useCallback(
    (filePath: string, name: string) => {
      const params = new URLSearchParams();
      if (state.workspacePath) params.set("path", state.workspacePath);
      params.set("taskId", state.sessionId);
      params.set("file", filePath);
      agentFetch(`/specs-file?${params.toString()}`)
        .then((res) => res.json())
        .then((data: { content: string; isMarkdown: boolean }) => {
          setModalContent({
            type: data.isMarkdown ? "markdown" : "code",
            title: name,
            content: data.content,
            language: data.isMarkdown ? undefined : getLanguageFromPath(filePath),
            filePath,
            workspacePath: state.workspacePath,
          });
        })
        .catch(() => {
          setModalContent({
            type: "code",
            title: name,
            content: "// 文件内容加载失败",
          });
        });
    },
    [state.workspacePath, state.sessionId],
  );

  // 从历史恢复的 ask_user_question 中提取已存储的回答
  const restoredAnswer = useMemo(() => {
    if (!restoredSession?.turns) return null;
    for (let i = restoredSession.turns.length - 1; i >= 0; i--) {
      for (const tc of restoredSession.turns[i].toolCalls || []) {
        if (tc.name === "ask_user_question" && tc.result) {
          return tc.result;
        }
      }
    }
    return null;
  }, [restoredSession]);

  // 自动 resume：点击"继续执行"时重建 session 并发送已存储的回答
  const [isResuming, setIsResuming] = useState(false);
  const handleAutoResume = useCallback(async () => {
    if (!stepId || !agentResumeQuestion || !restoredAnswer) return;
    setIsResuming(true);
    try {
      await agentResumeQuestion(stepId, restoredAnswer);
    } catch {
      // 错误由 ws 层处理
    } finally {
      setIsResuming(false);
    }
  }, [stepId, agentResumeQuestion, restoredAnswer]);

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
      {agentWorking && !pendingQuestion && (
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

      {/* Agent 正在问答，等待用户确认 */}
      {pendingQuestion && (
        <div className="delivery-question-notice">
          <div className="question-notice-icon">
            <HelpCircle size={22} />
          </div>
          <div className="question-notice-body">
            <strong>问答过程需要用户确认</strong>
            <p className="question-notice-desc">Agent 正在等待您的回答，请前往任务轨迹查看并回复</p>
            <button
              className="working-notice-link"
              type="button"
              onClick={onSwitchToTrajectory}
            >
              <Eye size={13} />
              <span>跳转到最新一轮</span>
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
              <KeyPointsGrid keyPoints={summaryResult.key_points ?? []} />
              {/* prototype 阶段：展示原型预览 */}
              {stepId === "prototype" && (
                <PrototypePreview
                  workspacePath={state.workspacePath}
                  sessionId={state.sessionId}
                  prototype={state.prototype}
                  onPreview={onPreview}
                  onPatch={onPatch}
                  onContinue={onContinue}
                  isAgentConnected={isAgentConnected}
                  agentAbort={agentAbort}
                />
              )}
              {/* intent / plan 阶段展示交付Spec 目录，其他阶段展示跳转到项目代码仓库的按钮 */}
              {(stepId === "intent" || stepId === "plan")
                ? <SpecsDirectory workspacePath={state.workspacePath} taskId={state.sessionId} onFileClick={handleSpecFileClick} />
                : <FileChangesButton files={fileChanges} onOpenRepoExplorer={onOpenRepoExplorer} />
              }
              {/* coding 步骤展示项目编译 */}
              {stepId === "coding" && (
                <BuildSection
                  workspacePath={state.workspacePath}
                  sessionId={state.sessionId}
                  triggerBuild={triggerBuild}
                  agentSession={agentSession}
                  agentPrompt={agentPrompt}
                  agentSteer={agentSteer}
                  stepId={stepId}
                  detectBuildCommand={detectBuildCommand}
                  onSwitchToTrajectory={onSwitchToTrajectory}
                  onBuildUpdate={onBuildUpdate}
                />
              )}
              <TodoSection
                todos={summaryResult.todos ?? []}
                todoAnswers={state.todoAnswers}
                onPatch={onPatch}
                stepId={stepId}
                agentPrompt={agentPrompt}
                agentSteer={agentSteer}
                onContinue={onContinue}
                stepIndex={state.stepIndex}
                agentSession={agentSession}
                prototypeState={state.prototype}
              />
            </>
          )}

          {/* 无总结结果但有 summary（idle/pending 状态下尚未触发） */}
          {!summaryLoading && !hasSummary && !summaryError && agentSession?.summary && (
            <div className="delivery-summary">
              <MarkdownRenderer>{agentSession.summary}</MarkdownRenderer>
            </div>
          )}
        </>
      )}
      {/* 从历史恢复且已完成：展示总结信息 */}
      {restoredCompleted && (
        <>
          {summaryResult && (
            <>
              <SummaryBrief brief={summaryResult.brief} />
              <KeyPointsGrid keyPoints={summaryResult.key_points ?? []} />
              {stepId === "prototype" && (
                <PrototypePreview
                  workspacePath={state.workspacePath}
                  sessionId={state.sessionId}
                  prototype={state.prototype}
                  onPreview={onPreview}
                  onPatch={onPatch}
                  onContinue={onContinue}
                  isAgentConnected={isAgentConnected}
                  agentAbort={agentAbort}
                />
              )}
              {(stepId === "intent" || stepId === "plan")
                ? <SpecsDirectory workspacePath={state.workspacePath} taskId={state.sessionId} onFileClick={handleSpecFileClick} />
                : <FileChangesButton files={fileChanges} onOpenRepoExplorer={onOpenRepoExplorer} />
              }
              {stepId === "coding" && (
                <BuildSection
                  workspacePath={state.workspacePath}
                  sessionId={state.sessionId}
                  triggerBuild={triggerBuild}
                  agentSession={undefined}
                  restoredBuildResult={restoredSession?.buildResult ?? null}
                  restoredBuildCommand={restoredSession?.buildCommand ?? null}
                  agentPrompt={agentPrompt}
                  agentSteer={agentSteer}
                  stepId={stepId}
                  detectBuildCommand={detectBuildCommand}
                  onSwitchToTrajectory={onSwitchToTrajectory}
                  onBuildUpdate={onBuildUpdate}
                />
              )}
              <TodoSection
                todos={summaryResult.todos ?? []}
                todoAnswers={state.todoAnswers}
                onPatch={onPatch}
                stepId={stepId}
                agentPrompt={agentPrompt}
                agentSteer={agentSteer}
                onContinue={onContinue}
                stepIndex={state.stepIndex}
                agentSession={undefined}
                prototypeState={state.prototype}
              />
            </>
          )}
          {!summaryResult && restoredSession?.summary && (
            <div className="delivery-summary">
              <MarkdownRenderer>{restoredSession.summary}</MarkdownRenderer>
            </div>
          )}
        </>
      )}

      {/* 从历史恢复但未完成：提示继续执行 */}
      {(restoredIncomplete || restoredPendingResume) && (
        <div className="delivery-incomplete-notice">
          <div className="incomplete-notice-icon">
            <HelpCircle size={28} />
          </div>
          <div className="incomplete-notice-body">
            <strong>当前阶段任务尚未完成</strong>
            <p>该会话在历史记录中处于未完成状态，请前往任务轨迹查看进度并继续执行。</p>
            <button
              className="working-notice-link"
              type="button"
              onClick={() => {
                handleAutoResume();
                onSwitchToTrajectory();
              }}
              disabled={isResuming}
            >
              {isResuming ? (
                <Loader2 size={14} className="spin-icon" />
              ) : (
                <Play size={14} />
              )}
              <span>{isResuming ? "恢复执行中..." : "前往任务轨迹继续执行"}</span>
              <ArrowRight size={12} />
            </button>
          </div>
        </div>
      )}

      {/* agent 已完成但 summary 未完成：显示总结中 */}
      {restoredPendingSummary && (
        <div className="summary-loading">
          <Loader2 size={20} className="spin-icon" />
          <span>正在生成阶段总结...</span>
        </div>
      )}

      {!isAgentConnected && !restoredCompleted && !restoredIncomplete && !restoredPendingResume && !restoredPendingSummary && (
        (stepId === "intent" || stepId === "plan") ? (
          <SpecsDirectory workspacePath={state.workspacePath} taskId={state.sessionId} onFileClick={handleSpecFileClick} />
        ) : (
          <div className="delivery-empty">
            <Bot size={24} />
            <p>连接 Agent 后将在此展示交付产出</p>
          </div>
        )
      )}

      {/* 已连接但无当前步骤 session（排除历史恢复已完成场景） */}
      {isAgentConnected && !agentSession && !agentWorking && !restoredCompleted && (
        (stepId === "intent" || stepId === "plan") ? (
          <SpecsDirectory workspacePath={state.workspacePath} taskId={state.sessionId} onFileClick={handleSpecFileClick} />
        ) : (
          <div className="delivery-empty">
            <Bot size={24} />
            <p>请通过任务轨迹创建 Agent 会话来开始本阶段工作</p>
          </div>
        )
      )}

      {/* 文件变更全屏弹窗 */}
      <ContentModal
        content={modalContent}
        onClose={() => setModalContent(null)}
      />

      {/* quality 阶段：独立于 agent session 状态，始终展示 QA 审查 */}
      {stepId === "quality" && (
        <>
          <VerificationArtifactsSection
            state={state}
            onPatch={onPatch}
          />
          <QaReviewSection
            qaReview={state.qaReview}
            sessionId={state.sessionId}
            workspacePath={state.workspacePath}
            onPatch={onPatch}
            onFixIssues={onFixIssues}
            onContinue={onContinue}
            agentSteer={agentSteer}
            stepId={stepId}
            onSwitchToTrajectory={onSwitchToTrajectory}
            qualitySession={qualitySession}
          />
        </>
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

// ── v0.2 验证计划与交付报告 ───────────────────
function VerificationArtifactsSection({
  state,
  onPatch,
}: {
  state: AppState;
  onPatch: (patch: Partial<AppState>) => void;
}) {
  const [workflowRunning, setWorkflowRunning] = useState(false);

  const generateVerificationPlan = useCallback(async (): Promise<boolean> => {
    if (!state.sessionId || !state.workspacePath) return false;
    onPatch({
      verificationPlan: {
        status: "running",
        filePath: state.verificationPlan.filePath,
        content: state.verificationPlan.content,
      },
    });
    try {
      const res = await agentFetch("/verification-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: state.sessionId,
          taskId: state.sessionId,
          workspacePath: state.workspacePath,
          intent: state.intent,
          deliveryConfig: state.deliveryConfig,
        }),
      });
      const data = await res.json() as { success?: boolean; filePath?: string; content?: string; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error || "验证计划生成失败");
      onPatch({
        verificationPlan: {
          status: "done",
          filePath: data.filePath || "",
          content: data.content || "",
        },
      });
      return true;
    } catch (err) {
      onPatch({
        verificationPlan: {
          status: "error",
          filePath: state.verificationPlan.filePath,
          content: state.verificationPlan.content,
          error: err instanceof Error ? err.message : "验证计划生成失败",
        },
      });
      return false;
    }
  }, [state.sessionId, state.workspacePath, state.intent, state.deliveryConfig, state.verificationPlan, onPatch]);

  const generateDeliveryReport = useCallback(async (): Promise<boolean> => {
    if (!state.sessionId || !state.workspacePath) return false;
    onPatch({
      deliveryReport: {
        status: "running",
        filePath: state.deliveryReport.filePath,
        content: state.deliveryReport.content,
      },
    });
    try {
      const res = await agentFetch("/delivery-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: state.sessionId,
          taskId: state.sessionId,
          workspacePath: state.workspacePath,
          intent: state.intent,
          deliveryConfig: state.deliveryConfig,
        }),
      });
      const data = await res.json() as { success?: boolean; filePath?: string; content?: string; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error || "交付报告生成失败");
      onPatch({
        deliveryReport: {
          status: "done",
          filePath: data.filePath || "",
          content: data.content || "",
        },
      });
      return true;
    } catch (err) {
      onPatch({
        deliveryReport: {
          status: "error",
          filePath: state.deliveryReport.filePath,
          content: state.deliveryReport.content,
          error: err instanceof Error ? err.message : "交付报告生成失败",
        },
      });
      return false;
    }
  }, [state.sessionId, state.workspacePath, state.intent, state.deliveryConfig, state.deliveryReport, onPatch]);

  const runVerification = useCallback(async (): Promise<boolean> => {
    if (!state.sessionId || !state.workspacePath) return false;
    onPatch({
      verificationResult: {
        status: "running",
        filePath: state.verificationResult.filePath,
        content: state.verificationResult.content,
      },
    });
    try {
      const res = await agentFetch("/verification-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: state.sessionId,
          taskId: state.sessionId,
          workspacePath: state.workspacePath,
        }),
      });
      const data = await res.json() as { success?: boolean; filePath?: string; content?: string; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error || "验证执行失败");
      onPatch({
        verificationResult: {
          status: "done",
          filePath: data.filePath || "",
          content: data.content || "",
        },
      });
      return true;
    } catch (err) {
      onPatch({
        verificationResult: {
          status: "error",
          filePath: state.verificationResult.filePath,
          content: state.verificationResult.content,
          error: err instanceof Error ? err.message : "验证执行失败",
        },
      });
      return false;
    }
  }, [state.sessionId, state.workspacePath, state.verificationResult, onPatch]);

  const runEndToEndVerification = useCallback(async () => {
    if (workflowRunning) return;
    setWorkflowRunning(true);
    try {
      const planOk = await generateVerificationPlan();
      if (!planOk) return;
      const runOk = await runVerification();
      if (!runOk) return;
      await generateDeliveryReport();
    } finally {
      setWorkflowRunning(false);
    }
  }, [workflowRunning, generateVerificationPlan, runVerification, generateDeliveryReport]);

  return (
    <div className="summary-section verification-artifacts-section">
      <div className="summary-section-header">
        <ShieldCheck size={15} />
        <span>v0.2 验证交付证据</span>
      </div>
      <div className="verification-workflow-cta">
        <div>
          <strong>一键完成测试后交付</strong>
          <p>自动生成验证计划，执行可安全运行的验证命令，并汇总为交付报告；无法自动执行的 Web/API/业务场景会标记为待回填证据。</p>
        </div>
        <button
          className="todo-submit-btn"
          type="button"
          onClick={runEndToEndVerification}
          disabled={workflowRunning}
        >
          {workflowRunning ? <Loader2 size={14} className="spin-icon" /> : <Play size={14} />}
          {workflowRunning ? "验证交付中..." : "一键验证并生成报告"}
        </button>
      </div>
      <div className="verification-artifact-grid">
        <ArtifactCard
          title="验证计划"
          description="根据交付模式、验证范围和项目特征生成 Web/API/业务场景测试矩阵。"
          status={state.verificationPlan.status}
          filePath={state.verificationPlan.filePath}
          content={state.verificationPlan.content}
          error={state.verificationPlan.error}
          actionLabel="生成验证计划"
          onAction={generateVerificationPlan}
        />
        <ArtifactCard
          title="执行验证"
          description="执行验证计划中安全可运行的项目脚本，并把 Web/API/业务场景缺口标成待回填证据。"
          status={state.verificationResult.status}
          filePath={state.verificationResult.filePath}
          content={state.verificationResult.content}
          error={state.verificationResult.error}
          actionLabel="执行可自动化验证"
          onAction={runVerification}
          disabled={state.verificationPlan.status !== "done"}
          disabledReason="请先生成验证计划"
        />
        <ArtifactCard
          title="交付报告"
          description="汇总验证计划、质量审查结果、残余风险和后续建议，生成 DELIVERY.md。"
          status={state.deliveryReport.status}
          filePath={state.deliveryReport.filePath}
          content={state.deliveryReport.content}
          error={state.deliveryReport.error}
          actionLabel="生成交付报告"
          onAction={generateDeliveryReport}
        />
      </div>
    </div>
  );
}

function ArtifactCard({
  title,
  description,
  status,
  filePath,
  content,
  error,
  actionLabel,
  onAction,
  disabled,
  disabledReason,
}: {
  title: string;
  description: string;
  status: AppState["verificationPlan"]["status"];
  filePath: string;
  content: string;
  error?: string;
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const isRunning = status === "running";
  const isDone = status === "done";
  const isError = status === "error";
  const preview = content.trim().slice(0, 520);

  return (
    <div className={`verification-artifact-card ${status}`}>
      <div className="verification-artifact-header">
        <div>
          <strong>{title}</strong>
          <p>{description}</p>
        </div>
        {isRunning && <span className="build-badge build-badge-running"><Loader2 size={11} className="spin-icon" /> 生成中</span>}
        {isDone && <span className="build-badge build-badge-success">✓ 已生成</span>}
        {isError && <span className="build-badge build-badge-failure">✗ 失败</span>}
      </div>
      {filePath && (
        <div className="build-command">
          <span className="build-command-label">产物：</span>
          <code>{filePath}</code>
        </div>
      )}
      {error && <div className="build-status build-failure">{error}</div>}
      {preview && (
        <pre className="verification-artifact-preview"><code>{preview}{content.length > preview.length ? "\n..." : ""}</code></pre>
      )}
      <div className="build-actions">
        <button
          className="todo-submit-btn"
          type="button"
          onClick={onAction}
          disabled={isRunning || disabled}
        >
          {isRunning ? <Loader2 size={14} className="spin-icon" /> : <Play size={14} />}
          {isDone ? "重新生成" : actionLabel}
        </button>
        {disabled && disabledReason ? <span className="verification-artifact-disabled">{disabledReason}</span> : null}
      </div>
    </div>
  );
}

// ── 项目编译 ────────────────────────────────
function BuildSection({
  workspacePath,
  sessionId,
  triggerBuild,
  agentSession,
  restoredBuildResult,
  restoredBuildCommand,
  agentPrompt,
  agentSteer,
  stepId,
  detectBuildCommand,
  onSwitchToTrajectory,
  onBuildUpdate,
}: {
  workspacePath: string;
  sessionId: string;
  triggerBuild: (workspacePath: string, command?: string) => Promise<{ success: boolean; output: string; command: string }>;
  agentSession?: import("../agent/types").SessionState;
  restoredBuildResult?: import("../data/types").BuildResult | null;
  restoredBuildCommand?: string | null;
  agentPrompt?: (step: string, text: string) => Promise<void>;
  agentSteer?: (step: string, text: string, intent?: string, workspacePath?: string) => void;
  stepId?: string;
  detectBuildCommand?: (workspacePath: string) => Promise<string>;
  onSwitchToTrajectory?: (msg?: string, roundIndex?: number) => void;
  /** 编译数据更新回调，用于持久化到 session */
  onBuildUpdate?: (command: string, result: import("../data/types").BuildResult) => void;
}) {
  const [outputExpanded, setOutputExpanded] = useState(false);
  const [showFullOutput, setShowFullOutput] = useState(false);
  const [localBuildResult, setLocalBuildResult] = useState<import("../data/types").BuildResult | null>(null);
  const [localBuilding, setLocalBuilding] = useState(false);
  const [localDetecting, setLocalDetecting] = useState(false);
  const [localBuildCommand, setLocalBuildCommand] = useState<string | null>(null);

  const buildResult = localBuildResult ?? agentSession?.buildResult ?? restoredBuildResult ?? null;
  const buildCommand = localBuildCommand ?? agentSession?.buildCommand ?? restoredBuildCommand ?? null;
  const buildStatus = localBuildResult
    ? "done"
    : agentSession?.buildStatus ?? (restoredBuildResult ? "done" : "idle");
  const isDetecting = buildStatus === "detecting" || localDetecting;
  const isBuilding = buildStatus === "loading" || buildStatus === "pending" || localBuilding;
  const isDone = buildStatus === "done" && !localBuilding && !localDetecting;
  const isError = buildStatus === "error" && !localBuilding && !localDetecting;

  const doBuild = useCallback(async () => {
    if (!workspacePath) return;
    setLocalBuilding(true);
    setOutputExpanded(true);

    // 如果没有编译命令，先检测
    let effectiveCommand = buildCommand;
    if (!effectiveCommand && detectBuildCommand) {
      setLocalDetecting(true);
      try {
        effectiveCommand = await detectBuildCommand(workspacePath);
        if (effectiveCommand) {
          setLocalBuildCommand(effectiveCommand);
        }
      } finally {
        setLocalDetecting(false);
      }
    }

    if (!effectiveCommand) {
      const buildResult: import("../data/types").BuildResult = {
        command: "",
        success: false,
        output: "// 错误：模型未提供编译命令",
        timestamp: new Date().toISOString(),
        retryCount: 0,
        building: false,
        fixing: false,
      };
      setLocalBuildResult(buildResult);
      onBuildUpdate?.("", buildResult);
      setLocalBuilding(false);
      return;
    }

    try {
      const result = await triggerBuild(workspacePath, effectiveCommand);
      const buildResult: import("../data/types").BuildResult = {
        command: result.command,
        success: result.success,
        output: result.output,
        timestamp: new Date().toISOString(),
        retryCount: 0,
        building: false,
        fixing: false,
      };
      setLocalBuildResult(buildResult);
      onBuildUpdate?.(effectiveCommand, buildResult);
    } catch {
      const buildResult: import("../data/types").BuildResult = {
        command: effectiveCommand,
        success: false,
        output: "// 编译请求失败",
        timestamp: new Date().toISOString(),
        retryCount: 0,
        building: false,
        fixing: false,
      };
      setLocalBuildResult(buildResult);
      onBuildUpdate?.(effectiveCommand, buildResult);
    } finally {
      setLocalBuilding(false);
    }
  }, [workspacePath, triggerBuild, buildCommand, detectBuildCommand, onBuildUpdate]);

  // 截取缩略内容：前 50 行 + 后 20 行
  const truncatedOutput = useMemo(() => {
    if (!buildResult?.output) return "";
    const lines = buildResult.output.split("\n");
    if (lines.length <= 100) return buildResult.output;
    const head = lines.slice(0, 50).join("\n");
    const tail = lines.slice(-20).join("\n");
    return `${head}\n\n... (中间 ${lines.length - 70} 行已折叠) ...\n\n${tail}`;
  }, [buildResult?.output]);

  // 编译结果分析摘要
  const buildAnalysis = useMemo(() => {
    if (!buildResult) return null;
    if (buildResult.success) {
      return { type: "success" as const, label: "编译成功", summary: "项目编译通过，无错误。" };
    }
    const lines = buildResult.output.split("\n");
    const errorLines = lines.filter(l =>
      /error|Error|ERROR|失败|Failed|FAILED/.test(l)
    ).slice(0, 5);
    const errorSummary = errorLines.length > 0
      ? errorLines.map(l => l.trim()).filter(Boolean).join("\n")
      : "编译过程出现错误，请查看完整输出。";
    return {
      type: "failure" as const,
      label: "编译失败",
      summary: errorSummary,
    };
  }, [buildResult]);

  const outputLineCount = buildResult?.output ? buildResult.output.split("\n").length : 0;

  return (
    <div className="summary-section build-section">
      <div className="summary-section-header">
        <Terminal size={15} />
        <span>项目编译</span>
        {/* 编译状态徽标 */}
        {isDone && buildResult && (
          <span className={`build-badge ${buildResult.success ? "build-badge-success" : "build-badge-failure"}`}>
            {buildResult.success ? "✓ 成功" : "✗ 失败"}
          </span>
        )}
        {isBuilding && (
          <span className="build-badge build-badge-running">
            <Loader2 size={11} className="spin-icon" /> 编译中
          </span>
        )}
        {isDetecting && (
          <span className="build-badge build-badge-running">
            <Loader2 size={11} className="spin-icon" /> 检测中
          </span>
        )}
      </div>

      {/* 模型检测到的编译命令 */}
      {buildCommand && (
        <div className="build-command">
          <span className="build-command-label">检测到编译命令：</span>
          <code>{buildCommand}</code>
        </div>
      )}

      {/* 检测中 */}
      {isDetecting && (
        <div className="build-status" style={{ color: "var(--text-secondary)" }}>
          <Loader2 size={14} className="spin-icon" /> AI 正在分析项目编译命令...
        </div>
      )}

      {/* 实际执行的编译命令 */}
      {buildResult?.command && buildResult.command !== buildCommand && (
        <div className="build-command">
          <span className="build-command-label">实际执行：</span>
          <code>{buildResult.command}</code>
        </div>
      )}

      {/* 编译状态 */}
      {isDone && buildResult && (
        <div className={`build-status ${buildResult.success ? "build-success" : "build-failure"}`}>
          {buildResult.success ? (
            <>✅ 编译成功{buildResult.timestamp ? ` (${new Date(buildResult.timestamp).toLocaleTimeString()})` : ""}</>
          ) : (
            <>❌ 编译失败{buildResult.timestamp ? ` (${new Date(buildResult.timestamp).toLocaleTimeString()})` : ""}</>
          )}
        </div>
      )}

      {/* 编译错误 */}
      {isError && (
        <div className="build-status build-failure">
          ❌ 编译分析异常
        </div>
      )}

      {/* 编译结果分析 */}
      {isDone && buildAnalysis && buildAnalysis.type === "failure" && (
        <div className="build-analysis">
          <div className="build-analysis-title">错误摘要</div>
          <pre className="build-analysis-content"><code>{buildAnalysis.summary}</code></pre>
        </div>
      )}

      {/* 编译输出 — 默认折叠，点击展开 */}
      {buildResult?.output && (
        <div className="build-output">
          <div
            className="build-output-header build-output-header-clickable"
            onClick={() => setOutputExpanded(!outputExpanded)}
          >
            <span>编译输出</span>
            <span className="build-output-header-right">
              <span className="build-output-meta">{outputLineCount} 行</span>
              <span className="build-expand-icon">
                {outputExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </span>
            </span>
          </div>
          {outputExpanded && (
            <>
              <pre className="build-output-pre">
                <code>{showFullOutput ? buildResult.output : truncatedOutput}</code>
              </pre>
              {outputLineCount > 100 && (
                <button
                  className="ghost-button small"
                  type="button"
                  onClick={() => setShowFullOutput(!showFullOutput)}
                >
                  {showFullOutput ? "收起完整输出" : "查看完整输出"}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="build-actions">
        <button
          className="ghost-button"
          type="button"
          onClick={doBuild}
          disabled={isBuilding || isDetecting}
        >
          {isDetecting ? (
            <><Loader2 size={14} className="spin-icon" /> 检测编译命令...</>
          ) : isBuilding ? (
            <><Loader2 size={14} className="spin-icon" /> 编译中...</>
          ) : (
            <><Play size={14} /> 重新编译</>
          )}
        </button>

        {/* 重新检测编译命令 */}
        {detectBuildCommand && workspacePath && (
          <button
            className="ghost-button"
            type="button"
            onClick={async () => {
              if (!detectBuildCommand || !workspacePath) return;
              setLocalDetecting(true);
              setLocalBuildCommand(null);
              setLocalBuildResult(null);
              try {
                const command = await detectBuildCommand(workspacePath);
                setLocalBuildCommand(command || null);
                // 检测到新命令后，自动执行编译
                if (command) {
                  const result = await triggerBuild(workspacePath, command);
                  const buildResult: import("../data/types").BuildResult = {
                    command: result.command,
                    success: result.success,
                    output: result.output,
                    timestamp: new Date().toISOString(),
                    retryCount: 0,
                    building: false,
                    fixing: false,
                  };
                  setLocalBuildResult(buildResult);
                  onBuildUpdate?.(command, buildResult);
                }
              } finally {
                setLocalDetecting(false);
              }
            }}
            disabled={isDetecting || isBuilding}
          >
            {isDetecting ? (
              <><Loader2 size={14} className="spin-icon" /> 检测中...</>
            ) : (
              <><Terminal size={14} /> 重新检测编译命令</>
            )}
          </button>
        )}

        {/* 编译失败时显示修复按钮 */}
        {buildResult && !buildResult.success && agentSteer && stepId && (
          <button
            className="ghost-button"
            type="button"
            onClick={async () => {
              const fixPrompt = `项目编译失败，请修复以下编译错误：\n\n编译命令：${buildResult.command}\n\n错误输出：\n${buildResult.output}`;
              agentSteer(stepId, fixPrompt, undefined, workspacePath);
              const latestRound = latestRoundIndex(agentSession);
              onSwitchToTrajectory?.(undefined, latestRound ?? undefined);
            }}
          >
            <Terminal size={14} /> 修复编译错误
          </button>
        )}
      </div>
    </div>
  );
}

// ── QA 质量审查 ─────────────────────────────
function QaReviewSection({
  qaReview,
  sessionId,
  workspacePath,
  onPatch,
  onFixIssues,
  onContinue,
  agentSteer,
  stepId,
  onSwitchToTrajectory,
  qualitySession,
}: {
  qaReview: import("../data/types").QaReviewState;
  sessionId: string;
  workspacePath: string;
  onPatch: (patch: Partial<AppState>) => void;
  onFixIssues?: (report: string) => void;
  onContinue?: () => void;
  agentSteer?: (step: string, text: string, intent?: string, workspacePath?: string) => void;
  stepId?: string;
  onSwitchToTrajectory?: (msg?: string, roundIndex?: number) => void;
  qualitySession?: import("../agent/types").SessionState;
}) {
  const [outputExpanded, setOutputExpanded] = useState(true);
  const outputEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startedRef = useRef(false);
  const outputLinesRef = useRef<string[]>([]);
  const [fixCompleted, setFixCompleted] = useState(false);
  const prevQualityCompletedRef = useRef(false);

  // 检测 quality 修复 session 完成
  useEffect(() => {
    const prev = prevQualityCompletedRef.current;
    const now = qualitySession?.completed ?? false;
    if (!prev && now && (qualitySession?.turns?.length ?? 0) > 0) {
      setFixCompleted(true);
    }
    prevQualityCompletedRef.current = now;
  }, [qualitySession?.completed, qualitySession?.turns?.length]);

  console.log("[QaReviewSection] render", { status: qaReview.status, outputLines: qaReview.outputLines.length, resultContent: qaReview.resultContent?.length });

  // 自动滚动到输出底部
  useEffect(() => {
    if (outputExpanded && outputEndRef.current) {
      outputEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [qaReview.outputLines.length, outputExpanded]);

  // ── 手动触发 qa-review CLI ──
  const startQaReview = useCallback(() => {
    if (!workspacePath || !sessionId) return;
    if (startedRef.current) return;

    console.log("[QaReviewSection] 手动触发 qa-review CLI", { workspacePath, sessionId });
    startedRef.current = true;
    outputLinesRef.current = [];
    setFixCompleted(false);

    const outputDir = `~/.aiNativeDevPlatform/sessions/${sessionId}`;
    const outputFile = `${outputDir}/quality_result.toml`;

    // 先设为 running 状态
    onPatch({
      qaReview: {
        status: "running",
        outputLines: [],
        resultFilePath: outputFile,
        resultContent: "",
      },
    });

    const controller = new AbortController();
    abortRef.current = controller;

    // 通过后端 API 执行 CLI 命令并流式返回
    agentFetch(`/qa-review?path=${encodeURIComponent(workspacePath)}&sessionId=${encodeURIComponent(sessionId)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        console.log("[QaReviewSection] fetch 响应", { status: response.status, ok: response.ok });
        if (!response.ok) {
          onPatch({
            qaReview: {
              status: "error",
              outputLines: [],
              resultFilePath: outputFile,
              resultContent: "",
              error: `HTTP ${response.status}`,
            },
          });
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          onPatch({
            qaReview: {
              status: "error",
              outputLines: [],
              resultFilePath: outputFile,
              resultContent: "",
              error: "无法读取响应流",
            },
          });
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            console.log("[QaReviewSection] SSE 流读取完毕");
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6));
              console.log("[QaReviewSection] SSE 事件", data.type, data);
              switch (data.type) {
                case "output":
                  outputLinesRef.current = [...outputLinesRef.current, data.line];
                  onPatch({
                    qaReview: {
                      status: "running",
                      outputLines: outputLinesRef.current,
                      resultFilePath: outputFile,
                      resultContent: "",
                    },
                  });
                  break;
                case "complete":
                  // 命令执行完毕，直接使用服务端返回的 resultContent
                  if (data.exitCode === 0) {
                    onPatch({
                      qaReview: {
                        status: "done",
                        outputLines: outputLinesRef.current,
                        resultFilePath: outputFile,
                        resultContent: data.resultContent || "",
                      },
                    });
                  } else {
                    onPatch({
                      qaReview: {
                        status: "error",
                        outputLines: outputLinesRef.current,
                        resultFilePath: outputFile,
                        resultContent: data.resultContent || "",
                        error: `qa-review 退出码: ${data.exitCode}`,
                      },
                    });
                  }
                  break;
                case "error":
                  onPatch({
                    qaReview: {
                      status: "error",
                      outputLines: outputLinesRef.current,
                      resultFilePath: outputFile,
                      resultContent: "",
                      error: data.message,
                    },
                  });
                  break;
              }
            } catch {
              // JSON 解析失败，忽略
            }
          }
        }
      })
      .catch((err) => {
        console.log("[QaReviewSection] fetch 错误", err);
        if (err.name === "AbortError") return;
        onPatch({
          qaReview: {
            status: "error",
            outputLines: outputLinesRef.current,
            resultFilePath: outputFile,
            resultContent: "",
            error: err.message,
          },
        });
      });
  }, [workspacePath, sessionId, onPatch]);

  const isRunning = qaReview.status === "running";
  const isDone = qaReview.status === "done";
  const isError = qaReview.status === "error";
  const isIdle = qaReview.status === "idle";

  // 解析 TOML 结果，判断是否存在问题
  const hasIssues = useMemo(() => {
    if (!isDone || !qaReview.resultContent) return false;
    // 简单判断：如果结果中包含 issues/errors/failures 等关键词，认为存在问题
    const lower = qaReview.resultContent.toLowerCase();
    return (
      lower.includes("issue") ||
      lower.includes("error") ||
      lower.includes("fail") ||
      lower.includes("problem") ||
      lower.includes("warning")
    );
  }, [isDone, qaReview.resultContent]);

  return (
    <div className="summary-section qa-review-section">
      <div className="summary-section-header">
        <Terminal size={15} />
        <span>质量 QA 审查</span>
        {isRunning && (
          <span className="build-badge build-badge-running">
            <Loader2 size={11} className="spin-icon" /> 审查中
          </span>
        )}
        {isDone && (
          <span className="build-badge build-badge-success">✓ 完成</span>
        )}
        {isError && (
          <span className="build-badge build-badge-failure">✗ 失败</span>
        )}
      </div>

      {/* 空闲状态：等待用户手动触发 */}
      {isIdle && (
        <div className="qa-review-idle">
          <div className="qa-review-command-line">
            <span className="qa-review-prompt">$</span>
            <span className="qa-review-command">qa-review --output ~/.aiNativeDevPlatform/sessions/{sessionId}/quality_result.toml</span>
          </div>
          <p className="qa-review-idle-text">点击下方按钮开始质量审查</p>
          <div className="build-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              className="todo-submit-btn"
              type="button"
              onClick={startQaReview}
            >
              <Play size={14} /> 开始质量审查
            </button>
            <button
              className="todo-submit-btn"
              type="button"
              style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
              onClick={() => onContinue?.()}
            >
              <CheckCircle2 size={14} /> 跳过审查，进入下一阶段
            </button>
          </div>
        </div>
      )}

      {/* 运行中 / 已完成：显示 CLI 输出终端 */}
      {(isRunning || isDone || isError) && (
        <>
          {/* 执行的命令 */}
          <div className="qa-review-command-line" style={{ margin: "0 0 8px 0", padding: "6px 10px", background: "#1e1e2e", borderRadius: 6, fontSize: 12 }}>
            <span className="qa-review-prompt">$</span>
            <span className="qa-review-command">qa-review --output ~/.aiNativeDevPlatform/sessions/{sessionId}/quality_result.toml</span>
          </div>

          {/* CLI 输出终端 */}
          <div className="qa-review-output">
            <div
              className="build-output-header build-output-header-clickable"
              onClick={() => setOutputExpanded(!outputExpanded)}
            >
              <span>命令行输出</span>
              <span className="build-output-header-right">
                <span className="build-output-meta">{qaReview.outputLines.length} 行</span>
                <span className="build-expand-icon">
                  {outputExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </span>
              </span>
            </div>
            {outputExpanded && (
              <div className="qa-review-terminal">
                {qaReview.outputLines.map((line, i) => (
                  <div key={i} className="qa-review-line">
                    <span className="qa-review-line-num">{i + 1}</span>
                    <span className="qa-review-line-text">{line}</span>
                  </div>
                ))}
                {isRunning && (
                  <div className="qa-review-line qa-review-line-cursor">
                    <span className="qa-review-line-num">{qaReview.outputLines.length + 1}</span>
                    <span className="qa-review-line-text"><span className="cursor-blink">▋</span></span>
                  </div>
                )}
                <div ref={outputEndRef} />
              </div>
            )}
          </div>

          {/* 运行中提示 */}
          {isRunning && (
            <div className="qa-review-running-hint">
              <Loader2 size={13} className="spin-icon" />
              <span>本地 QA Agent 正在执行，请稍候...</span>
            </div>
          )}

          {/* 结果文件路径 */}
          {qaReview.resultFilePath && (
            <div className="build-command">
              <span className="build-command-label">结果文件：</span>
              <code>{qaReview.resultFilePath}</code>
            </div>
          )}

          {/* 错误信息 */}
          {isError && qaReview.error && (
            <div className="build-status build-failure">
              ❌ {qaReview.error}
            </div>
          )}

          {/* 失败时重试按钮 */}
          {isError && (
            <div className="build-actions">
              <button
                className="todo-submit-btn"
                type="button"
                onClick={() => {
                  startedRef.current = false;
                  startQaReview();
                }}
              >
                <Play size={14} /> 重新执行 QA 审查
              </button>
            </div>
          )}

          {/* 结果内容展示 */}
          {isDone && qaReview.resultContent && (
            <div className="qa-review-result">
              <div className="summary-section-header" style={{ padding: "8px 0", margin: 0 }}>
                <FileText size={14} />
                <span>审查结果</span>
              </div>
              <pre className="qa-review-result-pre"><code>{qaReview.resultContent}</code></pre>
            </div>
          )}

          {/* 修复完成提示 — 独立于 QA 状态，始终展示 */}
          {fixCompleted && (
            <div className="qa-review-fix-done" style={{ marginTop: 16 }}>
              <div className="build-status build-success">
                <CheckCircle2 size={16} /> 修复完成
              </div>
              <p style={{ margin: "8px 0 12px", fontSize: 13, color: "var(--text-secondary)" }}>
                代码已根据质量审查报告完成修复，请重新执行 QA 审查验证修复结果。
              </p>
              <button
                className="todo-submit-btn"
                type="button"
                onClick={() => {
                  startedRef.current = false;
                  startQaReview();
                }}
              >
                <Play size={14} /> 重新开始质量审查
              </button>
            </div>
          )}

          {/* 操作按钮 — 所有状态下都支持进入下一阶段 */}
          {(isRunning || isDone || isError) && (
            <>
              <div className="build-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {isDone && hasIssues && onFixIssues ? (
                  <button
                    className="todo-submit-btn"
                    type="button"
                    onClick={() => onFixIssues(qaReview.resultContent)}
                  >
                    <Wrench size={14} /> 一键修复质量问题
                  </button>
                ) : null}
                {(isDone || isError) && (
                  <button
                    className="todo-submit-btn"
                    type="button"
                    style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
                    onClick={() => {
                      startedRef.current = false;
                      startQaReview();
                    }}
                  >
                    <Play size={14} /> 重新执行 QA 审查
                  </button>
                )}
              </div>
              <div className="build-actions" style={{ marginTop: 8 }}>
                <button
                  className="todo-submit-btn"
                  type="button"
                  onClick={() => onContinue?.()}
                >
                  <CheckCircle2 size={14} /> 进入下一阶段
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── 原型预览 ──────────────────────────────────
function PrototypePreview({
  workspacePath,
  sessionId,
  prototype,
  onPreview,
  onPatch,
  onContinue,
  isAgentConnected,
  agentAbort,
}: {
  workspacePath: string;
  sessionId: string;
  prototype: import("../data/types").PrototypeState;
  onPreview: (content: DrawerContent) => void;
  onPatch: (patch: Partial<AppState>) => void;
  onContinue: () => void;
  isAgentConnected: boolean;
  agentAbort: (step: string) => void;
}) {
  const [loadingHtml, setLoadingHtml] = useState(false);
  const [hasPreviewed, setHasPreviewed] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!workspacePath || !sessionId || prototype.status === "approved") return;
    let cancelled = false;

    const loadManifest = async () => {
      try {
        const params = new URLSearchParams({
          taskId: sessionId,
          file: `prototype.json`,
        });
        const res = await agentFetch(`/session-file?${params.toString()}`);
        if (!res.ok) throw new Error("未找到原型产物清单");
        const data = await res.json() as { content?: string };
        const manifest = parsePrototypeManifest(data.content, sessionId);
        if (!manifest || manifest.status === "pending") throw new Error("原型产物尚未生成完成");
        if (cancelled) return;

        const changed = prototype.mode !== manifest.mode
          || prototype.status !== manifest.status
          || prototype.htmlPath !== manifest.htmlPath
          || prototype.handoffPath !== manifest.handoffPath;
        if (changed) onPatch({ prototype: manifest });
        setError("");
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "原型产物加载失败");
        }
      }
    };

    void loadManifest();
    return () => { cancelled = true; };
  }, [workspacePath, sessionId, prototype, onPatch]);

  const handlePreview = useCallback(async () => {
    if (!workspacePath || !sessionId || !prototype.htmlPath) return;
    setLoadingHtml(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("taskId", sessionId);
      params.set("file", prototype.htmlPath);
      const res = await agentFetch(`/session-file?${params.toString()}`);
      if (!res.ok) throw new Error("原型文件不存在或无法读取");
      const data = await res.json() as { content?: string };
      if (!data.content) throw new Error("原型文件内容为空");
      onPreview({
        type: "html",
        title: "交互原型预览",
        html: data.content,
      });
      setHasPreviewed(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "原型预览加载失败");
    } finally {
      setLoadingHtml(false);
    }
  }, [workspacePath, sessionId, prototype.htmlPath, onPreview]);

  return (
    <div className="summary-section prototype-section">
      <div className="summary-section-header">
        <Eye size={15} />
        <span>交互原型</span>
        {prototype.status === "approved" && (
          <span className="build-badge build-badge-success">✓ 已确认</span>
        )}
        {prototype.status === "generating" && (
          <span className="build-badge build-badge-running">
            <Loader2 size={11} className="spin-icon" /> 生成中
          </span>
        )}
        {prototype.status === "skipped" && (
          <span className="build-badge">无需原型</span>
        )}
      </div>

      {prototype.mode !== "none" && (
        <div className="prototype-mode-info">
          <span className="build-command-label">原型类型：</span>
          <code>{prototype.mode === "new-page" ? "新页面" : "已有页面局部修改"}</code>
        </div>
      )}

      {error && (
        <div className="prototype-error" role="alert">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      <div className="build-actions prototype-actions">
        {prototype.status === "generating" && (
          <button
            className="todo-submit-btn prototype-skip-btn"
            type="button"
            onClick={() => {
              agentAbort("prototype");
              onPatch({ prototype: { ...prototype, status: "skipped", mode: "none" } });
              onContinue();
            }}
          >
            <span>取消生成，进入下一阶段</span>
          </button>
        )}
        <button
          className="todo-submit-btn"
          type="button"
          onClick={handlePreview}
          disabled={loadingHtml || !isAgentConnected || (prototype.status !== "reviewing" && prototype.status !== "approved") || !prototype.htmlPath}
        >
          {loadingHtml ? (
            <><Loader2 size={14} className="spin-icon" /> 加载中...</>
          ) : (
            <><Eye size={14} /> 预览原型</>
          )}
        </button>
        {prototype.status === "reviewing" && (
          <button
            className="todo-submit-btn prototype-confirm-btn"
            type="button"
            disabled={!hasPreviewed}
            onClick={() => {
              onPatch({ prototype: { ...prototype, status: "approved" } });
              onContinue();
            }}
          >
            <CheckCircle2 size={14} /> 确认原型，进入技术设计
          </button>
        )}
        {prototype.status === "skipped" && (
          <button className="todo-submit-btn" type="button" onClick={onContinue}>
            <CheckCircle2 size={14} /> 进入技术设计
          </button>
        )}
      </div>
    </div>
  );
}

// ── 文件变更按钮 ─────────────────────────────
function FileChangesButton({ files, onOpenRepoExplorer }: { files: FileChange[]; onOpenRepoExplorer?: (tab: RepoTab) => void }) {
  if (files.length === 0) return null;

  const totalAdditions = files.reduce((sum, f) => sum + (f.additions || 0), 0);
  const totalDeletions = files.reduce((sum, f) => sum + (f.deletions || 0), 0);

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

      {/* 跳转按钮 */}
      <button
        className="filechanges-repo-btn"
        type="button"
        onClick={() => onOpenRepoExplorer?.("diff")}
      >
        <Code2 size={15} />
        <span>查看项目代码仓库变更</span>
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

// ── Specs 目录树 ──────────────────────────────

type SpecNode = {
  name: string;
  type: "file" | "folder";
  children?: SpecNode[];
};

function SpecsDirectory({
  workspacePath,
  taskId,
  onFileClick,
}: {
  workspacePath: string;
  taskId?: string;
  onFileClick: (path: string, name: string) => void;
}) {
  const [nodes, setNodes] = useState<SpecNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspacePath && !taskId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams();
    if (workspacePath) params.set("path", workspacePath);
    if (taskId) params.set("taskId", taskId);
    agentFetch(`/specs-tree?${params.toString()}`)
      .then((res) => res.json())
      .then((data: SpecNode[]) => {
        setNodes(data);
        setLoading(false);
      })
      .catch(() => {
        setNodes([]);
        setLoading(false);
      });
  }, [workspacePath, taskId]);

  if (loading) {
    return (
      <div className="summary-section specs-section">
        <div className="summary-section-header">
          <FolderOpen size={15} />
          <span>交付Spec</span>
        </div>
        <div className="specs-empty">
          <Loader2 size={20} className="spin-icon" />
          <p>正在加载 specs 目录...</p>
        </div>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="summary-section specs-section">
        <div className="summary-section-header">
          <FolderOpen size={15} />
          <span>交付Spec</span>
          <em className="summary-section-count">0 项</em>
        </div>
        <div className="specs-empty">
          <FileText size={20} />
          <p>specs/ 目录为空，暂无交付Spec</p>
        </div>
      </div>
    );
  }

  return (
    <div className="summary-section specs-section">
      <div className="summary-section-header">
        <FolderOpen size={15} />
        <span>交付Spec</span>
        <em className="summary-section-count">{countFiles(nodes)} 项</em>
      </div>
      <div className="specs-tree">
        {nodes.map((node) => (
          <SpecTreeNode
            key={node.name}
            node={node}
            depth={0}
            path={node.name}
            onFileClick={onFileClick}
          />
        ))}
      </div>
    </div>
  );
}

function SpecTreeNode({
  node,
  depth,
  path,
  onFileClick,
}: {
  node: SpecNode;
  depth: number;
  path: string;
  onFileClick: (path: string, name: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  if (node.type === "folder") {
    return (
      <div className="specs-tree-folder">
        <button
          className="specs-tree-toggle"
          type="button"
          onClick={() => setExpanded(!expanded)}
          style={{ paddingLeft: depth * 16 }}
        >
          <ChevronRight
            size={14}
            style={{
              transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.2s",
            }}
          />
          <Folder size={14} />
          <span>{node.name}</span>
        </button>
        {expanded && node.children?.map((child) => (
          <SpecTreeNode
            key={child.name}
            node={child}
            depth={depth + 1}
            path={`${path}/${child.name}`}
            onFileClick={onFileClick}
          />
        ))}
      </div>
    );
  }

  return (
    <button
      className="specs-tree-file"
      type="button"
      style={{ paddingLeft: depth * 16 + 20 }}
      onClick={() => onFileClick(path, node.name)}
    >
      <FileText size={14} />
      <span>{node.name}</span>
    </button>
  );
}

function countFiles(nodes: SpecNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.type === "file") count++;
    if (node.children) count += countFiles(node.children);
  }
  return count;
}

// ── 待决策事项 ───────────────────────────────
function TodoSection({
  todos,
  todoAnswers,
  onPatch,
  stepId,
  agentPrompt,
  agentSteer,
  onContinue,
  stepIndex,
  agentSession,
  prototypeState,
}: {
  todos: TodoItem[];
  todoAnswers: Record<number, string | string[]>;
  onPatch: (patch: Partial<AppState>) => void;
  stepId: string;
  agentPrompt: (step: string, text: string) => Promise<void>;
  agentSteer: (step: string, text: string, intent?: string) => void;
  onContinue: () => void;
  stepIndex: number;
  agentSession?: { id: string; completed?: boolean; isStreaming?: boolean };
  prototypeState?: import("../data/types").PrototypeState;
}) {
  if (todos.length === 0) return null;

  // 上下文输入 key（使用负数避免与 todo index 冲突）
  const CONTEXT_KEY = -1;
  const contextValue = (todoAnswers[CONTEXT_KEY] as string) || "";

  // 检查是否所有待决策项都已作答（上下文输入为可选）
  const allAnswered = todos.every((_, ti) => {
    const answer = todoAnswers[ti];
    return answer !== undefined && (typeof answer === "string" ? answer.trim() !== "" : answer.length > 0);
  });
  const [submitting, setSubmitting] = useState(false);
  const [qaUncheckedWarning, setQaUncheckedWarning] = useState(false);

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

      // quality 阶段：若 quality session 不存在或未完成（未运行），阻止进入下一阶段并显示警告
      if (stepId === "quality" && allChoiceAdvance) {
        const qualitySessionExists = agentSession && agentSession.id;
        const qualitySessionRunning = qualitySessionExists && !agentSession.completed;
        if (!qualitySessionRunning) {
          setQaUncheckedWarning(true);
          return;
        }
      }

      // prototype 阶段：若原型未确认，阻止进入下一阶段
      if (stepId === "prototype" && allChoiceAdvance) {
        if (!prototypeState || (prototypeState.status !== "approved" && prototypeState.status !== "skipped")) {
          setQaUncheckedWarning(true);
          return;
        }
      }

      // 如果有补充的业务背景，先通过 agentSteer 发送，然后继续对话（不进入下一阶段）
      const contextText = contextValue.trim();
      if (contextText) {
        agentSteer(stepId, contextText);
        // 有补充输入时不进入下一阶段，而是继续与 Agent 对话
        const lines = todos.map((todo, ti) => {
          const answer = todoAnswers[ti];
          const answerText = Array.isArray(answer) ? answer.join("、") : answer;
          return `【${todo.task}】\n回答：${answerText}`;
        });
        const message = `以下是对待决策事项的回答：\n\n${lines.join("\n\n")}`;
        await agentPrompt(stepId, message);
        return;
      }

      if (allChoiceAdvance) {
        onContinue();
        return;
      }

      // 将输入内容作为提示词发给 Agent 继续对话
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

  const handleContextChange = (value: string) => {
    onPatch({ todoAnswers: { ...todoAnswers, [CONTEXT_KEY]: value } });
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

      {/* 补充诉求与约束 — 合并到待决策模块 */}
      <div className="todo-context-row">
        <div className="todo-context-header">
          <MessageSquare size={13} />
          <span>补充诉求与约束</span>
          <span className="todo-context-optional">可选</span>
        </div>
        <textarea
          className="todo-context-input"
          value={contextValue}
          onChange={(e) => handleContextChange(e.target.value)}
          placeholder={getPlaceholderForStage(stepIndex)}
          rows={2}
        />
      </div>

      {/* quality / prototype 阶段未完成警告 */}
      {qaUncheckedWarning && (
        <div className="qa-unchecked-warning">
          <AlertTriangle size={14} />
          <span>
            {stepId === "prototype"
              ? "交互原型尚未确认，请先预览并确认原型后再进入下一阶段"
              : "质量 QA 审查尚未执行，请先完成质量审查后再进入下一阶段"}
          </span>
        </div>
      )}

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

// ── 补充业务背景/边界条件 — 专用输入 + 提交按钮 ──
function ContextSubmitInput({
  stepId,
  agentSteer,
  placeholder,
}: {
  stepId: string;
  agentSteer: (step: string, text: string, intent?: string) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    const text = input.trim();
    if (!text) return;
    agentSteer(stepId, text);
    setInput("");
    // 提交后自动聚焦，方便连续输入
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="context-submit-row">
      <div className="context-submit-header">
        <MessageSquare size={13} />
        <span>补充诉求与约束</span>
      </div>
      <div className="context-submit-body">
        <textarea
          ref={inputRef}
          className="context-submit-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={2}
        />
        <button
          className="context-submit-btn"
          type="button"
          onClick={handleSubmit}
          disabled={!input.trim()}
        >
          <Send size={14} />
          <span>提交</span>
        </button>
      </div>
    </div>
  );
}

// ── Tab 2: AI 任务轨迹（单栏·固定高度轮次） ──
function TrajectoryChatTab({
  trajectory,
  stepIndex,
  stepId,
  agentSteer,
  agentAbort,
  agentPrompt,
  agentAnswerQuestion,
  agentContinueQuestion,
  agentResumeQuestion,
  agentSession,
  restoredSession,
  isAgentConnected,
  pendingAutoMessage,
  onConsumeAutoMessage,
  scrollToRound,
  onConsumeScrollToRound,
  intent,
  initialPrompts,
  stepSummaries,
  workspaceInitStatus,
  onRetryClone,
  onOpenRollback,
}: {
  trajectory: TrajectoryTurn[];
  stepIndex: number;
  stepId: string;
  agentSteer: (step: string, text: string, intent?: string) => void;
  agentAbort: (step: string) => void;
  agentPrompt: (step: string, text: string) => Promise<void>;
  agentAnswerQuestion: (step: string, answer: string) => Promise<void>;
  agentContinueQuestion: (step: string) => Promise<void>;
  agentResumeQuestion?: (step: string, answer: string) => Promise<void>;
  agentSession?: SessionState;
  restoredSession?: {
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    turns: Array<{
      id: string;
      index: number;
      status: "running" | "done";
      textContent: string;
      thinking: string;
      toolCalls: Array<{
        id: string;
        name: string;
        status: "running" | "done" | "error";
        category: string;
        input: string;
        result?: string;
        outputFragments?: string[];
      }>;
    }>;
    summary: string;
    totalTokenUsage?: import("../agent/types").TokenUsage;
    turnTokenUsage?: Record<number, import("../agent/types").TokenUsage>;
    summarizationResult?: import("../data/types").AgentSummary | null;
  };
  isAgentConnected: boolean;
  pendingAutoMessage: string | null;
  onConsumeAutoMessage: () => void;
  scrollToRound?: number | null;
  onConsumeScrollToRound?: () => void;
  intent: string;
  initialPrompts: Record<string, string>;
  stepSummaries: Record<string, string>;
  workspaceInitStatus?: WorkspaceInitStatus;
  onRetryClone?: () => void;
  onOpenRollback?: () => void;
}) {
  const [input, setInput] = useState("");
  const [expandedRoundIds, setExpandedRoundIds] = useState<Set<string>>(new Set());
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [modalContent, setModalContent] = useState<ModalContent | null>(null);
  const [descExpanded, setDescExpanded] = useState(false);
  // final round 在最后一轮完成时自动展开
  const lastExpandedRef = useRef<string | null>(null);
  const roundsContainerRef = useRef<HTMLDivElement>(null);

  // 构建展示用的轮次列表
  const displayTurns = buildDisplayTurns(agentSession, trajectory, isAgentConnected);

  // 从所有轮次中收集事件时间线（扁平化）
  const timeline = useTimeline(displayTurns, isAgentConnected, agentSession, initialPrompts, restoredSession);

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

  // 自动发送 pendingAutoMessage（来自"继续对话"按钮）
  useEffect(() => {
    if (pendingAutoMessage && isAgentConnected) {
      const msg = pendingAutoMessage;
      onConsumeAutoMessage();
      // 如果有 pending question，走 answer + continue 流程，避免 agentSteer 破坏问答上下文
      if (hasPendingQuestion(agentSession) && agentAnswerQuestion && agentContinueQuestion) {
        console.log("[DecisionBoard] pendingAutoMessage — pending question detected, routing as answer + continue");
        agentAnswerQuestion(stepId, msg).then(() => {
          return agentContinueQuestion(stepId);
        }).catch((err) => {
          console.error("[DecisionBoard] pendingAutoMessage — answer question failed:", err);
        });
      } else {
        requestAnimationFrame(() => {
          agentSteer(stepId, msg);
        });
      }
    }
  }, [pendingAutoMessage, isAgentConnected, stepId, agentSteer, agentAnswerQuestion, agentContinueQuestion, agentSession, onConsumeAutoMessage]);

  // 跳转到指定轮次（来自交付协作模块的"跳转到最新一轮"）
  useEffect(() => {
    if (scrollToRound == null) return;
    // 展开目标轮次
    const targetGroup = roundGroups.find((g) => g.index === scrollToRound);
    if (targetGroup) {
      setExpandedRoundIds((prev) => new Set([...prev, targetGroup.id]));
      // 等待 DOM 更新后滚动
      requestAnimationFrame(() => {
        const el = roundsContainerRef.current?.querySelector(
          `[data-round-index="${scrollToRound}"]`
        );
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    }
    onConsumeScrollToRound?.();
  }, [scrollToRound, roundGroups, onConsumeScrollToRound]);

  const handleSend = () => {
    const text = input.trim();
    console.log("[DecisionBoard] handleSend", { text, stepId, isAgentConnected, hasIntent: !!intent, hasPendingQuestion: hasPendingQuestion(agentSession) });
    if (!text) return;
    if (!isAgentConnected) {
      console.warn("[DecisionBoard] handleSend — agent not connected, keeping input");
      return; // 不清空输入，让用户知道未连接
    }
    setInput("");

    // 如果 Agent 正在等待用户回答问题（ask_user_question 工具 running），
    // 则将聊天输入框的内容作为问题的自定义回答，走 answerQuestion → continueQuestion 流程，
    // 避免走 agentSteer 导致上下文丢失或流程卡死。
    if (hasPendingQuestion(agentSession) && agentAnswerQuestion && agentContinueQuestion) {
      console.log("[DecisionBoard] handleSend — pending question detected, routing as answer + continue");
      agentAnswerQuestion(stepId, text).then(() => {
        return agentContinueQuestion(stepId);
      }).catch((err) => {
        console.error("[DecisionBoard] handleSend — answer question failed:", err);
        // 失败时放回输入框，让用户重试
        setInput(text);
      });
      return;
    }

    console.log("[DecisionBoard] handleSend — calling agentSteer", { stepId, text: text.slice(0, 50), intent });
    agentSteer(stepId, text, intent);
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
            <TokenUsageBadge
              usage={(() => {
                const tu = agentSession?.totalTokenUsage ?? restoredSession?.totalTokenUsage;
                return tu ? {
                  inputTokens: tu.input,
                  outputTokens: tu.output,
                  cacheRead: tu.cacheRead,
                  totalTokens: tu.total,
                  contextWindow: tu.contextWindow ?? 0,
                } : null;
              })()}
            />
            <span className="trajectory-turn-summary">
              {agentSession?.turns.length || displayTurns.length} 轮对话
            </span>
          </div>
        )}

        <div className="trajectory-rounds" ref={roundsContainerRef}>
          {/* 任务描述卡片 */}
          {intent && (
            <div className="trajectory-task-desc">
              <div className="task-desc-header">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                <span>任务描述</span>
              </div>
              <p className={`task-desc-text${descExpanded ? ' expanded' : ''}`}>{intent}</p>
              <button
                className={`task-desc-expand-btn visible`}
                onClick={() => setDescExpanded(!descExpanded)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={descExpanded ? 'rotated' : ''}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                {descExpanded ? '收起' : '展开'}
              </button>
            </div>
          )}

          {/* 当前任务信息 */}
          {agentSession && (agentSession.turns?.length ?? 0) > 0 && (
            <div className="trajectory-current-task">
              <div className="current-task-header">
                <Loader2 size={14} className="spin-icon" />
                <span>当前任务进行中</span>
              </div>
              <div className="current-task-body">
                <span className="current-task-rounds">{agentSession.turns.length} 轮对话</span>
                {agentSession.summary && (
                  <p className="current-task-summary">{agentSession.summary.slice(0, 200)}</p>
                )}
              </div>
            </div>
          )}

          {/* 历史任务列表 */}
          {Object.keys(stepSummaries).length > 0 && (
            <div className="trajectory-history-tasks">
              <div className="history-tasks-header">
                <FileText size={14} />
                <span>历史任务</span>
              </div>
              <div className="history-tasks-list">
                {Object.entries(stepSummaries).map(([sid, brief]) => (
                  <div key={sid} className={`history-task-item ${sid === stepId ? "active" : ""}`}>
                    <div className="history-task-step">{sid.toUpperCase()}</div>
                    <p className="history-task-brief">{brief}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 从历史记录恢复的对话 — 已通过 timeline 按轮次渲染 */}
          {restoredSession && restoredSession.summary && (
            <div className="restored-history-summary">
              <span className="detail-label">步骤总结</span>
              <p>{restoredSession.summary}</p>
            </div>
          )}

          {displayTurns.length === 0 && timeline.length === 0 && !isAgentConnected && (
            <div className="trajectory-empty">
              <Bot size={24} />
              <p>连接 Agent 后将在此展示实时工作轨迹</p>
            </div>
          )}
          {displayTurns.length === 0 && timeline.length === 0 && isAgentConnected && workspaceInitStatus?.stage === "error" && (
            <div className="trajectory-waiting trajectory-clone-error">
              <AlertTriangle size={20} />
              <p>{workspaceInitStatus.error || "仓库克隆失败，未知错误"}</p>
              {workspaceInitStatus.elapsedMs != null && (
                <p className="trajectory-progress">
                  耗时 {Math.round(workspaceInitStatus.elapsedMs / 1000)} 秒
                  {workspaceInitStatus.retryCount ? `（已重试 ${workspaceInitStatus.retryCount} 次）` : ""}
                </p>
              )}
              {onRetryClone && (
                <button
                  className="todo-submit-btn"
                  type="button"
                  onClick={onRetryClone}
                >
                  <RefreshCw size={14} /> 重试克隆
                </button>
              )}
            </div>
          )}
          {displayTurns.length === 0 && timeline.length === 0 && isAgentConnected && workspaceInitStatus?.stage === "cloning" && (
            <div className="trajectory-waiting">
              <Loader2 size={20} className="spin-icon" />
              <p>
                正在克隆 Git 仓库...
                {workspaceInitStatus.retryCount ? `（第 ${workspaceInitStatus.retryCount + 1} 次尝试）` : ""}
              </p>
              {workspaceInitStatus.progress && (
                <p className="trajectory-progress">{workspaceInitStatus.progress}</p>
              )}
              {workspaceInitStatus.startedAt && (
                <p className="trajectory-progress" style={{ fontSize: "0.68rem", marginTop: 2 }}>
                  已用 {Math.round((Date.now() - workspaceInitStatus.startedAt) / 1000)} 秒
                </p>
              )}
            </div>
          )}
          {displayTurns.length === 0 && timeline.length === 0 && isAgentConnected && workspaceInitStatus?.stage !== "cloning" && workspaceInitStatus?.stage !== "error" && (
            <div className="trajectory-waiting">
              <Loader2 size={20} className="spin-icon" />
              <p>等待 Agent 开始工作...</p>
            </div>
          )}

          {/* 按轮次分组渲染，用户输入穿插在轮次之间 */}
          {(() => {
            // 收集所有 user 事件
            const userEvents = timeline.filter((e) => e.type === "user");
            // 收集所有 complete/error 事件
            const postEvents = timeline.filter((e) => e.type === "complete" || e.type === "error");

            // 构建交错列表：每个 round group 前插入对应的 user 事件
            const items: { type: "round" | "user" | "post"; group?: typeof roundGroups[0]; event?: TimelineEvent }[] = [];

            // 按 timeline 原始顺序交错：遍历 timeline，遇到 user 就插入 user，遇到 round-divider 就插入对应的 round group
            let groupIdx = 0;
            for (const evt of timeline) {
              if (evt.type === "user") {
                items.push({ type: "user", event: evt });
              } else if (evt.type === "round-divider") {
                if (groupIdx < roundGroups.length) {
                  items.push({ type: "round", group: roundGroups[groupIdx] });
                  groupIdx++;
                }
              }
            }

            // 追加剩余的 round groups（兜底）
            while (groupIdx < roundGroups.length) {
              items.push({ type: "round", group: roundGroups[groupIdx] });
              groupIdx++;
            }

            return items.map((item) => {
              if (item.type === "user" && item.event) {
                return (
                  <TimelineEventV2
                    key={item.event.id}
                    event={item.event}
                    stepId={stepId}
                    agentAnswerQuestion={agentAnswerQuestion}
                    agentContinueQuestion={agentContinueQuestion}
                    agentResumeQuestion={agentResumeQuestion}
                    isExpanded={false}
                    onToggleExpand={() => {}}
                    onOpenModal={openModal}
                  />
                );
              }

              if (item.type === "round" && item.group) {
                const group = item.group;
                const isExpanded = expandedRoundIds.has(group.id);
                const reasoningPreview = getReasoningPreview(group.events);
                return (
                  <div
                    key={group.id}
                    data-round-index={group.index}
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
                        {group.status !== "running" && onOpenRollback && (
                          <button
                            className="ghost-button small"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onOpenRollback();
                            }}
                          >
                            <RotateCcw size={11} />
                            回退
                          </button>
                        )}
                        {group.toolCount > 0 && (
                          <span className="round-group-badge">
                            <Wrench size={10} />
                            {group.toolCount} 工具
                          </span>
                        )}
                        {(agentSession?.turnTokenUsage ?? restoredSession?.turnTokenUsage)?.[group.index] && (
                          <span
                            className="round-group-badge token-badge"
                            title={`输入: ${(() => { const tu = (agentSession?.turnTokenUsage ?? restoredSession?.turnTokenUsage)?.[group.index]; return tu ? tu.input.toLocaleString() : '0'; })()} | 输出: ${(() => { const tu = (agentSession?.turnTokenUsage ?? restoredSession?.turnTokenUsage)?.[group.index]; return tu ? tu.output.toLocaleString() : '0'; })()} | 总计: ${(() => { const tu = (agentSession?.turnTokenUsage ?? restoredSession?.turnTokenUsage)?.[group.index]; return tu ? tu.total.toLocaleString() : '0'; })()}`}
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10"/>
                              <polyline points="12 6 12 12 16 14"/>
                            </svg>
                            {(() => { const tu = (agentSession?.turnTokenUsage ?? restoredSession?.turnTokenUsage)?.[group.index]; return tu ? tu.total.toLocaleString() : '0'; })()}
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
                            agentContinueQuestion={agentContinueQuestion}
                            agentResumeQuestion={agentResumeQuestion}
                            isExpanded={event.type === "tool" || event.type === "diff"}
                            onToggleExpand={() => {}}
                            onOpenModal={openModal}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              return null;
            });
          })()}

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
                    stepId={stepId}
                    agentAnswerQuestion={agentAnswerQuestion}
                    agentContinueQuestion={agentContinueQuestion}
                    agentResumeQuestion={agentResumeQuestion}
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
          {agentSession?.isStreaming ? (
            <button
              className="chat-stop-btn"
              type="button"
              onClick={() => agentAbort(stepId)}
              title="中断当前会话"
            >
              <Square size={16} />
            </button>
          ) : (
            <button
              className="chat-send-btn"
              type="button"
              onClick={handleSend}
              disabled={!input.trim()}
            >
              <Send size={16} />
            </button>
          )}
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

/**
 * useTimeline — 将 turns 和 session.messages 扁平化为事件流。
 *
 * 用户输入展示策略：
 * - 仅展示用户主动输入（steer），过滤掉系统自动生成的 initialPrompts
 * - 每个 turn 前展示对应的用户输入（按 messages 中 user 消息的顺序匹配）
 * - 未被消费的用户消息（如 steer 后 agent 尚未产生新 turn）追加到末尾
 */
function useTimeline(
  turns: Turn[],
  isAgentConnected: boolean,
  agentSession?: SessionState,
  initialPrompts?: Record<string, string>,
  restoredSession?: StepSessionSnapshot,
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // 如果存在 restoredSession，将历史消息注入 timeline 作为初始事件
  // 注意：当 turns 已经包含 restored 的轮次时（继续执行场景），跳过注入避免重复
  const hasRestoredInTurns = restoredSession && turns.length >= (restoredSession.turns || []).length;
  if (restoredSession && !hasRestoredInTurns) {
    const restoredTurns = restoredSession.turns || [];
    const restoredMsgs = restoredSession.messages || [];

    if (restoredTurns.length > 0) {
      // 从 turns 构建 timeline。
      // turns 中可能包含 role="user" 的条目（用户输入），
      // 以及 role="assistant" 的条目（agent 回复）。
      // 按顺序遍历，遇到 user 条目就展示用户消息，遇到 assistant 条目就展示 agent 回复。
      for (let ti = 0; ti < restoredTurns.length; ti++) {
        const turn = restoredTurns[ti] as any;
        if (turn.role === "user") {
          // 用户输入消息
          events.push({
            type: "user",
            id: `restored-user-${ti}`,
            content: turn.textContent,
          });
        } else {
          // assistant 回复
          events.push({
            type: "round-divider",
            id: `restored-div-${turn.id}`,
            roundIndex: ti + 1,
            status: "done",
          });
          if (turn.thinking) {
            events.push({
              type: "thought",
              id: `restored-thought-${turn.id}`,
              content: turn.thinking,
              status: "done",
            });
          }
          for (const tc of turn.toolCalls || []) {
            events.push({
              type: "tool",
              id: `restored-tool-${tc.id}`,
              toolCall: tc,
            });
          }
          // ask_user_question 的回答已在 AskUserQuestionCard 中内联展示，
          // 不再作为独立 user 事件插入，避免重复渲染。
          if (turn.textContent) {
            events.push({
              type: "message",
              id: `restored-msg-${turn.id}`,
              content: turn.textContent,
              status: "done",
            });
          }
        }
      }
    } else if (restoredTurns.length === 0) {
      // 没有 turns，退回到用 messages 构建简单事件
      for (const msg of restoredMsgs) {
        if (msg.role === "user") {
          events.push({
            type: "user",
            id: `restored-user-${events.length}`,
            content: msg.content,
          });
        } else {
          events.push({
            type: "message",
            id: `restored-msg-${events.length}`,
            content: msg.content,
            status: "done",
          });
        }
      }
    }
  }

  // 记录历史轮次数量，用于实时轮次的 roundIndex 偏移
  // 当 turns 已包含 restored 轮次时，偏移量为 0（因为 turns 中的 roundIndex 已经是完整索引）
  const restoredRoundCount = hasRestoredInTurns ? 0 : (restoredSession ? (restoredSession.turns || []).length : 0);

  // 收集所有系统自动生成的 prompt 文本，用于过滤
  const systemPromptSet = new Set(Object.values(initialPrompts || {}));

  // 判断一条 user 消息是否应该展示
  function shouldShowUserMessage(content: string): boolean {
    if (systemPromptSet.has(content)) return false;
    if (content.startsWith("以下是对待决策事项的回答：")) return false;
    return true;
  }

  // 遍历 turns，按 turn 的实际顺序构建事件流。
  // role="user" 的 turn 直接展示为用户消息（按其在 turns 中的位置排列），
  // role="assistant" 的 turn 展开为 round-divider + thought + tool + message。
  for (let ri = 0; ri < turns.length; ri++) {
    const turn = turns[ri];

    // role="user" 的 turn → 直接展示为用户消息
    if ((turn as any).role === "user") {
      if (shouldShowUserMessage(turn.textContent)) {
        events.push({
          type: "user",
          id: `user-${ri}`,
          content: turn.textContent,
        });
      }
      continue;
    }

    // role="assistant" 的 turn → 轮次分隔线
    events.push({
      type: "round-divider",
      id: `div-${turn.id}`,
      roundIndex: ri + 1 + restoredRoundCount,
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
    for (const tc of turn.toolCalls || []) {
      const output = (tc.outputFragments || []).join("");
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

    // ask_user_question 的回答已在 AskUserQuestionCard 中内联展示，
    // 不再作为独立 user 事件插入，避免轮次计数断裂。
  }

  // 如果 turns 中最后一个 turn 是 user 类型且尚未被展示（steer 后 agent 尚未产生新 turn），
  // 它已经在上面循环中被处理了，无需额外逻辑。
  // 保留此段仅用于兜底：当 messages 中有 user 消息但 turns 中没有对应 user turn 时。
  // 当前所有 user 输入（steer/prompt/answerQuestion）都会写入 turns，此兜底极少触发。

  // 如果 agent 正在 streaming 但轮次里没有 textContent 也没有 turn
  if (isAgentConnected && agentSession?.isStreaming && agentSession.streamingText && turns.length === 0) {
    events.push({
      type: "round-divider",
      id: "div-streaming",
      roundIndex: 1 + restoredRoundCount,
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

    // 过滤掉 complete、error、user 和 round-divider（它们由头部或外部渲染）
    const events = allEvents.filter(
      (e) => e.type !== "complete" && e.type !== "error" && e.type !== "round-divider" && e.type !== "user",
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
  agentContinueQuestion,
  agentResumeQuestion,
  isExpanded,
  onToggleExpand,
  onOpenModal,
}: {
  toolCall: ToolCallRecord;
  stepId?: string;
  agentAnswerQuestion?: (step: string, answer: string) => Promise<void>;
  agentContinueQuestion?: (step: string) => Promise<void>;
  agentResumeQuestion?: (step: string, answer: string) => Promise<void>;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onOpenModal: (mc: ModalContent) => void;
}) {
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 从 input 中解析 question 和 options 字段
  let question = "";
  let options: string[] | undefined;
  try {
    const parsed = JSON.parse(tc.input);
    question = parsed.question || tc.input;
    options = parsed.options;
  } catch {
    question = tc.input;
  }

  // 如果已有 result（已回答过），显示结果
  const alreadyAnswered = tc.status === "done" && tc.result;
  // 如果工具执行出错（如超时），问答已不可用
  const questionErrored = tc.status === "error";

  // 自动 resume：仅在组件挂载时（历史恢复场景）触发一次。
  // 使用 useRef 记录初始值，后续 alreadyAnswered 变化（live 流中工具完成）不触发。
  const initialAnsweredRef = useRef(alreadyAnswered);
  const autoResumeRef = useRef(false);
  useEffect(() => {
    if (
      initialAnsweredRef.current &&
      alreadyAnswered &&
      agentResumeQuestion &&
      stepId &&
      tc.result &&
      !autoResumeRef.current
    ) {
      autoResumeRef.current = true;
      agentResumeQuestion(stepId, tc.result).catch(() => {});
    }
  }, [alreadyAnswered, agentResumeQuestion, stepId, tc.result]);

  const handleSelectOption = async (opt: string) => {
    if (!stepId) {
      console.warn("[AskUserQuestionCard] handleSelectOption — stepId is missing, cannot answer");
      return;
    }
    if (!agentAnswerQuestion) {
      console.warn("[AskUserQuestionCard] handleSelectOption — agentAnswerQuestion is missing, cannot answer");
      return;
    }
    setAnswer(opt);
    setSubmitting(true);
    try {
      await agentAnswerQuestion(stepId, opt);
      setSubmitted(true);
      // 选项点击后自动继续
      if (agentContinueQuestion) {
        await agentContinueQuestion(stepId);
      }
    } catch (err) {
      console.error("[AskUserQuestionCard] handleSelectOption failed:", err);
      // 失败时重置状态，让用户重试
      setSubmitted(false);
      setAnswer("");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!answer.trim()) return;
    if (!stepId) {
      console.warn("[AskUserQuestionCard] handleSubmit — stepId is missing, cannot answer");
      return;
    }
    if (!agentAnswerQuestion) {
      console.warn("[AskUserQuestionCard] handleSubmit — agentAnswerQuestion is missing, cannot answer");
      return;
    }
    setSubmitting(true);
    try {
      await agentAnswerQuestion(stepId, answer.trim());
      setSubmitted(true);
      // 自定义输入提交后自动继续
      if (agentContinueQuestion) {
        await agentContinueQuestion(stepId);
      }
    } catch (err) {
      console.error("[AskUserQuestionCard] handleSubmit failed:", err);
      // 失败时重置状态，让用户重试
      setSubmitted(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleContinue = async () => {
    if (!stepId) {
      console.warn("[AskUserQuestionCard] handleContinue — stepId is missing, cannot continue");
      return;
    }
    if (!agentContinueQuestion) {
      console.warn("[AskUserQuestionCard] handleContinue — agentContinueQuestion is missing, cannot continue");
      return;
    }
    setContinuing(true);
    try {
      await agentContinueQuestion(stepId);
    } catch (err) {
      console.error("[AskUserQuestionCard] handleContinue failed:", err);
    } finally {
      setContinuing(false);
    }
  };

  /** 从历史恢复后继续问答（重建 session 并发送已存储的回答） */
  const handleResume = async () => {
    if (!stepId || !agentResumeQuestion || !tc.result) return;
    setResuming(true);
    try {
      await agentResumeQuestion(stepId, tc.result);
    } catch {
      // 错误由 ws 层处理
    } finally {
      setResuming(false);
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
            {questionErrored ? "问答已超时/出错" : alreadyAnswered ? "已回答" : submitted ? "已提交，等待继续" : "等待您的回答"}
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

            {questionErrored ? (
              <div className="ask-question-answered" style={{ opacity: 0.7 }}>
                <div className="ask-question-answer-label" style={{ color: "var(--color-error, #e74c3c)" }}>
                  此问答已失效（超时或 Agent 已终止）。请使用下方聊天输入框发送消息继续对话。
                </div>
              </div>
            ) : alreadyAnswered ? (
              <div className="ask-question-answered">
                <div className="ask-question-answer-label">您的回答：</div>
                <div className="ask-question-answer-value">{tc.result}</div>
                {/* 从历史恢复的场景：显示"继续执行"按钮 */}
                {/* 仅在组件挂载时 alreadyAnswered 就为 true（历史恢复）时显示，避免 live 流中用户回答后误触 */}
                {initialAnsweredRef.current && (
                  <button
                    className="ask-question-resume-btn"
                    type="button"
                    onClick={handleResume}
                    disabled={resuming}
                  >
                    {resuming ? (
                      <Loader2 size={14} className="spin-icon" />
                    ) : (
                      <Play size={14} />
                    )}
                    <span>继续执行</span>
                  </button>
                )}
              </div>
            ) : submitted ? (
              <div className="ask-question-answered">
                <div className="ask-question-answer-label">您的回答：</div>
                <div className="ask-question-answer-value">{answer}</div>
              </div>
            ) : options && options.length > 0 && !showCustomInput ? (
              <div className="ask-question-options-area">
                <div className="ask-question-options">
                  {options.map((opt, i) => (
                    <button
                      key={i}
                      className="ask-question-option-btn"
                      type="button"
                      onClick={() => handleSelectOption(opt)}
                      disabled={submitting}
                    >
                      <span className="ask-question-option-num">{i + 1}</span>
                      <span>{opt}</span>
                    </button>
                  ))}
                </div>
                <button
                  className="ask-question-custom-toggle"
                  type="button"
                  onClick={() => {
                    setShowCustomInput(true);
                    setTimeout(() => inputRef.current?.focus(), 50);
                  }}
                >
                  <Edit3 size={12} />
                  <span>自定义输入</span>
                </button>
              </div>
            ) : (
              <div className="ask-question-input-area">
                {options && options.length > 0 && (
                  <button
                    className="ask-question-back-options"
                    type="button"
                    onClick={() => setShowCustomInput(false)}
                  >
                    <span>← 返回选项</span>
                  </button>
                )}
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
  agentContinueQuestion,
  agentResumeQuestion,
  isExpanded,
  onToggleExpand,
  onOpenModal,
}: {
  event: TimelineEvent;
  stepId?: string;
  agentAnswerQuestion?: (step: string, answer: string) => Promise<void>;
  agentContinueQuestion?: (step: string) => Promise<void>;
  agentResumeQuestion?: (step: string, answer: string) => Promise<void>;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onOpenModal: (mc: ModalContent) => void;
}) {
  switch (event.type) {
    case "user":
      return (
        <div className="timeline-user">
          <div className="tl-user-card">
            <div className="tl-user-card-header">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            </div>
            <p className="tl-user-card-text">{event.content}</p>
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
          <div className="tl-message-label">DevAgent</div>
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
      const resultText = tc.result || (tc.outputFragments || []).join("");

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
                  <DiffViewer content={resultText} maxLines={40} showFileHeaders={false} />
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
          agentContinueQuestion={agentContinueQuestion}
          agentResumeQuestion={agentResumeQuestion}
          isExpanded={isExpanded}
          onToggleExpand={onToggleExpand}
          onOpenModal={onOpenModal}
        />;
      }

      const argsSummary = tc.input ? extractToolArgsSummary(tc.input, tc.name) : "";
      const resultText = tc.result || (tc.outputFragments || []).join("");
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

// ── Diff 检测工具 ────────────────────────
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
