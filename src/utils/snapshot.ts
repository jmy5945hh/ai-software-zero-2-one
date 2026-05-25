/**
 * 文件系统快照工具。
 * 在每个 step 开始时保存工作目录快照（纯 rsync 复制），重试时从快照恢复代码状态。
 * 不依赖 git commit，避免在用户 git 历史中留下痕迹。
 *
 * 通过 WebSocket 请求代理到 server 执行 rsync 命令。
 */

import type { AgentWebSocket } from "../agent/ws";

/**
 * 保存当前工作目录的快照。
 * 用 rsync 将 workspace 内容复制到快照目录。
 * 返回快照路径，失败返回 null。
 */
export async function snapshotSave(
  ws: AgentWebSocket,
  taskId: string,
  label: string,
): Promise<string | null> {
  try {
    const result = (await ws.request("fs.snapshotSave", {
      taskId,
      label,
    })) as { path: string | null };
    return result.path ?? null;
  } catch {
    return null;
  }
}

/**
 * 从指定快照路径恢复代码状态。
 * 用 rsync 将快照内容同步回 workspace 目录。
 */
export async function snapshotRestore(
  ws: AgentWebSocket,
  taskId: string,
  snapshotPath: string,
): Promise<boolean> {
  try {
    await ws.request("fs.snapshotRestore", { taskId, snapshotPath });
    return true;
  } catch {
    return false;
  }
}
