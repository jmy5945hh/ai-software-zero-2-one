import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";

// ── 会话记录持久化存储 ──────────────────────
// 存储位置：~/.aiNativeDevPlatform/sessions/
//
// 每个会话一个目录，目录名 = sessionId
// 目录结构：
//   {sessionId}/
//     meta.json          ← 任务元信息（intent, workspacePath, stepIndex, runtimeMode 等）
//     step-{workflowId}.json  ← 各步骤的独立会话快照

/** Token 用量数据（持久化到磁盘） */
export type TokenUsageSnapshot = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  total: number;
  cost: number;
  contextWindow?: number;
  contextPercent?: number;
};

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
  /** 各轮次的 token 消耗（按 turn index 索引） */
  turnTokenUsage?: Record<number, TokenUsageSnapshot>;
  /** 整个步骤的累计 token 消耗 */
  totalTokenUsage?: TokenUsageSnapshot;
  summarizationResult?: Record<string, unknown> | null;
  /** 模型检测到的项目编译命令（仅 coding 步骤有值） */
  buildCommand?: string | null;
  /** 项目编译结果（仅 coding 步骤有值） */
  buildResult?: {
    command: string;
    success: boolean;
    output: string;
    timestamp: string;
    retryCount: number;
    building: boolean;
    fixing: boolean;
  } | null;
  // ── 执行状态（用于恢复时判断进度） ──
  /** Agent 是否执行完成 */
  completed?: boolean;
  /** 结构化总结状态 */
  summarizationStatus?: "idle" | "pending" | "loading" | "done" | "error";
  /** 项目编译状态 */
  buildStatus?: "idle" | "pending" | "detecting" | "loading" | "done" | "error";
  // ── QA 审查数据（仅 quality 步骤有值） ──
  /** QA 审查执行状态 */
  qaStatus?: "idle" | "running" | "done" | "error";
  /** CLI 实时输出行 */
  qaOutputLines?: string[];
  /** 最终结果文件路径 */
  qaResultFilePath?: string;
  /** 结果文件内容（TOML 格式） */
  qaResultContent?: string;
  /** 错误信息 */
  qaError?: string;
};

/** 任务元信息（不含对话数据） */
export type SessionMeta = {
  sessionId: string;
  taskId: string;
  intent: string;
  workspacePath: string;
  /** 运行时模式：local 或 cloud */
  runtimeMode: "local" | "cloud";
  /** Git 仓库配置（云端模式），用于 session 恢复时重建 workspace */
  gitRepo?: { url: string; branch: string; subdirectory?: string };
  /** 本地模式使用的 Git 分支配置 */
  localGit?: { branch: string; shouldPull: boolean };
  stepIndex: number;
  activeStage: string;
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
  /** QA 质量审查状态（仅存简略状态，完整数据在 step-quality.json） */
  qaReview?: {
    status: "idle" | "running" | "done" | "error";
  };
  /** 交互原型状态 */
  prototype?: {
    mode: "none" | "new-page" | "existing-change";
    status: "pending" | "generating" | "reviewing" | "approved" | "skipped";
    htmlPath: string;
    handoffPath: string;
  };
};

/** 完整的会话记录（元信息 + 各步骤对话数据） */
export type SessionRecord = SessionMeta & {
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

  /** 生成 32 位 sessionId */
  static generateSessionId(): string {
    return crypto.randomBytes(16).toString("hex");
  }

  /** 获取会话目录路径 */
  private sessionDir(sessionId: string): string {
    return path.join(this.baseDir, sessionId);
  }

  /** 获取 meta.json 路径 */
  private metaPath(sessionId: string): string {
    return path.join(this.sessionDir(sessionId), "meta.json");
  }

  /** 获取某步骤的会话文件路径 */
  private stepPath(sessionId: string, stepId: string): string {
    return path.join(this.sessionDir(sessionId), `step-${stepId}.json`);
  }

  /** 保存会话元信息 */
  saveMeta(meta: SessionMeta): void {
    const dir = this.sessionDir(meta.sessionId);
    fs.mkdirSync(dir, { recursive: true });
    meta.updatedAt = new Date().toISOString();
    const filePath = this.metaPath(meta.sessionId);
    fs.writeFileSync(filePath, JSON.stringify(meta, null, 2), "utf-8");
    console.log(`[SessionStore] saveMeta → ${filePath} (sessionId=${meta.sessionId}, runtimeMode=${meta.runtimeMode || "-"})`);
  }

  /** 保存某步骤的会话快照 */
  saveStep(sessionId: string, stepId: string, snapshot: StepSessionSnapshot): void {
    const dir = this.sessionDir(sessionId);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      this.stepPath(sessionId, stepId),
      JSON.stringify(snapshot, null, 2),
      "utf-8",
    );
  }

  /** 保存完整会话记录（兼容旧接口，内部拆分为 meta + step 文件） */
  save(record: SessionRecord): void {
    const { stepSessions, ...meta } = record;
    this.saveMeta(meta);
    for (const [stepId, snapshot] of Object.entries(stepSessions || {})) {
      this.saveStep(record.sessionId, stepId, snapshot);
    }
  }

  /** 加载会话元信息 */
  loadMeta(sessionId: string): SessionMeta | null {
    try {
      const raw = fs.readFileSync(this.metaPath(sessionId), "utf-8");
      return JSON.parse(raw) as SessionMeta;
    } catch {
      return null;
    }
  }

  /** 加载某步骤的会话快照 */
  loadStep(sessionId: string, stepId: string): StepSessionSnapshot | null {
    try {
      const raw = fs.readFileSync(this.stepPath(sessionId, stepId), "utf-8");
      return JSON.parse(raw) as StepSessionSnapshot;
    } catch {
      return null;
    }
  }

  /** 加载完整会话记录（元信息 + 所有步骤对话数据） */
  load(sessionId: string): SessionRecord | null {
    const meta = this.loadMeta(sessionId);
    if (!meta) return null;

    const stepSessions: Record<string, StepSessionSnapshot> = {};
    const dir = this.sessionDir(sessionId);
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const match = file.match(/^step-(.+)\.json$/);
        if (match) {
          const stepId = match[1];
          try {
            const raw = fs.readFileSync(path.join(dir, file), "utf-8");
            stepSessions[stepId] = JSON.parse(raw) as StepSessionSnapshot;
          } catch {
            // 跳过损坏的文件
          }
        }
      }
    } catch {
      // 目录不存在
    }

    return { ...meta, stepSessions };
  }

  /** 列出所有会话记录（按更新时间倒序，不含对话数据） */
  list(): SessionMeta[] {
    const metas: SessionMeta[] = [];

    // 仅以主存储 ~/.aiNativeDevPlatform/sessions/ 为准
    try {
      const entries = fs.readdirSync(this.baseDir);
      console.log(`[SessionStore] list() → scanning ${entries.length} entries in ${this.baseDir}`);
      for (const entry of entries) {
        const dir = path.join(this.baseDir, entry);
        if (!fs.statSync(dir).isDirectory()) continue;
        const metaPath = path.join(dir, "meta.json");
        try {
          const raw = fs.readFileSync(metaPath, "utf-8");
          const meta = JSON.parse(raw) as SessionMeta;
          metas.push(meta);
        } catch {
          // 跳过损坏的目录
        }
      }
    } catch (err) {
      console.warn(`[SessionStore] list() primary storage scan failed:`, (err as Error).message);
    }

    // 按更新时间倒序
    metas.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    return metas;
  }

  /** 删除会话记录 */
  delete(sessionId: string): void {
    const dir = this.sessionDir(sessionId);
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // 目录不存在忽略
    }
  }
}
