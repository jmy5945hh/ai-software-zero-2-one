import { Play, Eye, Rocket } from "lucide-react";
import type { AppState, TaskCard, TaskCategory } from "../data/types";
import { taskCards, categoryMeta, priorityLabel } from "../data";
import { createDefaultState } from "../data";

type HomeTaskBoardProps = {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  onPatch: (patch: Partial<AppState>) => void;
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
export function HomeTaskBoard({ state, setState, onPatch }: HomeTaskBoardProps) {
  const startTaskFromCard = (card: TaskCard) => {
    setState((previous) => ({
      ...createDefaultState(),
      intent: `${card.title}：${card.summary}`,
      notes: previous.notes.trim(),
      activeTaskCard: card,
      view: "workspace",
      createdAt: new Date().toISOString(),
    }));
    window.scrollTo({ top: 0 });
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
            const cards = taskCards.filter((c) => c.category === category);
            return (
              <div className={`task-swimlane ${meta.accent}`} key={category}>
                <div className="swimlane-header">
                  <Icon size={16} />
                  <strong>{meta.label}</strong>
                  <span>{cards.length} 项</span>
                </div>
                <div className="swimlane-cards">
                  {cards.map((card) => {
                    const tag = extractTag(card.title);
                    const cleanTitle = stripTag(card.title);
                    return (
                    <div className="task-card" key={card.id}>
                      <div className="task-card-body">
                        {tag && <span className="task-type-tag">{tag}</span>}
                        <h3>{cleanTitle}</h3>
                        <p>{card.summary}</p>
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
              </div>
            );
          },
        )}
      </div>

      {/* 预览弹窗 */}
      {previewTask && (
        <div
          className="preview-backdrop"
          onClick={() => onPatch({ previewTaskId: null })}
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
                onClick={() => onPatch({ previewTaskId: null })}
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
                onClick={() => startTaskFromCard(previewTask)}
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
