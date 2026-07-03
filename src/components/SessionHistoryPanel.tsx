import { useState, useCallback, useMemo } from "react";
import {
  Clock,
  RotateCcw,
  Trash2,
  ChevronRight,
  Play,
  Loader2,
  History,
  CheckCircle2,
  AlertCircle,
  FileText,
  Sparkles,
  MessageSquare,
  Monitor,
  Cloud,
  Search,
  GitBranch,
  Filter,
} from "lucide-react";
import type { SessionMeta, SessionRecord } from "../hooks/useSessionRecords";
import { createDefaultState, getTaskWorkflow, getWorkflowStepIndex, workflow } from "../data";

type SessionHistoryPanelProps = {
  records: SessionMeta[];
  loading: boolean;
  onContinue: (record: SessionMeta, followUpPrompt?: string) => void;
  onDelete: (sessionId: string) => void;
  onRefresh: () => void;
};

// ── 筛选条件 ────────────────────────────────

type FilterState = {
  repo: string;
  keyword: string;
  mode: "" | "local" | "cloud";
  status: "" | "active" | "completed";
};

const defaultFilter: FilterState = {
  repo: "",
  keyword: "",
  mode: "",
  status: "",
};

/**
 * 会话历史面板 — 展示所有历史会话记录，支持继续执行和删除。
 */
export function SessionHistoryPanel({
  records,
  loading,
  onContinue,
  onDelete,
  onRefresh,
}: SessionHistoryPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [followUpInput, setFollowUpInput] = useState<string>("");
  const [continuingId, setContinuingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterState>(defaultFilter);
  const [showFilters, setShowFilters] = useState(false);

  // ── 提取所有仓库列表（用于下拉） ──
  const repoOptions = useMemo(() => {
    const repos = new Set<string>();
    for (const r of records) {
      const repo = extractRepo(r);
      if (repo) repos.add(repo);
    }
    return Array.from(repos).sort();
  }, [records]);

  // ── 筛选逻辑 ──
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (filter.repo) {
        const repo = extractRepo(r);
        if (!repo || !repo.toLowerCase().includes(filter.repo.toLowerCase())) return false;
      }
      if (filter.keyword) {
        if (!r.intent.toLowerCase().includes(filter.keyword.toLowerCase())) return false;
      }
      if (filter.mode && r.runtimeMode !== filter.mode) return false;
      if (filter.status && r.status !== filter.status) return false;
      return true;
    });
  }, [records, filter]);

  const handleDelete = useCallback(
    async (sessionId: string) => {
      setDeletingId(sessionId);
      await onDelete(sessionId);
      setDeletingId(null);
    },
    [onDelete],
  );

  const toggleExpand = (sessionId: string) => {
    setExpandedId((prev) => (prev === sessionId ? null : sessionId));
  };

  if (loading && records.length === 0) {
    return (
      <div className="session-history-panel">
        <div className="session-history-header">
          <History size={16} />
          <span>历史会话</span>
        </div>
        <div className="session-history-loading">
          <Loader2 size={18} className="spin-icon" />
          <span>加载中...</span>
        </div>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="session-history-panel">
        <div className="session-history-header">
          <History size={16} />
          <span>历史会话</span>
        </div>
        <div className="session-history-empty">
          <Clock size={24} />
          <p>暂无历史会话记录</p>
          <p className="session-history-empty-hint">开始一个新任务后，会话将自动保存到这里</p>
        </div>
      </div>
    );
  }

  return (
    <div className="session-history-panel">
      <div className="session-history-header">
        <History size={16} />
        <span>历史会话</span>
        <span className="session-history-count">{filteredRecords.length}</span>
        <button
          className={`session-history-filter-toggle ${showFilters ? "active" : ""}`}
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          title="筛选"
        >
          <Filter size={13} />
        </button>
        <button
          className="session-history-refresh"
          type="button"
          onClick={onRefresh}
          title="刷新"
        >
          <RotateCcw size={13} />
        </button>
      </div>

      {showFilters && (
        <div className="session-history-filters">
          <div className="session-history-filter-row">
            <div className="session-history-filter-field">
              <GitBranch size={13} />
              <select
                value={filter.repo}
                onChange={(e) => setFilter((f) => ({ ...f, repo: e.target.value }))}
              >
                <option value="">全部仓库</option>
                {repoOptions.map((repo) => (
                  <option key={repo} value={repo}>{repo}</option>
                ))}
              </select>
            </div>
            <div className="session-history-filter-field">
              <Search size={13} />
              <input
                placeholder="搜索任务名称..."
                value={filter.keyword}
                onChange={(e) => setFilter((f) => ({ ...f, keyword: e.target.value }))}
              />
            </div>
            <div className="session-history-filter-field">
              <Monitor size={13} />
              <select
                value={filter.mode}
                onChange={(e) => setFilter((f) => ({ ...f, mode: e.target.value as FilterState["mode"] }))}
              >
                <option value="">全部模式</option>
                <option value="local">本地</option>
                <option value="cloud">云端</option>
              </select>
            </div>
            <div className="session-history-filter-field">
              <CheckCircle2 size={13} />
              <select
                value={filter.status}
                onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value as FilterState["status"] }))}
              >
                <option value="">全部状态</option>
                <option value="active">进行中</option>
                <option value="completed">已完成</option>
              </select>
            </div>
          </div>
          {(filter.repo || filter.keyword || filter.mode || filter.status) && (
            <button
              className="session-history-filter-clear"
              type="button"
              onClick={() => setFilter(defaultFilter)}
            >
              清除筛选
            </button>
          )}
        </div>
      )}

      <div className="session-history-list">
        {filteredRecords.map((record) => {
          const isExpanded = expandedId === record.sessionId;
          const stepLabel = getStepLabel(record.activeStage);
          const taskWorkflow = getTaskWorkflow(record.prototype || createDefaultState().prototype);
          const stageIndex = getWorkflowStepIndex(record.activeStage, record.stepIndex, taskWorkflow);
          const progress = Math.round(
            ((stageIndex + (record.releaseApproved ? 1 : 0)) / taskWorkflow.length) * 100,
          );
          const timeAgo = formatTimeAgo(record.updatedAt);

          return (
            <div
              key={record.sessionId}
              className={`session-history-item ${isExpanded ? "expanded" : ""}`}
            >
              <div
                className="session-history-item-header"
                onClick={() => toggleExpand(record.sessionId)}
              >
                <div className="session-history-item-icon">
                  {record.status === "completed" ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    <Sparkles size={16} />
                  )}
                </div>
                <div className="session-history-item-info">
                  <div className="session-history-item-title">
                    <span className={`session-history-mode-badge ${record.runtimeMode === "cloud" ? "badge-cloud" : "badge-local"}`}>
                      {record.runtimeMode === "cloud" ? "云端" : "本地"}
                    </span>
                    {truncateIntent(record.intent, 34)}
                  </div>
                  <div className="session-history-item-meta">
                    <span className="session-history-item-step">{stepLabel}</span>
                    <span className="session-history-item-time">{timeAgo}</span>
                    <span className="session-history-item-progress">{progress}%</span>
                    <span className="session-history-item-mode" title={record.runtimeMode === "cloud" ? "云端运行" : "本地运行"}>
                      {record.runtimeMode === "cloud" ? <Cloud size={11} /> : <Monitor size={11} />}
                    </span>
                  </div>
                </div>
                <ChevronRight
                  size={14}
                  className={`session-history-chevron ${isExpanded ? "rotated" : ""}`}
                />
              </div>

              {isExpanded && (
                <div className="session-history-item-detail">
                  <div className="session-history-detail-intent">
                    <FileText size={13} />
                    <span>{record.intent}</span>
                  </div>

                  {record.workspacePath && (
                    <div className="session-history-detail-row">
                      <span className="detail-label">工作空间</span>
                      <span className="detail-value">{record.workspacePath}</span>
                    </div>
                  )}

                  <div className="session-history-detail-row">
                    <span className="detail-label">创建时间</span>
                    <span className="detail-value">
                      {formatDateTime(record.createdAt)}
                    </span>
                  </div>

                  <div className="session-history-detail-row">
                    <span className="detail-label">最后更新</span>
                    <span className="detail-value">
                      {formatDateTime(record.updatedAt)}
                    </span>
                  </div>

                  {/* 步骤摘要 */}
                  {Object.keys(record.stepSummaries).length > 0 && (
                    <div className="session-history-step-summaries">
                      <span className="detail-label">步骤摘要</span>
                      <div className="step-summary-list">
                        {Object.entries(record.stepSummaries).map(
                          ([stepId, brief]) => (
                            <div key={stepId} className="step-summary-item">
                              <span className="step-summary-step">
                                {getStepLabel(stepId)}
                              </span>
                              <span className="step-summary-brief">{brief}</span>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  )}

                  {/* 各步骤对话历史 — 仅完整记录包含对话数据 */}
                  {"stepSessions" in record && Object.keys((record as SessionRecord).stepSessions).length > 0 && (
                    <div className="session-history-step-sessions">
                      <span className="detail-label">对话记录</span>
                      {Object.entries((record as SessionRecord).stepSessions).map(
                        ([stepId, snapshot]) => (
                          <div key={stepId} className="step-session-block">
                            <div className="step-session-header">
                              <MessageSquare size={12} />
                              <span>{getStepLabel(stepId)}</span>
                              <span className="step-session-count">
                                {snapshot.messages.length} 条消息 · {snapshot.turns?.length || 0} 轮
                              </span>
                            </div>
                            {snapshot.messages.length > 0 && (
                              <div className="step-session-messages">
                                {snapshot.messages.map((msg, i) => (
                                  <div key={i} className={`step-session-msg ${msg.role}`}>
                                    <span className="step-session-role">
                                      {msg.role === "user" ? "👤" : "🤖"}
                                    </span>
                                    <span className="step-session-text">{msg.content}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {snapshot.summary && (
                              <div className="step-session-summary">
                                <span className="step-session-summary-label">总结：</span>
                                {snapshot.summary}
                              </div>
                            )}
                          </div>
                        ),
                      )}
                    </div>
                  )}

                  <div className="session-history-detail-actions">
                    <button
                      className="session-history-continue-btn"
                      type="button"
                      onClick={() => {
                        setContinuingId(record.sessionId);
                        onContinue(record, followUpInput || undefined);
                      }}
                      disabled={continuingId === record.sessionId}
                    >
                      {continuingId === record.sessionId ? (
                        <Loader2 size={14} className="spin-icon" />
                      ) : (
                        <Play size={14} />
                      )}
                      继续执行
                    </button>
                    <button
                      className="session-history-delete-btn"
                      type="button"
                      onClick={() => handleDelete(record.sessionId)}
                      disabled={deletingId === record.sessionId}
                    >
                      {deletingId === record.sessionId ? (
                        <Loader2 size={13} className="spin-icon" />
                      ) : (
                        <Trash2 size={13} />
                      )}
                      删除
                    </button>
                  </div>

                  {/* 补充需求输入 */}
                  <div className="session-history-followup">
                    <textarea
                      className="session-history-followup-input"
                      placeholder="补充需求（可选）：在此输入对原有需求的补充或修改..."
                      value={followUpInput}
                      onChange={(e) => setFollowUpInput(e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 辅助函数 ────────────────────────────────

function extractRepo(record: SessionMeta): string {
  if (record.gitRepo?.url) {
    const name = record.gitRepo.url.split("/").pop()?.replace(/\.git$/, "") || record.gitRepo.url;
    return `${name} · ${record.gitRepo.branch}`;
  }
  if (record.workspacePath) {
    return record.workspacePath.split("/").filter(Boolean).pop() || record.workspacePath;
  }
  return "";
}

function getStepLabel(stepId: string): string {
  return workflow.find((step) => step.id === stepId)?.label || stepId;
}

function truncateIntent(intent: string, maxLen: number): string {
  if (intent.length <= maxLen) return intent;
  return intent.slice(0, maxLen) + "...";
}

function formatTimeAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin}分钟前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}小时前`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay}天前`;
  return formatDateTime(iso);
}

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
