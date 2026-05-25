import type { LucideIcon } from "lucide-react";

// ── 视图状态 ────────────────────────────────
export type View = "home" | "workspace";
export type HomeTab = "tasks" | "build";

// ── 任务卡片 ────────────────────────────────
export type ScopeChoice = "mvp" | "governed" | "full";
export type TaskCategory = "story" | "defect" | "governance";

export type TaskCard = {
  id: string;
  category: TaskCategory;
  title: string;
  summary: string;
  docs?: string;
  priority: "critical" | "high" | "medium" | "low";
  source: string;
};

export type CategoryMeta = {
  label: string;
  icon: LucideIcon;
  accent: string;
};

// ── SOP 工作流 ──────────────────────────────
export type WorkflowId =
  | "intent"
  | "plan"
  | "coding"
  | "quality"
  | "verify"
  | "release";

export type WorkflowStep = {
  id: WorkflowId;
  label: string;
  detail: string;
  userRole: string;
};

export type StageStatus = "done" | "active" | "queued";

export type Stage = {
  label: string;
  detail: string;
  status: StageStatus;
  time: string;
};

// ── Agent ────────────────────────────────────
export type AgentStatus = "running" | "review" | "blocked" | "done";

export type Agent = {
  name: string;
  role: string;
  status: AgentStatus;
  confidence: number;
  task: string;
  icon: LucideIcon;
};

// ── 质量门禁 ────────────────────────────────
export type GateStatus = "passed" | "running" | "queued";

export type Gate = {
  name: string;
  value: number;
  status: GateStatus;
};

// ── 代码资产 ───────────────────────────────
export type CodeItem = {
  title: string;
  detail: string;
  icon: LucideIcon;
  accent: string;
};

// ── 测试矩阵行 ──────────────────────────────
export type TestRow = [string, string, string, string];

// ── 应用状态 ─────────────────────────────────
export type AppState = {
  view: View;
  homeTab: HomeTab;
  intent: string;
  workspacePath: string;
  activeStage: WorkflowId;
  stepIndex: number;
  scope: ScopeChoice;
  selectedModules: string[];
  notes: string;
  codeConfirmed: boolean;
  fixApproved: boolean;
  releaseApproved: boolean;
  qualityPassed: boolean;
  createdAt: string;
  previewTaskId: string | null;
  activeTaskCard: TaskCard | null;
  /** 待决策事项的用户回答（持久化） */
  todoAnswers: Record<number, string | string[]>;
  /** 各步骤的初始提示词（用于重试时复用 user prompt） */
  initialPrompts: Record<string, string>;
  /** 各步骤的 git worktree 路径（用于重试时回滚代码） */
  worktreePaths: Record<string, string>;
};

// ── 抽屉预览 ────────────────────────────────
export type DrawerContent =
  | { type: "code"; title: string; language: string; content: string }
  | { type: "document"; title: string; content: string }
  | { type: "html"; title: string; html: string }
  | { type: "file"; title: string; path: string; content: string }
  | { type: "diff"; title: string; path: string; content: string; additions: number; deletions: number }
  | null;

// ── 工作空间文件节点 ────────────────────────
export type FileNode = {
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
  highlight?: boolean;
};

// ── Agent 结构化总结 ─────────────────────────

/** Agent 产出总结的完整结构 */
export type AgentSummary = {
  brief: string;
  key_points: KeyPoint[];
  todos: TodoItem[];
};

/** 单个关键产出要点 */
export type KeyPoint = {
  title: string;
  summary: string;
};

/** 待决策事项 */
export type TodoItem = {
  task: string;
  type: "choice" | "fill";
  /** type=choice 时是否多选 */
  multiSelect?: boolean;
  /** type=choice 时的选项列表；type=fill 时为空 */
  choices: Choice[];
  /** type=fill 时的输入框占位文本 */
  placeholder?: string;
  /** 用户已选 / 已填内容（暂做视觉标记，后续反馈给 Agent） */
  userAnswer?: string | string[];
};

/** 选项 */
export type Choice = {
  option: string;
  description: string;
};

/** 从 session toolCalls 统计的文件变更 */
export type FileChange = {
  path: string;
  action: "create" | "modify" | "delete";
  /** 新增行数（create 时 = 文件行数，modify 时从 diff 统计） */
  additions?: number;
  /** 删除行数（仅 modify 时有值） */
  deletions?: number;
  /** diff 原文（modify）或完整文件内容（create），用于 Drawer 展示 */
  diffContent?: string;
};
