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
  | "scope"
  | "spec"
  | "build"
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

// ── Spec 资产 ───────────────────────────────
export type SpecItem = {
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
  activeStage: WorkflowId;
  stepIndex: number;
  scope: ScopeChoice;
  selectedModules: string[];
  notes: string;
  specConfirmed: boolean;
  fixApproved: boolean;
  releaseApproved: boolean;
  qualityPassed: boolean;
  createdAt: string;
  previewTaskId: string | null;
  activeTaskCard: TaskCard | null;
};

// ── 抽屉预览 ────────────────────────────────
export type DrawerContent =
  | { type: "code"; title: string; language: string; content: string }
  | { type: "document"; title: string; content: string }
  | { type: "html"; title: string; html: string }
  | { type: "file"; title: string; path: string; content: string }
  | null;

// ── 工作空间文件节点 ────────────────────────
export type FileNode = {
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
  highlight?: boolean;
};
