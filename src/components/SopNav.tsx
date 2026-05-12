import { Check, CircleDot } from "lucide-react";
import type { WorkflowStep, StageStatus } from "../data/types";

type SopNavProps = {
  workflow: WorkflowStep[];
  stepIndex: number;
  progress: number;
  onStepClick: (index: number) => void;
};

/**
 * 横置 SOP 进度导航条 —— 页面顶部的研发任务导航。
 * 横向展示 7 个步骤节点，当前步骤居中高亮。
 */
export function SopNav({ workflow, stepIndex, progress, onStepClick }: SopNavProps) {
  return (
    <nav className="sop-nav" aria-label="研发任务导航">
      {/* 全局进度条 */}
      <div className="sop-progress-track">
        <span style={{ width: `${progress}%` }} />
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
    </nav>
  );
}
