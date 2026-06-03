import path from "path";
import fs from "fs";
import os from "os";
import { spawnSync } from "child_process";

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

/**
 * Workspace 文件系统管理器 — 为每个 taskId 维护隔离的工作目录。
 *
 * 根目录：~/workspaces/（可通过 WORKSPACE_ROOT 环境变量覆盖）
 *
 * 支持三种模式：
 * 1. 托管模式：在 root 下创建 taskId 子目录（含 AGENTS.md / package.json）
 * 2. 云端模式：从 git 克隆仓库到 root/{taskId}/repo/
 * 3. 外部模式：直接使用用户指定的现有目录（本地 Git 项目等）
 *
 * 每个任务的工作目录结构：
 *   ~/workspaces/{taskId}/
 *     repo/              ← git clone 的仓库（云端模式）或托管代码（本地托管模式）
 *     session/           ← 对话轨迹持久化目录
 *       meta.json
 *       step-{workflowId}.json
 */
export class WorkspaceManager {
  /** 外部工作空间映射 taskId → 绝对路径 */
  private externalDirs = new Map<string, string>();

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

  /** 初始化托管 workspace 目录结构，写入 AGENTS.md */
  initWorkspace(taskId: string, intent: string): string {
    const dir = this.dir(taskId);
    fs.mkdirSync(dir, { recursive: true });
    fs.mkdirSync(path.join(dir, "src"), { recursive: true });

    fs.writeFileSync(
      path.join(dir, "AGENTS.md"),
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

    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ name: taskId, private: true, type: "module" }, null, 2),
    );

    return dir;
  }

  /** 云端模式：从 Git 仓库克隆代码到 workspace */
  initCloudWorkspace(taskId: string, gitRepo: GitRepoConfig): string {
    const taskDir = path.join(this.root, taskId);
    const repoDir = path.join(taskDir, "repo");

    // 如果 repo 目录已存在（可能是重试），先清理
    if (fs.existsSync(repoDir)) {
      fs.rmSync(repoDir, { recursive: true, force: true });
    }

    fs.mkdirSync(repoDir, { recursive: true });

    console.log(`[WorkspaceManager] Cloning ${gitRepo.url}#${gitRepo.branch} into ${repoDir}`);

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

    try {
      const result = spawnSync("git", [
        "clone", "--depth", "1", "--branch", gitRepo.branch, gitRepo.url, repoDir,
      ], {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 120_000, // 2 分钟超时
      });

      if (result.error) {
        throw new Error(`Git clone 执行失败: ${result.error.message}`);
      }
      if (result.status !== 0) {
        throw new Error(`Git clone 失败: ${result.stderr?.trim() || "unknown error"}`);
      }
    } catch (err) {
      // 克隆失败时清理并抛出
      try { fs.rmSync(repoDir, { recursive: true, force: true }); } catch { /* ignore */ }
      throw new Error(`Git 仓库克隆失败: ${(err as Error).message}`);
    }

    // 如果指定了子目录，调整工作空间根目录指向子目录
    const effectiveDir = gitRepo.subdirectory
      ? path.join(repoDir, gitRepo.subdirectory)
      : repoDir;

    if (gitRepo.subdirectory && !fs.existsSync(effectiveDir)) {
      throw new Error(`仓库子目录不存在: ${gitRepo.subdirectory}`);
    }

    // 设置为外部目录（Agent 直接操作此目录）
    this.externalDirs.set(taskId, effectiveDir);

    console.log(`[WorkspaceManager] Cloud workspace ready: ${effectiveDir}`);
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

  /** 获取 workspace 文件树 */
  getFileTree(taskId: string): FileNode[] {
    const dir = this.dir(taskId);
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

  /** 解析 workspace 相对路径，防止路径遍历 */
  private resolveWorkspace(taskId: string, filePath: string): string {
    const full = path.resolve(this.dir(taskId), filePath);
    if (!full.startsWith(path.resolve(this.dir(taskId)))) {
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

  /** 获取任务 workspace 下的 session 目录路径 */
  getSessionDir(taskId: string): string {
    return path.join(this.root, taskId, "session");
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

  /** 获取 workspace 根目录 */
  getDir(taskId: string): string {
    return this.dir(taskId);
  }

  /** 获取根目录路径 */
  getRoot(): string {
    return this.root;
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
