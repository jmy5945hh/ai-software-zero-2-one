import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

export type RollbackCheckpoint = {
  id: string;
  round: number;
  step: string;
  commit: string;
  createdAt: string;
};

type RollbackState = {
  version: 2;
  taskId: string;
  workspacePath: string;
  baselineCommit: string;
  checkpoints: RollbackCheckpoint[];
};

export type TaskDiffFile = {
  path: string;
  diff: string;
  additions: number;
  deletions: number;
  changeType: "create" | "modify" | "delete";
};

/**
 * 任务文件快照。每个任务使用平台目录中的外置 Git 对象库，用户 workspace 仅作为 work tree。
 * 因此普通文件夹和 Git 仓库使用同一套实现，且不会写入用户目录中的 .git。
 */
export class RollbackManager {
  private readonly baseDir: string;
  private readonly states = new Map<string, RollbackState>();

  constructor(baseDir = path.join(os.homedir(), ".aiNativeDevPlatform", "rollbacks")) {
    this.baseDir = baseDir;
    fs.mkdirSync(baseDir, { recursive: true });
  }

  ensureBaseline(taskId: string, workspacePath: string): RollbackState {
    const resolvedWorkspace = path.resolve(workspacePath);
    const existing = this.load(taskId);
    if (existing && path.resolve(existing.workspacePath) === resolvedWorkspace) return existing;

    this.initializeSnapshotStore(taskId);
    const state: RollbackState = {
      version: 2,
      taskId,
      workspacePath: resolvedWorkspace,
      baselineCommit: this.capture(taskId, resolvedWorkspace, `task ${taskId} baseline`),
      checkpoints: [],
    };
    this.keepCommit(taskId, resolvedWorkspace, "baseline", state.baselineCommit);
    this.save(state);
    return state;
  }

  createCheckpoint(taskId: string, workspacePath: string, step: string): RollbackCheckpoint {
    const state = this.ensureBaseline(taskId, workspacePath);
    const round = state.checkpoints.length + 1;
    const checkpoint: RollbackCheckpoint = {
      id: `round-${round}`,
      round,
      step,
      commit: this.capture(taskId, state.workspacePath, `task ${taskId} round ${round}`),
      createdAt: new Date().toISOString(),
    };
    state.checkpoints.push(checkpoint);
    this.keepCommit(taskId, state.workspacePath, checkpoint.id, checkpoint.commit);
    this.save(state);
    return checkpoint;
  }

  getStatus(taskId: string): Omit<RollbackState, "baselineCommit" | "version"> & { ready: boolean } | { ready: false; taskId: string; checkpoints: [] } {
    const state = this.load(taskId);
    if (!state) return { ready: false, taskId, checkpoints: [] };
    return {
      ready: true,
      taskId: state.taskId,
      workspacePath: state.workspacePath,
      checkpoints: state.checkpoints,
    };
  }

  rollbackTask(taskId: string): void {
    const state = this.requireState(taskId);
    this.restore(taskId, state.workspacePath, state.baselineCommit);
  }

  rollbackFile(taskId: string, filePath: string): void {
    const state = this.requireState(taskId);
    this.restore(taskId, state.workspacePath, state.baselineCommit, this.safeRelativePath(state.workspacePath, filePath));
  }

  rollbackRound(taskId: string, checkpointId: string): RollbackCheckpoint {
    const state = this.requireState(taskId);
    const checkpoint = state.checkpoints.find((item) => item.id === checkpointId);
    if (!checkpoint) throw new Error(`回退点不存在: ${checkpointId}`);
    this.restore(taskId, state.workspacePath, checkpoint.commit);
    return checkpoint;
  }

  /** 比较任务基线和当前文件状态，不依赖 workspace 自身是否为 Git 仓库。 */
  getDiffFiles(taskId: string): TaskDiffFile[] {
    const state = this.requireState(taskId);
    const currentCommit = this.capture(taskId, state.workspacePath, "temporary diff source");
    const baselineTree = execFileSync("git", [
      `--git-dir=${this.gitDir(taskId)}`,
      "rev-parse", `${state.baselineCommit}^{tree}`,
    ], { encoding: "utf8" }).trim();
    const currentTree = execFileSync("git", [
      `--git-dir=${this.gitDir(taskId)}`,
      "rev-parse", `${currentCommit}^{tree}`,
    ], { encoding: "utf8" }).trim();
    console.log("[rollback] getDiffFiles baseline=%s current=%s baselineTree=%s currentTree=%s",
      state.baselineCommit.slice(0, 8), currentCommit.slice(0, 8),
      baselineTree.slice(0, 8), currentTree.slice(0, 8));
    const output = execFileSync("git", [
      `--git-dir=${this.gitDir(taskId)}`,
      "diff", "--name-status", "--no-renames", "-z", state.baselineCommit, currentCommit,
    ], { cwd: state.workspacePath, encoding: "buffer", maxBuffer: 20 * 1024 * 1024 });
    const fields = output.toString("utf8").split("\0").filter(Boolean);
    const files: TaskDiffFile[] = [];
    for (let index = 0; index + 1 < fields.length; index += 2) {
      const status = fields[index];
      const filePath = fields[index + 1];
      const diff = this.git(taskId, state.workspacePath, [
        "diff", "--binary", "--no-ext-diff", "--no-renames",
        state.baselineCommit, currentCommit, "--", filePath,
      ]);
      let additions = 0;
      let deletions = 0;
      for (const line of diff.split("\n")) {
        if (line.startsWith("+") && !line.startsWith("+++")) additions++;
        if (line.startsWith("-") && !line.startsWith("---")) deletions++;
      }
      files.push({
        path: filePath,
        diff,
        additions,
        deletions,
        changeType: status === "A" ? "create" : status === "D" ? "delete" : "modify",
      });
    }
    return files;
  }

  private initializeSnapshotStore(taskId: string): void {
    const taskDir = this.taskDir(taskId);
    const gitDir = this.gitDir(taskId);
    fs.mkdirSync(taskDir, { recursive: true });
    if (!fs.existsSync(path.join(gitDir, "HEAD"))) {
      execFileSync("git", ["init", "--bare", gitDir], { encoding: "utf8", stdio: "pipe" });
    }
  }

  private capture(taskId: string, workspacePath: string, message: string): string {
    this.assertWorkspace(workspacePath);
    this.initializeSnapshotStore(taskId);
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zero-one-index-"));
    const env = { ...process.env, GIT_INDEX_FILE: path.join(tempDir, "index") };
    try {
      this.git(taskId, workspacePath, ["read-tree", "--empty"], env);
      this.git(taskId, workspacePath, [
        "add", "-A", "--", ".",
        ":(exclude).git", ":(exclude).git/**",
      ], env);
      const tree = this.git(taskId, workspacePath, ["write-tree"], env).trim();
      const commitEnv = {
        ...env,
        GIT_AUTHOR_NAME: "Zero One Rollback",
        GIT_AUTHOR_EMAIL: "rollback@zero-one.local",
        GIT_COMMITTER_NAME: "Zero One Rollback",
        GIT_COMMITTER_EMAIL: "rollback@zero-one.local",
      };
      return this.git(taskId, workspacePath, ["commit-tree", tree, "-m", message], commitEnv).trim();
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  private restore(taskId: string, workspacePath: string, targetCommit: string, onlyPath?: string): void {
    if (onlyPath) {
      if (this.pathExistsInCommit(taskId, workspacePath, targetCommit, onlyPath)) {
        this.removeDirectoryBlockingFile(workspacePath, onlyPath);
        this.git(taskId, workspacePath, ["restore", `--source=${targetCommit}`, "--worktree", "--", onlyPath]);
      } else {
        fs.rmSync(path.join(workspacePath, onlyPath), { recursive: true, force: true });
      }
      return;
    }

    const currentCommit = this.capture(taskId, workspacePath, "temporary rollback source");
    const targetPaths = this.listPaths(taskId, workspacePath, targetCommit);
    const targetSet = new Set(targetPaths);
    for (const currentPath of this.listPaths(taskId, workspacePath, currentCommit)) {
      if (!targetSet.has(currentPath)) {
        fs.rmSync(path.join(workspacePath, currentPath), { recursive: true, force: true });
      }
    }
    for (const targetPath of targetPaths) this.removeDirectoryBlockingFile(workspacePath, targetPath);
    for (let index = 0; index < targetPaths.length; index += 200) {
      this.git(taskId, workspacePath, [
        "restore", `--source=${targetCommit}`, "--worktree", "--",
        ...targetPaths.slice(index, index + 200),
      ]);
    }
  }

  private removeDirectoryBlockingFile(workspacePath: string, filePath: string): void {
    const fullPath = path.join(workspacePath, filePath);
    if (fs.existsSync(fullPath) && fs.lstatSync(fullPath).isDirectory()) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    }
  }

  private listPaths(taskId: string, workspacePath: string, commit: string): string[] {
    const output = execFileSync("git", [
      `--git-dir=${this.gitDir(taskId)}`,
      "ls-tree", "-r", "-z", "--name-only", commit,
    ], { cwd: workspacePath, encoding: "buffer", maxBuffer: 20 * 1024 * 1024 });
    return output.toString("utf8").split("\0").filter(Boolean);
  }

  private pathExistsInCommit(taskId: string, workspacePath: string, commit: string, filePath: string): boolean {
    try {
      this.git(taskId, workspacePath, ["cat-file", "-e", `${commit}:${filePath}`]);
      return true;
    } catch {
      return false;
    }
  }

  private safeRelativePath(workspacePath: string, filePath: string): string {
    const relative = path.isAbsolute(filePath) ? path.relative(workspacePath, filePath) : filePath;
    const normalized = relative.replaceAll("\\", "/");
    if (!normalized || normalized === "." || normalized.startsWith("../") || path.isAbsolute(normalized)) {
      throw new Error("文件不在任务工作区内");
    }
    return normalized;
  }

  private assertWorkspace(workspacePath: string): void {
    if (!fs.existsSync(workspacePath) || !fs.statSync(workspacePath).isDirectory()) {
      throw new Error("任务工作区不存在或不是文件夹");
    }
  }

  private keepCommit(taskId: string, workspacePath: string, name: string, commit: string): void {
    this.git(taskId, workspacePath, ["update-ref", `refs/zero-one/${name}`, commit]);
  }

  private requireState(taskId: string): RollbackState {
    const state = this.load(taskId);
    if (!state) throw new Error("该任务尚未建立回退基线");
    return state;
  }

  private load(taskId: string): RollbackState | null {
    const cached = this.states.get(taskId);
    if (cached) return cached;
    try {
      const state = JSON.parse(fs.readFileSync(this.statePath(taskId), "utf8")) as RollbackState;
      if (state.version !== 2) return null;
      this.states.set(taskId, state);
      return state;
    } catch {
      return null;
    }
  }

  private save(state: RollbackState): void {
    this.states.set(state.taskId, state);
    fs.mkdirSync(this.taskDir(state.taskId), { recursive: true });
    fs.writeFileSync(this.statePath(state.taskId), JSON.stringify(state, null, 2), "utf8");
  }

  private taskKey(taskId: string): string {
    return crypto.createHash("sha256").update(taskId).digest("hex").slice(0, 20);
  }

  private taskDir(taskId: string): string {
    return path.join(this.baseDir, this.taskKey(taskId));
  }

  private statePath(taskId: string): string {
    return path.join(this.taskDir(taskId), "state.json");
  }

  private gitDir(taskId: string): string {
    return path.join(this.taskDir(taskId), "objects.git");
  }

  private git(taskId: string, workspacePath: string, args: string[], env = process.env): string {
    return execFileSync("git", [
      `--git-dir=${this.gitDir(taskId)}`,
      `--work-tree=${workspacePath}`,
      "-c", "core.bare=false",
      ...args,
    ], { cwd: workspacePath, env, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
  }
}
