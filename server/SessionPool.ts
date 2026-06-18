import type { AgentSession } from "@earendil-works/pi-coding-agent";

type PooledSession = {
  session: AgentSession;
  taskId: string;
  step: string;
  unsub: (() => void) | null;
};

/**
 * SessionPool — 多 session 管理（taskId:step → AgentSession）。
 * 同一个 (taskId, step) 只能有一个活跃 session。
 * 同时维护 sessionId → (taskId, step) 索引，支持按 sessionId 查找。
 */
export class SessionPool {
  private pool = new Map<string, PooledSession>();
  /** sessionId → (taskId, step) 索引 */
  private sessionIdIndex = new Map<string, { taskId: string; step: string }>();

  private key(taskId: string, step: string): string {
    return `${taskId}:${step}`;
  }

  /** 存入 session（若已存在则先 dispose 旧的） */
  set(taskId: string, step: string, session: AgentSession): void {
    const k = this.key(taskId, step);
    const existing = this.pool.get(k);
    if (existing) {
      this.sessionIdIndex.delete(existing.session.sessionId);
      existing.session.dispose();
    }
    this.pool.set(k, { session, taskId, step, unsub: null });
    this.sessionIdIndex.set(session.sessionId, { taskId, step });
  }

  /** 获取 session */
  get(taskId: string, step: string): AgentSession | undefined {
    return this.pool.get(this.key(taskId, step))?.session;
  }

  /** 按 sessionId 查找 session */
  findBySessionId(sessionId: string): { taskId: string; step: string; session: AgentSession } | undefined {
    const entry = this.sessionIdIndex.get(sessionId);
    if (!entry) return undefined;
    const pooled = this.pool.get(this.key(entry.taskId, entry.step));
    if (!pooled) return undefined;
    return { ...entry, session: pooled.session };
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
      this.sessionIdIndex.delete(entry.session.sessionId);
      entry.unsub?.();
      entry.session.dispose();
      this.pool.delete(k);
    }
  }

  /** 获取活跃 session 数量 */
  getActiveCount(): number {
    return this.pool.size;
  }

  /** 任务仍在写文件时禁止回退，避免恢复结果立刻被后续工具调用覆盖。 */
  isTaskStreaming(taskId: string): boolean {
    for (const entry of this.pool.values()) {
      if (entry.taskId === taskId && entry.session.isStreaming) return true;
    }
    return false;
  }

  /** 销毁全部 session */
  disposeAll(): void {
    for (const entry of this.pool.values()) {
      entry.unsub?.();
      entry.session.dispose();
    }
    this.pool.clear();
    this.sessionIdIndex.clear();
  }
}
