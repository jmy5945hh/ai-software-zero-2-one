import { useState, useRef } from "react";
import { Play, Eye, Rocket, ChevronDown, ChevronUp, FileText, X, Paperclip } from "lucide-react";
import { MarkdownRenderer } from "./MarkdownRenderer";
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

  // 已选择的 Markdown 附件
  const [selectedFile, setSelectedFile] = useState<{ name: string; content: string } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleCategory = (cat: TaskCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const startTaskFromCard = (card: TaskCard) => {
    let intent = `${card.title}：${card.summary}`;
    if (selectedFile?.content) {
      intent += `\n\n--- 需求文档: ${selectedFile.name} ---\n${selectedFile.content}`;
    }
    onRequestStartTask(intent, state.notes.trim(), card);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError(null);

    // 只允许 .md 文件
    if (!file.name.endsWith(".md")) {
      setFileError("仅支持 Markdown (.md) 文件");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      if (!content || !content.trim()) {
        setFileError("文件内容为空");
        return;
      }
      setSelectedFile({ name: file.name, content });
    };
    reader.onerror = () => {
      setFileError("文件读取失败");
    };
    reader.readAsText(file);
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setFileError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const previewTask = state.previewTaskId
    ? taskCards.find((t) => t.id === state.previewTaskId) ?? null
    : null;

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
                            setSelectedFile(null);
                            setFileError(null);
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
          onClick={() => { onPatch({ previewTaskId: null }); setSelectedFile(null); setFileError(null); }}
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
                onClick={() => { onPatch({ previewTaskId: null }); setSelectedFile(null); setFileError(null); }}
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
                <MarkdownRenderer>{previewTask.summary}</MarkdownRenderer>
              </div>

              {/* ── 需求文档附件 ── */}
              <div className="preview-docs">
                <span>
                  <FileText size={14} />
                  需求文档（可选，仅 .md）
                </span>

                {/* 隐藏的本地文件选择器 */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".md,.markdown"
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />

                {!selectedFile ? (
                  <button
                    className="preview-docs-upload-btn"
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip size={16} />
                    选择 Markdown 文件
                  </button>
                ) : (
                  <div className="preview-docs-attachment">
                    <div className="preview-docs-attachment-card">
                      <FileText size={18} className="preview-docs-attachment-icon" />
                      <div className="preview-docs-attachment-info">
                        <span className="preview-docs-attachment-name">{selectedFile.name}</span>
                        <span className="preview-docs-attachment-meta">
                          Markdown · {selectedFile.content.split("\n").length} 行
                        </span>
                      </div>
                      <button
                        className="preview-docs-attachment-remove"
                        type="button"
                        onClick={clearSelectedFile}
                        title="移除附件"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    {/* 文档内容预览 */}
                    <div className="preview-docs-content">
                      <div className="preview-docs-content-header">
                        <span>内容预览</span>
                      </div>
                      <div className="preview-docs-content-body">
                        <MarkdownRenderer>{selectedFile.content}</MarkdownRenderer>
                      </div>
                    </div>
                  </div>
                )}

                {fileError && (
                  <div className="preview-docs-content-error">
                    {fileError}
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
                  startTaskFromCard(previewTask);
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
