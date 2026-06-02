import { useEffect, useMemo, useRef, useCallback, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useStoredState } from "../hooks/useStoredState";
import { useAgent } from "../agent";
import { titleFromIntent, workflow } from "../data";

import type { DrawerContent, AppState } from "../data/types";
import type { ConnectionStatus } from "../agent/types";
import { useSessionRecords } from "../hooks/useSessionRecords";

import { WifiOff } from "lucide-react";

import { SopNav } from "../components/SopNav";
import { LeftPanel } from "../components/LeftPanel";
import { DecisionBoard } from "../components/DecisionBoard";
import { Drawer } from "../components/Drawer";
import { AgentStatusBadge } from "../components/AgentStatusBadge";

/**
 * 任务执行页 —— "/task"
 * SOP 导航 / 左侧面板 / 决策台 / 抽屉预览。
 */
export function TaskPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [state, setState] = useStoredState();
  const [drawerContent, setDrawerContent] = useState<DrawerContent>(null);
  const [repoExplorerOpen, setRepoExplorerOpen] = useState(false);

  // ── URL sessionId 恢复 ──
  // 如果 URL 携带 sessionId 且与 localStorage 中的不一致，说明是刷新后首次加载，
  // 需要从服务端加载会话记录并恢复到 AppState
  const urlSessionId = searchParams.get("sessionId");
  const restoreAttemptedRef = useRef(false);

  useEffect(() => {
    // 仅执行一次：URL 有 sessionId，且尚未尝试恢复
    if (!urlSessionId || restoreAttemptedRef.current) return;
    restoreAttemptedRef.current = true;

    // 如果 localStorage 中的 sessionId 与 URL 一致，说明状态已就绪，无需恢复
    if (state.sessionId === urlSessionId && state.workspacePath) {
      return;
    }

    // 从服务端加载会话记录
    sessionRecords.loadRecord(urlSessionId).then((record) => {
      if (!record) return;

      setState((previous) => ({
        ...previous,
        intent: record.intent,
        workspacePath: record.workspacePath,
        stepIndex: record.stepIndex,
        activeStage: record.activeStage as AppState["activeStage"],
        scope: record.scope as AppState["scope"],
        selectedModules: record.selectedModules,
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
        view: "workspace",
      }));
    });
  }, [urlSessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 如果状态中没有 workspacePath 或者不在 workspace 状态，跳回首页
  useEffect(() => {
    // 如果没有 workspacePath 且没有待恢复的 URL sessionId，跳回首页
    if (!state.workspacePath && !urlSessionId) {
      navigate("/");
    }
  }, [state.workspacePath, navigate, urlSessionId]);

  const taskId = useMemo(() => {
    if (state.createdAt) {
      return `task-${new Date(state.createdAt).getTime()}`;
    }
    return null;
  }, [state.createdAt]);

  const agent = useAgent(taskId, state.workspacePath);

  // ── 从历史恢复 session 状态到 agent ──
  // 当 restoredSessions 加载完成后，将各步骤的状态注入 agent sessions，
  // 若 agent 已完成但 summary 未完成，自动触发总结流程
  useEffect(() => {
    if (!agent.restoreSessionState) return;
    for (const [stepId, snapshot] of Object.entries(state.restoredSessions)) {
      agent.restoreSessionState(stepId, snapshot);
    }
  }, [state.restoredSessions]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 会话记录自动保存 ──
  const sessionRecords = useSessionRecords();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCompletedRef = useRef<Record<string, boolean>>({});

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
    state.scope,
    state.selectedModules,
    state.notes,
    state.todoAnswers,
    state.codeConfirmed,
    state.fixApproved,
    state.releaseApproved,
    state.qualityPassed,
    state.workspacePath,
    taskId,
    stepSummaries,
    agent.sessions,
  ]);

  const taskTitle = useMemo(
    () => titleFromIntent(state.intent),
    [state.intent],
  );

  const progress = useMemo(
    () =>
      Math.round(
        ((state.stepIndex + (state.releaseApproved ? 1 : 0)) /
          workflow.length) *
        100,
      ),
    [state.stepIndex, state.releaseApproved],
  );

  const patchState = useCallback(
    (patch: Partial<typeof state>) =>
      setState((previous) => ({ ...previous, ...patch })),
    [setState],
  );

  const openDrawer = useCallback(
    (content: DrawerContent) => setDrawerContent(content),
    [],
  );
  const closeDrawer = useCallback(() => setDrawerContent(null), []);

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

      const intentPrompt = `请分析以下业务意图，识别核心业务对象、角色和场景：\n\n${state.intent}`;
      patchState({
        initialPrompts: { ...state.initialPrompts, intent: intentPrompt },
      });

      const startIntent = async () => {
        await agent.createSession("intent", state.intent, state.workspacePath);
        await agent.prompt("intent", intentPrompt);
        agent.getFileTree();
      };
      startIntent();
    }
  }, [isAgentConnected, state.stepIndex, state.intent, state.initialPrompts, patchState]);

  const continueTask = useCallback(async () => {
    const nextIndex = Math.min(state.stepIndex + 1, workflow.length - 1);
    const nextStep = workflow[nextIndex];

    if (isAgentConnected && taskId) {
      const promptText = getStepPrompt(
        nextStep.id,
        state.intent,
        state.scope,
        state.selectedModules,
      );

      patchState({
        initialPrompts: { ...state.initialPrompts, [nextStep.id]: promptText },
      });
      agent.createSession(nextStep.id, state.intent, state.workspacePath).then(() => {
        agent.prompt(nextStep.id, promptText);
        agent.getFileTree();
      });
    }

    patchState({
      stepIndex: nextIndex,
      activeStage: nextStep.id,
      codeConfirmed: state.codeConfirmed || state.stepIndex >= 2,
    });
    window.scrollTo({ top: 0 });
  }, [state.stepIndex, state.intent, state.scope, state.selectedModules, state.initialPrompts, isAgentConnected, taskId, agent, patchState, state.codeConfirmed]);

  const handleStepClick = (index: number) => {
    patchState({
      stepIndex: index,
      activeStage: workflow[index].id,
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
        workflow={workflow}
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
              repoExplorerOpen={repoExplorerOpen}
              onCloseRepoExplorer={() => setRepoExplorerOpen(false)}
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
              agentPrompt={agent.prompt}
              agentAnswerQuestion={agent.answerQuestion}
              agentContinueQuestion={agent.continueQuestion}
              agentResumeQuestion={agent.resumeQuestion}
              isAgentConnected={isAgentConnected}
              triggerBuild={agent.triggerBuild}
              detectBuildCommand={agent.detectBuildCommand}
              taskId={taskId}
              onOpenRepoExplorer={() => setRepoExplorerOpen(true)}
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
  scope: string,
  selectedModules: string[],
): string {
  switch (step) {
    case "intent":
      return `请分析以下业务意图，识别核心业务对象、角色和场景，并生成Spec 文档：\n\n${intent}`;
    case "plan":
      return `基于意图分析结果，请拆解功能模块、分析依赖关系、评估风险，并建议本轮交付范围，生成对应的技术方案文档。\n\n业务意图：${intent}`;
    case "coding":
      return `基于技术方案设计，生成可运行的代码骨架。\n\n业务意图：${intent}`;
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
