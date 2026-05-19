import { Type } from "typebox";
import { defineTool } from "@earendil-works/pi-coding-agent";

/**
 * Pending question registry.
 * Maps (taskId:step) → a resolver that the WebSocket handler calls
 * when the user responds via the frontend.
 */
export const pendingQuestions = new Map<
  string,
  { question: string; resolve: (answer: string) => void; reject: (err: Error) => void }
>();

function makeKey(taskId: string, step: string): string {
  return `${taskId}:${step}`;
}

/** Resolve a pending question (called from WebSocket handler) */
export function resolveQuestion(
  taskId: string,
  step: string,
  answer: string,
): boolean {
  const key = makeKey(taskId, step);
  const entry = pendingQuestions.get(key);
  if (!entry) return false;
  entry.resolve(answer);
  pendingQuestions.delete(key);
  return true;
}

/** Reject a pending question (called on session abort/dispose) */
export function rejectQuestion(taskId: string, step: string, err: Error): boolean {
  const key = makeKey(taskId, step);
  const entry = pendingQuestions.get(key);
  if (!entry) return false;
  entry.reject(err);
  pendingQuestions.delete(key);
  return true;
}

/** Create the ask_user_question custom tool for a given (taskId, step) pair */
export function createAskUserQuestionTool(taskId: string, step: string) {
  return defineTool({
    name: "ask_user_question",
    label: "Ask User Question",
    description:
      "向用户提问并等待回答。当你需要澄清需求、确认方案或获取用户决策时使用此工具。会暂停执行直到用户回复。",
    parameters: Type.Object({
      question: Type.String({
        description: "向用户提出的问题，应清晰、具体，包含选项供用户选择",
      }),
    }),
    execute: async (_toolCallId, params) => {
      const key = makeKey(taskId, step);
      const question = params.question as string;

      // 如果已有 pending 问题，先 reject 旧的
      const existing = pendingQuestions.get(key);
      if (existing) {
        existing.reject(new Error("Superseded by a new question"));
      }

      const answer = await new Promise<string>((resolve, reject) => {
        pendingQuestions.set(key, { question, resolve, reject });

        // 超时保护：5分钟后自动取消
        setTimeout(() => {
          const entry = pendingQuestions.get(key);
          if (entry && entry.resolve === resolve) {
            pendingQuestions.delete(key);
            reject(new Error("ask_user_question timed out after 5 minutes"));
          }
        }, 5 * 60 * 1000);
      });

      return {
        content: [{ type: "text", text: answer }],
        details: {},
      };
    },
  });
}
