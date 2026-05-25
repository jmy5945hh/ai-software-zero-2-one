import { Type } from "typebox";
import { defineTool } from "@earendil-works/pi-coding-agent";

/**
 * Pending question registry.
 *
 * Two-phase flow:
 *   1. User answers → answer is stored (agent stays blocked)
 *   2. User clicks "continue" → Promise resolves (agent resumes)
 *
 * Maps (taskId:step) → { question, storedAnswer, resolve, reject }
 */
export const pendingQuestions = new Map<
  string,
  {
    question: string;
    storedAnswer: string | null;
    resolve: (answer: string) => void;
    reject: (err: Error) => void;
  }
>();

function makeKey(taskId: string, step: string): string {
  return `${taskId}:${step}`;
}

/**
 * Phase 1: Store the user's answer but do NOT unblock the agent.
 * Returns false if no pending question exists for this (taskId, step).
 */
export function resolveQuestion(
  taskId: string,
  step: string,
  answer: string,
): boolean {
  const key = makeKey(taskId, step);
  const entry = pendingQuestions.get(key);
  if (!entry) return false;
  entry.storedAnswer = answer;
  return true;
}

/**
 * Phase 2: Unblock the agent with the previously stored answer.
 * Returns false if no answered question is waiting to continue.
 */
export function continueQuestion(taskId: string, step: string): boolean {
  const key = makeKey(taskId, step);
  const entry = pendingQuestions.get(key);
  if (!entry || entry.storedAnswer === null) return false;
  entry.resolve(entry.storedAnswer);
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
        pendingQuestions.set(key, { question, storedAnswer: null, resolve, reject });

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
