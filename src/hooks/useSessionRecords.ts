import { useState, useEffect, useCallback, useRef } from "react";
import type { AppState } from "../data/types";
import { AgentWebSocket } from "../agent/ws";

// ── 会话记录类型（与服务端 SessionRecord 对齐） ──

/** 单个步骤的会话快照 */
export type StepSessionSnapshot = {
  /** 用户与 Agent 的消息历史 */
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  /** Agent 执行轮次 */
  turns: Array<{
    id: string;
    index: number;
    status: "running" | "done";
    textContent: string;
    thinking: string;
    /** 触发该轮的 user 输入 */
    userInput?: string;
    /** 消息角色：user 表示用户输入，assistant 表示 agent 回复 */
    role?: "user" | "assistant";
    toolCalls: Array<{
      id: string;
      name: string;
      status: "running" | "done" | "error";
      category: string;
      input: string;
      result?: string;
      outputFragments: string[];
    }>;
  }>;
  /** Agent 原始总结文本 */
  summary: string;
  /** 结构化总结结果 */
  summarizationResult?: import("../data/types").AgentSummary | null;
};

export type SessionRecord = {
  taskId: string;
  intent: string;
  workspacePath: string;
  stepIndex: number;
  activeStage: string;
  scope: string;
  selectedModules: string[];
  notes: string;
  todoAnswers: Record<number, string | string[]>;
  initialPrompts: Record<string, string>;
  codeConfirmed: boolean;
  fixApproved: boolean;
  releaseApproved: boolean;
  qualityPassed: boolean;
  createdAt: string;
  updatedAt: string;
  status: "active" | "completed";
  /** 各步骤的 Agent 总结摘要（stepId → brief） */
  stepSummaries: Record<string, string>;
  /** 各步骤的完整会话快照（stepId → 会话数据） */
  stepSessions: Record<string, StepSessionSnapshot>;
};

/**
 * useSessionRecords — 管理会话历史记录。
 *
 * 通过 WebSocket 与服务端 SessionStore 通信，
 * 支持保存、加载、列出、删除会话记录。
 */
export function useSessionRecords() {
  const [records, setRecords] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const wsRef = useRef<AgentWebSocket | null>(null);
  const connectedRef = useRef(false);

  // ── 建立 WebSocket 连接 ──
  useEffect(() => {
    const wsUrl =
      import.meta.env.VITE_AGENT_WS_URL ||
      (import.meta.env.DEV
        ? `ws://${window.location.hostname}:3100/agent`
        : `ws://${window.location.host}/agent`);

    const ws = new AgentWebSocket(wsUrl);
    wsRef.current = ws;

    ws.onOpen(() => {
      connectedRef.current = true;
      // 连接后自动加载记录列表
      refreshRecords();
    });

    ws.onClose(() => {
      connectedRef.current = false;
    });

    return () => {
      ws.close();
      wsRef.current = null;
      connectedRef.current = false;
    };
  }, []);

  /** 刷新会话记录列表 */
  const refreshRecords = useCallback(async () => {
    if (!wsRef.current || !connectedRef.current) return;
    setLoading(true);
    try {
      const result = (await wsRef.current.request("session.listRecords", {})) as {
        records: SessionRecord[];
      };
      setRecords(result.records || []);
    } catch {
      // 静默失败
    } finally {
      setLoading(false);
    }
  }, []);

  /** 保存队列，避免并发保存导致数据覆盖 */
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  /** 保存当前 AppState 为会话记录 */
  const saveRecord = useCallback(
    async (
      state: AppState,
      taskId: string,
      stepSummaries?: Record<string, string>,
      agentSessions?: Record<string, {
        messages: Array<{ role: "user" | "assistant"; content: string }>;
        turns: Array<{
          id: string;
          index: number;
          status: "running" | "done";
          textContent: string;
          thinking: string;
          toolCalls: Array<{
            id: string;
            name: string;
            status: "running" | "done" | "error";
            category: string;
            input: string;
            result?: string;
          }>;
        }>;
        summary: string;
        summarizationResult?: import("../data/types").AgentSummary | null;
      }>,
      restoredSessions?: Record<string, StepSessionSnapshot>,
    ) => {
      if (!wsRef.current || !connectedRef.current) {
        console.log("[saveRecord] skip: ws or not connected");
        return;
      }

      console.log("[saveRecord] agentSessions keys:", Object.keys(agentSessions || {}), "restoredSessions keys:", Object.keys(restoredSessions || {}));

      // 构建 stepSessions 快照：以 agentSessions 为主（包含完整的最新数据），
      // 仅补充 restoredSessions 中 agentSessions 未覆盖的 step
      const stepSessions: Record<string, StepSessionSnapshot> = {
        ...(restoredSessions || {}),
      };
      if (agentSessions) {
        for (const [stepId, session] of Object.entries(agentSessions)) {
          console.log("[saveRecord] step:", stepId, "messages:", session.messages?.length, "turns:", session.turns?.length);
          // agentSessions 已包含该 step 的最新数据，但 turns 可能只有新轮次（继续执行后）。
          // 合并 restoredSessions 中的历史 turns 和 messages
          const restoredStep = restoredSessions?.[stepId];
          const mergedTurns = [
            ...(restoredStep?.turns || []),
            ...(session.turns || []),
          ];
          // 去重（按 id）
          const seenTurnIds = new Set<string>();
          const uniqueTurns = mergedTurns.filter((t) => {
            if (seenTurnIds.has(t.id)) return false;
            seenTurnIds.add(t.id);
            return true;
          });
          // messages 也合并去重
          const mergedMessages = [
            ...(restoredStep?.messages || []),
            ...(session.messages || []),
          ];
          const seenMsgKeys = new Set<string>();
          const uniqueMessages = mergedMessages.filter((m) => {
            const key = `${m.role}:${m.content}`;
            if (seenMsgKeys.has(key)) return false;
            seenMsgKeys.add(key);
            return true;
          });
          stepSessions[stepId] = {
            messages: uniqueMessages,
            turns: uniqueTurns.map((t) => ({
              id: t.id,
              index: t.index,
              status: t.status,
              textContent: t.textContent,
              thinking: t.thinking,
              userInput: (t as any).userInput,
              role: (t as any).role,
              toolCalls: (t.toolCalls || []).map((tc) => ({
                id: tc.id,
                name: tc.name,
                status: tc.status,
                category: tc.category,
                input: tc.input,
                result: tc.result,
                outputFragments: tc.outputFragments || [],
              })),
            })),
            summary: session.summary || "",
            summarizationResult: session.summarizationResult || null,
          };
        }
      }

      const record: SessionRecord = {
        taskId,
        intent: state.intent,
        workspacePath: state.workspacePath,
        stepIndex: state.stepIndex,
        activeStage: state.activeStage,
        scope: state.scope,
        selectedModules: state.selectedModules,
        notes: state.notes,
        todoAnswers: state.todoAnswers,
        initialPrompts: state.initialPrompts,
        codeConfirmed: state.codeConfirmed,
        fixApproved: state.fixApproved,
        releaseApproved: state.releaseApproved,
        qualityPassed: state.qualityPassed,
        createdAt: state.createdAt,
        updatedAt: new Date().toISOString(),
        status: "active",
        stepSummaries: stepSummaries || {},
        stepSessions,
      };
      console.log("[saveRecord] final stepSessions keys:", Object.keys(stepSessions), "data:", Object.fromEntries(Object.entries(stepSessions).map(([k, v]) => [k, { messages: v.messages?.length, turns: v.turns?.length, firstMsg: v.messages?.[0]?.role, lastMsg: v.messages?.[v.messages?.length-1]?.role }])));
      // 串行化保存，避免并发覆盖
      saveQueueRef.current = saveQueueRef.current.then(async () => {
        try {
          await wsRef.current!.request("session.saveRecord", record as unknown as Record<string, unknown>);
          await refreshRecords();
        } catch {
          // 静默失败
        }
      });
      await saveQueueRef.current;
    },
    [refreshRecords],
  );

  /** 按 taskId 加载会话记录 */
  const loadRecord = useCallback(
    async (taskId: string): Promise<SessionRecord | null> => {
      if (!wsRef.current || !connectedRef.current) return null;
      try {
        const result = (await wsRef.current.request("session.loadRecord", {
          taskId,
        })) as { record: SessionRecord | null };
        return result.record;
      } catch {
        return null;
      }
    },
    [],
  );

  /** 删除会话记录 */
  const deleteRecord = useCallback(
    async (taskId: string) => {
      if (!wsRef.current || !connectedRef.current) return;
      try {
        await wsRef.current.request("session.deleteRecord", { taskId });
        await refreshRecords();
      } catch {
        // 静默失败
      }
    },
    [refreshRecords],
  );

  return {
    records,
    loading,
    refreshRecords,
    saveRecord,
    loadRecord,
    deleteRecord,
  } as const;
}
