import { useState } from "react";
import { X, Plus } from "lucide-react";
import type { TaskCard } from "../data/types";
import { addTaskCard } from "../data";

type AddStoryCardModalProps = {
  onClose: () => void;
  onAdded: (card: TaskCard) => void;
};

const PRIORITY_OPTIONS: { value: TaskCard["priority"]; label: string }[] = [
  { value: "critical", label: "紧急" },
  { value: "high", label: "高" },
  { value: "medium", label: "中" },
  { value: "low", label: "低" },
];

const CATEGORY_OPTIONS: { value: TaskCard["category"]; label: string }[] = [
  { value: "story", label: "故事卡" },
  { value: "defect", label: "问题 / 缺陷" },
  { value: "governance", label: "治理任务" },
];

/**
 * 新增故事卡弹窗 —— 支持填写标题、描述、来源、优先级、分类。
 */
export function AddStoryCardModal({ onClose, onAdded }: AddStoryCardModalProps) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [source, setSource] = useState("");
  const [priority, setPriority] = useState<TaskCard["priority"]>("high");
  const [category, setCategory] = useState<TaskCard["category"]>("story");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = title.trim().length > 0 && summary.trim().length > 0;

  const handleSubmit = () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    const card = addTaskCard({
      category,
      title: title.trim(),
      summary: summary.trim(),
      priority,
      source: source.trim() || "手动创建",
    });
    onAdded(card);
  };

  return (
    <div className="add-card-backdrop" onClick={onClose}>
      <div className="add-card-modal" onClick={(e) => e.stopPropagation()}>
        <div className="add-card-modal-header">
          <div>
            <span className="eyebrow">新增任务卡片</span>
            <h2>填写卡片信息</h2>
          </div>
          <button className="ghost-button" type="button" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="add-card-modal-body">
          {/* 分类 */}
          <div className="add-card-field">
            <label>分类</label>
            <div className="add-card-category-row">
              {CATEGORY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`add-card-category-btn ${category === opt.value ? "active" : ""}`}
                  onClick={() => setCategory(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 标题 */}
          <div className="add-card-field">
            <label htmlFor="add-card-title">标题</label>
            <input
              id="add-card-title"
              className="add-card-input"
              type="text"
              placeholder="例如：【后台】退货原因字典管理"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* 优先级 */}
          <div className="add-card-field">
            <label>优先级</label>
            <div className="add-card-priority-row">
              {PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`add-card-priority-btn ${priority === opt.value ? "active" : ""}`}
                  onClick={() => setPriority(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 来源 */}
          <div className="add-card-field">
            <label htmlFor="add-card-source">来源</label>
            <input
              id="add-card-source"
              className="add-card-input"
              type="text"
              placeholder="例如：商城项目"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </div>

          {/* 任务描述 */}
          <div className="add-card-field">
            <label htmlFor="add-card-summary">任务描述</label>
            <textarea
              id="add-card-summary"
              className="add-card-textarea"
              placeholder="描述任务的背景、功能概述、接口信息等"
              rows={6}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>
        </div>

        <div className="add-card-modal-actions">
          <button className="ghost-button" type="button" onClick={onClose}>
            取消
          </button>
          <button
            className="primary-action"
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            <Plus size={16} />
            新增卡片
          </button>
        </div>
      </div>
    </div>
  );
}
