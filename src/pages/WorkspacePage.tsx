import { useEffect, useMemo, useRef, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStoredState } from "../hooks/useStoredState";
import { useAgent } from "../agent";
import { titleFromIntent, formatTime, workflow } from "../data";
import type { DrawerContent } from "../data/types";
import type { ConnectionStatus } from "../agent/types";

import {
  Wifi,
  WifiOff,
  Loader2,
  SignalLow,
  SignalMedium,
  SignalHigh,
} from "lucide-react";

import { SopNav } from "../components/SopNav";
import { LeftPanel } from "../components/LeftPanel";
import { DecisionBoard } from "../components/DecisionBoard";
import { Drawer } from "../components/Drawer";

/**
 * 工作空间路由页 —— "/workspace"
 * 包含 SOP 导航、左侧面板、决策台、抽屉预览。
 */
export function WorkspacePage() {
  const navigate = useNavigate();
  const [state, setState] = useStoredState();
  const [drawerContent, setDrawerContent] = useState<DrawerContent>(null);

  // 如果状态中没有 workspacePath 或者不在 workspace 状态，跳回首页
  useEffect(() => {
    if (!state.workspacePath) {
      navigate("/");
    }
  }, [state.workspacePath, navigate]);

  const taskId = useMemo(() => {
    if (state.createdAt) {
      return `task-${new Date(state.createdAt).getTime()}`;
    }
    return null;
  }, [state.createdAt]);

  const agent = useAgent(taskId);
  const isAgentConnected = agent.connectionStatus === "connected";
  const connectionStatus = agent.connectionStatus;
  const connectionQuality = agent.connectionQuality;

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
      state.intent
    ) {
      sessionInitRef.current = true;
      const intentPrompt = `请分析以下业务意图，识别核心业务对象、角色和场景：\n\n${state.intent}`;
      patchState({
        initialPrompts: { ...state.initialPrompts, intent: intentPrompt },
      });
      agent.createSession("intent", state.intent, state.workspacePath).then(() => {
        agent.prompt("intent", intentPrompt);
        agent.getFileTree();
      });
    }
  }, [isAgentConnected, state.stepIndex, state.intent, state.initialPrompts, patchState]);

  const continueTask = useCallback(() => {
    const nextIndex = Math.min(state.stepIndex + 1, workflow.length - 1);
    const currentStep = workflow[state.stepIndex];
    const nextStep = workflow[nextIndex];

    if (isAgentConnected) {
      const promptText = getStepPrompt(
        nextStep.id,
        state.intent,
        state.scope,
        state.selectedModules,
      );
      // 保存初始提示词，供重试时复用
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
  }, [state.stepIndex, state.intent, state.scope, state.selectedModules, state.initialPrompts, isAgentConnected, agent, patchState, state.codeConfirmed]);

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
    navigate("/");
  }, [patchState, navigate]);

  return (
    <main className="workspace-shell">
      {/* Topbar 信息条 */}
      <div className="workspace-infobar">
        <div className="infobar-left">
          <button className="ghost-button" type="button" onClick={goHome}>
            ← 新任务
          </button>
          <div className="workspace-title">
            <span>CS-2026-0518 · {formatTime(state.createdAt)}</span>
            <strong>{taskTitle}</strong>
          </div>
        </div>
        <div className="infobar-right">
          <AgentStatusBadge status={connectionStatus} quality={connectionQuality} />
        </div>
      </div>

      {/* 顶部横置 SOP 导航 */}
      <SopNav
        workflow={workflow}
        stepIndex={state.stepIndex}
        progress={progress}
        onStepClick={handleStepClick}
      />

      {/* Agent 未连接 / 连接中 / 重连中 */}
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
                  ← 返回首页
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* 主内容区：左侧面板 + 决策台 */}
          <div className="workspace-grid">
            <LeftPanel
              activeTaskCard={state.activeTaskCard}
              stepIndex={state.stepIndex}
              onFileClick={handleFileClick}
              onBackToTasks={goHome}
              agentFileTree={agent.fileTree}
              isAgentConnected={isAgentConnected}
            />
            <DecisionBoard
              state={state}
              onPatch={patchState}
              onContinue={continueTask}
              onPreview={openDrawer}
              agentSessions={agent.sessions}
              agentSteer={agent.steer}
              agentPrompt={agent.prompt}
              agentAnswerQuestion={agent.answerQuestion}
              agentRetry={agent.retrySession}
              isAgentConnected={isAgentConnected}
            />
          </div>

          {/* 右侧抽屉 */}
          <Drawer content={drawerContent} onClose={closeDrawer} />
        </>
      )}
    </main>
  );
}

// ── Agent 连接状态徽章 ──────────────────────

function AgentStatusBadge({
  status,
  quality,
}: {
  status: ConnectionStatus;
  quality: { latency: number; reconnectAttempt: number };
}) {
  const latencyMs = quality.latency;
  const latencyLabel =
    latencyMs <= 0
      ? null
      : latencyMs < 100
        ? `${latencyMs}ms`
        : `${Math.round(latencyMs / 100) / 10}s`;

  const LatencyIcon =
    !latencyMs || latencyMs <= 0
      ? SignalLow
      : latencyMs < 150
        ? SignalHigh
        : SignalMedium;

  return (
    <div className={`agent-status-badge ${status}`}>
      {status === "connected" ? (
        <>
          <Wifi size={13} />
          <span>Agent 已连接</span>
          {latencyLabel && (
            <span className="agent-latency">
              <LatencyIcon size={11} />
              {latencyLabel}
            </span>
          )}
        </>
      ) : status === "connecting" ? (
        <>
          <Loader2 size={13} className="agent-spin" />
          <span>连接中...</span>
        </>
      ) : status === "reconnecting" ? (
        <>
          <Loader2 size={13} className="agent-spin" />
          <span>重连 {quality.reconnectAttempt}...</span>
        </>
      ) : (
        <>
          <WifiOff size={13} />
          <span className="agent-disconnected-text">Agent 未连接</span>
        </>
      )}
    </div>
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
      return `请分析以下业务意图，识别核心业务对象、角色和场景：\n\n${intent}`;
    case "scope":
      return `基于意图分析结果，请拆解功能模块、分析依赖关系、评估风险，并建议本轮交付范围。\n\n业务意图：${intent}`;
    case "coding":
      return `基于技术方案设计，生成可运行的代码骨架，包括类型定义、API 服务层、页面组件和路由配置。\n\n业务意图：${intent}`;
    case "build":
      return `基于 Spec 基线，实现页面组件和 mock 数据。请阅读 workspace 中的 API 契约和数据模型文件后开始开发。`;
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
