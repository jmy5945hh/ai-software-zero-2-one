import type { AgentSession } from "@earendil-works/pi-coding-agent";

type PooledSession = {
  session: AgentSession;
  step: string;
  unsub: (() => void) | null;
};

/**
 * SessionPool — 多 session 管理（taskId:step → AgentSession）。
 * 同一个 (taskId, step) 只能有一个活跃 session。
 */
export class SessionPool {
  private pool = new Map<string, PooledSession>();

  private key(taskId: string, step: string): string {
    return `${taskId}:${step}`;
  }

  /** 存入 session（若已存在则先 dispose 旧的） */
  set(taskId: string, step: string, session: AgentSession): void {
    const k = this.key(taskId, step);
    this.pool.get(k)?.session.dispose();
    this.pool.set(k, { session, step, unsub: null });
  }

  /** 获取 session */
  get(taskId: string, step: string): AgentSession | undefined {
    return this.pool.get(this.key(taskId, step))?.session;
  }

  /** 设置事件订阅取消函数 */
  setUnsub(taskId: string, step: string, unsub: () => void): void {
    const entry = this.pool.get(this.key(taskId, step));
    if (entry) entry.unsub = unsub;
  }

  /** 清除事件订阅（取消旧订阅，保留 session） */
  clearUnsub(taskId: string, step: string): void {
    const entry = this.pool.get(this.key(taskId, step));
    if (entry) {
      entry.unsub?.();
      entry.unsub = null;
    }
  }

  /** 销毁指定 session */
  dispose(taskId: string, step: string): void {
    const k = this.key(taskId, step);
    const entry = this.pool.get(k);
    if (entry) {
      entry.unsub?.();
      entry.session.dispose();
      this.pool.delete(k);
    }
  }

  /** 获取活跃 session 数量 */
  getActiveCount(): number {
    return this.pool.size;
  }

  /** 销毁全部 session */
  disposeAll(): void {
    for (const entry of this.pool.values()) {
      entry.unsub?.();
      entry.session.dispose();
    }
    this.pool.clear();
  }
}
