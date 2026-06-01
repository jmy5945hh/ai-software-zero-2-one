// ── 双运行时架构：核心类型定义 ───────────────────

/** 运行时模式 */
export type RuntimeMode = "local" | "cloud";

/** 连接状态 */
export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

/** 项目阶段 */
export type ProjectPhase =
  | "draft"
  | "building"
  | "running"
  | "paused"
  | "completed"
  | "error";

// ── 运行时状态 ─────────────────────────────────

export type RuntimeStatus = {
  mode: RuntimeMode;
  connected: ConnectionStatus;
  /** 模型是否就绪（本地: Ollama 检测成功；云端: 默认 true） */
  modelReady: boolean;
  /** 当前活跃项目数 */
  activeProjects: number;
};

// ── 资源指标 ──────────────────────────────────

export type ResourceMetrics = {
  /** CPU 使用率 0-100 */
  cpu: number;
  /** 内存使用率 0-100 */
  memory: number;
  /** 磁盘使用率 0-100 */
  disk: number;
  /** 云端专属：活跃任务数 */
  activeQueues?: number;
  /** 云端专属：月度 token 额度（已用/total） */
  monthlyTokens?: { used: number; total: number };
};

// ── Agent 项目 ─────────────────────────────────

export type AgentProject = {
  id: string;
  name: string;
  description: string;
  phase: ProjectPhase;
  /** 所属运行时模式 */
  mode: RuntimeMode;
  /** 进度 0-100 */
  progress: number;
  /** 最近活动时间 ISO 字符串 */
  lastActivity: string;
  /** 工具调用次数 */
  toolCallCount: number;
  /** 产出文件数 */
  fileCount: number;
  /** 本地路径（仅本地模式） */
  localPath?: string;
  /** 云端任务 ID（仅云端模式） */
  cloudTaskId?: string;
};

export type CreateProjectParams = {
  name: string;
  description: string;
  /** 本地模式下的工作目录（File System Access API handle name） */
  localPath?: string;
};

// ── 运行时事件枚举 ────────────────────────────

/** 运行时级别事件 */
export type RuntimeEventType =
  | "status_change"
  | "resource_update"
  | "project_created"
  | "project_updated"
  | "project_deleted"
  | "error";

export type RuntimeEvent = {
  type: RuntimeEventType;
  payload: unknown;
  timestamp: number;
};

// ── 运行时连接器接口 ───────────────────────────

export type StatusHandler = (status: RuntimeStatus) => void;
export type ResourceHandler = (metrics: ResourceMetrics) => void;
export type EventHandler = (event: RuntimeEvent) => void;

export interface IRuntimeConnector {
  readonly mode: RuntimeMode;

  /** 建立连接 / 初始化 */
  connect(): Promise<void>;
  /** 断开连接 */
  disconnect(): void;

  /** 获取当前运行时状态 */
  getStatus(): Promise<RuntimeStatus>;
  /** 获取当前资源指标 */
  getResources(): Promise<ResourceMetrics>;

  /** 获取项目列表 */
  listProjects(): Promise<AgentProject[]>;
  /** 创建项目 */
  createProject(params: CreateProjectParams): Promise<AgentProject>;
  /** 删除项目 */
  deleteProject(id: string): Promise<void>;

  /** 启动项目 */
  startProject(id: string): Promise<void>;
  /** 暂停项目 */
  pauseProject(id: string): Promise<void>;

  /** 注册状态变更回调 */
  onStatusChange(handler: StatusHandler): () => void;
  /** 注册资源更新回调 */
  onResourceUpdate(handler: ResourceHandler): () => void;
}
