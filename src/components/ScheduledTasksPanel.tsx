import { useState } from "react";
import {
  Clock,
  Plus,
  Play,
  Pause,
  Trash2,
  Edit3,
  RefreshCw,
  Calendar,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";

// ── 定时任务数据类型 ────────────────────────

type TaskStatus = "running" | "paused" | "failed" | "completed";

type ScheduledTask = {
  id: string;
  name: string;
  description: string;
  cron: string;
  status: TaskStatus;
  lastRun: string | null;
  nextRun: string;
  createdAt: string;
};

// ── 模拟数据 ────────────────────────────────

const mockTasks: ScheduledTask[] = [
  {
    id: "1",
    name: "每日代码质量扫描",
    description: "自动扫描仓库代码质量，生成质量报告并推送至团队群",
    cron: "0 9 * * 1-5",
    status: "running",
    lastRun: "2026-07-02 09:00",
    nextRun: "2026-07-03 09:00",
    createdAt: "2026-06-15",
  },
  {
    id: "2",
    name: "每周依赖更新检查",
    description: "检查项目依赖是否有安全漏洞或过期版本，自动创建升级 PR",
    cron: "0 10 * * 1",
    status: "running",
    lastRun: "2026-06-29 10:00",
    nextRun: "2026-07-06 10:00",
    createdAt: "2026-06-10",
  },
  {
    id: "3",
    name: "夜间回归测试",
    description: "每晚执行全量回归测试套件，输出测试报告并标记失败用例",
    cron: "0 2 * * *",
    status: "paused",
    lastRun: "2026-06-28 02:00",
    nextRun: "2026-07-03 02:00",
    createdAt: "2026-06-01",
  },
];

// ── 工具函数 ────────────────────────────────

function cronToHuman(cron: string): string {
  const parts = cron.split(" ");
  if (parts.length !== 5) return cron;
  const [minute, hour, , , dayOfWeek] = parts;

  const days: Record<string, string> = {
    "1": "周一", "2": "周二", "3": "周三", "4": "周四", "5": "周五",
    "6": "周六", "0": "周日",
  };

  const time = `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;

  if (dayOfWeek === "*" && hour !== "*" && minute !== "*") {
    return `每天 ${time}`;
  }
  if (dayOfWeek !== "*") {
    const dayLabels = dayOfWeek.split(",").map((d) => days[d] || d).join("、");
    return `每${dayLabels} ${time}`;
  }
  return cron;
}

function statusIcon(status: TaskStatus) {
  switch (status) {
    case "running":
      return <Play size={14} />;
    case "paused":
      return <Pause size={14} />;
    case "failed":
      return <AlertCircle size={14} />;
    case "completed":
      return <CheckCircle2 size={14} />;
  }
}

function statusLabel(status: TaskStatus): string {
  switch (status) {
    case "running":
      return "运行中";
    case "paused":
      return "已暂停";
    case "failed":
      return "执行失败";
    case "completed":
      return "已完成";
  }
}

// ── 组件 ────────────────────────────────────

export function ScheduledTasksPanel() {
  const [tasks] = useState<ScheduledTask[]>(mockTasks);

  return (
    <div className="scheduled-tasks-panel">
      {/* 标题栏 */}
      <div className="scheduled-tasks-header">
        <div className="scheduled-tasks-title">
          <span className="eyebrow">自动化</span>
          <h2>定时任务管理</h2>
        </div>
        <button className="scheduled-tasks-add-btn" type="button">
          <Plus size={16} />
          新增定时任务
        </button>
      </div>

      {/* 任务列表 */}
      <div className="scheduled-tasks-list">
        {tasks.length === 0 ? (
          <div className="scheduled-tasks-empty">
            <Clock size={40} />
            <p>暂无定时任务</p>
            <span>点击右上角「新增定时任务」创建你的第一个自动化任务</span>
          </div>
        ) : (
          tasks.map((task) => (
            <div key={task.id} className="scheduled-task-card">
              <div className="scheduled-task-card-left">
                <div className={`scheduled-task-status-badge ${task.status}`}>
                  {statusIcon(task.status)}
                </div>
                <div className="scheduled-task-card-info">
                  <strong>{task.name}</strong>
                  <p>{task.description}</p>
                  <div className="scheduled-task-card-meta">
                    <span className="scheduled-task-cron">
                      <Calendar size={12} />
                      {cronToHuman(task.cron)}
                    </span>
                    {task.lastRun && (
                      <span className="scheduled-task-last-run">
                        上次执行：{task.lastRun}
                      </span>
                    )}
                    <span className="scheduled-task-next-run">
                      下次执行：{task.nextRun}
                    </span>
                  </div>
                </div>
              </div>
              <div className="scheduled-task-card-right">
                <span className={`scheduled-task-status-label ${task.status}`}>
                  {statusLabel(task.status)}
                </span>
                <div className="scheduled-task-card-actions">
                  <button type="button" className="scheduled-task-action-btn" title={task.status === "paused" ? "启动" : "暂停"}>
                    {task.status === "paused" ? <Play size={14} /> : <Pause size={14} />}
                  </button>
                  <button type="button" className="scheduled-task-action-btn" title="编辑">
                    <Edit3 size={14} />
                  </button>
                  <button type="button" className="scheduled-task-action-btn" title="立即执行">
                    <RefreshCw size={14} />
                  </button>
                  <button type="button" className="scheduled-task-action-btn danger" title="删除">
                    <Trash2 size={14} />
                  </button>
                </div>
                <ChevronRight size={16} className="scheduled-task-card-chevron" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
