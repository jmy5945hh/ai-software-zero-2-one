import { Check, CircleDot } from "lucide-react";
import type { WorkflowStep, StageStatus } from "../data/types";
import { formatTime } from "../data";

type SopNavProps = {
  workflow: WorkflowStep[];
  stepIndex: number;
  progress: number;
  onStepClick: (index: number) => void;
  /** 标题栏属性 — 与流程节点融合为一行 */
  goHome: () => void;
  taskTitle: string;
  createdAt: string;
  statusBadge: React.ReactNode;
};

/**
 * 横置 SOP 进度导航条 —— 页面顶部的研发任务导航。
 * 标题栏与流程节点融合为一行，竖线分隔，更紧凑聚焦。
 */
export function SopNav({ workflow, stepIndex, progress, onStepClick, goHome, taskTitle, createdAt, statusBadge }: SopNavProps) {
  return (
    <nav className="sop-nav" aria-label="研发任务导航">
      {/* 全局进度条 */}
      <div className="sop-progress-track">
        <span style={{ width: `${progress}%` }} />
      </div>

      {/* 合并行：标题 | 流程节点 + 状态徽章 */}
      <div className="sop-nav-row">
        <div className="sop-nav-left">
          <button className="ghost-button" type="button" onClick={goHome}>
            ← 新任务
          </button>
          <div className="sop-title">
            <span>CS-2026-0518 · {formatTime(createdAt)}</span>
            <strong>{taskTitle}</strong>
          </div>
          <span className="sop-nav-divider" aria-hidden="true">|</span>
        </div>

        <div className="sop-steps">
        {workflow.map((step, index) => {
          const status: StageStatus =
            index < stepIndex
              ? "done"
              : index === stepIndex
                ? "active"
                : "queued";

          return (
            <button
              key={step.id}
              className={`sop-step ${status}`}
              type="button"
              onClick={() => onStepClick(index)}
              aria-label={`${step.label} - ${status === "done" ? "已完成" : status === "active" ? "进行中" : "待进行"}`}
            >
              {/* 步骤节点圆点 */}
              <div className="sop-dot">
                {status === "done" ? (
                  <Check size={12} />
                ) : (
                  <CircleDot size={12} />
                )}
              </div>

              {/* 步骤文字 */}
              <div className="sop-copy">
                <strong>{step.label}</strong>
                {status === "active" && (
                  <span>{step.detail}</span>
                )}
              </div>

              {/* 连接线（非最后一个） */}
              {index < workflow.length - 1 && (
                <div
                  className={`sop-connector ${
                    index < stepIndex ? "filled" : ""
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* 连接状态徽章 */}
      {statusBadge}
    </div>
    </nav>
  );
}
