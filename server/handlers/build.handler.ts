import type { WebSocket } from "ws";
import type { HandlerDeps } from "./utils";
import {
  resolveWorkspaceDir,
  buildStepSnapshot,
  mapSdkEvent,
  sendResponse,
  sendWorkspaceInitializing,
} from "./utils";
import { buildBuildPrompt, buildDetectCommandPrompt } from "../prompts";
import type { WsRequestMessage } from "../protocol";

/**
 * 编译相关消息处理
 */
export async function handleBuildMessage(
  ws: WebSocket,
  msg: WsRequestMessage,
  deps: HandlerDeps,
): Promise<void> {
  const { runner, workspace, sessionStore } = deps;

  switch (msg.method as string) {
    case "build.detectCommand": {
      const { workspacePath, taskId } = msg.params as { workspacePath?: string; taskId?: string };
      if (!taskId && !workspacePath) throw new Error("Missing workspacePath or taskId");
      const workspaceDir = taskId
        ? workspace.getRepoDir(taskId)
        : workspacePath as string;
      const session = await runner.createBuildCommandSession(workspaceDir);

      let fullOutput = "";

      const unsub = session.subscribe((sdkEvent) => {
        const event = mapSdkEvent(sdkEvent);
        if (!event) return;

        if (event.type === "text_delta") {
          fullOutput += event.delta;
        }

        if (event.type === "agent_end") {
          unsub();
          session.dispose();

          const lines = fullOutput
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l && !l.startsWith("```") && !l.startsWith("`"));
          const rawCommand =
            lines.find(
              (l) =>
                !/[\u4e00-\u9fff]/.test(l) && !l.includes("：") && !l.includes(":"),
            ) || lines[0] || "npm run build";
          const command = rawCommand.replace(/^`|`$/g, "").trim();
          console.log("[build.detectCommand] fullOutput:", fullOutput);
          console.log("[build.detectCommand] detected command:", command);
          sendResponse(ws, msg.id, { command });
        }
      });

      const detectPrompt = buildDetectCommandPrompt();
      console.log("[build.detectCommand] sending prompt");
      await session.prompt(detectPrompt);
      break;
    }

    case "build.trigger": {
      const { taskId, buildResult } = msg.params as {
        taskId: string;
        buildResult: {
          command: string;
          success: boolean;
          output: string;
          timestamp: string;
        };
      };
      const workspaceDir = workspace.getRepoDir(taskId);
      const session = await runner.createBuildSession(workspaceDir);

      const unsub = session.subscribe((sdkEvent) => {
        const event = mapSdkEvent(sdkEvent);
        if (!event) return;
        ws.send(JSON.stringify({ type: "event", id: msg.id, event }));

        if (event.type === "agent_end") {
          unsub();
          session.dispose();
        }
      });

      sendResponse(ws, msg.id, { sessionId: session.sessionId });

      const promptText = buildBuildPrompt(buildResult);
      console.log("[build.trigger] userPrompt=%.20s", promptText.slice(0, 20));
      await session.prompt(promptText);
      break;
    }

    case "build.save": {
      const { sessionId, stepId, buildResult } = msg.params as {
        sessionId: string;
        stepId: string;
        buildResult: import("../SessionStore").StepSessionSnapshot["buildResult"];
      };
      const existing = sessionStore.loadStep(sessionId, stepId) || {
        messages: [],
        turns: [],
        summary: "",
      };
      existing.buildResult = buildResult;
      sessionStore.saveStep(sessionId, stepId, existing);
      sendResponse(ws, msg.id, {});
      break;
    }

    case "build.fix": {
      const { taskId, step, buildOutput, workspacePath } = msg.params as {
        taskId: string;
        step: string;
        buildOutput: string;
        workspacePath?: string;
      };
      const gitRepo = (msg.params as { gitRepo?: { url: string; branch: string } }).gitRepo;
      const intent = (msg.params as { intent?: string }).intent || "";
      const { workspaceDir, needsWait } = resolveWorkspaceDir(workspace, taskId, {
        gitRepo,
        workspacePath,
        intent,
      });

      if (needsWait) {
        sendWorkspaceInitializing(ws, msg.id, workspace, taskId);
        break;
      }

      const configuredModelId = sessionStore.loadMeta(taskId)?.deliveryConfig?.modelId;
      const fixSession = await runner.createSession(
        taskId,
        step,
        workspaceDir,
        undefined,
        configuredModelId && configuredModelId !== "auto" ? configuredModelId : undefined,
      );

      const unsub = fixSession.subscribe((sdkEvent) => {
        const event = mapSdkEvent(sdkEvent);
        if (!event) return;
        ws.send(JSON.stringify({ type: "event", id: msg.id, event }));

        if (event.type === "turn_end" || event.type === "agent_end") {
          const snapshot = buildStepSnapshot(fixSession);
          sessionStore.saveStep(fixSession.sessionId, step, snapshot);
        }
        if (event.type === "agent_end") {
          unsub();
          fixSession.dispose();
        }
      });

      sendResponse(ws, msg.id, { sessionId: fixSession.sessionId });

      const fixPrompt = `项目编译失败，请修复以下编译错误：\n\n\`\`\`\n${buildOutput.slice(0, 5000)}\n\`\`\`\n\n请分析错误原因并修复代码。修复完成后，项目应该能成功编译。`;
      await fixSession.prompt(fixPrompt);
      break;
    }

    default:
      throw new Error(`Unknown build method: ${msg.method}`);
  }
}
