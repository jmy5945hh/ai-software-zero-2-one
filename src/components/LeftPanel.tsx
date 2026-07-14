import { Sparkles, GitBranch, Copy, Check, ChevronDown, Circle, CheckCircle2 } from "lucide-react";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { useState, useCallback } from "react";
import type { TaskCard, WorkflowStep } from "../data/types";
import { categoryMeta, priorityLabel } from "../data";
import type { SessionState } from "../agent/types";
import { WorkspaceExplorer } from "./WorkspaceExplorer";
import type { RepoTab } from "./RepoExplorer";
import type { RuntimeMode } from "../types/runtime";

type LeftPanelProps = {
  activeTaskCard: TaskCard | null;
  stepIndex: number;
  onFileClick: (path: string, name: string) => void;
  onBackToTasks: () => void;
  agentFileTree?: any[] | null;
  isAgentConnected: boolean;
  agentSessions?: Record<string, SessionState>;
  intent?: string;
  workspacePath?: string;
  /** 当前会话 sessionId */
  sessionId?: string;
  runtimeMode?: RuntimeMode;
  /** 外部触发打开 repo explorer */
  repoExplorerOpen?: RepoTab | null;
  /** 关闭 repo explorer */
  onCloseRepoExplorer?: () => void;
  workflow?: WorkflowStep[];
  executionStepIndex?: number;
  viewingStepIndex?: number;
  onViewStep?: (index: number) => void;
};

/**
 * 左侧面板 —— 故事卡驻留 + 当前任务 + 历史任务 + 工作空间模块。
 * 让研发人员随时看到当前任务上下文和 workspace 操作入口。
 */
export function LeftPanel({
  activeTaskCard,
  onBackToTasks,
  isAgentConnected,
  agentSessions,
  intent,
  workspacePath,
  sessionId,
  runtimeMode,
  repoExplorerOpen,
  onCloseRepoExplorer,
  workflow = [],
  executionStepIndex = 0,
  viewingStepIndex = 0,
  onViewStep,
}: LeftPanelProps) {
  const [workflowOpen, setWorkflowOpen] = useState(true);
  return (
    <aside className="left-panel">
      <TaskCardResident
        taskCard={activeTaskCard}
        onBackToTasks={onBackToTasks}
        intent={intent}
        sessionId={sessionId}
      />

      <section className="task-workflow-nav">
        <button type="button" className="task-workflow-toggle" onClick={() => setWorkflowOpen((value) => !value)}>
          <span>Workflow</span>
          <small>{executionStepIndex + 1}/{workflow.length}</small>
          <ChevronDown size={14} className={workflowOpen ? "open" : ""} />
        </button>
        {workflowOpen && <div className="task-workflow-steps">
          {workflow.map((step, index) => {
            const done = index < executionStepIndex;
            const active = index === executionStepIndex;
            return (
              <button
                type="button"
                key={step.id}
                className={`${viewingStepIndex === index ? "viewing" : ""} ${active ? "executing" : ""}`}
                onClick={() => index <= executionStepIndex && onViewStep?.(index)}
                disabled={index > executionStepIndex}
              >
                {done ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                <span><strong>{step.label}</strong>{active && <small>当前执行</small>}</span>
              </button>
            );
          })}
        </div>}
      </section>

      {workspacePath && <div className="left-panel-repo-bridge" aria-hidden="true">
        <WorkspaceExplorer workspacePath={workspacePath} taskId={sessionId} runtimeMode={runtimeMode}
          repoExplorerOpen={repoExplorerOpen} onCloseRepoExplorer={onCloseRepoExplorer} />
      </div>}
    </aside>
  );
}

/**
 * 故事卡驻留组件 —— 始终显示当前研发任务的上下文，
 * 以及需求分析和历史任务列表。
 */
function TaskCardResident({
  taskCard,
  onBackToTasks,
  intent,
  sessionId,
}: {
  taskCard: TaskCard | null;
  onBackToTasks: () => void;
  intent?: string;
  sessionId?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copySessionId = useCallback(() => {
    if (!sessionId) return;
    navigator.clipboard.writeText(sessionId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [sessionId]);

  return (
    <section className="left-card story-resident">
      {/* 头部 */}
      <div className="left-card-header">
        <Sparkles size={16} />
        <span>当前任务</span>
        {sessionId && (
          <button
            className="session-id-copy-btn"
            type="button"
            onClick={copySessionId}
            title="点击复制 Session ID"
          >
            <code className="session-id-text">{sessionId.slice(0, 8)}</code>
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
        )}
      </div>

      {/* 故事卡信息 */}
      {taskCard ? (
        <div className="story-resident-body">
          <div className="story-resident-source">
            <span className="story-resident-source-label">任务来源</span>
            <span className="story-resident-source-value">{categoryMeta[taskCard.category]?.label || taskCard.category}</span>
          </div>
          <div className="story-resident-detail">
            <span className="story-resident-detail-label">任务详情</span>
            <div className="story-resident-detail-value">
              <MarkdownRenderer>{intent || taskCard.summary}</MarkdownRenderer>
            </div>
          </div>
          <div className="story-resident-meta">
            <span className={`priority-tag ${taskCard.priority}`}>
              {priorityLabel(taskCard.priority)}
            </span>
            <button
              className="ghost-button small"
              type="button"
              onClick={onBackToTasks}
            >
              <GitBranch size={12} />
              切换任务
            </button>
          </div>
        </div>
      ) : (
        <div className="story-resident-empty">
          <p>还未选择任务卡片</p>
          <button
            className="ghost-button"
            type="button"
            onClick={onBackToTasks}
          >
            返回任务列表
          </button>
        </div>
      )}
    </section>
  );
}

// WorkspaceTree 已迁移至 WorkspaceExplorer 组件
