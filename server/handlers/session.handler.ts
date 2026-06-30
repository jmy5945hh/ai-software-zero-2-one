import type { WebSocket } from "ws";
import type { HandlerDeps } from "./utils.js";
import {
  resolveWorkspaceDir,
  ensureSubscription,
  buildStepSnapshot,
  mapSdkEvent,
  sendResponse,
  sendWorkspaceInitializing,
} from "./utils.js";
import { rejectQuestion, pendingQuestions, resolveQuestion, continueQuestion } from "../customTools.js";
import type { WsRequestMessage, SessionSnapshot } from "../protocol.js";

/**
 * Session 相关消息处理
 */
export async function handleSessionMessage(
  ws: WebSocket,
  msg: WsRequestMessage,
  deps: HandlerDeps,
): Promise<void> {
  const { runner, pool, sessionStore, workspace, rollback } = deps;

  switch (msg.method as string) {
    case "session.create": {
      const { taskId, step } = msg.params as {
        taskId: string;
        step: string;
        intent?: string;
        workspacePath?: string;
        gitRepo?: { url: string; branch: string };
      };
      const intent = (msg.params as { intent?: string }).intent || "";
      const extPath = (msg.params as { workspacePath?: string }).workspacePath;
      const gitRepo = (msg.params as { gitRepo?: { url: string; branch: string } }).gitRepo;
      const { workspaceDir, needsWait } = resolveWorkspaceDir(workspace, taskId, {
        gitRepo,
        workspacePath: extPath,
        intent,
      });

      if (needsWait) {
        sendWorkspaceInitializing(ws, msg.id, workspace, taskId);
        break;
      }

      const session = await runner.createSession(taskId, step, workspaceDir);
      pool.set(taskId, step, session);
      try { rollback.ensureBaseline(taskId, workspaceDir); } catch { /* 快照不可用不阻断任务 */ }

      const unsub = session.subscribe((sdkEvent) => {
        const event = mapSdkEvent(sdkEvent);
        if (!event) return;
        if (event.type === "turn_start") {
          try { rollback.createCheckpoint(taskId, workspaceDir, step); } catch { /* 回退不可用不阻断 Agent */ }
        }
        ws.send(JSON.stringify({ type: "event", id: msg.id, event }));

        if (event.type === "turn_end" || event.type === "agent_end") {
          const snapshot = buildStepSnapshot(session);
          sessionStore.saveStep(session.sessionId, step, snapshot);

          // 发送 token 用量事件到前端
          if (snapshot.totalTokenUsage) {
            ws.send(JSON.stringify({
              type: "event",
              id: msg.id,
              event: {
                type: "token_usage",
                usage: {
                  input: snapshot.totalTokenUsage.input,
                  output: snapshot.totalTokenUsage.output,
                  cacheRead: snapshot.totalTokenUsage.cacheRead,
                  cacheWrite: snapshot.totalTokenUsage.cacheWrite,
                  total: snapshot.totalTokenUsage.total,
                  cost: snapshot.totalTokenUsage.cost,
                  contextWindow: snapshot.totalTokenUsage.contextWindow,
                  contextPercent: snapshot.totalTokenUsage.contextPercent,
                },
              },
            }));
          }
        }
      });
      pool.setUnsub(taskId, step, unsub);

      sendResponse(ws, msg.id, { sessionId: session.sessionId, workspaceDir });
      break;
    }

    case "session.steer": {
      const { taskId, step, text } = msg.params as {
        taskId: string;
        step: string;
        text: string;
      };
      console.log("[session.steer] userPrompt=%.20s step=%s", text.slice(0, 20), step);
      let session = pool.get(taskId, step);
      if (!session) {
        console.warn("[session.steer] session not in pool, creating new session for step=%s — prior context may be lost", step);
        const intent = (msg.params as { intent?: string }).intent || "";
        const extPath = (msg.params as { workspacePath?: string }).workspacePath;
        const gitRepo = (msg.params as { gitRepo?: { url: string; branch: string } }).gitRepo;
        const { workspaceDir, needsWait } = resolveWorkspaceDir(workspace, taskId, {
          gitRepo,
          workspacePath: extPath,
          intent,
        });
        if (needsWait) {
          sendWorkspaceInitializing(ws, msg.id, workspace, taskId);
          break;
        }
        session = await runner.createSession(taskId, step, workspaceDir);
        pool.set(taskId, step, session);
      }

      ensureSubscription(pool, taskId, step, ws, msg.id, sessionStore, rollback, workspace);

      console.log(`[session.steer] isStreaming=${session.isStreaming} step=${step} text=%.20s`, text.slice(0, 20));
      if (session.isStreaming) {
        session.steer(text);
      } else {
        await session.prompt(text);
      }

      sendResponse(ws, msg.id, {});
      break;
    }

    case "session.abort": {
      const { taskId, step } = msg.params as { taskId: string; step: string };
      const session = pool.get(taskId, step);
      if (!session) throw new Error(`Session not found: ${taskId}:${step}`);
      session.abort();
      sendResponse(ws, msg.id, {});
      break;
    }

    case "session.dispose": {
      const { taskId, step } = msg.params as { taskId: string; step: string };
      pool.dispose(taskId, step);
      sendResponse(ws, msg.id, {});
      break;
    }

    case "session.reconnect": {
      const { sessionId } = msg.params as { sessionId: string };
      console.log("[session.reconnect] sessionId=%s", sessionId);

      const found = pool.findBySessionId(sessionId);
      if (!found) {
        console.log("[session.reconnect] session not found: %s", sessionId);
        sendResponse(ws, msg.id, { found: false });
        break;
      }

      const { taskId, step, session } = found;
      ensureSubscription(pool, taskId, step, ws, msg.id, sessionStore, rollback, workspace);

      const messages = (session as any).agent?.state?.messages || [];
      const mappedMessages = messages
        .filter((m: any) => m.role === "user" || m.role === "assistant")
        .map((m: any) => ({
          role: m.role as "user" | "assistant",
          content: typeof m.content === "string" ? m.content : "",
        }));

      const pqKey = `${taskId}:${step}`;
      const pq = pendingQuestions.get(pqKey);
      const hasPendingQuestion = !!pq && pq.storedAnswer === null;

      const turns: SessionSnapshot["turns"] = [];
      let turnIndex = 0;
      for (const msg of messages) {
        if (msg.role === "assistant") {
          const content = typeof msg.content === "string" ? msg.content : "";
          turns.push({
            id: `turn-${turnIndex}`,
            index: turnIndex++,
            status: "done",
            textContent: content,
            thinking: "",
            toolCalls: [],
          });
        }
      }

      const snapshot: SessionSnapshot = {
        sessionId,
        taskId,
        step,
        isStreaming: session.isStreaming,
        completed: !session.isStreaming,
        messages: mappedMessages,
        turns,
        hasPendingQuestion,
        pendingQuestion: hasPendingQuestion && pq
          ? { question: pq.question, options: pq.options }
          : undefined,
      };

      console.log("[session.reconnect] found, isStreaming=%s, messages=%d, hasPendingQuestion=%s",
        snapshot.isStreaming, snapshot.messages.length, snapshot.hasPendingQuestion);

      sendResponse(ws, msg.id, { found: true });
      ws.send(JSON.stringify({ type: "event", id: msg.id, event: { type: "session_snapshot", session: snapshot } }));
      break;
    }

    case "session.restore": {
      const { taskId, step, messages } = msg.params as {
        taskId: string;
        step: string;
        messages?: Array<{ role: "user" | "assistant"; content: string }>;
        intent?: string;
        workspacePath?: string;
      };
      console.log("[session.restore] step=%s messages=%d", step, messages?.length || 0);

      const intent = (msg.params as { intent?: string }).intent || "";
      const extPath = (msg.params as { workspacePath?: string }).workspacePath;
      const gitRepo = (msg.params as { gitRepo?: { url: string; branch: string } }).gitRepo;
      const { workspaceDir, needsWait } = resolveWorkspaceDir(workspace, taskId, {
        gitRepo,
        workspacePath: extPath,
        intent,
      });

      if (needsWait) {
        sendWorkspaceInitializing(ws, msg.id, workspace, taskId);
        break;
      }

      pool.dispose(taskId, step);

      const session = await runner.createSession(taskId, step, workspaceDir);
      pool.set(taskId, step, session);
      try { rollback.ensureBaseline(taskId, workspaceDir); } catch { /* 快照不可用不阻断任务 */ }

      const unsub = session.subscribe((sdkEvent) => {
        const event = mapSdkEvent(sdkEvent);
        if (!event) return;
        ws.send(JSON.stringify({ type: "event", id: msg.id, event }));

        if (event.type === "turn_end" || event.type === "agent_end") {
          const snapshot = buildStepSnapshot(session);
          sessionStore.saveStep(session.sessionId, step, snapshot);

          // 发送 token 用量事件到前端
          if (snapshot.totalTokenUsage) {
            ws.send(JSON.stringify({
              type: "event",
              id: msg.id,
              event: {
                type: "token_usage",
                usage: {
                  input: snapshot.totalTokenUsage.input,
                  output: snapshot.totalTokenUsage.output,
                  cacheRead: snapshot.totalTokenUsage.cacheRead,
                  cacheWrite: snapshot.totalTokenUsage.cacheWrite,
                  total: snapshot.totalTokenUsage.total,
                  cost: snapshot.totalTokenUsage.cost,
                  contextWindow: snapshot.totalTokenUsage.contextWindow,
                  contextPercent: snapshot.totalTokenUsage.contextPercent,
                },
              },
            }));
          }
        }
      });
      pool.setUnsub(taskId, step, unsub);

      if (messages) {
        for (const m of messages) {
          if (m.role === "user") {
            session.steer(m.content);
          }
        }
      }

      sendResponse(ws, msg.id, { sessionId: session.sessionId });
      break;
    }

    case "session.answerQuestion": {
      const { taskId, step, answer } = msg.params as {
        taskId: string;
        step: string;
        answer: string;
      };
      const resolved = resolveQuestion(taskId, step, answer);
      if (!resolved) {
        throw new Error(`No pending question for ${taskId}:${step}`);
      }
      sendResponse(ws, msg.id, {});
      break;
    }

    case "session.continueQuestion": {
      const { taskId, step } = msg.params as { taskId: string; step: string };
      const continued = continueQuestion(taskId, step);
      if (!continued) {
        throw new Error(`No answered question to continue for ${taskId}:${step}`);
      }
      sendResponse(ws, msg.id, {});
      break;
    }

    case "session.resumeQuestion": {
      const { taskId, step, answer, intent, workspacePath } = msg.params as {
        taskId: string;
        step: string;
        answer: string;
        intent?: string;
        workspacePath?: string;
      };

      rejectQuestion(taskId, step, new Error("Session resumed, old question superseded"));

      const gitRepo = (msg.params as { gitRepo?: { url: string; branch: string } }).gitRepo;
      const { workspaceDir, needsWait } = resolveWorkspaceDir(workspace, taskId, {
        gitRepo,
        workspacePath,
        intent,
      });

      if (needsWait) {
        sendWorkspaceInitializing(ws, msg.id, workspace, taskId);
        break;
      }

      const session = await runner.createSession(taskId, step, workspaceDir);
      pool.set(taskId, step, session);
      try { rollback.ensureBaseline(taskId, workspaceDir); } catch { /* 快照不可用不阻断任务 */ }

      const unsub = session.subscribe((sdkEvent) => {
        const event = mapSdkEvent(sdkEvent);
        if (!event) return;
        if (event.type === "turn_start") {
          try { rollback.createCheckpoint(taskId, workspaceDir, step); } catch { /* 回退不可用不阻断 Agent */ }
        }
        ws.send(JSON.stringify({ type: "event", id: msg.id, event }));

        if (event.type === "turn_end" || event.type === "agent_end") {
          const snapshot = buildStepSnapshot(session);
          sessionStore.saveStep(session.sessionId, step, snapshot);

          // 发送 token 用量事件到前端
          if (snapshot.totalTokenUsage) {
            ws.send(JSON.stringify({
              type: "event",
              id: msg.id,
              event: {
                type: "token_usage",
                usage: {
                  input: snapshot.totalTokenUsage.input,
                  output: snapshot.totalTokenUsage.output,
                  cacheRead: snapshot.totalTokenUsage.cacheRead,
                  cacheWrite: snapshot.totalTokenUsage.cacheWrite,
                  total: snapshot.totalTokenUsage.total,
                  cost: snapshot.totalTokenUsage.cost,
                  contextWindow: snapshot.totalTokenUsage.contextWindow,
                  contextPercent: snapshot.totalTokenUsage.contextPercent,
                },
              },
            }));
          }
        }
      });
      pool.setUnsub(taskId, step, unsub);

      sendResponse(ws, msg.id, { sessionId: session.sessionId });

      const resumePrompt = `用户已回答了你的问题。回答是：${answer}\n\n请基于此回答继续执行任务。`;
      await session.prompt(resumePrompt);
      break;
    }

    case "session.saveStep": {
      const { sessionId, stepId, snapshot } = msg.params as {
        sessionId: string;
        stepId: string;
        snapshot: import("../SessionStore.js").StepSessionSnapshot;
      };
      sessionStore.saveStep(sessionId, stepId, snapshot);
      sendResponse(ws, msg.id, {});
      break;
    }

    case "session.saveRecord": {
      const record = msg.params as Record<string, unknown>;
      sessionStore.save(record as import("../SessionStore.js").SessionRecord);
      sendResponse(ws, msg.id, {});
      break;
    }

    case "session.loadRecord": {
      const { sessionId } = msg.params as { sessionId: string };
      const record = sessionStore.load(sessionId);
      sendResponse(ws, msg.id, { record });
      break;
    }

    case "session.listRecords": {
      const records = sessionStore.list();
      sendResponse(ws, msg.id, { records });
      break;
    }

    case "session.deleteRecord": {
      const { sessionId } = msg.params as { sessionId: string };
      sessionStore.delete(sessionId);
      sendResponse(ws, msg.id, {});
      break;
    }

    default:
      throw new Error(`Unknown session method: ${msg.method}`);
  }
}
