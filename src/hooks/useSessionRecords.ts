import { useState, useEffect, useCallback, useRef } from "react";
import type { AppState } from "../data/types";
import { AgentWebSocket } from "../agent/ws";
import { buildAgentWsUrl } from "../agent/config";
import type { RuntimeMode } from "../types/runtime";

// ── 会话记录类型（与服务端 SessionStore 对齐） ──

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
      outputFragments?: string[];
    }>;
  }>;
  /** Agent 原始总结文本 */
  summary: string;
  /** 结构化总结结果 */
  summarizationResult?: import("../data/types").AgentSummary | null;
  /** 模型检测到的项目编译命令（仅 coding 步骤有值） */
  buildCommand?: string | null;
  /** 项目编译结果（仅 coding 步骤有值） */
  buildResult?: import("../data/types").BuildResult | null;
  // ── 执行状态（用于恢复时判断进度） ──
  /** Agent 是否执行完成 */
  completed?: boolean;
  /** 结构化总结状态 */
  summarizationStatus?: "idle" | "pending" | "loading" | "done" | "error";
  /** 项目编译状态 */
  buildStatus?: "idle" | "pending" | "detecting" | "loading" | "done" | "error";
};

/** 任务元信息（不含对话数据，与服务端 SessionMeta 对齐） */
export type SessionMeta = {
  sessionId: string;
  taskId: string;
  intent: string;
  workspacePath: string;
  /** 运行时模式：local 或 cloud */
  runtimeMode: "local" | "cloud";
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
};

/** 完整的会话记录（元信息 + 各步骤对话数据） */
export type SessionRecord = SessionMeta & {
  /** 各步骤的完整会话快照（stepId → 会话数据） */
  stepSessions: Record<string, StepSessionSnapshot>;
};

/**
 * useSessionRecords — 管理会话历史记录。
 *
 * 通过 WebSocket 与服务端 SessionStore 通信，
 * 支持保存、加载、列出、删除会话记录。
 *
 * 存储策略：
 * - 每个会话一个目录，目录名 = 32 位 sessionId
 * - meta.json 存储任务元信息
 * - step-{workflowId}.json 存储各步骤的独立会话快照
 */
export function useSessionRecords() {
  const [records, setRecords] = useState<SessionMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const wsRef = useRef<AgentWebSocket | null>(null);
  const connectedRef = useRef(false);

  // ── 建立 WebSocket 连接 ──
  useEffect(() => {
    const runtimeMode = (localStorage.getItem("zero-one-runtime-mode") as RuntimeMode) || "local";
    const wsUrl = buildAgentWsUrl(runtimeMode);
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
    if (!wsRef.current || !connectedRef.current) {
      console.warn("[useSessionRecords] refreshRecords skip: ws not connected");
      return;
    }
    setLoading(true);
    try {
      const result = (await wsRef.current.request("session.listRecords", {})) as {
        records: SessionMeta[];
      };
      setRecords(result.records || []);
    } catch (err) {
      console.error("[useSessionRecords] refreshRecords failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  /** 保存队列，避免并发保存导致数据覆盖 */
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  /**
   * 保存某步骤的会话快照（独立存储）。
   * 每次 agent 轮次完成时调用，确保每轮数据不遗漏。
   */
  const saveStep = useCallback(
    async (sessionId: string, stepId: string, snapshot: StepSessionSnapshot) => {
      if (!wsRef.current || !connectedRef.current) return;
      saveQueueRef.current = saveQueueRef.current.then(async () => {
        try {
          await wsRef.current!.request("session.saveStep", {
            sessionId,
            stepId,
            snapshot,
          });
        } catch (err) {
          console.error("[useSessionRecords] saveStep failed:", sessionId, stepId, err);
        }
      });
      await saveQueueRef.current;
    },
    [],
  );

  /**
   * 保存任务元信息。
   * 关键状态变化时调用（防抖 2s，作为兜底）。
   */
  const saveMeta = useCallback(
    async (sessionId: string, meta: SessionMeta) => {
      if (!wsRef.current || !connectedRef.current) return;
      saveQueueRef.current = saveQueueRef.current.then(async () => {
        try {
          await wsRef.current!.request("session.saveMeta", meta as unknown as Record<string, unknown>);
          await refreshRecords();
        } catch (err) {
          console.error("[useSessionRecords] saveMeta failed:", sessionId, err);
        }
      });
      await saveQueueRef.current;
    },
    [refreshRecords],
  );

  /** 保存当前 AppState 为会话记录（兼容旧接口，内部拆分为 meta + step 文件） */
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
        buildCommand?: string | null;
        buildResult?: import("../data/types").BuildResult | null;
        completed?: boolean;
        summarizationStatus?: string;
        buildStatus?: string;
      }>,
      restoredSessions?: Record<string, StepSessionSnapshot>,
    ) => {
      if (!wsRef.current || !connectedRef.current) {
        console.warn("[saveRecord] skip: ws not connected (wsRef=", !!wsRef.current, "connected=", connectedRef.current, ")");
        return;
      }

      const sessionId = state.sessionId;
      if (!sessionId) {
        console.log("[saveRecord] skip: no sessionId");
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
                outputFragments: (tc as any).outputFragments || [],
              })),
            })),
            summary: session.summary || "",
            summarizationResult: session.summarizationResult || null,
            // 保留模型检测到的编译命令
            buildCommand: session.buildCommand ?? restoredStep?.buildCommand ?? null,
            // 保留编译结果（优先 agent session 最新值，fallback 到 restored）
            buildResult: session.buildResult ?? restoredStep?.buildResult ?? null,
            // 保留执行状态
            completed: session.completed ?? (restoredStep as any)?.completed ?? undefined,
            summarizationStatus: session.summarizationStatus ?? (restoredStep as any)?.summarizationStatus ?? undefined,
            buildStatus: session.buildStatus ?? (restoredStep as any)?.buildStatus ?? undefined,
          };
        }
      }

      // 构建元信息
      const meta: SessionMeta = {
        sessionId,
        taskId,
        intent: state.intent,
        workspacePath: state.workspacePath,
        runtimeMode: state.runtimeMode || "local",
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
      };

      console.log("[saveRecord] final stepSessions keys:", Object.keys(stepSessions));

      // 串行化保存：先保存 meta，再逐个保存 step
      saveQueueRef.current = saveQueueRef.current.then(async () => {
        try {
          // 保存元信息
          await wsRef.current!.request("session.saveMeta", meta as unknown as Record<string, unknown>);
          // 逐个保存步骤会话快照
          for (const [stepId, snapshot] of Object.entries(stepSessions)) {
            await wsRef.current!.request("session.saveStep", {
              sessionId,
              stepId,
              snapshot,
            });
          }
          await refreshRecords();
        } catch (err) {
          console.error("[useSessionRecords] saveRecord failed:", meta.sessionId, err);
        }
      });
      await saveQueueRef.current;
    },
    [refreshRecords],
  );

  /** 按 sessionId 加载完整会话记录 */
  const loadRecord = useCallback(
    async (sessionId: string): Promise<SessionRecord | null> => {
      if (!wsRef.current || !connectedRef.current) return null;
      try {
        const result = (await wsRef.current.request("session.loadRecord", {
          sessionId,
        })) as { record: SessionRecord | null };
        return result.record;
      } catch (err) {
        console.error("[useSessionRecords] loadRecord failed:", sessionId, err);
        return null;
      }
    },
    [],
  );

  /** 按 sessionId 加载某步骤的会话快照 */
  const loadStep = useCallback(
    async (sessionId: string, stepId: string): Promise<StepSessionSnapshot | null> => {
      if (!wsRef.current || !connectedRef.current) return null;
      try {
        const result = (await wsRef.current.request("session.loadStep", {
          sessionId,
          stepId,
        })) as { snapshot: StepSessionSnapshot | null };
        return result.snapshot;
      } catch (err) {
        console.error("[useSessionRecords] loadStep failed:", sessionId, stepId, err);
        return null;
      }
    },
    [],
  );

  /** 删除会话记录 */
  const deleteRecord = useCallback(
    async (sessionId: string) => {
      if (!wsRef.current || !connectedRef.current) return;
      try {
        await wsRef.current.request("session.deleteRecord", { sessionId });
        await refreshRecords();
      } catch (err) {
        console.error("[useSessionRecords] deleteRecord failed:", sessionId, err);
      }
    },
    [refreshRecords],
  );

  return {
    records,
    loading,
    refreshRecords,
    saveRecord,
    saveStep,
    saveMeta,
    loadRecord,
    loadStep,
    deleteRecord,
  } as const;
}
