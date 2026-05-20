/**
 * SummaryStore — 存储每个 (taskId, step) 的 Agent 完成摘要文本。
 * 供独立总结 Session 读取，避免通过 WebSocket 传大文本。
 */
export class SummaryStore {
  private store = new Map<string, string>();

  private key(taskId: string, step: string): string {
    return `${taskId}:${step}`;
  }

  set(taskId: string, step: string, summary: string): void {
    this.store.set(this.key(taskId, step), summary);
  }

  get(taskId: string, step: string): string | undefined {
    return this.store.get(this.key(taskId, step));
  }

  delete(taskId: string, step: string): void {
    this.store.delete(this.key(taskId, step));
  }

  /** 销毁 task 下所有 step 的摘要 */
  deleteAll(taskId: string): void {
    const prefix = `${taskId}:`;
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) this.store.delete(k);
    }
  }
}
