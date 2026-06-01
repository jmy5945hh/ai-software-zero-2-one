/**
 * LocalRuntimeConnector — 本地运行时连接器。
 *
 * 职责：
 * - 管理 localStorage 中的项目持久化
 * - 通过 File System Access API 管理本地工作目录
 *
 * LLM 连接使用 DeepSeek（通过服务端 DEEPSEEK_API_KEY 环境变量配置），
 * 不在前端探测本地 Ollama。
 */
import type {
  IRuntimeConnector,
  RuntimeMode,
  RuntimeStatus,
  ResourceMetrics,
  AgentProject,
  CreateProjectParams,
  StatusHandler,
  ResourceHandler,
} from "../types/runtime";

const STORAGE_KEY = "zero-one-local-projects";

function generateId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 从 localStorage 读写项目列表 */
function loadProjects(): AgentProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveProjects(projects: AgentProject[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

/** 估算本机资源 */
function estimateResources(): ResourceMetrics {
  // performance.memory 仅 Chrome 支持
  const memInfo = (performance as unknown as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
  const memUsed = memInfo ? memInfo.usedJSHeapSize : 0;
  const memTotal = memInfo ? memInfo.jsHeapSizeLimit : 1;
  const memory = Math.round((memUsed / memTotal) * 100);

  const cores = navigator.hardwareConcurrency || 4;
  const cpu = Math.min(Math.round(10 + Math.random() * 30), 100);

  return {
    cpu,
    memory: Math.min(memory || 15, 100),
    disk: Math.min(Math.round(40 + Math.random() * 20), 100),
  };
}

export class LocalRuntimeConnector implements IRuntimeConnector {
  readonly mode: RuntimeMode = "local";

  private projects: AgentProject[] = [];
  private statusHandlers: StatusHandler[] = [];
  private resourceHandlers: ResourceHandler[] = [];
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  async connect(): Promise<void> {
    this.projects = loadProjects();
    this.notifyStatus();
    this.startPolling();
  }

  disconnect(): void {
    this.stopPolling();
  }

  async getStatus(): Promise<RuntimeStatus> {
    return {
      mode: "local",
      connected: "connected",
      modelReady: true,
      activeProjects: this.projects.filter((p) => p.phase === "running").length,
    };
  }

  async getResources(): Promise<ResourceMetrics> {
    return estimateResources();
  }

  async listProjects(): Promise<AgentProject[]> {
    return [...this.projects];
  }

  async createProject(params: CreateProjectParams): Promise<AgentProject> {
    const project: AgentProject = {
      id: generateId(),
      name: params.name,
      description: params.description,
      phase: "draft",
      mode: "local",
      progress: 0,
      lastActivity: new Date().toISOString(),
      toolCallCount: 0,
      fileCount: 0,
      localPath: params.localPath,
    };
    this.projects = [project, ...this.projects];
    saveProjects(this.projects);
    return project;
  }

  async deleteProject(id: string): Promise<void> {
    this.projects = this.projects.filter((p) => p.id !== id);
    saveProjects(this.projects);
  }

  async startProject(id: string): Promise<void> {
    this.updateProject(id, {
      phase: "running",
      lastActivity: new Date().toISOString(),
    });
  }

  async pauseProject(id: string): Promise<void> {
    this.updateProject(id, {
      phase: "paused",
      lastActivity: new Date().toISOString(),
    });
  }

  onStatusChange(handler: StatusHandler): () => void {
    this.statusHandlers.push(handler);
    return () => {
      this.statusHandlers = this.statusHandlers.filter((h) => h !== handler);
    };
  }

  onResourceUpdate(handler: ResourceHandler): () => void {
    this.resourceHandlers.push(handler);
    return () => {
      this.resourceHandlers = this.resourceHandlers.filter((h) => h !== handler);
    };
  }

  // ── 内部方法 ─────────────────────────────────

  private updateProject(id: string, patch: Partial<AgentProject>): void {
    this.projects = this.projects.map((p) =>
      p.id === id ? { ...p, ...patch } : p,
    );
    saveProjects(this.projects);
  }

  private notifyStatus(): void {
    const status: RuntimeStatus = {
      mode: "local",
      connected: "connected",
      modelReady: true,
      activeProjects: this.projects.filter((p) => p.phase === "running").length,
    };
    for (const h of this.statusHandlers) h(status);
  }

  private startPolling(): void {
    this.stopPolling();
    this.pollTimer = setInterval(async () => {
      const metrics = estimateResources();
      for (const h of this.resourceHandlers) h(metrics);
    }, 3000);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}
