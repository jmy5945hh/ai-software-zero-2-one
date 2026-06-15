import type { LucideIcon } from "lucide-react";

// ── 视图状态 ────────────────────────────────
export type View = "home" | "workspace";
export type HomeTab = "tasks" | "build" | "history";

// ── 任务卡片 ────────────────────────────────
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
/** Git 仓库配置（云端模式） */
export type GitRepoConfig = {
  url: string;
  branch: string;
  /** 子目录（可选，只克隆仓库中的特定目录作为工作空间） */
  subdirectory?: string;
};

export type AppState = {
  view: View;
  homeTab: HomeTab;
  intent: string;
  workspacePath: string;
  /** 当前运行时模式（local / cloud），持久化到 localStorage */
  runtimeMode: "local" | "cloud";
  /** Git 仓库配置（仅云端模式使用） */
  gitRepo?: GitRepoConfig;
  activeStage: WorkflowId;
  stepIndex: number;
  notes: string;
  codeConfirmed: boolean;
  fixApproved: boolean;
  releaseApproved: boolean;
  qualityPassed: boolean;
  createdAt: string;
  /** 32 位 sessionId，用于关联对应对话任务 */
  sessionId: string;
  previewTaskId: string | null;
  activeTaskCard: TaskCard | null;
  /** 待决策事项的用户回答（持久化） */
  todoAnswers: Record<number, string | string[]>;
  /** 各步骤的初始提示词（用于重试时复用 user prompt） */
  initialPrompts: Record<string, string>;
  /** QA 质量审查状态 */
  qaReview: QaReviewState;
  /** 从历史记录恢复的会话快照（stepId → 会话数据），用于继续执行时恢复上下文 */
  restoredSessions: Record<string, {
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    turns: Array<{
      id: string;
      index: number;
      status: "running" | "done";
      textContent: string;
      thinking: string;
      userInput?: string;
      toolCalls: Array<{
        id: string;
        name: string;
        status: "running" | "done" | "error";
        category: string;
        input: string;
        result?: string;
      }>;
    }>;
    summary: string;
    summarizationResult?: AgentSummary | null;
  }>;
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

/** 项目编译结果 */
export type BuildResult = {
  /** 编译命令 */
  command: string;
  /** 是否编译成功 */
  success: boolean;
  /** 编译输出（完整内容） */
  output: string;
  /** 编译时间戳 */
  timestamp: string;
  /** 当前修复次数 */
  retryCount: number;
  /** 是否正在编译中 */
  building: boolean;
  /** 是否正在自动修复中 */
  fixing: boolean;
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

// ── QA 质量审查 ─────────────────────────────

/** QA 审查执行状态 */
export type QaReviewStatus = "idle" | "running" | "done" | "error";

/** QA 审查状态 */
export type QaReviewState = {
  /** 执行状态 */
  status: QaReviewStatus;
  /** CLI 实时输出行 */
  outputLines: string[];
  /** 最终结果文件路径 */
  resultFilePath: string;
  /** 结果文件内容（TOML 格式） */
  resultContent: string;
  /** 错误信息 */
  error?: string;
};
