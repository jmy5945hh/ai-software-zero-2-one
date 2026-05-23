import { useState } from "react";
import { Play, Eye, Rocket, ChevronDown, ChevronUp, FileText, FolderOpen, File, ChevronRight, ArrowLeft } from "lucide-react";
import type { AppState, TaskCard, TaskCategory } from "../data/types";
import type { BrowseEntry } from "./WorkspaceSelector";
import { taskCards, categoryMeta, priorityLabel } from "../data";

type HomeTaskBoardProps = {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  onPatch: (patch: Partial<AppState>) => void;
  onRequestStartTask: (intent: string, notes: string, activeTaskCard: AppState["activeTaskCard"]) => void;
  /** 浏览目录（复用 Agent 连接） */
  onBrowseDir?: (dirPath: string) => Promise<BrowseEntry[]>;
};

/** 从卡片标题中提取方括号内的标签文字，如 "【前端】xxx" → "前端" */
function extractTag(title: string): string | null {
  const match = title.match(/【(.+?)】/);
  return match ? match[1] : null;
}

/** 去除标题中的方括号标签 */
function stripTag(title: string): string {
  return title.replace(/【.+?】\s?/, "");
}

/**
 * 首页任务面板 —— 三列泳道展示故事卡、缺陷、治理任务。
 */
export function HomeTaskBoard({ state, setState, onPatch, onRequestStartTask, onBrowseDir }: HomeTaskBoardProps) {
  // 展开/收起控制：默认每类只展示前3张卡片
  const [expandedCategories, setExpandedCategories] = useState<Set<TaskCategory>>(new Set());

  // 预览弹窗中 docs 文件浏览器
  const [docsBrowserOpen, setDocsBrowserOpen] = useState(false);
  const [docsBrowserPath, setDocsBrowserPath] = useState("~");
  const [docsBrowserEntries, setDocsBrowserEntries] = useState<BrowseEntry[]>([]);
  const [docsBrowserLoading, setDocsBrowserLoading] = useState(false);
  const [docsBrowserError, setDocsBrowserError] = useState<string | null>(null);
  // 用户在预览弹窗中编辑/选择的 docs 路径
  const [editedDocsPath, setEditedDocsPath] = useState<string | null>(null);

  const toggleCategory = (cat: TaskCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const startTaskFromCard = (card: TaskCard) => {
    onRequestStartTask(`${card.title}：${card.summary}`, state.notes.trim(), card);
  };

  const previewTask = state.previewTaskId
    ? taskCards.find((t) => t.id === state.previewTaskId) ?? null
    : null;

  // ── docs 文件浏览器 ──
  const openDocsBrowser = async () => {
    const current = editedDocsPath || previewTask?.docs || "~";
    const baseDir = current.includes("/") ? current.split("/").slice(0, -1).join("/") || "/" : current;
    setDocsBrowserPath(baseDir);
    setDocsBrowserOpen(true);
    setDocsBrowserError(null);
    await loadDocsDir(baseDir);
  };

  const loadDocsDir = async (dirPath: string) => {
    if (!onBrowseDir) return;
    setDocsBrowserLoading(true);
    setDocsBrowserError(null);
    try {
      const entries = await onBrowseDir(dirPath);
      setDocsBrowserEntries(entries);
    } catch (err) {
      setDocsBrowserError((err as Error).message || "无法读取目录");
      setDocsBrowserEntries([]);
    } finally {
      setDocsBrowserLoading(false);
    }
  };

  const enterDocsDir = (entry: BrowseEntry) => {
    if (entry.type === "dir") {
      setDocsBrowserPath(entry.path);
      loadDocsDir(entry.path);
    }
  };

  const selectDocsFile = (entry: BrowseEntry) => {
    if (entry.type === "file") {
      setEditedDocsPath(entry.path);
      setDocsBrowserOpen(false);
    }
  };

  const docsParentPath = docsBrowserPath === "/" ? null
    : docsBrowserPath.split("/").slice(0, -1).join("/") || "/";

  const goDocsUp = () => {
    if (docsParentPath) {
      setDocsBrowserPath(docsParentPath);
      loadDocsDir(docsParentPath);
    }
  };

  // 当前生效的 docs 路径（优先用户编辑的）
  const getEffectiveDocs = (card: TaskCard) => editedDocsPath ?? card.docs;

  return (
    <>
      <div className="task-board">
        {(["story", "defect", "governance"] as TaskCategory[]).map(
          (category) => {
            const meta = categoryMeta[category];
            const Icon = meta.icon;
            const allCards = taskCards.filter((c) => c.category === category);
            const isExpanded = expandedCategories.has(category);
            const shouldCollapse = allCards.length > 3;
            const visibleCards = shouldCollapse && !isExpanded ? allCards.slice(0, 3) : allCards;
            return (
              <div className={`task-swimlane ${meta.accent}`} key={category}>
                <div className="swimlane-header">
                  <Icon size={16} />
                  <strong>{meta.label}</strong>
                  <span>{allCards.length} 项</span>
                </div>
                <div className="swimlane-cards">
                  {visibleCards.map((card) => {
                    const tag = extractTag(card.title);
                    const cleanTitle = stripTag(card.title);
                    return (
                    <div className="task-card" key={card.id}>
                      <div className="task-card-body">
                        {tag && <span className="task-type-tag">{tag}</span>}
                        <h3>{cleanTitle}</h3>
                        <p className="task-card-desc">{card.summary}</p>
                        {card.docs && (
                          <span className="task-card-docs-badge" title={card.docs}>
                            <FileText size={11} />
                            含文档
                          </span>
                        )}
                      </div>
                      <div className="task-card-meta">
                        <span
                          className={`priority-tag ${card.priority}`}
                        >
                          {priorityLabel(card.priority)}
                        </span>
                        <span className="source-tag">{card.source}</span>
                      </div>
                      <div className="task-card-overlay">
                        <button
                          className="overlay-btn primary"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            startTaskFromCard(card);
                          }}
                        >
                          <Play size={15} />
                          直接开始!
                        </button>
                        <button
                          className="overlay-btn secondary"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditedDocsPath(null);
                            onPatch({ previewTaskId: card.id });
                          }}
                        >
                          <Eye size={15} />
                          查看
                        </button>
                      </div>
                    </div>
                    );
                  })}
                </div>
                {shouldCollapse && (
                  <button
                    className="swimlane-expand-btn"
                    type="button"
                    onClick={() => toggleCategory(category)}
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp size={15} />
                        收起
                      </>
                    ) : (
                      <>
                        <ChevronDown size={15} />
                        展开更多（{allCards.length - 3} 项）
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          },
        )}
      </div>

      {/* 预览弹窗 */}
      {previewTask && (
        <div
          className="preview-backdrop"
          onClick={() => { onPatch({ previewTaskId: null }); setDocsBrowserOpen(false); }}
        >
          <div
            className="preview-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="preview-modal-header">
              <div>
                <span className="eyebrow">
                  {categoryMeta[previewTask.category].label}
                </span>
                <h2>{previewTask.title}</h2>
              </div>
              <button
                className="ghost-button"
                type="button"
                onClick={() => { onPatch({ previewTaskId: null }); setDocsBrowserOpen(false); }}
              >
                Esc
              </button>
            </div>
            <div className="preview-modal-body">
              <div className="preview-meta-grid">
                <div>
                  <span>来源</span>
                  <strong>{previewTask.source}</strong>
                </div>
                <div>
                  <span>优先级</span>
                  <strong
                    className={`priority-text ${previewTask.priority}`}
                  >
                    {priorityLabel(previewTask.priority)}
                  </strong>
                </div>
                <div>
                  <span>当前状态</span>
                  <strong>待处理</strong>
                </div>
              </div>
              <div className="preview-desc">
                <span>任务描述</span>
                <p>{previewTask.summary}</p>
              </div>

              {/* ── Docs 文档字段 ── */}
              <div className="preview-docs">
                <span>
                  <FileText size={14} />
                  需求文档（可选）
                </span>
                <div className="preview-docs-row">
                  <input
                    className="preview-docs-input"
                    type="text"
                    value={getEffectiveDocs(previewTask) || ""}
                    onChange={(e) => setEditedDocsPath(e.target.value)}
                    placeholder="选择或输入文档路径（如 ~/docs/prd.md）"
                  />
                  {onBrowseDir && (
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={openDocsBrowser}
                    >
                      <FolderOpen size={14} />
                      浏览
                    </button>
                  )}
                </div>

                {/* 内联文件浏览器 */}
                {docsBrowserOpen && (
                  <div className="preview-docs-browser">
                    <div className="preview-docs-breadcrumb">
                      <button
                        className="preview-docs-back-btn"
                        type="button"
                        onClick={goDocsUp}
                        disabled={!docsParentPath}
                        title={docsParentPath ? `返回 ${docsParentPath}` : "已是根目录"}
                      >
                        <ArrowLeft size={13} />
                      </button>
                      <span className="preview-docs-breadcrumb-path">
                        {docsBrowserPath}
                      </span>
                    </div>
                    <div className="preview-docs-entry-list">
                      {docsBrowserLoading ? (
                        <div className="preview-docs-status">加载中…</div>
                      ) : docsBrowserError ? (
                        <div className="preview-docs-status error">{docsBrowserError}</div>
                      ) : docsBrowserEntries.length === 0 ? (
                        <div className="preview-docs-status">此目录为空</div>
                      ) : (
                        docsBrowserEntries.map((entry) => (
                          <button
                            key={entry.path}
                            className={`preview-docs-entry ${entry.type === "dir" ? "is-dir" : ""}`}
                            type="button"
                            onClick={() => entry.type === "dir" ? enterDocsDir(entry) : selectDocsFile(entry)}
                          >
                            {entry.type === "dir" ? (
                              <FolderOpen size={14} />
                            ) : (
                              <File size={14} />
                            )}
                            <span>{entry.name}</span>
                            {entry.type === "dir" && (
                              <ChevronRight size={12} className="preview-docs-entry-arrow" />
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="preview-notes">
                <span>补充备注（可选）</span>
                <textarea
                  value={state.notes}
                  onChange={(event) =>
                    onPatch({ notes: event.target.value })
                  }
                  placeholder="例如：需要先确认合规口径；UI 需适配移动端。"
                  rows={3}
                />
              </div>
            </div>
            <div className="preview-modal-actions">
              <button
                className="primary-action wide"
                type="button"
                onClick={() => {
                  const effectiveDocs = getEffectiveDocs(previewTask);
                  const card = effectiveDocs ? { ...previewTask, docs: effectiveDocs } : previewTask;
                  startTaskFromCard(card);
                }}
              >
                <Rocket size={16} />
                确认并开始任务
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
