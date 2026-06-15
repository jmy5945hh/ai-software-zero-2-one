import path from "path";
import fs from "fs";
import os from "os";
import { spawn, spawnSync } from "child_process";

export type FileNode = {
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
};

export type BrowseEntry = {
  name: string;
  type: "dir" | "file";
  path: string;
};

/** Git 仓库配置 */
export type GitRepoConfig = {
  url: string;
  branch: string;
  subdirectory?: string;
};

/** Workspace 初始化状态 */
export type WorkspaceInitStatus = {
  stage: "idle" | "cloning" | "ready" | "error";
  progress?: string;  // git clone 的实时输出行
  error?: string;     // 人类可读错误信息
  /** 错误分类，用于前端展示差异化提示和重试建议 */
  errorType?: "auth" | "network" | "branch_not_found" | "timeout" | "not_found" | "unknown";
  startedAt?: number;
  /** 克隆耗时（ms），完成或失败时填充 */
  elapsedMs?: number;
  /** 已重试次数（0 表示首次尝试） */
  retryCount?: number;
};

/**
 * Workspace 文件系统管理器 — 为每个 taskId 维护隔离的工作目录。
 *
 * 根目录：~/workspaces/（可通过 WORKSPACE_ROOT 环境变量覆盖）
 *
 * 支持三种模式：
 * 1. 托管模式：在 root 下创建 taskId 子目录
 * 2. 云端模式：从 git 克隆仓库到 root/{taskId}/repo/
 * 3. 外部模式：直接使用用户指定的现有目录（本地 Git 项目等）
 *
 * 分层目录结构（云端/托管模式）：
 *   ~/workspaces/{taskId}/
 *     repo/              ← git clone 的仓库（Agent 工作目录 cwd）
 *     deliverables/       ← Agent 交付物（specs、plans、reports 等）
 *       specs/
 *       plans/
 *       reports/
 *     session/           ← 对话轨迹持久化目录
 *       meta.json
 *       step-{workflowId}.json
 *     logs/              ← 编译日志、Agent 运行日志
 *
 * 外部模式：
 *   直接使用用户指定的目录作为 repo 目录，不在其下创建额外子目录。
 */
// ── Git 错误分类与用户提示 ──────────────────

/** 根据 git 错误信息分类 */
function categorizeGitError(message: string): WorkspaceInitStatus["errorType"] {
  const lower = message.toLowerCase();
  if (lower.includes("authentication") || lower.includes("permission") || lower.includes("could not read from remote repository")) return "auth";
  if (lower.includes("could not resolve host") || lower.includes("connection") || lower.includes("timed out") || lower.includes("network") || lower.includes("unable to access")) return "network";
  if (lower.includes("not found") || lower.includes("does not exist") || lower.includes("remote: not found") || lower.includes("repository not found")) return "not_found";
  if (lower.includes("killed") || lower.includes("signal") || lower.includes("timeout")) return "timeout";
  return "unknown";
}

/** 将错误分类转为中文用户提示 */
function buildUserFriendlyError(errorType: WorkspaceInitStatus["errorType"], rawMessage: string): string {
  switch (errorType) {
    case "auth":
      return "Git 仓库认证失败，请检查仓库地址或凭证配置是否正确";
    case "network":
      return "网络连接失败，请检查网络状态后重试";
    case "not_found":
      return "Git 仓库不存在或地址不正确，请检查仓库 URL";
    case "timeout":
      return "Git 克隆超时（超过 120 秒），请检查网络状态或尝试使用更小的仓库";
    case "branch_not_found":
      return "指定的分支不存在，请检查分支名称";
    default:
      return `Git 克隆失败: ${rawMessage}`;
  }
}

/** 格式化毫秒为 "X分Y秒" */
function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min > 0) return `${min}分${sec}秒`;
  return `${sec}秒`;
}

export class WorkspaceManager {
  /** 外部工作空间映射 taskId → 绝对路径（该路径即 repo 目录） */
  private externalDirs = new Map<string, string>();
  /** Workspace 初始化状态跟踪（云端模式 git clone 进度） */
  private initStatuses = new Map<string, WorkspaceInitStatus>();

  constructor(private root: string) {
    // 自动创建根目录
    if (!fs.existsSync(root)) {
      fs.mkdirSync(root, { recursive: true });
      console.log(`[WorkspaceManager] Created workspace root: ${root}`);
    }
  }

  /** 获取默认的 workspace 根目录 */
  static defaultRoot(): string {
    return process.env.WORKSPACE_ROOT
      || path.join(os.homedir(), "workspaces");
  }

  /** 获取 Agent 工作目录（项目代码所在位置） */
  getRepoDir(taskId: string): string {
    const external = this.externalDirs.get(taskId);
    if (external) return external;
    return path.join(this.root, taskId, "repo");
  }

  /** 获取 Agent 交付物目录（specs、plans、reports） */
  getDeliverablesDir(taskId: string): string {
    const external = this.externalDirs.get(taskId);
    if (external) return external; // 外部模式下不创建额外子目录
    return path.join(this.root, taskId, "deliverables");
  }

  /** 获取日志目录 */
  getLogsDir(taskId: string): string {
    const external = this.externalDirs.get(taskId);
    if (external) return external; // 外部模式下不创建额外子目录
    return path.join(this.root, taskId, "logs");
  }

  /** 获取任务 workspace 下的 session 目录路径 */
  getSessionDir(taskId: string): string {
    const external = this.externalDirs.get(taskId);
    if (external) return path.join(external, "session");
    return path.join(this.root, taskId, "session");
  }

  /** 获取 workspace 根目录（taskId 顶层目录） */
  getDir(taskId: string): string {
    return this.dir(taskId);
  }

  /** 获取根目录路径 */
  getRoot(): string {
    return this.root;
  }

  /** 初始化托管 workspace 目录结构 */
  initWorkspace(taskId: string, intent: string): string {
    const taskDir = path.join(this.root, taskId);
    const repoDir = path.join(taskDir, "repo");
    const deliverablesDir = path.join(taskDir, "deliverables");
    const specsDir = path.join(deliverablesDir, "specs");
    const plansDir = path.join(deliverablesDir, "plans");
    const reportsDir = path.join(deliverablesDir, "reports");

    // 创建分层目录结构
    fs.mkdirSync(repoDir, { recursive: true });
    fs.mkdirSync(specsDir, { recursive: true });
    fs.mkdirSync(plansDir, { recursive: true });
    fs.mkdirSync(reportsDir, { recursive: true });

    // AGENTS.md 放在 deliverables 目录（不在 repo 中污染项目代码）
    fs.writeFileSync(
      path.join(deliverablesDir, "AGENTS.md"),
      [
        `# ${taskId}`,
        "",
        "本项目由 AI Agent 驱动生成。",
        "",
        "## 业务意图",
        intent,
        "",
        "## 规范",
        "- 代码使用 TypeScript + React",
        "- 样式使用 CSS（保持与平台 UI 风格一致）",
        "- 数据先 mock，存在 localStorage",
      ].join("\n"),
    );

    console.log(`[WorkspaceManager] Managed workspace ready: ${repoDir}`);
    return repoDir;
  }

  /** 获取 workspace 初始化状态 */
  getInitStatus(taskId: string): WorkspaceInitStatus {
    return this.initStatuses.get(taskId) || { stage: "idle" };
  }

  /**
   * 云端模式：从 Git 仓库克隆代码到 workspace 的 repo/ 子目录。
   *
   * - 如果 repo 已存在（含 .git），直接返回已有路径（幂等）
   * - 如果正在克隆中，返回 "cloning" 状态
   * - 否则启动异步克隆，返回 repoDir 路径并设置状态为 "cloning"
   *
   * 调用方应在克隆完成后检查 initStatus 确认状态为 "ready"。
   */
  initCloudWorkspace(taskId: string, gitRepo: GitRepoConfig): string {
    const taskDir = path.join(this.root, taskId);
    const repoDir = path.join(taskDir, "repo");
    const logPrefix = `[WorkspaceManager][${taskId}]`;
    const startTime = Date.now();
    const retryCount = this.initStatuses.get(taskId)?.retryCount ?? 0;

    // 如果 repo 已存在且有 .git 目录，说明已克隆成功，直接复用
    if (fs.existsSync(repoDir) && fs.existsSync(path.join(repoDir, ".git"))) {
      const effectiveDir = gitRepo.subdirectory
        ? path.join(repoDir, gitRepo.subdirectory)
        : repoDir;
      if (!gitRepo.subdirectory || fs.existsSync(effectiveDir)) {
        console.log(`${logPrefix} Clone cache hit — reusing existing repo: ${repoDir}`);
        this.initStatuses.set(taskId, { stage: "ready", startedAt: startTime, retryCount });
        return effectiveDir;
      }
    }

    // 检查是否正在克隆中
    const currentStatus = this.initStatuses.get(taskId);
    if (currentStatus?.stage === "cloning") {
      // 仍在克隆中，调用方应等待
      console.log(`${logPrefix} Clone already in progress, returning repoDir for wait`);
      return repoDir;
    }

    // 如果 repo 目录存在但没有 .git（之前克隆失败），清理
    if (fs.existsSync(repoDir)) {
      console.log(`${logPrefix} Cleaning up stale repo directory: ${repoDir}`);
      fs.rmSync(repoDir, { recursive: true, force: true });
    }

    // 输入校验：防止 shell 注入
    const urlPattern = /^(https?:\/\/|git@|git:\/\/)/;
    if (!urlPattern.test(gitRepo.url)) {
      throw new Error(`Git URL 格式不合法，仅支持 http(s)://、git@、git:// 协议`);
    }
    const branchPattern = /^[a-zA-Z0-9._\-/]+$/;
    if (!branchPattern.test(gitRepo.branch)) {
      throw new Error(`分支名称包含非法字符: ${gitRepo.branch}`);
    }
    if (gitRepo.subdirectory && !/^[a-zA-Z0-9._\-/]+$/.test(gitRepo.subdirectory)) {
      throw new Error(`子目录路径包含非法字符: ${gitRepo.subdirectory}`);
    }

    // 创建父目录
    fs.mkdirSync(repoDir, { recursive: true });

    // 创建 deliverables 和 logs 目录（提前创建，不依赖 clone 完成）
    const deliverablesDir = path.join(taskDir, "deliverables");
    const specsDir = path.join(deliverablesDir, "specs");
    const plansDir = path.join(deliverablesDir, "plans");
    const reportsDir = path.join(deliverablesDir, "reports");
    const logsDir = path.join(taskDir, "logs");
    fs.mkdirSync(specsDir, { recursive: true });
    fs.mkdirSync(plansDir, { recursive: true });
    fs.mkdirSync(reportsDir, { recursive: true });
    fs.mkdirSync(logsDir, { recursive: true });

    // 设置状态为 "cloning"
    this.initStatuses.set(taskId, { stage: "cloning", startedAt: startTime, progress: "准备克隆...", retryCount });

    // ── 详细日志：克隆开始 ──
    console.log(`${logPrefix} ═══ Git Clone Started ═══`);
    console.log(`${logPrefix}   Timestamp: ${new Date(startTime).toISOString()}`);
    console.log(`${logPrefix}   URL:       ${gitRepo.url}`);
    console.log(`${logPrefix}   Branch:    ${gitRepo.branch}`);
    console.log(`${logPrefix}   Target:    ${repoDir}`);
    console.log(`${logPrefix}   Subdir:    ${gitRepo.subdirectory || "(none)"}`);
    if (retryCount > 0) console.log(`${logPrefix}   Retry:     #${retryCount}`);
    console.log(`${logPrefix} ═══════════════════════════`);

    // 异步克隆
    const child = spawn("git", [
      "clone", "--depth", "1", "--branch", gitRepo.branch, gitRepo.url, repoDir,
    ], {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 120_000,
    });

    // 收集 stderr 完整内容（用于失败时输出完整日志）
    let stderrFull = "";
    let lastProgressLogTime = 0;

    child.stderr.on("data", (data: Buffer) => {
      const text = data.toString().trim();
      if (text) {
        stderrFull += text + "\n";
        const now = Date.now();
        // 每 5 秒打印一次进度（避免日志刷屏）
        if (now - lastProgressLogTime >= 5000) {
          console.log(`${logPrefix} [progress] ${text}`);
          lastProgressLogTime = now;
        }
        this.initStatuses.set(taskId, {
          stage: "cloning",
          progress: text,
          startedAt: startTime,
          retryCount,
        });
      }
    });

    child.on("error", (err) => {
      const elapsed = Date.now() - startTime;
      const errorType = categorizeGitError(err.message);
      const userMsg = buildUserFriendlyError(errorType, err.message);
      console.error(`${logPrefix} ═══ Git Clone ERROR ═══`);
      console.error(`${logPrefix}   Elapsed:    ${formatDuration(elapsed)} (${elapsed}ms)`);
      console.error(`${logPrefix}   Error type: ${errorType}`);
      console.error(`${logPrefix}   Message:    ${err.message}`);
      console.error(`${logPrefix}   Code:       ${(err as NodeJS.ErrnoException).code || "none"}`);
      console.error(`${logPrefix} ═══════════════════════════`);
      this.initStatuses.set(taskId, {
        stage: "error",
        error: userMsg,
        errorType,
        startedAt: startTime,
        elapsedMs: elapsed,
        retryCount,
      });
      try { fs.rmSync(repoDir, { recursive: true, force: true }); } catch { /* ignore */ }
    });

    child.on("close", (code, signal) => {
      const elapsed = Date.now() - startTime;
      if (code === 0) {
        console.log(`${logPrefix} ═══ Git Clone SUCCESS ═══`);
        console.log(`${logPrefix}   Elapsed: ${formatDuration(elapsed)} (${elapsed}ms)`);
        console.log(`${logPrefix} ═══════════════════════════`);
        this.initStatuses.set(taskId, {
          stage: "ready",
          startedAt: startTime,
          elapsedMs: elapsed,
          retryCount,
        });
      } else {
        // 解析 stderr 判断错误类型
        const combinedMsg = stderrFull || `exit code ${code}${signal ? `, signal ${signal}` : ""}`;
        const errorType = code === 128
          ? categorizeGitError(stderrFull) || "branch_not_found"
          : categorizeGitError(stderrFull);
        const userMsg = code === 128
          ? (stderrFull.includes("not found") || stderrFull.includes("does not exist")
              ? buildUserFriendlyError("branch_not_found", `分支 "${gitRepo.branch}" 不存在，请检查分支名称`)
              : buildUserFriendlyError(errorType, combinedMsg))
          : buildUserFriendlyError(errorType, combinedMsg);
        console.error(`${logPrefix} ═══ Git Clone FAILED ═══`);
        console.error(`${logPrefix}   Elapsed:    ${formatDuration(elapsed)} (${elapsed}ms)`);
        console.error(`${logPrefix}   Exit code:  ${code}${signal ? `, signal: ${signal}` : ""}`);
        console.error(`${logPrefix}   Error type: ${errorType}`);
        console.error(`${logPrefix}   User msg:   ${userMsg}`);
        if (stderrFull) console.error(`${logPrefix}   Stderr:\n${stderrFull.trim()}`);
        console.error(`${logPrefix} ═══════════════════════════`);
        this.initStatuses.set(taskId, {
          stage: "error",
          error: userMsg,
          errorType,
          startedAt: startTime,
          elapsedMs: elapsed,
          retryCount,
        });
        try { fs.rmSync(repoDir, { recursive: true, force: true }); } catch { /* ignore */ }
      }
    });

    // 如果指定了子目录，返回子目录路径
    const effectiveRepoDir = gitRepo.subdirectory
      ? path.join(repoDir, gitRepo.subdirectory)
      : repoDir;

    return effectiveRepoDir;
  }

  /**
   * 重试云端 workspace 初始化（清理已损坏目录并重新克隆）。
   * 仅在当前状态为 "error" 时允许重试，防止并发克隆。
   */
  retryCloudWorkspace(taskId: string, gitRepo: GitRepoConfig): string {
    const currentStatus = this.initStatuses.get(taskId);
    const logPrefix = `[WorkspaceManager][${taskId}]`;

    // 防止并发克隆
    if (currentStatus?.stage === "cloning") {
      throw new Error("克隆正在进行中，请等待完成后再重试");
    }

    if (!currentStatus || currentStatus.stage !== "error") {
      throw new Error(`当前状态为 "${currentStatus?.stage || "idle"}"，无法重试克隆（仅在 error 状态下允许重试）`);
    }

    const taskDir = path.join(this.root, taskId);
    const repoDir = path.join(taskDir, "repo");

    // 清理上次失败的残留
    if (fs.existsSync(repoDir)) {
      console.log(`${logPrefix} Retry — cleaning up failed clone residue: ${repoDir}`);
      fs.rmSync(repoDir, { recursive: true, force: true });
    }

    const retryCount = (currentStatus.retryCount ?? 0) + 1;
    console.log(`${logPrefix} Retry clone #${retryCount} — clearing status and restarting`);

    // 重置状态为 idle，让 initCloudWorkspace 正常启动新克隆
    this.initStatuses.delete(taskId);

    const effectiveDir = this.initCloudWorkspace(taskId, gitRepo);

    // 补上 retryCount（initCloudWorkspace 会创建新状态，retryCount 默认为 0）
    const status = this.initStatuses.get(taskId);
    if (status) {
      this.initStatuses.set(taskId, { ...status, retryCount });
    }

    return effectiveDir;
  }

  /** 设置外部工作空间目录（用户指定的本地 Git 项目等） */
  setExternalWorkspace(taskId: string, dirPath: string): string {
    const resolved = path.resolve(this.expandHome(dirPath));
    if (!fs.existsSync(resolved)) {
      throw new Error(`目录不存在: ${resolved}`);
    }
    if (!fs.statSync(resolved).isDirectory()) {
      throw new Error(`路径不是目录: ${resolved}`);
    }
    this.externalDirs.set(taskId, resolved);
    return resolved;
  }

  /** 获取 workspace 文件树（默认展示 repo 目录） */
  getFileTree(taskId: string): FileNode[] {
    const dir = this.getRepoDir(taskId);
    if (!fs.existsSync(dir)) return [];
    return this.scanDir(dir, dir);
  }

  /** 安全读取文件内容，支持绝对路径（任意本地文件）和 workspace 相对路径 */
  readFile(taskId: string, filePath: string): string {
    const full = this.isAbsolutePath(filePath)
      ? this.resolveAbsolute(filePath)
      : this.resolveWorkspace(taskId, filePath);
    if (!fs.existsSync(full)) {
      throw new Error(`File not found: ${filePath}`);
    }
    return fs.readFileSync(full, "utf-8");
  }

  /** 判断是否为绝对路径 */
  private isAbsolutePath(p: string): boolean {
    return p.startsWith("/") || p.startsWith("~/") || p === "~";
  }

  /** 解析绝对路径（含 ~ 展开） */
  private resolveAbsolute(p: string): string {
    return path.resolve(this.expandHome(p));
  }

  /** 解析 workspace 相对路径（相对于 repo 目录），防止路径遍历 */
  private resolveWorkspace(taskId: string, filePath: string): string {
    const repoDir = this.getRepoDir(taskId);
    const full = path.resolve(repoDir, filePath);
    if (!full.startsWith(path.resolve(repoDir))) {
      throw new Error("Path traversal detected");
    }
    return full;
  }

  /** 展开 ~ 为用户主目录 */
  private expandHome(dirPath: string): string {
    if (dirPath === "~" || dirPath.startsWith("~/")) {
      return dirPath.replace("~", os.homedir());
    }
    return dirPath;
  }

  /** 浏览文件系统目录（用于前端目录选择器） */
  browseDir(dirPath: string): BrowseEntry[] {
    const resolved = path.resolve(this.expandHome(dirPath));
    if (!fs.existsSync(resolved)) {
      throw new Error(`目录不存在: ${resolved}`);
    }
    if (!fs.statSync(resolved).isDirectory()) {
      throw new Error(`路径不是目录: ${resolved}`);
    }

    try {
      const entries = fs.readdirSync(resolved, { withFileTypes: true });
      const result: BrowseEntry[] = [];

      for (const entry of entries) {
        // 跳过隐藏文件和 node_modules
        if (entry.name.startsWith(".")) continue;
        if (entry.name === "node_modules") continue;

        try {
          const entryPath = path.join(resolved, entry.name);
          result.push({
            name: entry.name,
            type: entry.isDirectory() ? "dir" : "file",
            path: entryPath,
          });
        } catch {
          // 跳过无法访问的条目
        }
      }

      // 排序：目录在前，然后按名称排序
      result.sort((a, b) => {
        if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      return result;
    } catch (err) {
      throw new Error(`无法读取目录: ${(err as Error).message}`);
    }
  }

  /** 列出所有 workspace 下的任务目录 */
  listTaskDirs(): string[] {
    try {
      const entries = fs.readdirSync(this.root, { withFileTypes: true });
      return entries
        .filter((e) => e.isDirectory() && !e.name.startsWith("."))
        .map((e) => path.join(this.root, e.name));
    } catch {
      return [];
    }
  }

  private dir(taskId: string): string {
    // 优先返回外部目录
    const external = this.externalDirs.get(taskId);
    if (external) return external;
    return path.join(this.root, taskId);
  }

  private scanDir(base: string, current: string): FileNode[] {
    return fs
      .readdirSync(current, { withFileTypes: true })
      .filter((d) => !d.name.startsWith(".") && d.name !== "node_modules")
      .sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      })
      .map((d) => {
        const full = path.join(current, d.name);
        if (d.isDirectory()) {
          return { name: d.name, type: "folder" as const, children: this.scanDir(base, full) };
        }
        return { name: d.name, type: "file" as const };
      });
  }
}
