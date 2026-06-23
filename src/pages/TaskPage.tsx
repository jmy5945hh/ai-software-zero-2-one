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
} from "../data";
import { agentFetch } from "../agent/config";

import type { DrawerContent, AppState } from "../data/types";
import type { ConnectionStatus } from "../agent/types";
import { useSessionRecords } from "../hooks/useSessionRecords";

import { WifiOff } from "lucide-react";

import { SopNav } from "../components/SopNav";
import { LeftPanel } from "../components/LeftPanel";
import { DecisionBoard } from "../components/DecisionBoard";
import { Drawer } from "../components/Drawer";
import { AgentStatusBadge } from "../components/AgentStatusBadge";
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
        mode: "none" as const,
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

  const taskWorkflow = useMemo(
    () => getTaskWorkflow(state.prototype),
    [state.prototype],
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
    if (!taskId || !state.workspacePath) return null;
    try {
      const paths = getPrototypeArtifactPaths(taskId);
      const params = new URLSearchParams({
        path: state.workspacePath,
        taskId,
        file: paths.manifestPath,
      });
      const res = await agentFetch(`/specs-file?${params.toString()}`);
      if (!res.ok) return null;
      const data = await res.json() as { content?: string };
      return parsePrototypeManifest(data.content, taskId);
    } catch {
      return null;
    }
  }, [taskId, state.workspacePath]);

  const openDrawer = useCallback(
    (content: DrawerContent) => setDrawerContent(content),
    [],
  );
  const closeDrawer = useCallback(() => setDrawerContent(null), []);

  // ── QA 质量审查：一键修复 ──
  const handleFixQaIssues = useCallback(
    (report: string) => {
      if (!isAgentConnected) return;
      // 先推进到 verify 阶段
      const verifyIndex = taskWorkflow.findIndex((s) => s.id === "verify");
      patchState({
        stepIndex: verifyIndex,
        activeStage: "verify",
      });
      // 创建 verify session 并触发 Agent 执行修复
      const fixPrompt = `请根据以下质量审查报告修复代码中的问题：\n\n${report}`;
      agent.createSession("verify", state.intent, state.workspacePath, state.gitRepo).then(() => {
        agent.prompt("verify", fixPrompt);
      });
    },
    [isAgentConnected, agent, state.intent, state.workspacePath, state.gitRepo, patchState, taskWorkflow],
  );

  // ── Agent session 生命周期 ──
  const sessionInitRef = useRef(false);

  useEffect(() => {
    if (
      isAgentConnected &&
      state.stepIndex === 0 &&
      !sessionInitRef.current &&
      state.intent &&
      Object.keys(state.restoredSessions).length === 0
    ) {
      sessionInitRef.current = true;

      const intentPrompt = getStepPrompt("intent", state.intent, taskId);
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
                  await agent.createSession("intent", state.intent, state.workspacePath, state.gitRepo);
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
        await agent.createSession("intent", state.intent, state.workspacePath, state.gitRepo);
        // 首次 session 创建后立即保存，确保初始状态不丢失
        if (taskId && state.intent) {
          sessionRecords.saveRecord(state, taskId, stepSummaries, agent.sessions, state.restoredSessions);
        }
        await agent.prompt("intent", intentPrompt);
        agent.getFileTree();
      };
      startIntent();
    }
  }, [isAgentConnected, state.stepIndex, state.intent, state.initialPrompts, patchState, state.runtimeMode]);

  // 需求分析完成后读取 UI 变化决策，据此决定任务工作流是否包含交互原型。
  useEffect(() => {
    const intentSession = agent.sessions.intent;
    if (!taskId || !state.workspacePath || !intentSession?.completed) return;
    if (state.prototype.mode !== "none" || state.prototype.status === "skipped") return;

    let cancelled = false;
    void readPrototypeDecision().then((prototype) => {
      if (!cancelled && prototype) patchState({ prototype });
    });
    return () => { cancelled = true; };
  }, [agent.sessions.intent, taskId, state.workspacePath, state.prototype, patchState, readPrototypeDecision]);

  const continueTask = useCallback(async () => {
    let effectivePrototype = state.prototype;
    if (state.activeStage === "intent" && state.prototype.mode === "none" && state.prototype.status === "pending") {
      const decision = await readPrototypeDecision();
      if (!decision) {
        const manifestPath = taskId ? getPrototypeArtifactPaths(taskId).manifestPath : "prototype.json";
        await agent.prompt(
          "intent",
          `需求分析尚未生成工作流决策。请根据当前需求判断是否包含用户可见的 UI 变化，并按初始要求写入 specs/${manifestPath}。`,
        );
        return;
      }
      effectivePrototype = decision;
      patchState({ prototype: decision });
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
            htmlPath: `prototype/${taskId}/index.html`,
            handoffPath: `prototype/${taskId}/原型交接.md`,
          }
        : effectivePrototype;
      const promptText = getStepPrompt(nextStep.id, state.intent, taskId, prototype);

      patchState({
        initialPrompts: { ...state.initialPrompts, [nextStep.id]: promptText },
        ...(nextStep.id === "prototype" ? { prototype } : {}),
      });
      agent.createSession(nextStep.id, state.intent, state.workspacePath, state.gitRepo).then(() => {
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
  }, [state.stepIndex, state.activeStage, state.intent, state.initialPrompts, state.prototype, isAgentConnected, taskId, agent, patchState, state.codeConfirmed, readPrototypeDecision]);

  const handleStepClick = (index: number) => {
    // 已完成阶段可回看；未来阶段必须通过当前阶段的门禁顺序推进。
    if (index > state.stepIndex) return;
    const targetStage = taskWorkflow[index].id;
    patchState({
      stepIndex: index,
      activeStage: targetStage,
      // 点击 quality 阶段且不是当前步骤时重置 QA 审查状态
      ...(targetStage === "quality" && index !== state.stepIndex ? {
        qaReview: {
          status: "idle" as const,
          outputLines: [],
          resultFilePath: "",
          resultContent: "",
        },
      } : {}),
    });
    window.scrollTo({ top: 0 });
  };

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
      <SopNav
        workflow={taskWorkflow}
        stepIndex={state.stepIndex}
        progress={progress}
        onStepClick={handleStepClick}
        goHome={goHome}
        taskTitle={taskTitle}
        createdAt={state.createdAt}
        statusBadge={<AgentStatusBadge status={connectionStatus} quality={connectionQuality} />}
      />

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
              stepSummaries={stepSummaries}
              agentSessions={agent.sessions}
              intent={state.intent}
              workspacePath={state.workspacePath}
              sessionId={state.sessionId}
              runtimeMode={state.runtimeMode}
              repoExplorerOpen={repoExplorerOpen}
              onCloseRepoExplorer={() => setRepoExplorerOpen(null)}
            />
            <DecisionBoard
              state={state}
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

function getStepPrompt(
  step: string,
  intent: string,
  taskId?: string | null,
  prototype?: AppState["prototype"],
): string {
  switch (step) {
    case "intent":
      return `请分析以下业务意图，识别核心业务对象、角色和场景，并生成 Spec 文档。\n\n同时判断本任务是否包含需要用户确认的 UI 页面或交互变化，并将工作流决策写入 specs/prototype/${taskId || "unknown"}/prototype.json。\n\n如果包含 UI 变化，请写入：\n{\"mode\":\"new-page 或 existing-change\",\"status\":\"pending\",\"htmlPath\":\"prototype/${taskId || "unknown"}/index.html\",\"handoffPath\":\"prototype/${taskId || "unknown"}/原型交接.md\"}\n\n如果不包含 UI 变化，请写入：\n{\"mode\":\"none\",\"status\":\"skipped\",\"htmlPath\":\"\",\"handoffPath\":\"\"}\n\n业务意图：\n${intent}`;
    case "prototype":
      return `需求分析已确认本任务包含 UI 变化，建议原型模式为 ${prototype?.mode || "existing-change"}。当前任务 ID：${taskId || "unknown"}。\n\n本阶段的产物目录固定为 specs/prototype/${taskId || "unknown"}/，不得写入其他 prototype 目录。请先用 ask_user_question 让用户确认原型模式（新页面 or 已有页面修改），然后生成 index.html、原型交接.md，并写入 prototype.json：\n{\"mode\":\"用户确认后的 new-page 或 existing-change\",\"status\":\"reviewing\",\"htmlPath\":\"${prototype?.htmlPath || ""}\",\"handoffPath\":\"${prototype?.handoffPath || ""}\"}\n\n业务意图：${intent}`;
    case "plan":
      return `基于意图分析结果，请拆解功能模块、分析依赖关系、评估风险，并建议本轮交付范围，生成对应的技术方案文档。${prototype?.handoffPath ? `\n\n原型已确认，请读取 specs/${prototype.handoffPath} 并遵守其中的确认范围和交互约束。` : ""}\n\n业务意图：${intent}`;
    case "coding":
      return `基于技术方案设计，生成可运行的代码骨架。${prototype?.handoffPath ? `\n\n编码前必须读取 specs/${prototype.handoffPath} 和 specs/${prototype.htmlPath}。原型用于表达已确认的交互，不得直接复制其 HTML。` : ""}\n\n业务意图：${intent}`;
    case "quality":
      return `请执行代码检视、检查测试覆盖率，运行测试并输出质量报告。`;
    case "verify":
      return `请分析质量报告中的未通过项，生成修复方案并执行修复和复测。`;
    case "release":
      return `请汇总所有产出文件，生成变更摘要、CHANGELOG.md 和 DELIVERY.md。`;
    default:
      return `继续当前任务。`;
  }
}
