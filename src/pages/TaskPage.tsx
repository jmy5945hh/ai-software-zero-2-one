import { useEffect, useMemo, useRef, useCallback, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useStoredState } from "../hooks/useStoredState";
import { useAgent } from "../agent";
import {
  getPrototypeArtifactPaths,
  getTaskWorkflow,
  getWorkflowStepIndex,
  parsePrototypeManifest,
  titleFromIntent,
  createDefaultState,
  normalizeDeliveryConfig,
} from "../data";
import { agentFetch, getBaseUrl } from "../agent/config";

import type { DrawerContent, AppState, DeliveryConfig, PrototypeState } from "../data/types";
import type { ConnectionStatus } from "../agent/types";
import { useSessionRecords } from "../hooks/useSessionRecords";

import { Bot, Code2, FileText, Gauge, Globe, Maximize2, Minimize2, ShieldCheck, Sparkles, Terminal, TestTube2, WifiOff } from "lucide-react";

import { SopNav } from "../components/SopNav";
import { LeftPanel } from "../components/LeftPanel";
import { DecisionBoard } from "../components/DecisionBoard";
import { Drawer } from "../components/Drawer";
import { AgentStatusBadge } from "../components/AgentStatusBadge";
import { RepoExplorer } from "../components/RepoExplorer";
import type { RepoTab } from "../components/RepoExplorer";

/**
 * 任务执行页 —— "/task"
 * SOP 导航 / 左侧面板 / 决策台 / 抽屉预览。
 */
export function TaskPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [state, setState] = useStoredState();
  const [drawerContent, setDrawerContent] = useState<DrawerContent>(null);
  const [repoExplorerOpen, setRepoExplorerOpen] = useState<RepoTab | null>(null);
  const [viewingStepIndex, setViewingStepIndex] = useState(state.stepIndex);
  const [workbenchTab, setWorkbenchTab] = useState<"artifacts" | "code" | "preview" | "terminal">("artifacts");
  const [fullscreenTab, setFullscreenTab] = useState<"artifacts" | "code" | "preview" | "terminal" | null>(null);

  // ── URL taskId 恢复 ──
  // 如果 URL 携带 taskId 且与 localStorage 中的不一致，说明是刷新后首次加载，
  // 需要从服务端加载会话记录并恢复到 AppState
  const urlTaskId = searchParams.get("taskId");
  const restoreAttemptedRef = useRef(false);

  useEffect(() => {
    // 仅执行一次：URL 有 taskId，且尚未尝试恢复
    if (!urlTaskId || restoreAttemptedRef.current) return;
    restoreAttemptedRef.current = true;

    // 如果 localStorage 中的 sessionId 与 URL 一致，说明状态已就绪，无需恢复
    if (state.sessionId === urlTaskId && state.workspacePath) {
      return;
    }

    // 从服务端加载会话记录
    sessionRecords.loadRecord(urlTaskId).then((record) => {
      if (!record) return;

      const prototype = record.prototype || {
        mode: "pending" as const,
        status: "pending" as const,
        htmlPath: "",
        handoffPath: "",
      };
      const taskWorkflow = getTaskWorkflow(prototype);
      setState((previous) => ({
        ...previous,
        intent: record.intent,
        workspacePath: record.workspacePath,
        runtimeMode: (record as any).runtimeMode || "local",
        deliveryConfig: normalizeDeliveryConfig(record.deliveryConfig),
        gitRepo: (record as any).gitRepo,
        localGit: record.localGit,
        stepIndex: getWorkflowStepIndex(record.activeStage, record.stepIndex, taskWorkflow),
        activeStage: record.activeStage as AppState["activeStage"],
        notes: record.notes,
        todoAnswers: record.todoAnswers,
        initialPrompts: record.initialPrompts,
        codeConfirmed: record.codeConfirmed,
        fixApproved: record.fixApproved,
        releaseApproved: record.releaseApproved,
        qualityPassed: record.qualityPassed,
        verificationPlan: record.verificationPlan || createDefaultState().verificationPlan,
        verificationResult: record.verificationResult || createDefaultState().verificationResult,
        deliveryReport: record.deliveryReport || createDefaultState().deliveryReport,
        createdAt: record.createdAt,
        sessionId: record.sessionId,
        restoredSessions: record.stepSessions || {},
        // 从 step-quality.json 恢复 QA 完整数据，meta 中仅存简略状态
        qaReview: (() => {
          const qualityStep = record.stepSessions?.["quality"];
          const metaStatus = record.qaReview?.status;
          if (qualityStep && (qualityStep as any).qaStatus) {
            const qs = qualityStep as any;
            return {
              status: qs.qaStatus === "running" ? "idle" as const : qs.qaStatus,
              outputLines: qs.qaOutputLines || [],
              resultFilePath: qs.qaResultFilePath || "",
              resultContent: qs.qaResultContent || "",
              error: qs.qaError || undefined,
            };
          }
          // fallback: 从 meta 恢复（兼容旧数据）
          if (record.qaReview) {
            return {
              ...record.qaReview,
              status: record.qaReview.status === "running" ? "idle" as const : record.qaReview.status,
              outputLines: (record.qaReview as any).outputLines || [],
              resultFilePath: (record.qaReview as any).resultFilePath || "",
              resultContent: (record.qaReview as any).resultContent || "",
            };
          }
          return {
            status: "idle" as const,
            outputLines: [],
            resultFilePath: "",
            resultContent: "",
          };
        })(),
        prototype,
        view: "workspace",
      }));
    });
  }, [urlTaskId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 如果状态中没有 workspacePath 或者不在 workspace 状态，跳回首页
  useEffect(() => {
    // 如果没有 workspacePath 且没有待恢复的 URL taskId，跳回首页
    if (!state.workspacePath && !urlTaskId) {
      navigate("/");
    }
  }, [state.workspacePath, navigate, urlTaskId]);

  // 使用 state.sessionId 作为 taskId，确保与 /task/init 中的 taskId 一致
  const taskId = state.sessionId || null;

  const agent = useAgent(taskId, state.workspacePath, state.gitRepo, state.runtimeMode);

  // ── 从历史恢复 session 状态到 agent ──
  // 当 restoredSessions 加载完成后，将各步骤的状态注入 agent sessions，
  // 若 agent 已完成但 summary 未完成，自动触发总结流程
  // 同时恢复 server-side session，确保后续用户输入能正确路由到有历史上下文的 session
  const restoreFromHistoryRef = useRef(false);
  useEffect(() => {
    if (!agent.restoreSessionState) return;
    const restoredKeys = Object.keys(state.restoredSessions);
    if (restoredKeys.length === 0) return;

    // 恢复 client-side 状态（每次 restoredSessions 变化都执行）
    for (const [stepId, snapshot] of Object.entries(state.restoredSessions)) {
      agent.restoreSessionState(stepId, snapshot);
    }

    // 恢复 server-side session（仅在 agent 已连接时执行一次）
    if (agent.connectionStatus === "connected" && !restoreFromHistoryRef.current) {
      restoreFromHistoryRef.current = true;
      for (const [stepId, snapshot] of Object.entries(state.restoredSessions)) {
        const userMessages = (snapshot.messages || []).filter(m => m.role === "user");
        if (userMessages.length > 0) {
          agent.restoreServerSession?.(
            stepId,
            snapshot.messages,
            state.intent,
            state.workspacePath,
            state.gitRepo,
          );
        }
      }
    }
  }, [state.restoredSessions, agent.connectionStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 会话记录自动保存 ──
  const sessionRecords = useSessionRecords();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCompletedRef = useRef<Record<string, boolean>>({});
  /** 记录每个 step 上一次保存时的 turn 数量，用于检测新用户输入后立即保存 */
  const lastSavedTurnCountRef = useRef<Record<string, number>>({});

  const stepSummaries = useMemo(() => {
    const summaries: Record<string, string> = {};
    for (const [stepId, session] of Object.entries(agent.sessions)) {
      if (session.summarizationResult?.brief) {
        summaries[stepId] = session.summarizationResult.brief;
      } else if (session.summary) {
        summaries[stepId] = session.summary.slice(0, 100);
      }
    }
    for (const [stepId, session] of Object.entries(state.restoredSessions)) {
      if (!summaries[stepId]) {
        if (session.summarizationResult?.brief) {
          summaries[stepId] = session.summarizationResult.brief;
        } else if (session.summary) {
          summaries[stepId] = session.summary.slice(0, 100);
        }
      }
    }
    return summaries;
  }, [agent.sessions, state.restoredSessions]);

  const handleSessionComplete = useCallback((step: string, sessionsSnapshot: Record<string, any>) => {
    console.log("[TaskPage] handleSessionComplete, step:", step, "turns:", sessionsSnapshot[step]?.turns?.length, "messages:", sessionsSnapshot[step]?.messages?.length);
    if (taskId && state.intent) {
      sessionRecords.saveRecord(state, taskId, stepSummaries, sessionsSnapshot, state.restoredSessions);
    }
  }, [taskId, state, stepSummaries, sessionRecords]);

  useEffect(() => {
    agent.setOnSessionComplete(handleSessionComplete);
    return () => agent.setOnSessionComplete(null);
  }, [agent, handleSessionComplete]);

  const isAgentConnected = agent.connectionStatus === "connected";
  const connectionStatus = agent.connectionStatus;
  const connectionQuality = agent.connectionQuality;

  useEffect(() => {
    if (!taskId || !state.intent) return;

    for (const [stepId, session] of Object.entries(agent.sessions)) {
      const wasCompleted = lastCompletedRef.current[stepId];
      const nowCompleted = session.completed;
      if (!wasCompleted && nowCompleted) {
        lastCompletedRef.current[stepId] = true;
        sessionRecords.saveRecord(state, taskId, stepSummaries, agent.sessions, state.restoredSessions);
      }
      if (!nowCompleted) {
        lastCompletedRef.current[stepId] = false;
      }
    }
  }, [agent.sessions, taskId, state, stepSummaries, sessionRecords]);

  useEffect(() => {
    if (!taskId || !state.intent) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      sessionRecords.saveRecord(state, taskId, stepSummaries, agent.sessions, state.restoredSessions);
    }, 2000);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [
    state.stepIndex,
    state.activeStage,
    state.notes,
    state.todoAnswers,
    state.codeConfirmed,
    state.fixApproved,
    state.releaseApproved,
    state.qualityPassed,
    state.qaReview,
    state.prototype,
    state.workspacePath,
    taskId,
    stepSummaries,
    agent.sessions,
  ]);

  const taskTitle = useMemo(
    () => titleFromIntent(state.intent),
    [state.intent],
  );

  const isBuilderMode = state.deliveryConfig.interactionMode === "builder" && state.activeStage === "coding";
  const taskWorkflow = useMemo(
    () => getTaskWorkflow(state.prototype),
    [state.prototype],
  );
  // builder 模式：传给 LeftPanel 的 workflow 只包含编码开发阶段
  const displayWorkflow = useMemo(
    () => isBuilderMode ? taskWorkflow.filter((step) => step.id === "coding") : taskWorkflow,
    [taskWorkflow, isBuilderMode],
  );

  const progress = useMemo(
    () =>
      Math.round(
        ((state.stepIndex + (state.releaseApproved ? 1 : 0)) /
          taskWorkflow.length) *
        100,
      ),
    [state.stepIndex, state.releaseApproved, taskWorkflow.length],
  );

  const patchState = useCallback(
    (patch: Partial<typeof state>) =>
      setState((previous) => ({ ...previous, ...patch })),
    [setState],
  );

  const readPrototypeDecision = useCallback(async () => {
    if (!taskId) return null;
    try {
      const paths = getPrototypeArtifactPaths(taskId);
      const params = new URLSearchParams({
        taskId,
        file: paths.manifestPath,
      });
      const res = await agentFetch(`${getBaseUrl("local")}/session-file?${params.toString()}`);
      if (!res.ok) return null;
      const data = await res.json() as { content?: string };
      return parsePrototypeManifest(data.content, taskId);
    } catch {
      return null;
    }
  }, [taskId]);

  const openDrawer = useCallback(
    (content: DrawerContent) => setDrawerContent(content),
    [],
  );
  const closeDrawer = useCallback(() => setDrawerContent(null), []);

  // ── QA 质量审查：一键修复 ──
  const handleFixQaIssues = useCallback(
    (report: string) => {
      if (!isAgentConnected) return;
      // 清空上次 QA 审查结果
      patchState({
        qaReview: {
          status: "idle",
          outputLines: [],
          resultFilePath: "",
          resultContent: "",
        },
      });
      // 在 quality 阶段内执行修复，不推进到下一阶段
      const fixPrompt = `${buildDeliveryPolicyPrompt(state.deliveryConfig)}\n\n请根据以下质量审查报告修复代码中的问题。修复后按本任务的验证范围说明需要复测哪些 Web/API/业务场景路径：\n\n${report}`;
      agent.createSession("quality", state.intent, state.workspacePath, state.gitRepo, state.deliveryConfig.modelId, state.deliveryConfig.modelProvider).then(() => {
        agent.prompt("quality", fixPrompt);
      });
    },
    [isAgentConnected, agent, state.intent, state.workspacePath, state.gitRepo, state.deliveryConfig, patchState],
  );

  // ── Agent session 生命周期 ──
  const sessionInitRef = useRef(false);

  useEffect(() => {
    if (
      !isAgentConnected ||
      sessionInitRef.current ||
      !state.intent ||
      Object.keys(state.restoredSessions).length > 0
    ) return;
    sessionInitRef.current = true;

    // builder 模式：stepIndex 指向 coding，直接创建 coding session
    const isBuilderMode = state.deliveryConfig.interactionMode === "builder" && state.activeStage === "coding";

    if (isBuilderMode) {
      // builder 模式：直接用用户原始提示词作为 coding prompt
      patchState({
        initialPrompts: { ...state.initialPrompts, coding: state.intent },
      });

      const startCoding = async () => {
        await agent.createSession("coding", state.intent, state.workspacePath, state.gitRepo, state.deliveryConfig.modelId, state.deliveryConfig.modelProvider);
        if (taskId && state.intent) {
          sessionRecords.saveRecord(state, taskId, stepSummaries, agent.sessions, state.restoredSessions);
        }
        await agent.prompt("coding", state.intent);
        agent.getFileTree();
      };
      startCoding();
      return;
    }

    // 非 builder 模式：从 intent 阶段开始
    if (state.stepIndex !== 0) return;

    const intentPrompt = getStepPrompt("intent", state.intent, taskId, undefined, state.deliveryConfig);
    patchState({
      initialPrompts: { ...state.initialPrompts, intent: intentPrompt },
    });

    const startIntent = async () => {
      // 云端模式：先检查 workspace 初始化状态
      if (state.runtimeMode === "cloud" && agent.getWorkspaceInitStatus) {
        const status = await agent.getWorkspaceInitStatus();
        if (status?.stage === "cloning") {
          // 正在克隆中，轮询等待
          const pollInterval = setInterval(async () => {
            const s = await agent.getWorkspaceInitStatus();
            if (!s || s.stage === "ready" || s.stage === "error") {
              clearInterval(pollInterval);
              if (s?.stage === "ready") {
                // 创建 session
                await agent.createSession("intent", state.intent, state.workspacePath, state.gitRepo, state.deliveryConfig.modelId, state.deliveryConfig.modelProvider);
                if (taskId && state.intent) {
                  sessionRecords.saveRecord(state, taskId, stepSummaries, agent.sessions, state.restoredSessions);
                }
                await agent.prompt("intent", intentPrompt);
                agent.getFileTree();
              }
            }
          }, 2000);
          return;
        }
      }

      // 本地模式或云端已就绪
      await agent.createSession("intent", state.intent, state.workspacePath, state.gitRepo, state.deliveryConfig.modelId, state.deliveryConfig.modelProvider);
      // 首次 session 创建后立即保存，确保初始状态不丢失
      if (taskId && state.intent) {
        sessionRecords.saveRecord(state, taskId, stepSummaries, agent.sessions, state.restoredSessions);
      }
      await agent.prompt("intent", intentPrompt);
      agent.getFileTree();
    };
    startIntent();
  }, [isAgentConnected, state.stepIndex, state.intent, state.initialPrompts, state.deliveryConfig, patchState, state.runtimeMode, state.activeStage]);

  // 需求分析完成后读取 UI 变化决策，据此决定任务工作流是否包含交互原型。
  useEffect(() => {
    const intentSession = agent.sessions.intent;
    if (!taskId || !state.workspacePath || !intentSession?.completed) return;
    if (state.prototype.mode !== "pending" || state.prototype.status === "skipped") return;

    let cancelled = false;
    void readPrototypeDecision().then((prototype) => {
      if (!cancelled && prototype) patchState({ prototype });
    });
    return () => { cancelled = true; };
  }, [agent.sessions.intent, taskId, state.workspacePath, state.prototype, patchState, readPrototypeDecision]);

  const continueTask = useCallback(async (prototypeOverride?: PrototypeState) => {
    let effectivePrototype = prototypeOverride ?? state.prototype;
    if (state.activeStage === "intent" && state.prototype.mode === "pending" && state.prototype.status === "pending") {
      // 优先从文件读取最新决策（可能 useEffect 因时序问题未及时更新 state）
      const decision = await readPrototypeDecision();
      if (decision) {
        effectivePrototype = decision;
        patchState({ prototype: decision });
      } else {
        // 文件不存在或内容无效，提示 agent 重新生成
        const manifestPath = taskId ? getPrototypeArtifactPaths(taskId).manifestPath : "prototype.json";
        await agent.prompt(
          "intent",
          `需求分析尚未生成工作流决策。请根据当前需求判断是否包含用户可见的 UI 变化，并按初始要求写入 ~/.aiNativeDevPlatform/sessions/${taskId || "unknown"}/${manifestPath}。`,
        );
        return;
      }
    }
    const effectiveWorkflow = getTaskWorkflow(effectivePrototype);
    const nextIndex = Math.min(state.stepIndex + 1, effectiveWorkflow.length - 1);
    const nextStep = effectiveWorkflow[nextIndex];

    if (isAgentConnected && taskId && nextStep.id !== "quality") {
      // quality 阶段不走 Agent session 逻辑，直接触发 CLI 命令
      const prototype = nextStep.id === "prototype"
        ? {
            mode: effectivePrototype.mode,
            status: "generating" as const,
            htmlPath: `index.html`,
            handoffPath: `原型交接.md`,
          }
        : effectivePrototype;
      const promptText = getStepPrompt(nextStep.id, state.intent, taskId, prototype, state.deliveryConfig);

      patchState({
        initialPrompts: { ...state.initialPrompts, [nextStep.id]: promptText },
        ...(nextStep.id === "prototype" ? { prototype } : {}),
      });
      agent.createSession(nextStep.id, state.intent, state.workspacePath, state.gitRepo, state.deliveryConfig.modelId, state.deliveryConfig.modelProvider).then(() => {
        agent.prompt(nextStep.id, promptText);
        agent.getFileTree();
      });
    }

    console.log("[TaskPage] continueTask", { nextIndex, nextStepId: nextStep.id, isQuality: nextStep.id === "quality" });

    patchState({
      stepIndex: nextIndex,
      activeStage: nextStep.id,
      codeConfirmed: state.codeConfirmed || nextStep.id === "coding",
      // 进入 quality 阶段时重置 QA 审查状态
      ...(nextStep.id === "quality" ? {
        qaReview: {
          status: "idle" as const,
          outputLines: [],
          resultFilePath: "",
          resultContent: "",
        },
      } : {}),
    });
    window.scrollTo({ top: 0 });
  }, [state.stepIndex, state.activeStage, state.intent, state.initialPrompts, state.prototype, state.deliveryConfig, isAgentConnected, taskId, agent, patchState, state.codeConfirmed, readPrototypeDecision]);

  const handleStepClick = (index: number) => {
    if (index <= state.stepIndex) setViewingStepIndex(index);
  };

  useEffect(() => {
    setViewingStepIndex(state.stepIndex);
  }, [state.stepIndex]);

  const handleFileClick = useCallback(
    async (path: string, name: string) => {
      if (!isAgentConnected) return;
      try {
        const content = await agent.readFile(path);
        const ext = path.split(".").pop() || "";
        const isCode = ["ts", "tsx", "js", "jsx", "json", "yaml", "yml", "css"].includes(ext);
        openDrawer({
          type: isCode ? "code" : ["md"].includes(ext) ? "document" : "file",
          title: name,
          path,
          content,
          language: getLanguageFromPath(path),
          html: "",
        } as DrawerContent);
      } catch {
        // 读取失败
      }
    },
    [isAgentConnected, agent, openDrawer],
  );

  const goHome = useCallback(() => {
    patchState({ view: "home" });
    navigate("/dashboard");
  }, [patchState, navigate]);

  return (
    <main className="workspace-shell">
      {!isAgentConnected ? (
        <div className="workspace-no-agent">
          <div className="no-agent-card">
            {connectionStatus === "connecting" ? (
              <>
                <div className="agent-summon-spinner" />
                <h2>DevAgent 数字伙伴召集中...</h2>
                <p>云端算力唤醒，Agent Team 即将就绪</p>
                <div className="agent-summon-dots">
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                </div>
              </>
            ) : connectionStatus === "reconnecting" ? (
              <>
                <div className="agent-summon-spinner" />
                <h2>重新连接中...</h2>
                <p>连接中断，正在第 {connectionQuality.reconnectAttempt} 次尝试重新连接</p>
              </>
            ) : (
              <>
                <WifiOff size={32} />
                <h2>Agent 未连接</h2>
                <p>请启动 Agent Server 并配置 API Key 后刷新页面</p>
                <button className="ghost-button" type="button" onClick={goHome}>
                  ← 返回仪表盘
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="workspace-grid">
            <LeftPanel
              activeTaskCard={state.activeTaskCard}
              stepIndex={state.stepIndex}
              onFileClick={handleFileClick}
              onBackToTasks={goHome}
              agentFileTree={agent.fileTree}
              isAgentConnected={isAgentConnected}
              agentSessions={agent.sessions}
              intent={state.intent}
              workspacePath={state.workspacePath}
              sessionId={state.sessionId}
              runtimeMode={state.runtimeMode}
              repoExplorerOpen={repoExplorerOpen}
              onCloseRepoExplorer={() => setRepoExplorerOpen(null)}
              workflow={displayWorkflow}
              executionStepIndex={isBuilderMode ? 0 : state.stepIndex}
              viewingStepIndex={viewingStepIndex}
              onViewStep={handleStepClick}
            />
            <section className="conversation-column">
              <header className="conversation-header">
                <div><strong>{taskTitle}</strong><span className="workflow-status-pill">{isBuilderMode ? "Builder · 编码开发" : `Workflow · ${taskWorkflow[state.stepIndex].label} ${state.stepIndex + 1}/${taskWorkflow.length}`}</span></div>
                {viewingStepIndex !== state.stepIndex && <button type="button" onClick={() => setViewingStepIndex(state.stepIndex)}>历史产出 · 返回当前</button>}
                <AgentStatusBadge status={connectionStatus} quality={connectionQuality} />
              </header>
              <DecisionBoard
              fixedTab="trajectory"
              state={{ ...state, stepIndex: viewingStepIndex }}
              onPatch={patchState}
              onContinue={continueTask}
              onPreview={openDrawer}
              agentSessions={agent.sessions}
              restoredSessions={state.restoredSessions}
              stepSummaries={stepSummaries}
              agentSteer={agent.steer}
              agentAbort={agent.abort}
              agentPrompt={agent.prompt}
              agentAnswerQuestion={agent.answerQuestion}
              agentContinueQuestion={agent.continueQuestion}
              agentResumeQuestion={agent.resumeQuestion}
              isAgentConnected={isAgentConnected}
              triggerBuild={agent.triggerBuild}
              detectBuildCommand={agent.detectBuildCommand}
              taskId={taskId}
              onOpenRepoExplorer={(tab) => setRepoExplorerOpen(tab)}
              onBuildUpdate={(stepId, command, result) => {
                agent.updateBuildData(stepId, command, result);
                // 立即持久化，避免用户切换页面导致数据丢失
                // 直接构造包含最新 build 数据的 sessions 快照传给 saveRecord
                if (taskId && state.intent) {
                  const updatedSessions = {
                    ...agent.sessions,
                    [stepId]: {
                      ...(agent.sessions[stepId] || {}),
                      buildCommand: command,
                      buildResult: result,
                      buildStatus: "done" as const,
                    },
                  };
                  sessionRecords.saveRecord(state, taskId, stepSummaries, updatedSessions, state.restoredSessions);
                }
              }}
              onFixIssues={handleFixQaIssues}
              workspaceInitStatus={agent.workspaceInitStatus}
              onRetryClone={() => agent.retryWorkspaceInit(state.gitRepo)}
            />
            </section>
            <section className="execution-workbench">
              <header className="workbench-tabs">
                {([
                  ["artifacts", FileText, "产出"],
                  ["code", Code2, "代码"],
                  ["preview", Globe, "预览"],
                  ["terminal", Terminal, "终端"],
                ] as const).map(([id, Icon, label]) => <button key={id} type="button"
                  className={workbenchTab === id ? "active" : ""}
                  onClick={() => setWorkbenchTab(id)}>
                  <Icon size={14} />{label}
                  <span className="workbench-fullscreen-btn" onClick={(e) => { e.stopPropagation(); setFullscreenTab(id); }} title="全屏">
                    <Maximize2 size={11} />
                  </span>
                </button>)}
              </header>
              {workbenchTab === "artifacts" ? <DecisionBoard
                fixedTab="delivery"
                state={{ ...state, stepIndex: viewingStepIndex }}
                onPatch={patchState} onContinue={continueTask} onPreview={openDrawer}
                agentSessions={agent.sessions} restoredSessions={state.restoredSessions}
                stepSummaries={stepSummaries} agentSteer={agent.steer} agentAbort={agent.abort}
                agentPrompt={agent.prompt} agentAnswerQuestion={agent.answerQuestion}
                agentContinueQuestion={agent.continueQuestion} agentResumeQuestion={agent.resumeQuestion}
                isAgentConnected={isAgentConnected} triggerBuild={agent.triggerBuild}
                detectBuildCommand={agent.detectBuildCommand} taskId={taskId}
                onOpenRepoExplorer={(tab) => setRepoExplorerOpen(tab)}
                onFixIssues={handleFixQaIssues} workspaceInitStatus={agent.workspaceInitStatus}
                onRetryClone={() => agent.retryWorkspaceInit(state.gitRepo)}
              /> : <div className="workbench-canvas">
                {workbenchTab === "preview" && <><Globe size={28}/><strong>应用预览</strong><p>运行中的 Web 应用将在这里保持可见。</p></>}
                {workbenchTab === "code" && state.workspacePath && (
                  <RepoExplorer
                    workspacePath={state.workspacePath}
                    taskId={taskId || undefined}
                    runtimeMode={state.runtimeMode}
                    initialTab={repoExplorerOpen || "tree"}
                  />
                )}
                {workbenchTab === "terminal" && <><Terminal size={28}/><strong>Terminal</strong><p>构建、测试与验证输出将在这里汇总。</p></>}
              </div>}

              {/* ── 全屏浮层 ── */}
              {fullscreenTab && (
                <div className="workbench-fullscreen-overlay" onClick={() => setFullscreenTab(null)}>
                  <div className="workbench-fullscreen-content" onClick={(e) => e.stopPropagation()}>
                    <header className="workbench-fullscreen-header">
                      <span>{fullscreenTab === "artifacts" ? "产出" : fullscreenTab === "code" ? "代码" : fullscreenTab === "preview" ? "预览" : "终端"}</span>
                      <button type="button" onClick={() => setFullscreenTab(null)} title="退出全屏">
                        <Minimize2 size={14} />
                      </button>
                    </header>
                    <div className="workbench-fullscreen-body">
                      {fullscreenTab === "artifacts" ? <DecisionBoard
                        fixedTab="delivery"
                        state={{ ...state, stepIndex: viewingStepIndex }}
                        onPatch={patchState} onContinue={continueTask} onPreview={openDrawer}
                        agentSessions={agent.sessions} restoredSessions={state.restoredSessions}
                        stepSummaries={stepSummaries} agentSteer={agent.steer} agentAbort={agent.abort}
                        agentPrompt={agent.prompt} agentAnswerQuestion={agent.answerQuestion}
                        agentContinueQuestion={agent.continueQuestion} agentResumeQuestion={agent.resumeQuestion}
                        isAgentConnected={isAgentConnected} triggerBuild={agent.triggerBuild}
                        detectBuildCommand={agent.detectBuildCommand} taskId={taskId}
                        onOpenRepoExplorer={(tab) => setRepoExplorerOpen(tab)}
                        onFixIssues={handleFixQaIssues} workspaceInitStatus={agent.workspaceInitStatus}
                        onRetryClone={() => agent.retryWorkspaceInit(state.gitRepo)}
                      /> : <div className="workbench-canvas">
                        {fullscreenTab === "preview" && <><Globe size={28}/><strong>应用预览</strong><p>运行中的 Web 应用将在这里保持可见。</p></>}
                        {fullscreenTab === "code" && state.workspacePath && (
                          <RepoExplorer
                            workspacePath={state.workspacePath}
                            taskId={taskId || undefined}
                            runtimeMode={state.runtimeMode}
                            initialTab={repoExplorerOpen || "tree"}
                          />
                        )}
                        {fullscreenTab === "terminal" && <><Terminal size={28}/><strong>Terminal</strong><p>构建、测试与验证输出将在这里汇总。</p></>}
                      </div>}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>

          <Drawer content={drawerContent} onClose={closeDrawer} />
        </>
      )}
    </main>
  );
}

// ── 辅助函数 ────────────────────────────────

function getLanguageFromPath(path: string): string {
  const ext = path.split(".").pop() || "";
  const map: Record<string, string> = {
    ts: "TypeScript", tsx: "TSX", js: "JavaScript", jsx: "JSX",
    json: "JSON", yaml: "YAML", yml: "YAML", md: "Markdown",
    css: "CSS", html: "HTML", diff: "Diff",
  };
  return map[ext] || ext;
}

function DeliveryStrategyBanner({
  config,
  runtimeMode,
}: {
  config: DeliveryConfig;
  runtimeMode: AppState["runtimeMode"];
}) {
  const items = [
    { icon: Sparkles, label: "交付模式", value: deliveryModeLabel(config.mode) },
    { icon: Gauge, label: "自治等级", value: autonomyLabel(config.autonomy) },
    { icon: TestTube2, label: "验证范围", value: verificationLabel(config.verification) },
    {
      icon: Bot,
      label: "模型",
      value: config.modelId === "auto"
        ? `Auto · ${modelPolicyLabel(config.modelPolicy)}`
        : config.modelId,
    },
  ];

  return (
    <section className="delivery-strategy-strip" aria-label="v0.2 交付策略">
      <div className="delivery-strategy-main">
        <div className="delivery-strategy-icon">
          <ShieldCheck size={17} />
        </div>
        <div>
          <strong>测试验证后交付</strong>
          <span>{runtimeMode === "cloud" ? "云端运行" : "本地运行"} · {config.autoRepair ? "失败自动修复复测" : "失败后等待确认"} · {config.confirmRiskyActions ? "高风险操作前确认" : "按自治等级自动推进"}</span>
        </div>
      </div>
      <div className="delivery-strategy-items">
        {items.map(({ icon: Icon, label, value }) => (
          <div className="delivery-strategy-item" key={label}>
            <Icon size={14} />
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function deliveryModeLabel(mode: DeliveryConfig["mode"]): string {
  return {
    app: "一句话做应用",
    "project-change": "改现有项目",
    bugfix: "修复 Bug",
    verification: "运行测试",
  }[mode];
}

function autonomyLabel(mode: DeliveryConfig["autonomy"]): string {
  return {
    fast: "极速交付",
    collaborative: "协作模式",
    strict: "严格审查",
  }[mode];
}

function verificationLabel(profile: DeliveryConfig["verification"]): string {
  return {
    full: "完整验证",
    "api-web": "API + Web",
    smoke: "冒烟验证",
  }[profile];
}

function modelPolicyLabel(policy: DeliveryConfig["modelPolicy"]): string {
  return {
    balanced: "平衡",
    quality: "质量优先",
    cost: "成本优先",
  }[policy];
}

function buildDeliveryPolicyPrompt(config: DeliveryConfig): string {
  const interactionGuide = {
    plan: "先澄清目标、边界和验收标准，未经用户触发不直接修改代码。",
    builder: "围绕当前目标端到端实现，按风险策略自动推进到测试后交付。",
    workflow: "按既定 SOP 分阶段执行，并保留节点产物和验证证据。",
  }[config.interactionMode];

  const verificationGuide = {
    full: "必须覆盖 Web E2E、API 合约、核心业务场景、异常恢复、数据持久化和可观测性证据。",
    "api-web": "必须覆盖 API 合约和 Web 主路径，业务场景可聚焦最高价值链路。",
    smoke: "必须覆盖构建/启动/关键路径冒烟验证，避免扩展到低价值长尾用例。",
  }[config.verification];

  const autonomyGuide = {
    fast: "默认自动推进；仅在需求歧义、高风险操作、验证失败但建议放行、成本/时间超阈值时询问用户。",
    collaborative: "关键决策询问用户；低风险实现、检查、修复和复测自动推进。",
    strict: "架构变更、范围变化、依赖新增、删除/覆盖文件、验证失败修复都需要用户确认。",
  }[config.autonomy];

  const modelGuide = {
    balanced: "常规任务优先中等推理；复杂架构/失败归因/最终审查可升档。",
    quality: "优先保证可靠性；复杂节点、失败归因、最终交付审查使用更强推理。",
    cost: "优先控制成本；分类、摘要、简单检查使用低成本模型，失败或高风险时再升档。",
  }[config.modelPolicy];

  return `v0.2 交付策略：
  - 交互模式：${config.interactionMode}。${interactionGuide}
  - 交付模式：${deliveryModeLabel(config.mode)}
- 自治等级：${autonomyLabel(config.autonomy)}。${autonomyGuide}
- 验证范围：${verificationLabel(config.verification)}。${verificationGuide}
  - 指定模型：${config.modelId === "auto" ? "Auto（按节点自动选择）" : config.modelId}
  - 模型策略：${modelPolicyLabel(config.modelPolicy)}。${modelGuide}
  - 挂载 Skills：${config.skills.length ? config.skills.join("、") : "无额外挂载"}
  - 连接 MCP：${config.mcpServers.length ? config.mcpServers.join("、") : "无额外连接"}
- 自动修复：${config.autoRepair ? "验证或质量检查失败后，优先自动修复并复测。" : "失败后先汇报证据和修复方案，等待用户授权。"}
- 风险确认：${config.confirmRiskyActions ? "删除/覆盖文件、数据库/鉴权/部署/生产配置、新依赖、大范围重构前必须确认。" : "按自治等级推进，但仍需记录高风险操作证据。"}
- 最终交付必须包含：变更摘要、测试验证证据、未覆盖风险、建议后续动作。`;
}

function getStepPrompt(
  step: string,
  intent: string,
  taskId?: string | null,
  prototype?: AppState["prototype"],
  deliveryConfig: DeliveryConfig = createDefaultState().deliveryConfig,
): string {
  const deliveryPolicy = buildDeliveryPolicyPrompt(deliveryConfig);
  switch (step) {
    case "intent":
      return `${deliveryPolicy}\n\n请分析以下业务意图，识别核心业务对象、角色和场景，并生成 Spec 文档。Spec 必须包含验收标准和系统级验证计划草案。\n\n同时判断本任务是否包含需要用户确认的 UI 页面或交互变化，并将工作流决策写入 ~/.aiNativeDevPlatform/sessions/${taskId || "unknown"}/prototype.json。\n\n如果包含 UI 变化，请写入：\n{\"mode\":\"new-page 或 existing-change\",\"status\":\"pending\",\"htmlPath\":\"index.html\",\"handoffPath\":\"原型交接.md\"}\n\n如果不包含 UI 变化，请写入：\n{\"mode\":\"none\",\"status\":\"skipped\",\"htmlPath\":\"\",\"handoffPath\":\"\"}\n\n业务意图：\n${intent}`;
    case "prototype":
      return `${deliveryPolicy}\n\n需求分析已确认本任务包含 UI 变化，建议原型模式为 ${prototype?.mode || "existing-change"}。当前任务 ID：${taskId || "unknown"}。\n\n本阶段的产物目录固定为 ~/.aiNativeDevPlatform/sessions/${taskId || "unknown"}/，不得写入其他目录。请根据自治等级决定是否询问用户确认原型模式；若必须确认，请用 ask_user_question。然后生成 index.html、原型交接.md，并写入 prototype.json：\n{\"mode\":\"用户确认后的 new-page 或 existing-change\",\"status\":\"reviewing\",\"htmlPath\":\"${prototype?.htmlPath || "index.html"}\",\"handoffPath\":\"${prototype?.handoffPath || "原型交接.md"}\"}\n\n业务意图：${intent}`;
    case "plan":
      return `${deliveryPolicy}\n\n基于意图分析结果，请拆解功能模块、分析依赖关系、评估风险，并建议本轮交付范围，生成对应的技术方案文档。技术方案必须明确黑盒验证入口、测试数据、接口契约和失败修复策略。${prototype?.handoffPath ? `\n\n原型已确认，请读取 ~/.aiNativeDevPlatform/sessions/${taskId || "unknown"}/${prototype.handoffPath} 并遵守其中的确认范围和交互约束。` : ""}\n\n业务意图：${intent}`;
    case "coding":
      return `${deliveryPolicy}\n\n基于技术方案设计，生成可运行的代码骨架。编码完成后必须说明建议执行的构建、API、Web 和业务场景验证命令。${prototype?.handoffPath ? `\n\n编码前必须读取 ~/.aiNativeDevPlatform/sessions/${taskId || "unknown"}/${prototype.handoffPath} 和 ~/.aiNativeDevPlatform/sessions/${taskId || "unknown"}/${prototype.htmlPath}。原型用于表达已确认的交互，不得直接复制其 HTML。` : ""}\n\n业务意图：${intent}`;
    case "quality":
      return `${deliveryPolicy}\n\n请执行代码检视、检查测试覆盖率，运行可用的质量门禁，并输出质量报告。报告必须区分代码质量问题、测试缺口、业务验证缺口和交付风险。`;
    case "verify":
      return `${deliveryPolicy}\n\n请根据验证范围执行系统级黑盒验证：Web 页面、API 合约、核心业务场景、异常恢复和必要的冒烟测试。若失败且允许自动修复，请修复并复测；否则输出失败证据、根因和修复建议。`;
    case "release":
      return `${deliveryPolicy}\n\n请汇总所有产出文件，生成变更摘要、CHANGELOG.md 和 DELIVERY.md。DELIVERY.md 必须包含已执行验证、通过/失败证据、未覆盖风险、回退方案和建议后续动作。`;
    default:
      return `继续当前任务。`;
  }
}
