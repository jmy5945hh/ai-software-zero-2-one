import { useState, useEffect, useCallback, useRef } from "react";
import type { AppState, PrototypeState } from "../data/types";
import { AgentWebSocket } from "../agent/ws";
import { agentFetch, buildAgentWsUrl, getAgentWsOrigin } from "../agent/config";
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
  // ── QA 审查数据（仅 quality 步骤有值） ──
  /** QA 审查执行状态 */
  qaStatus?: "idle" | "running" | "done" | "error";
  /** CLI 实时输出行 */
  qaOutputLines?: string[];
  /** 最终结果文件路径 */
  qaResultFilePath?: string;
  /** 结果文件内容（TOML 格式） */
  qaResultContent?: string;
  /** 错误信息 */
  qaError?: string;
};

/** 任务元信息（不含对话数据，与服务端 SessionMeta 对齐） */
export type SessionMeta = {
  sessionId: string;
  taskId: string;
  intent: string;
  workspacePath: string;
  /** 运行时模式：local 或 cloud */
  runtimeMode: "local" | "cloud";
  /** Git 仓库配置（云端模式），用于 session 恢复时重建 workspace */
  gitRepo?: { url: string; branch: string; subdirectory?: string };
  /** 本地模式使用的 Git 分支配置 */
  localGit?: { branch: string; shouldPull: boolean };
  stepIndex: number;
  activeStage: string;
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
  /** QA 质量审查状态（仅存简略状态，完整数据在 step-quality.json） */
  qaReview?: {
    status: "idle" | "running" | "done" | "error";
  };
  /** 交互原型状态 */
  prototype?: PrototypeState;
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

  // ── 双连接：本地和云端各自独立的 WebSocket ──
  const wsLocalRef = useRef<AgentWebSocket | null>(null);
  const wsCloudRef = useRef<AgentWebSocket | null>(null);
  const localReadyRef = useRef(false);
  const cloudReadyRef = useRef(false);

  /** 获取指定模式的 WebSocket（用于写操作时路由到正确的连接） */
  const getWsForMode = useCallback((mode: RuntimeMode): AgentWebSocket | null => {
    return mode === "cloud" ? wsCloudRef.current : wsLocalRef.current;
  }, []);

  /** 检查指定模式的连接是否就绪 */
  const isWsReady = useCallback((mode: RuntimeMode): boolean => {
    return mode === "cloud" ? cloudReadyRef.current : localReadyRef.current;
  }, []);

  // ── 建立双 WebSocket 连接 ──
  useEffect(() => {
    // 本地连接
    const localUrl = buildAgentWsUrl("local");
    const localWs = new AgentWebSocket(localUrl);
    wsLocalRef.current = localWs;
    localWs.onOpen(() => {
      localReadyRef.current = true;
      refreshRecords();
    });
    localWs.onClose(() => {
      localReadyRef.current = false;
    });

    // 云端连接
    const cloudUrl = buildAgentWsUrl("cloud");
    const cloudWs = new AgentWebSocket(cloudUrl);
    wsCloudRef.current = cloudWs;
    cloudWs.onOpen(() => {
      cloudReadyRef.current = true;
      refreshRecords();
    });
    cloudWs.onClose(() => {
      cloudReadyRef.current = false;
    });

    return () => {
      localWs.close();
      cloudWs.close();
      wsLocalRef.current = null;
      wsCloudRef.current = null;
      localReadyRef.current = false;
      cloudReadyRef.current = false;
    };
  }, []);

  /** 刷新会话记录列表（分别查询本地和云端，合并后按时间降序） */
  const refreshRecords = useCallback(async () => {
    setLoading(true);
    const allRecords: SessionMeta[] = [];

    // 查询本地
    if (wsLocalRef.current && localReadyRef.current) {
      try {
        const result = (await wsLocalRef.current.request("session.listRecords", {})) as {
          records: SessionMeta[];
        };
        const localRecords = (result.records || []).map((r) => ({
          ...r,
          runtimeMode: r.runtimeMode || "local",
        }));
        allRecords.push(...localRecords);
      } catch (err) {
        console.error("[useSessionRecords] listRecords (local) failed:", err);
      }
    }

    // 查询云端（仅当云端地址与本地不同时，避免重复）
    if (wsCloudRef.current && cloudReadyRef.current) {
      const localUrl = wsLocalRef.current?.url;
      const cloudUrl = wsCloudRef.current.url;
      if (localUrl !== cloudUrl) {
        try {
          const result = (await wsCloudRef.current.request("session.listRecords", {})) as {
            records: SessionMeta[];
          };
          const cloudRecords = (result.records || []).map((r) => ({
            ...r,
            runtimeMode: r.runtimeMode || "cloud",
          }));
          allRecords.push(...cloudRecords);
        } catch (err) {
          console.error("[useSessionRecords] listRecords (cloud) failed:", err);
        }
      }
    }

    // 按更新时间降序排列
    allRecords.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    setRecords(allRecords);
    setLoading(false);
  }, []);

  /** 保存队列，避免并发保存导致数据覆盖 */
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  /**
   * 保存某步骤的会话快照（独立存储）。
   * 每次 agent 轮次完成时调用，确保每轮数据不遗漏。
   */
  const saveStep = useCallback(
    async (sessionId: string, stepId: string, snapshot: StepSessionSnapshot, mode?: RuntimeMode) => {
      const ws = mode ? getWsForMode(mode) : wsLocalRef.current;
      const ready = mode ? isWsReady(mode) : localReadyRef.current;
      if (!ws || !ready) return;
      saveQueueRef.current = saveQueueRef.current.then(async () => {
        try {
          await ws.request("session.saveStep", {
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
    [getWsForMode, isWsReady],
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
            outputFragments?: string[];
          }>;
        }>;
        summary: string;
        summarizationResult?: import("../data/types").AgentSummary | null;
        buildCommand?: string | null;
        buildResult?: import("../data/types").BuildResult | null;
        completed?: boolean;
        summarizationStatus?: StepSessionSnapshot["summarizationStatus"];
        buildStatus?: StepSessionSnapshot["buildStatus"];
      }>,
      restoredSessions?: Record<string, StepSessionSnapshot>,
    ) => {
      const targetMode = state.runtimeMode || "local";
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
                outputFragments: tc.outputFragments ?? [],
              })),
            })),
            summary: session.summary || "",
            summarizationResult: session.summarizationResult || null,
            // 保留模型检测到的编译命令
            buildCommand: session.buildCommand ?? restoredStep?.buildCommand ?? null,
            // 保留编译结果（优先 agent session 最新值，fallback 到 restored）
            buildResult: session.buildResult ?? restoredStep?.buildResult ?? null,
            // 保留执行状态
            completed: session.completed ?? restoredStep?.completed ?? undefined,
            summarizationStatus: session.summarizationStatus ?? restoredStep?.summarizationStatus ?? undefined,
            buildStatus: session.buildStatus ?? restoredStep?.buildStatus ?? undefined,
          };
        }
      }

      // 将 QA 审查完整数据写入 step-quality.json
      const qualitySnapshot: StepSessionSnapshot | undefined = state.qaReview.status !== "idle"
        ? {
            messages: [],
            turns: [],
            summary: "",
            qaStatus: state.qaReview.status === "running" ? "idle" as const : state.qaReview.status,
            qaOutputLines: state.qaReview.outputLines,
            qaResultFilePath: state.qaReview.resultFilePath,
            qaResultContent: state.qaReview.resultContent,
            qaError: state.qaReview.error,
          }
        : undefined;

      if (qualitySnapshot) {
        // 合并已有的 quality step 数据（如果有 Agent 对话）
        const existingQuality = stepSessions["quality"];
        if (existingQuality) {
          qualitySnapshot.messages = existingQuality.messages;
          qualitySnapshot.turns = existingQuality.turns;
          qualitySnapshot.summary = existingQuality.summary;
          qualitySnapshot.summarizationResult = existingQuality.summarizationResult;
        }
        stepSessions["quality"] = qualitySnapshot;
      }

      // 构建元信息（仅存简略状态）
      const meta: SessionMeta = {
        sessionId,
        taskId,
        intent: state.intent,
        workspacePath: state.workspacePath,
        runtimeMode: state.runtimeMode || "local",
        gitRepo: state.gitRepo,
        localGit: state.localGit,
        stepIndex: state.stepIndex,
        activeStage: state.activeStage,
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
        // meta 中仅存简略状态
        qaReview: {
          status: state.qaReview.status === "running" ? "idle" as const : state.qaReview.status,
        },
        prototype: state.prototype || {
          mode: "none",
          status: "pending",
          htmlPath: "",
          handoffPath: "",
        },
      };

      console.log("[saveRecord] final stepSessions keys:", Object.keys(stepSessions));

      // 串行化保存：先保存 meta，再逐个保存 step
      saveQueueRef.current = saveQueueRef.current.then(async () => {
        try {
          const origin = getAgentWsOrigin(meta.runtimeMode || "local");
          // 保存元信息（HTTP）
          await agentFetch(`${origin}/session/save-meta`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(meta),
          }, meta.runtimeMode || "local");

          // 本地插入/更新 records（meta 已保存成功，先更新本地缓存，避免全量重查）
          setRecords((prev) => {
            const idx = prev.findIndex((r) => r.sessionId === sessionId);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = { ...next[idx], ...meta };
              return next;
            }
            const next = [...prev, meta];
            next.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
            return next;
          });

          // 逐个保存步骤会话快照（需要 WebSocket）
          const ws = getWsForMode(targetMode);
          const ready = isWsReady(targetMode);
          if (ws && ready) {
            for (const [stepId, snapshot] of Object.entries(stepSessions)) {
              try {
                await ws.request("session.saveStep", {
                  sessionId,
                  stepId,
                  snapshot,
                  taskId,
                });
              } catch (stepErr) {
                console.error("[useSessionRecords] saveStep failed:", sessionId, stepId, stepErr);
              }
            }
          } else {
            console.warn("[saveRecord] step sessions not saved: ws not connected for mode", targetMode);
          }
        } catch (err) {
          console.error("[useSessionRecords] saveRecord failed:", meta.sessionId, err);
        }
      });
      await saveQueueRef.current;
    },
    [],
  );

  /** 按 sessionId 加载完整会话记录（优先 HTTP，不依赖 WebSocket） */
  const loadRecord = useCallback(
    async (sessionId: string, mode?: RuntimeMode): Promise<SessionRecord | null> => {
      // 尝试从现有 records 中查找该 session 的模式
      const existing = records.find((r) => r.sessionId === sessionId);
      const targetMode = mode || existing?.runtimeMode || "local";

      try {
        // 1. 通过 HTTP 加载 meta（不依赖 WebSocket，页面刷新后立即可用）
        const origin = getAgentWsOrigin(targetMode);
        const metaRes = await agentFetch(`${origin}/session/meta?sessionId=${encodeURIComponent(sessionId)}`, {}, targetMode);
        if (!metaRes.ok) {
          console.error("[useSessionRecords] loadRecord meta HTTP failed:", metaRes.status);
          return null;
        }
        const { meta } = await metaRes.json() as { meta: SessionMeta | null };
        if (!meta) return null;

        // 2. 等待 WebSocket 就绪后加载 step sessions（最多等待 5 秒）
        let stepSessions: Record<string, StepSessionSnapshot> = {};
        const ws = getWsForMode(targetMode);
        if (ws) {
          // 如果尚未就绪，轮询等待
          if (!isWsReady(targetMode)) {
            await new Promise<void>((resolve) => {
              const start = Date.now();
              const check = () => {
                if (isWsReady(targetMode) || Date.now() - start > 5000) {
                  resolve();
                } else {
                  setTimeout(check, 200);
                }
              };
              setTimeout(check, 200);
            });
          }
          if (isWsReady(targetMode)) {
            try {
              const result = (await ws.request("session.loadRecord", {
                sessionId,
              })) as { record: SessionRecord | null };
              if (result.record?.stepSessions) {
                stepSessions = result.record.stepSessions;
              }
            } catch (wsErr) {
              console.warn("[useSessionRecords] loadRecord step sessions via WS failed:", wsErr);
            }
          }
        }

        return { ...meta, stepSessions };
      } catch (err) {
        console.error("[useSessionRecords] loadRecord failed:", sessionId, err);
        return null;
      }
    },
    [records, getWsForMode, isWsReady],
  );

  /** 按 sessionId 加载某步骤的会话快照（通过 HTTP，不依赖 WebSocket） */
  const loadStep = useCallback(
    async (sessionId: string, stepId: string, mode?: RuntimeMode): Promise<StepSessionSnapshot | null> => {
      try {
        const existing = records.find((r) => r.sessionId === sessionId);
        const targetMode = mode || existing?.runtimeMode || "local";
        const origin = getAgentWsOrigin(targetMode);
        const url = `${origin}/step-snapshot?sessionId=${encodeURIComponent(sessionId)}&stepId=${encodeURIComponent(stepId)}`;
        const res = await agentFetch(url, {}, targetMode);
        if (!res.ok) {
          console.error("[useSessionRecords] loadStep HTTP failed:", res.status);
          return null;
        }
        const data = await res.json() as { snapshot: StepSessionSnapshot | null };
        return data.snapshot;
      } catch (err) {
        console.error("[useSessionRecords] loadStep failed:", sessionId, stepId, err);
        return null;
      }
    },
    [records],
  );

  /** 删除会话记录（需要知道记录属于哪个模式） */
  const deleteRecord = useCallback(
    async (sessionId: string, mode?: RuntimeMode) => {
      const existing = records.find((r) => r.sessionId === sessionId);
      const targetMode = mode || existing?.runtimeMode || "local";
      const ws = getWsForMode(targetMode);
      const ready = isWsReady(targetMode);
      if (!ws || !ready) return;
      try {
        await ws.request("session.deleteRecord", { sessionId });
        // 本地移除，避免全量重查
        setRecords((prev) => prev.filter((r) => r.sessionId !== sessionId));
      } catch (err) {
        console.error("[useSessionRecords] deleteRecord failed:", sessionId, err);
      }
    },
    [records, getWsForMode, isWsReady],
  );

  return {
    records,
    loading,
    refreshRecords,
    saveRecord,
    loadRecord,
    loadStep,
    deleteRecord,
  } as const;
}
