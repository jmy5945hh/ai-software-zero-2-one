/**
 * Git Worktree 快照工具。
 * 在每个 step 开始时保存工作树快照（git worktree），重试时从 worktree 恢复代码状态。
 *
 * 通过 WebSocket 请求代理到 server 执行 git 命令。
 */

import type { AgentWebSocket } from "../agent/ws";

/**
 * 在 workspacePath 中创建 git worktree 快照。
 * 1. git add -A && git commit（如有变更）
 * 2. git worktree add --detach <path> HEAD
 * 返回 worktree 路径，失败返回 null。
 */
export async function worktreeSave(
  ws: AgentWebSocket,
  taskId: string,
  label: string,
): Promise<string | null> {
  try {
    const result = (await ws.request("git.worktreeSave", {
      taskId,
      label,
    })) as { path: string | null };
    return result.path ?? null;
  } catch {
    return null;
  }
}

/**
 * 从指定 worktree 路径恢复代码状态。
 * 用 rsync 将 worktree 内容同步回 workspace 目录。
 */
export async function worktreeRestore(
  ws: AgentWebSocket,
  taskId: string,
  worktreePath: string,
): Promise<boolean> {
  try {
    await ws.request("git.worktreeRestore", { taskId, worktreePath });
    return true;
  } catch {
    return false;
  }
}
