import type { WebSocket } from "ws";
import type { HandlerDeps } from "./utils.js";
import { sendResponse } from "./utils.js";
import type { WsRequestMessage } from "../protocol.js";

/**
 * Workspace 相关消息处理
 */
export async function handleWorkspaceMessage(
  ws: WebSocket,
  msg: WsRequestMessage,
  deps: HandlerDeps,
): Promise<void> {
  const { workspace } = deps;

  switch (msg.method as string) {
    case "workspace.initStatus": {
      const { taskId } = msg.params as { taskId: string };
      sendResponse(ws, msg.id, { initStatus: workspace.getInitStatus(taskId) });
      break;
    }

    case "workspace.retryClone": {
      const { taskId } = msg.params as { taskId: string };
      const gitRepo = (msg.params as { gitRepo?: { url: string; branch: string } }).gitRepo;
      if (!gitRepo?.url) {
        throw new Error("retryClone 需要 gitRepo 参数");
      }
      const repoDir = workspace.retryCloudWorkspace(taskId, gitRepo);
      const initStatus = workspace.getInitStatus(taskId);
      sendResponse(ws, msg.id, { repoDir, initStatus });
      break;
    }

    default:
      throw new Error(`Unknown workspace method: ${msg.method}`);
  }
}
