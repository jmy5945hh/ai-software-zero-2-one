import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import type { View, HomeTab, AppState, DrawerContent } from "./data/types";
import { createDefaultState, titleFromIntent, formatTime, workflow } from "./data";
import { useAgent } from "./agent";

import {
  Sparkles,
  Play,
  ListTodo,
  UserCircle,
  Wifi,
  WifiOff,
} from "lucide-react";

import { HomeTaskBoard } from "./components/HomeTaskBoard";
import { TypewriterText } from "./components/TypewriterText";
import { SopNav } from "./components/SopNav";
import { LeftPanel } from "./components/LeftPanel";
import { DecisionBoard } from "./components/DecisionBoard";
import { Drawer } from "./components/Drawer";
import { WorkspaceSelector } from "./components/WorkspaceSelector";

const STORAGE_KEY = "zero-one-software.prototype.v4";

/**
 * 顶层应用组件 —— 路由 home / workspace 两个视图。
 * 仅通过 Agent WebSocket 连接驱动，无静态 Demo 模式。
 */
export function App() {
  const [state, setState] = useStoredState();
  const [drawerContent, setDrawerContent] = useState<DrawerContent>(null);
  const [showWorkspacePicker, setShowWorkspacePicker] = useState(false);

  // ── Agent 集成 ──
  const taskId = useMemo(() => {
    if ((state.view === "workspace" || showWorkspacePicker) && state.createdAt) {
      return `task-${new Date(state.createdAt).getTime()}`;
    }
    return null;
  }, [state.view, state.createdAt, showWorkspacePicker]);

  const agent = useAgent(taskId);
  const isAgentConnected = agent.connectionStatus === "connected";

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
    (patch: Partial<AppState>) =>
      setState((previous) => ({ ...previous, ...patch })),
    [setState],
  );

  const openDrawer = useCallback(
    (content: DrawerContent) => setDrawerContent(content),
    [],
  );
  const closeDrawer = useCallback(() => setDrawerContent(null), []);

  // ── 开始任务流程：先选工作空间，再进入 workspace ──
  const requestStartTask = useCallback(
    (intent: string, notes: string, activeTaskCard: AppState["activeTaskCard"]) => {
      setState((previous) => ({
        ...createDefaultState(),
        intent,
        notes,
        activeTaskCard,
        view: "home", // 暂不切换
        createdAt: new Date().toISOString(),
      }));
      setShowWorkspacePicker(true);
    },
    [setState],
  );

  const confirmWorkspace = useCallback(
    (path: string) => {
      setState((previous) => ({
        ...previous,
        workspacePath: path,
        view: "workspace",
      }));
      setShowWorkspacePicker(false);
      window.scrollTo({ top: 0 });
    },
    [setState],
  );

  const cancelWorkspacePicker = useCallback(() => {
    setShowWorkspacePicker(false);
    // 回到干净的首页状态
    setState((previous) => ({
      ...previous,
      intent: "",
      notes: "",
      activeTaskCard: null,
      createdAt: new Date().toISOString(),
    }));
  }, [setState]);

  if (state.view === "home") {
    return (
      <>
        <HomeView
          state={state}
          onPatch={patchState}
          setState={setState}
          agentConnected={isAgentConnected}
          onRequestStartTask={requestStartTask}
        />
        {showWorkspacePicker && (
          <WorkspaceSelector
            onConfirm={confirmWorkspace}
            onCancel={cancelWorkspacePicker}
            onBrowse={isAgentConnected ? agent.browseDir : undefined}
            initialPath={state.workspacePath || "~"}
          />
        )}
      </>
    );
  }

  return (
    <WorkspaceView
      state={state}
      taskTitle={taskTitle}
      progress={progress}
      onPatch={patchState}
      setState={setState}
      onPreview={openDrawer}
      drawerContent={drawerContent}
      onCloseDrawer={closeDrawer}
      agent={agent}
      isAgentConnected={isAgentConnected}
      connectionStatus={agent.connectionStatus}
    />
  );
}

// ── Home 视图 ───────────────────────────────

function HomeView({
  state,
  onPatch,
  setState,
  agentConnected,
  onRequestStartTask,
}: {
  state: AppState;
  onPatch: (patch: Partial<AppState>) => void;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  agentConnected: boolean;
  onRequestStartTask: (intent: string, notes: string, activeTaskCard: AppState["activeTaskCard"]) => void;
}) {
  const updateHomeTab = (tab: HomeTab) =>
    onPatch({ homeTab: tab, previewTaskId: null });

  const startTaskFromIntent = () => {
    if (!state.intent.trim()) return;
    onRequestStartTask(state.intent.trim(), state.notes, null);
  };

  return (
    <main className="home-shell">
      <header className="home-nav">
        <div className="brand">
          <div className="brand-mark">
            <Sparkles size={18} />
          </div>
          <div>
            <strong>AI原生研发平台</strong>
          </div>
        </div>
        <div className="home-nav-right">
          <div className="home-user-info">
            <UserCircle size={18} />
            <div>
              <strong>景梦园</strong>
              <span>80123456</span>
            </div>
          </div>
        </div>
      </header>

      <section className="home-hero">
        <div className="home-copy">
          <h1>
            <TypewriterText
              text="创意需求 👉 可运行软件"
              speed={90}
              startDelay={500}
              showCursor
            />
          </h1>
          <p>没关系, 就让我们从"一句话需求"开始</p>
        </div>

        <div className="home-tabs">
          <button
            className={`home-tab ${state.homeTab === "tasks" ? "active" : ""}`}
            type="button"
            onClick={() => updateHomeTab("tasks")}
          >
            <ListTodo size={18} />
            任务交付
          </button>
          <button
            className={`home-tab ${state.homeTab === "build" ? "active" : ""}`}
            type="button"
            onClick={() => updateHomeTab("build")}
          >
            <Sparkles size={18} />
            想法实现
          </button>
        </div>

        {state.homeTab === "tasks" ? (
          <HomeTaskBoard state={state} setState={setState} onPatch={onPatch} onRequestStartTask={onRequestStartTask} />
        ) : (
          <div className="launch-panel">
            <label htmlFor="intent">Hi, 今天想创造点什么？</label>
            <textarea
              id="intent"
              value={state.intent}
              onChange={(event) => onPatch({ intent: event.target.value })}
              rows={4}
            />
            <div className="launch-actions">
              <button
                className="primary-action"
                type="button"
                onClick={startTaskFromIntent}
              >
                <Play size={17} />
                开始
              </button>
              <span>状态会自动保存到浏览器 storage</span>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

// ── Workspace 视图 ──────────────────────────

function WorkspaceView({
  state,
  taskTitle,
  progress,
  onPatch,
  setState,
  onPreview,
  drawerContent,
  onCloseDrawer,
  agent,
  isAgentConnected,
  connectionStatus,
}: {
  state: AppState;
  taskTitle: string;
  progress: number;
  onPatch: (patch: Partial<AppState>) => void;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  onPreview: (content: DrawerContent) => void;
  drawerContent: DrawerContent;
  onCloseDrawer: () => void;
  agent: ReturnType<typeof useAgent>;
  isAgentConnected: boolean;
  connectionStatus: string;
}) {
  // ── Agent session 生命周期：进入 workspace 时自动创建 intent session ──
  const sessionInitRef = useRef(false);
  useEffect(() => {
    if (
      isAgentConnected &&
      state.stepIndex === 0 &&
      !sessionInitRef.current &&
      state.intent
    ) {
      sessionInitRef.current = true;
      agent.createSession("intent", state.intent, state.workspacePath).then(() => {
        // 发送意图分析 prompt
        agent.prompt(
          "intent",
          `请分析以下业务意图，识别核心业务对象、角色和场景：\n\n${state.intent}`,
        );
        // 刷新文件树
        agent.getFileTree();
      });
    }
  }, [isAgentConnected, state.stepIndex, state.intent]);

  const continueTask = useCallback(() => {
    const nextIndex = Math.min(state.stepIndex + 1, workflow.length - 1);
    const currentStep = workflow[state.stepIndex];
    const nextStep = workflow[nextIndex];

    // Agent 模式：创建下一步 session（旧 session 由 SessionPool 管理）
    if (isAgentConnected) {
      agent.createSession(nextStep.id, state.intent, state.workspacePath).then(() => {
        const promptText = getStepPrompt(
          nextStep.id,
          state.intent,
          state.scope,
          state.selectedModules,
        );
        agent.prompt(nextStep.id, promptText);
        // 刷新文件树
        agent.getFileTree();
      });
    }

    onPatch({
      stepIndex: nextIndex,
      activeStage: nextStep.id,
      specConfirmed: state.specConfirmed || state.stepIndex >= 2,
    });
    window.scrollTo({ top: 0 });
  }, [state.stepIndex, isAgentConnected, agent, onPatch, state.intent, state.scope, state.selectedModules, state.specConfirmed]);

  const handleStepClick = (index: number) => {
    onPatch({
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
        onPreview({
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
    [isAgentConnected, agent, onPreview],
  );

  return (
    <main className="workspace-shell">
      {/* Topbar 信息条 */}
      <div className="workspace-infobar">
        <div className="infobar-left">
          <button
            className="ghost-button"
            type="button"
            onClick={() =>
              setState((prev) => ({ ...prev, view: "home" }))
            }
          >
            ← 新任务
          </button>
          <div className="workspace-title">
            <span>CS-2026-0518 · {formatTime(state.createdAt)}</span>
            <strong>{taskTitle}</strong>
          </div>
        </div>
        <div className="infobar-right">
          <AgentStatusBadge connected={isAgentConnected} />
        </div>
      </div>

      {/* 顶部横置 SOP 导航 */}
      <SopNav
        workflow={workflow}
        stepIndex={state.stepIndex}
        progress={progress}
        onStepClick={handleStepClick}
      />

      {/* Agent 未连接 / 连接中 */}
      {!isAgentConnected && (
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
            ) : (
              <>
                <WifiOff size={32} />
                <h2>Agent 未连接</h2>
                <p>请启动 Agent Server 并配置 API Key 后刷新页面</p>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() =>
                    setState((prev) => ({ ...prev, view: "home" }))
                  }
                >
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
              onBackToTasks={() =>
                setState((prev) => ({ ...prev, view: "home" }))
              }
              agentFileTree={agent.fileTree}
              isAgentConnected={isAgentConnected}
            />

            <DecisionBoard
              state={state}
              onPatch={onPatch}
              onContinue={continueTask}
              onPreview={onPreview}
              agentSessions={agent.sessions}
              agentSteer={agent.steer}
              agentPrompt={agent.prompt}
              isAgentConnected={isAgentConnected}
            />
          </div>

          {/* 右侧抽屉 */}
          <Drawer content={drawerContent} onClose={onCloseDrawer} />
        </>
      )}
    </main>
  );
}

// ── Agent 连接状态徽章（始终显示于右上角） ──
function AgentStatusBadge({ connected }: { connected: boolean }) {
  return (
    <div className={`agent-status-badge ${connected ? "connected" : "disconnected"}`}>
      {connected ? (
        <>
          <Wifi size={13} />
          <span>Agent 已连接</span>
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

// ── 状态持久化 ──────────────────────────────

function useStoredState() {
  const [state, setState] = useState<AppState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved
        ? { ...createDefaultState(), ...JSON.parse(saved) }
        : createDefaultState();
    } catch {
      return createDefaultState();
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage full, ignore
    }
  }, [state]);

  return [state, setState] as const;
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

/** 获取每步的 agent prompt */
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
    case "spec":
      return `基于范围定义，请生成数据模型、页面地图、API 契约和权限模型。\n\n业务意图：${intent}\n交付模式：${scope}\n选定模块：${selectedModules.join("、")}`;
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
