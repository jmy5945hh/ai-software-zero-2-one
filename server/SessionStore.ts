import fs from "fs";
import path from "path";
import os from "os";

// ── 会话记录持久化存储 ──────────────────────
// 存储位置：~/.aiNativeDevPlatform/sessions/
// 每个会话一个 JSON 文件，文件名 = taskId.json

/** 单个步骤的会话快照 */
export type StepSessionSnapshot = {
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
      outputFragments: string[];
    }>;
  }>;
  summary: string;
  summarizationResult?: Record<string, unknown> | null;
};

export type SessionRecord = {
  taskId: string;
  intent: string;
  workspacePath: string;
  stepIndex: number;
  activeStage: string;
  scope: string;
  selectedModules: string[];
  notes: string;
  todoAnswers: Record<number, string | string[]>;
  initialPrompts: Record<string, string>;
  codeConfirmed: boolean;
  fixApproved: boolean;
  releaseApproved: boolean;
  qualityPassed: boolean;
  createdAt: string;
  updatedAt: string;
  status: "active" | "completed";
  /** 各步骤的 Agent 总结摘要（stepId → brief） */
  stepSummaries: Record<string, string>;
  /** 各步骤的完整会话快照（stepId → 会话数据） */
  stepSessions: Record<string, StepSessionSnapshot>;
};

export class SessionStore {
  private baseDir: string;

  constructor() {
    this.baseDir = path.join(os.homedir(), ".aiNativeDevPlatform", "sessions");
    fs.mkdirSync(this.baseDir, { recursive: true });
    console.log(`[SessionStore] sessions dir: ${this.baseDir}`);
  }

  /** 保存/更新会话记录 */
  save(record: SessionRecord): void {
    const filePath = this.filePath(record.taskId);
    record.updatedAt = new Date().toISOString();
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2), "utf-8");
  }

  /** 按 taskId 加载会话记录 */
  load(taskId: string): SessionRecord | null {
    const filePath = this.filePath(taskId);
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw) as SessionRecord;
    } catch {
      return null;
    }
  }

  /** 列出所有会话记录（按更新时间倒序） */
  list(): SessionRecord[] {
    try {
      const files = fs.readdirSync(this.baseDir);
      const records: SessionRecord[] = [];
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        try {
          const raw = fs.readFileSync(path.join(this.baseDir, file), "utf-8");
          records.push(JSON.parse(raw) as SessionRecord);
        } catch {
          // 跳过损坏的文件
        }
      }
      records.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
      return records;
    } catch {
      return [];
    }
  }

  /** 删除会话记录 */
  delete(taskId: string): void {
    const filePath = this.filePath(taskId);
    try {
      fs.unlinkSync(filePath);
    } catch {
      // 文件不存在忽略
    }
  }

  private filePath(taskId: string): string {
    // 将 taskId 中的特殊字符替换为安全文件名
    const safeName = taskId.replace(/[^a-zA-Z0-9_-]/g, "_");
    return path.join(this.baseDir, `${safeName}.json`);
  }
}
