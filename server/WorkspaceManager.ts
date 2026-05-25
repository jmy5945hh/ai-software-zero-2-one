import path from "path";
import fs from "fs";
import os from "os";

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

/**
 * Workspace 文件系统管理器 — 为每个 taskId 维护隔离的工作目录。
 * 支持两种模式：
 * 1. 托管模式：在 root 下创建 task 子目录（含 AGENTS.md / package.json）
 * 2. 外部模式：直接使用用户指定的现有目录（如 Git 项目）
 *
 * 限制路径遍历，安全读取 workspace 下文件。
 */
export class WorkspaceManager {
  /** 外部工作空间映射 taskId → 绝对路径 */
  private externalDirs = new Map<string, string>();

  constructor(private root: string) {}

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

  /** 获取 workspace 根目录 */
  getDir(taskId: string): string {
    return this.dir(taskId);
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
