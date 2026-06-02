/**
 * CloudRuntimeConnector — 云端运行时连接器。
 *
 * 职责：
 * - 通过 WebSocket 与云端 Agent Server 通信
 * - 通过 REST API 管理云端项目
 * - 指数退避自动重连
 * - 资源配额监控（月度 token、任务队列）
 *
 * 复用现有 src/agent/ws.ts 的 AgentWebSocket 基础设施。
 * 当云端不可达时降级展示离线状态。
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
import { AgentWebSocket } from "../agent/ws";
import { buildAgentWsUrl, getAgentWsOrigin } from "../agent/config";

function getCloudApiBase(): string {
  const origin = getAgentWsOrigin();
  // 如果设置了 VITE_CLOUD_API_URL 则优先使用，否则从 WS URL 自动推导
  return import.meta.env.VITE_CLOUD_API_URL || origin;
}

interface CloudProjectResponse {
  id: string;
  name: string;
  description: string;
  status: string;
  progress: number;
  lastActivity: string;
  toolCallCount: number;
  fileCount: number;
}

/** 将云端项目状态映射为前端 ProjectPhase */
function mapPhase(status: string): AgentProject["phase"] {
  switch (status) {
    case "draft":       return "draft";
    case "building":    return "building";
    case "running":     return "running";
    case "paused":      return "paused";
    case "completed":   return "completed";
    case "error":       return "error";
    default:            return "draft";
  }
}

function toAgentProject(p: CloudProjectResponse): AgentProject {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    phase: mapPhase(p.status),
    mode: "cloud",
    progress: p.progress,
    lastActivity: p.lastActivity,
    toolCallCount: p.toolCallCount,
    fileCount: p.fileCount,
    cloudTaskId: p.id,
  };
}

/** 带指数退避的重连管理 */
class ReconnectManager {
  private baseDelay = 1000;
  private maxDelay = 30000;
  private maxAttempts = 5;
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private callback: (() => void) | null = null;

  start(cb: () => void): void {
    this.callback = cb;
    this.attempt = 0;
    this.scheduleNext();
  }

  reset(): void {
    this.attempt = 0;
    this.clearTimer();
  }

  clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private scheduleNext(): void {
    if (this.attempt >= this.maxAttempts) return;
    const delay = Math.min(this.baseDelay * Math.pow(2, this.attempt), this.maxDelay);
    this.attempt++;
    this.timer = setTimeout(() => {
      this.callback?.();
    }, delay);
  }
}

export class CloudRuntimeConnector implements IRuntimeConnector {
  readonly mode: RuntimeMode = "cloud";

  private ws: AgentWebSocket | null = null;
  private statusHandlers: StatusHandler[] = [];
  private resourceHandlers: ResourceHandler[] = [];
  private reconnectMgr = new ReconnectManager();
  private _connected = false;

  async connect(): Promise<void> {
    const wsUrl = buildAgentWsUrl();
    this.ws = new AgentWebSocket(wsUrl);

    this.ws.onOpen(() => {
      this._connected = true;
      this.reconnectMgr.reset();
      this.notifyStatus("connected");
    });

    this.ws.onClose(() => {
      this._connected = false;
      this.notifyStatus("disconnected");
      this.reconnectMgr.start(() => {
        this.notifyStatus("connecting");
        this.connect(); // 重新连接
      });
    });

    this.ws.onAuthError(() => {
      this._connected = false;
      this.notifyStatus("error");
    });

    this.ws.onStatusUpdate(() => {
      // 心跳状态变化时推送资源更新
      this.pushResourceUpdate();
    });
  }

  disconnect(): void {
    this.reconnectMgr.clearTimer();
    this.ws?.close();
    this.ws = null;
    this._connected = false;
  }

  async getStatus(): Promise<RuntimeStatus> {
    return {
      mode: "cloud",
      connected: this._connected ? "connected" : "disconnected",
      modelReady: this._connected,
      activeProjects: 0,
    };
  }

  async getResources(): Promise<ResourceMetrics> {
    try {
      const resp = await fetch(`${getCloudApiBase()}/api/resources`, {
        signal: AbortSignal.timeout(3000),
      });
      if (resp.ok) {
        const data = await resp.json();
        return {
          cpu: data.cpu || 20,
          memory: data.memory || 30,
          disk: data.disk || 40,
          activeQueues: data.activeQueues || 0,
          monthlyTokens: data.monthlyTokens || { used: 0, total: 1_000_000 },
        };
      }
    } catch {
      // 降级：返回默认值
    }
    return {
      cpu: 0,
      memory: 0,
      disk: 0,
      activeQueues: 0,
      monthlyTokens: { used: 0, total: 1_000_000 },
    };
  }

  async listProjects(): Promise<AgentProject[]> {
    try {
      const resp = await fetch(`${getCloudApiBase()}/api/projects`, {
        signal: AbortSignal.timeout(5000),
      });
      if (resp.ok) {
        const data: CloudProjectResponse[] = await resp.json();
        return data.map(toAgentProject);
      }
    } catch {
      // 降级：返回空列表
    }
    return [];
  }

  async createProject(params: CreateProjectParams): Promise<AgentProject> {
    const resp = await fetch(`${getCloudApiBase()}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!resp.ok) throw new Error("Failed to create cloud project");
    const data: CloudProjectResponse = await resp.json();
    return toAgentProject(data);
  }

  async deleteProject(id: string): Promise<void> {
    await fetch(`${getCloudApiBase()}/api/projects/${id}`, { method: "DELETE" });
  }

  async startProject(id: string): Promise<void> {
    await fetch(`${getCloudApiBase()}/api/projects/${id}/start`, { method: "POST" });
  }

  async pauseProject(id: string): Promise<void> {
    await fetch(`${getCloudApiBase()}/api/projects/${id}/pause`, { method: "POST" });
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

  private notifyStatus(status: "connected" | "disconnected" | "connecting"): void {
    const s: RuntimeStatus = {
      mode: "cloud",
      connected: status,
      modelReady: status === "connected",
      activeProjects: 0,
    };
    for (const h of this.statusHandlers) h(s);
  }

  private async pushResourceUpdate(): Promise<void> {
    const metrics = await this.getResources();
    for (const h of this.resourceHandlers) h(metrics);
  }
}
