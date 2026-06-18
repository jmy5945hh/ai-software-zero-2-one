import type { WebSocket } from "ws";
import type { HandlerDeps } from "./utils";
import { mapSdkEvent, sendResponse } from "./utils";
import { buildSummarizationPrompt } from "../prompts";
import type { WsRequestMessage } from "../protocol";

/**
 * 总结相关消息处理
 */
export async function handleSummarizationMessage(
  ws: WebSocket,
  msg: WsRequestMessage,
  deps: HandlerDeps,
): Promise<void> {
  const { runner, summaryStore, workspace } = deps;

  switch (msg.method as string) {
    case "summarization.save": {
      const { taskId, step, summary } = msg.params as {
        taskId: string;
        step: string;
        summary: string;
      };
      summaryStore.set(taskId, step, summary);
      sendResponse(ws, msg.id, {});
      break;
    }

    case "summarization.trigger": {
      const { taskId, step } = msg.params as { taskId: string; step: string };
      const saved = summaryStore.get(taskId, step);
      if (!saved) {
        throw new Error(`No summary saved for ${taskId}:${step}`);
      }
      const workspaceDir = workspace.getRepoDir(taskId);
      const session = await runner.createSummarizationSession(workspaceDir);

      const unsub = session.subscribe((sdkEvent) => {
        const event = mapSdkEvent(sdkEvent);
        if (!event) return;
        ws.send(JSON.stringify({ type: "event", id: msg.id, event }));

        if (event.type === "agent_end") {
          unsub();
          session.dispose();
          summaryStore.delete(taskId, step);
        }
      });

      sendResponse(ws, msg.id, { sessionId: session.sessionId });

      const promptText = buildSummarizationPrompt(saved);
      console.log("[summarization.trigger] userPrompt=%.20s", promptText.slice(0, 20));
      await session.prompt(promptText);
      break;
    }

    default:
      throw new Error(`Unknown summarization method: ${msg.method}`);
  }
}
