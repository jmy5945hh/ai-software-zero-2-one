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
  error?: string;
  startedAt?: number;
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

    // 如果 repo 已存在且有 .git 目录，说明已克隆成功，直接复用
    if (fs.existsSync(repoDir) && fs.existsSync(path.join(repoDir, ".git"))) {
      const effectiveDir = gitRepo.subdirectory
        ? path.join(repoDir, gitRepo.subdirectory)
        : repoDir;
      if (!gitRepo.subdirectory || fs.existsSync(effectiveDir)) {
        this.initStatuses.set(taskId, { stage: "ready", startedAt: Date.now() });
        return effectiveDir;
      }
    }

    // 检查是否正在克隆中
    const currentStatus = this.initStatuses.get(taskId);
    if (currentStatus?.stage === "cloning") {
      // 仍在克隆中，调用方应等待
      return repoDir;
    }

    // 如果 repo 目录存在但没有 .git（之前克隆失败），清理
    if (fs.existsSync(repoDir)) {
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
    this.initStatuses.set(taskId, { stage: "cloning", startedAt: Date.now(), progress: "准备克隆..." });

    console.log(`[WorkspaceManager] Starting async clone: ${gitRepo.url}#${gitRepo.branch} → ${repoDir}`);

    // 异步克隆
    const child = spawn("git", [
      "clone", "--depth", "1", "--branch", gitRepo.branch, gitRepo.url, repoDir,
    ], {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 120_000,
    });

    child.stderr.on("data", (data: Buffer) => {
      const text = data.toString().trim();
      if (text) {
        this.initStatuses.set(taskId, {
          stage: "cloning",
          progress: text,
          startedAt: Date.now(),
        });
      }
    });

    child.on("error", (err) => {
      console.error(`[WorkspaceManager] Clone error for ${taskId}:`, err.message);
      this.initStatuses.set(taskId, { stage: "error", error: err.message, startedAt: Date.now() });
      try { fs.rmSync(repoDir, { recursive: true, force: true }); } catch { /* ignore */ }
    });

    child.on("close", (code) => {
      if (code === 0) {
        console.log(`[WorkspaceManager] Clone complete for ${taskId}`);
        this.initStatuses.set(taskId, { stage: "ready", startedAt: Date.now() });
      } else {
        const errMsg = `Git clone 失败 (exit code ${code})`;
        console.error(`[WorkspaceManager] ${errMsg} for ${taskId}`);
        this.initStatuses.set(taskId, { stage: "error", error: errMsg, startedAt: Date.now() });
        try { fs.rmSync(repoDir, { recursive: true, force: true }); } catch { /* ignore */ }
      }
    });

    // 如果指定了子目录，返回子目录路径
    const effectiveRepoDir = gitRepo.subdirectory
      ? path.join(repoDir, gitRepo.subdirectory)
      : repoDir;

    return effectiveRepoDir;
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
