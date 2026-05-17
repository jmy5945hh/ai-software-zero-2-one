import type { AgentEvent, WsMessage } from "./types";

type EventHandler = (event: AgentEvent) => void;

/**
 * WebSocket 连接管理器 — 封装请求-响应 + 事件流。
 * 支持自动递增请求 ID，关联 response/event。
 */
export class AgentWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private nextId = 1;
  private pending = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  private eventHandlers: EventHandler[] = [];
  private openHandlers: Array<() => void> = [];
  private closeHandlers: Array<() => void> = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private shouldReconnect = true;

  constructor(url: string) {
    this.url = url;
    this.connect();
  }

  private connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.reconnectDelay = 1000;
      for (const h of this.openHandlers) h();
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data);

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

    this.ws.onclose = () => {
      for (const h of this.closeHandlers) h();
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      // 错误后会触发 onclose，由 onclose 处理重连
    };
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

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
      throw new Error("WebSocket is not connected");
    }

    const id = String(this.nextId++);
    const promise = new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });

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

  /** 关闭连接（不重连） */
  close(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }
}
