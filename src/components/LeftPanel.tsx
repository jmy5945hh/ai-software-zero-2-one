import { Sparkles, GitBranch } from "lucide-react";
import type { TaskCard } from "../data/types";
import { categoryMeta, priorityLabel } from "../data";
import type { SessionState } from "../agent/types";
import { WorkspaceExplorer } from "./WorkspaceExplorer";

type LeftPanelProps = {
  activeTaskCard: TaskCard | null;
  stepIndex: number;
  onFileClick: (path: string, name: string) => void;
  onBackToTasks: () => void;
  agentFileTree?: any[] | null;
  isAgentConnected: boolean;
  stepSummaries?: Record<string, string>;
  agentSessions?: Record<string, SessionState>;
  intent?: string;
  workspacePath?: string;
  /** 当前会话 sessionId */
  sessionId?: string;
  /** 外部触发打开 repo explorer */
  repoExplorerOpen?: boolean;
  /** 关闭 repo explorer */
  onCloseRepoExplorer?: () => void;
};

/**
 * 左侧面板 —— 故事卡驻留 + 当前任务 + 历史任务 + 工作空间模块。
 * 让研发人员随时看到当前任务上下文和 workspace 操作入口。
 */
export function LeftPanel({
  activeTaskCard,
  onBackToTasks,
  isAgentConnected,
  stepSummaries,
  agentSessions,
  intent,
  workspacePath,
  sessionId,
  repoExplorerOpen,
  onCloseRepoExplorer,
}: LeftPanelProps) {
  return (
    <aside className="left-panel">
      {/* 故事卡驻留 + 当前任务 + 历史任务 */}
      <TaskCardResident
        taskCard={activeTaskCard}
        onBackToTasks={onBackToTasks}
        stepSummaries={stepSummaries}
        intent={intent}
        sessionId={sessionId}
      />

      {/* 工作空间模块：两个按钮 */}
      {workspacePath && (
        <section className="left-card workspace-explorer-card">
          <div className="left-card-header">
            <span>Workspace</span>
          </div>
          <WorkspaceExplorer
            workspacePath={workspacePath}
            repoExplorerOpen={repoExplorerOpen}
            onCloseRepoExplorer={onCloseRepoExplorer}
          />
        </section>
      )}
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
  stepSummaries,
  intent,
  sessionId,
}: {
  taskCard: TaskCard | null;
  onBackToTasks: () => void;
  stepSummaries?: Record<string, string>;
  intent?: string;
  sessionId?: string;
}) {
  return (
    <section className="left-card story-resident">
      {/* 头部 */}
      <div className="left-card-header">
        <Sparkles size={16} />
        <span>当前任务</span>
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
            <p className="story-resident-detail-value" title={intent || taskCard.summary}>
              {(intent || taskCard.summary).length > 20 ? (intent || taskCard.summary).slice(0, 20) + "…" : (intent || taskCard.summary)}
            </p>
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
          {sessionId && (
            <div className="story-resident-session">
              <span className="story-resident-session-label">Session ID</span>
              <code className="story-resident-session-value">{sessionId}</code>
            </div>
          )}
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

      {/* 历史任务列表 */}
      {stepSummaries && Object.keys(stepSummaries).length > 0 && (
        <div className="history-tasks-section">
          <div className="history-tasks-header">历史任务</div>
          <div className="history-tasks-body">
            {Object.entries(stepSummaries).map(([sid, brief]) => (
              <div key={sid} className="history-task-item">
                <div className="history-task-step-label">{sid.toUpperCase()}</div>
                <p className="history-task-brief" title={brief}>
                  {brief.length > 20 ? brief.slice(0, 20) + "…" : brief}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// WorkspaceTree 已迁移至 WorkspaceExplorer 组件
