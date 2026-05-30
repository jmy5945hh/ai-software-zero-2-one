import { useState, useCallback } from "react";
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
} from "lucide-react";
import type { SessionRecord } from "../hooks/useSessionRecords";

type SessionHistoryPanelProps = {
  records: SessionRecord[];
  loading: boolean;
  onContinue: (record: SessionRecord, followUpPrompt?: string) => void;
  onDelete: (taskId: string) => void;
  onRefresh: () => void;
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

  const handleDelete = useCallback(
    async (taskId: string) => {
      setDeletingId(taskId);
      await onDelete(taskId);
      setDeletingId(null);
    },
    [onDelete],
  );

  const toggleExpand = (taskId: string) => {
    setExpandedId((prev) => (prev === taskId ? null : taskId));
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
        <span className="session-history-count">{records.length}</span>
        <button
          className="session-history-refresh"
          type="button"
          onClick={onRefresh}
          title="刷新"
        >
          <RotateCcw size={13} />
        </button>
      </div>

      <div className="session-history-list">
        {records.map((record) => {
          const isExpanded = expandedId === record.taskId;
          const stepLabel = getStepLabel(record.activeStage);
          const progress = Math.round(
            ((record.stepIndex + (record.releaseApproved ? 1 : 0)) / 6) * 100,
          );
          const timeAgo = formatTimeAgo(record.updatedAt);

          return (
            <div
              key={record.taskId}
              className={`session-history-item ${isExpanded ? "expanded" : ""}`}
            >
              <div
                className="session-history-item-header"
                onClick={() => toggleExpand(record.taskId)}
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
                    {truncateIntent(record.intent, 40)}
                  </div>
                  <div className="session-history-item-meta">
                    <span className="session-history-item-step">{stepLabel}</span>
                    <span className="session-history-item-time">{timeAgo}</span>
                    <span className="session-history-item-progress">{progress}%</span>
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
                    <span className="detail-label">交付范围</span>
                    <span className="detail-value">{scopeLabel(record.scope)}</span>
                  </div>

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

                  {/* 各步骤对话历史 */}
                  {Object.keys(record.stepSessions).length > 0 && (
                    <div className="session-history-step-sessions">
                      <span className="detail-label">对话记录</span>
                      {Object.entries(record.stepSessions).map(
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
                        setContinuingId(record.taskId);
                        onContinue(record, followUpInput || undefined);
                      }}
                      disabled={continuingId === record.taskId}
                    >
                      {continuingId === record.taskId ? (
                        <Loader2 size={14} className="spin-icon" />
                      ) : (
                        <Play size={14} />
                      )}
                      继续执行
                    </button>
                    <button
                      className="session-history-delete-btn"
                      type="button"
                      onClick={() => handleDelete(record.taskId)}
                      disabled={deletingId === record.taskId}
                    >
                      {deletingId === record.taskId ? (
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

function getStepLabel(stepId: string): string {
  const labels: Record<string, string> = {
    intent: "需求分析",
    plan: "技术设计",
    coding: "编码开发",
    quality: "质量QA",
    verify: "验证修复",
    release: "发布交付",
  };
  return labels[stepId] || stepId;
}

function scopeLabel(scope: string): string {
  const labels: Record<string, string> = {
    mvp: "MVP",
    governed: "治理模式",
    full: "完整交付",
  };
  return labels[scope] || scope;
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
