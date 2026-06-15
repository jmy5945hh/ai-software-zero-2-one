import type { AgentEvent, WsMessage, ConnectionQuality } from "./types";

type EventHandler = (event: AgentEvent) => void;
type StatusHandler = (status: ConnectionQuality) => void;
type AuthErrorHandler = () => void;

/**
 * WebSocket 连接管理器 — 封装请求-响应 + 事件流。
 * 支持自动递增请求 ID，关联 response/event。
 * 内置应用层心跳检测与延迟测量。
 */
export class AgentWebSocket {
  private ws: WebSocket | null = null;
  readonly url: string;
  private nextId = 1;
  private pending = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  private eventHandlers: EventHandler[] = [];
  private openHandlers: Array<() => void> = [];
  private closeHandlers: Array<() => void> = [];
  private reconnectingHandlers: Array<(attempt: number) => void> = [];
  private statusHandlers: StatusHandler[] = [];
  private authErrorHandlers: AuthErrorHandler[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private shouldReconnect = true;
  private reconnectAttempt = 0;
  private lastLatency = 0;
  private readonly HEARTBEAT_INTERVAL = 10000;
  private readonly PONG_TIMEOUT = 5000;

  constructor(url: string) {
    this.url = url;
    this.connect();
  }

  private connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.reconnectDelay = 1000;
      this.reconnectAttempt = 0;
      this.startHeartbeat();
      for (const h of this.openHandlers) h();
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data);

        if (msg.type === "pong") {
          this.lastLatency = Date.now() - msg.ts;
          this.notifyStatus();
          if (this.pongTimer) {
            clearTimeout(this.pongTimer);
            this.pongTimer = null;
          }
          return;
        }

        if (msg.type === "response") {
          const pending = this.pending.get(msg.id);
          if (pending) {
            pending.resolve(msg.result);
            this.pending.delete(msg.id);
          }
        } else if (msg.type === "error") {
          const pending = this.pending.get(msg.id);
          if (pending) {
            pending.reject(new Error(msg.error.message));
            this.pending.delete(msg.id);
          }
        } else if (msg.type === "event") {
          for (const h of this.eventHandlers) h(msg.event);
        }
      } catch {
        // 忽略解析失败的消息
      }
    };

    this.ws.onclose = (event: CloseEvent) => {
      this.stopHeartbeat();

      // 4010-4019 → 认证相关错误，停止重连
      if (event.code >= 4001 && event.code <= 4019) {
        this.shouldReconnect = false;
        for (const h of this.authErrorHandlers) h();
      }

      for (const h of this.closeHandlers) h();

      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // 错误后会触发 onclose，由 onclose 处理重连
    };
  }

  // ── 心跳检测 ──────────────────────────

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      this.sendPing();
    }, this.HEARTBEAT_INTERVAL);
    // 立即发第一个 ping 获取初始延迟
    this.sendPing();
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  private sendPing(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const ts = Date.now();
    this.ws.send(JSON.stringify({ type: "ping", ts }));
    // 如果在 PONG_TIMEOUT 内未收到 pong，标记为不可达
    this.pongTimer = setTimeout(() => {
      this.lastLatency = -1; // -1 表示超时
      this.notifyStatus();
    }, this.PONG_TIMEOUT);
  }

  private notifyStatus(): void {
    const quality: ConnectionQuality = {
      latency: this.lastLatency,
      reconnectAttempt: this.reconnectAttempt,
    };
    for (const h of this.statusHandlers) h(quality);
  }

  // ── 重连 ──────────────────────────────

  private scheduleReconnect(): void {
    if (!this.shouldReconnect) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    this.reconnectAttempt++;
    for (const h of this.reconnectingHandlers) h(this.reconnectAttempt);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(
        this.reconnectDelay * 2,
        this.maxReconnectDelay,
      );
      this.connect();
    }, this.reconnectDelay);
  }

  /** 发送请求并等待响应 */
  async request(
    method: string,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error("[AgentWebSocket] request failed — ws not connected", { method, wsState: this.ws?.readyState });
      throw new Error("WebSocket is not connected");
    }

    const id = String(this.nextId++);
    const promise = new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });

    console.log("[AgentWebSocket] sending request", { method, id, params: { ...params, text: typeof params.text === 'string' ? params.text.slice(0, 30) : params.text } });
    this.ws.send(JSON.stringify({ type: "request", id, method, params }));
    return promise;
  }

  /** 注册事件处理器 */
  onEvent(handler: EventHandler): void {
    this.eventHandlers.push(handler);
  }

  /** 注册连接打开处理器 */
  onOpen(handler: () => void): void {
    this.openHandlers.push(handler);
  }

  /** 注册连接关闭处理器 */
  onClose(handler: () => void): void {
    this.closeHandlers.push(handler);
  }

  /** 注册重连中处理器（携带重连次数） */
  onReconnecting(handler: (attempt: number) => void): void {
    this.reconnectingHandlers.push(handler);
  }

  /** 注册连接质量更新（延迟、重连次数） */
  onStatusUpdate(handler: StatusHandler): void {
    this.statusHandlers.push(handler);
  }

  /** 注册认证失败处理器（Token 错误等，触发后不会重连） */
  onAuthError(handler: AuthErrorHandler): void {
    this.authErrorHandlers.push(handler);
  }

  /** 关闭连接（不重连） */
  close(): void {
    this.shouldReconnect = false;
    this.stopHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }
}
