import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStoredState, STORAGE_KEY } from "../hooks/useStoredState";
import { createDefaultState } from "../data";
import type { AppState, HomeTab } from "../data/types";
import { useSessionRecords } from "../hooks/useSessionRecords";
import type { SessionMeta, SessionRecord } from "../hooks/useSessionRecords";

import {
  Sparkles,
  Play,
  ListTodo,
  UserCircle,
  FileText,
  History,
  Monitor,
  Cloud,
  Check,
  SignalHigh,
  SignalMedium,
  Loader2,
  AlertTriangle,
} from "lucide-react";

import { HomeTaskBoard } from "../components/HomeTaskBoard";
import { TypewriterText } from "../components/TypewriterText";
import { WorkspaceSelector } from "../components/WorkspaceSelector";
import { SessionHistoryPanel } from "../components/SessionHistoryPanel";
import { useAgent } from "../agent";
import { generateId } from "../utils/id";
import { useRuntimeState, useRuntimeActions } from "../stores/runtimeStore";

/**
 * 控制台页 —— "/dashboard"
 * 任务看板 / 想法输入 / 工作空间选择 / 历史会话 + Agent 运行时连接状态。
 */
export function DashboardPage() {
  const navigate = useNavigate();
  const [state, setState] = useStoredState();
  const [showWorkspacePicker, setShowWorkspacePicker] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [preflightError, setPreflightError] = useState<string | null>(null);
  const sessionRecords = useSessionRecords();

  const [pendingRecord, setPendingRecord] = useState<SessionRecord | null>(null);

  const runtimeState = useRuntimeState();
  const runtimeActions = useRuntimeActions();

  // 使用 state.sessionId 作为 taskId，确保与后续 TaskPage 中的 taskId 一致
  const taskIdForPicker = showWorkspacePicker && state.createdAt
    ? state.sessionId
    : null;
  const agent = useAgent(taskIdForPicker, undefined, undefined, runtimeState.mode);
  const agentAvailable = agent.connectionStatus === "connected" || agent.connectionStatus === "reconnecting";

  const patchState = useCallback(
    (patch: Partial<AppState>) =>
      setState((previous) => ({ ...previous, ...patch })),
    [setState],
  );

  // ── Dashboard 级别的模式选择（用于想法实现区域） ──
  const [dashboardMode, setDashboardMode] = useState<"local" | "cloud">(runtimeState.mode);

  const requestStartTask = useCallback(
    (intent: string, notes: string, activeTaskCard: AppState["activeTaskCard"]) => {
      setDocsError(null);
      const sessionId = generateId();
      setState((previous) => ({
        ...createDefaultState(),
        intent,
        notes,
        activeTaskCard,
        createdAt: new Date().toISOString(),
        sessionId,
        runtimeMode: dashboardMode,
      }));
      setShowWorkspacePicker(true);
    },
    [setState, dashboardMode],
  );

  const confirmWorkspace = useCallback(
    async (path: string, mode: "local" | "cloud", gitConfig?: { branch: string; shouldPull: boolean }) => {
      setDocsError(null);
      setPreflightError(null);
      const isCloud = mode === "cloud";

      // 同步 runtimeMode 到全局 store（用于连接器等）
      if (mode !== runtimeState.mode) {
        runtimeActions.switchMode(mode);
      }

      if (isCloud) {
        // 云端模式：path 格式为 "url#branch"，解析为 gitRepo 配置
        const hashIndex = path.lastIndexOf("#");
        const url = hashIndex > 0 ? path.slice(0, hashIndex) : path;
        const branch = hashIndex > 0 ? path.slice(hashIndex + 1) : "main";
        const gitRepoConfig = { url, branch };

        setState((previous) => ({
          ...previous,
          workspacePath: "",
          gitRepo: gitRepoConfig,
          view: "workspace",
        }));
        setShowWorkspacePicker(false);

        // 持久化到 localStorage
        try {
          const currentState = JSON.parse(
            localStorage.getItem(STORAGE_KEY) || "{}"
          );
          localStorage.setItem(STORAGE_KEY, JSON.stringify({
            ...currentState,
            gitRepo: gitRepoConfig,
            workspacePath: "",
            view: "workspace",
            runtimeMode: mode,
          }));
        } catch (err) {
          console.warn("[DashboardPage] Failed to persist cloud workspace:", err);
        }

        // 初始化任务环境（HTTP 接口，不依赖 WebSocket 连接）
        agent.initTask({
          intent: state.intent,
          workspacePath: "",
          runtimeMode: mode,
          notes: state.notes,
          todoAnswers: state.todoAnswers,
          initialPrompts: state.initialPrompts,
          gitRepo: gitRepoConfig,
        }).catch((err: Error) => console.warn("[DashboardPage] task.init failed:", err));

        navigate(`/task?taskId=${state.sessionId}`);
        return;
      }

      // 本地模式：Git preflight（checkout + pull）
      if (gitConfig) {
        try {
          const result = await agent.gitPreflight(path, gitConfig.branch, gitConfig.shouldPull);
          if (!result.success) {
            setPreflightError(result.error || "Git 操作失败");
            setShowWorkspacePicker(false);
            return;
          }
        } catch (err) {
          setPreflightError(err instanceof Error ? err.message : "Git 操作异常");
          setShowWorkspacePicker(false);
          return;
        }
      }

      // 本地模式：path 为本地目录路径
      setState((previous) => ({
        ...previous,
        workspacePath: path,
        localGit: gitConfig ? { branch: gitConfig.branch, shouldPull: gitConfig.shouldPull } : undefined,
        view: "workspace",
      }));
      setShowWorkspacePicker(false);
      try {
        const currentState = JSON.parse(
          localStorage.getItem(STORAGE_KEY) || "{}"
        );
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          ...currentState,
          workspacePath: path,
          localGit: gitConfig ? { branch: gitConfig.branch, shouldPull: gitConfig.shouldPull } : undefined,
          view: "workspace",
          runtimeMode: mode,
        }));
      } catch (err) {
        console.warn("[DashboardPage] Failed to persist local workspace:", err);
      }

      // 初始化任务环境（HTTP 接口，不依赖 WebSocket 连接）
      agent.initTask({
        intent: state.intent,
        workspacePath: path,
        runtimeMode: mode,
        notes: state.notes,
        todoAnswers: state.todoAnswers,
        initialPrompts: state.initialPrompts,
      }).catch((err: Error) => console.warn("[DashboardPage] task.init failed:", err));

      navigate(`/task?taskId=${state.sessionId}`);
    },
    [setState, navigate, state, agentAvailable, agent, runtimeState.mode, runtimeActions],
  );

  const cancelWorkspacePicker = useCallback(() => {
    setShowWorkspacePicker(false);
    setDocsError(null);
    setState((previous) => ({
      ...previous,
      intent: "",
      notes: "",
      activeTaskCard: null,
      createdAt: new Date().toISOString(),
    }));
  }, [setState]);

  const updateHomeTab = (tab: HomeTab) =>
    patchState({ homeTab: tab, previewTaskId: null });

  const handleContinueFromHistory = useCallback(
    async (record: SessionMeta, followUpPrompt?: string) => {
      const loaded = await sessionRecords.loadRecord(record.sessionId);
      const fullRecord: SessionRecord = loaded || {
        ...record,
        stepSessions: {},
      };

      // 历史恢复时先切换运行时模式，再进入任务页
      const targetMode = fullRecord.runtimeMode || "local";
      if (targetMode !== runtimeState.mode) {
        await runtimeActions.switchMode(targetMode);
      }

      const nextState: Partial<AppState> = {
        intent: followUpPrompt
          ? `${fullRecord.intent}\n\n--- 补充需求 ---\n${followUpPrompt}`
          : fullRecord.intent,
        workspacePath: fullRecord.workspacePath,
        runtimeMode: fullRecord.runtimeMode || "local",
        gitRepo: (fullRecord as any).gitRepo,
        stepIndex: fullRecord.stepIndex,
        activeStage: fullRecord.activeStage as AppState["activeStage"],
        notes: fullRecord.notes,
        todoAnswers: fullRecord.todoAnswers,
        initialPrompts: fullRecord.initialPrompts,
        codeConfirmed: fullRecord.codeConfirmed,
        fixApproved: fullRecord.fixApproved,
        releaseApproved: fullRecord.releaseApproved,
        qualityPassed: fullRecord.qualityPassed,
        createdAt: fullRecord.createdAt,
        sessionId: fullRecord.sessionId,
        restoredSessions: fullRecord.stepSessions || {},
        view: "workspace",
      };
      setState((previous) => ({ ...previous, ...nextState }));
      // 同步写入 localStorage，确保 TaskPage 挂载时能读到最新状态
      try {
        const key = "zero-one-software.prototype.v4";
        const existing = JSON.parse(localStorage.getItem(key) || "{}");
        localStorage.setItem(key, JSON.stringify({ ...existing, ...nextState }));
      } catch { /* ignore */ }
      navigate(`/task?taskId=${fullRecord.sessionId}`);
    },
    [setState, navigate, sessionRecords, runtimeState.mode, runtimeActions],
  );

  const startTaskFromIntent = () => {
    if (!state.intent.trim()) return;
    requestStartTask(state.intent.trim(), state.notes, null);
  };

  return (
    <>
      <main className="home-shell">
        <header className="home-nav">
          <div className="brand" style={{ cursor: "pointer" }} onClick={() => navigate("/")}>
            <div className="brand-mark">
              <Sparkles size={18} />
            </div>
            <div>
              <strong>AI原生研发平台</strong>
            </div>
          </div>
          <div className="home-nav-right">
            {/* Agent 运行时状态徽章 — 双端点 */}
            <div className="dual-endpoint-status">
              <EndpointBadge
                label="本地"
                icon={<Monitor size={12} />}
                status={runtimeState.localEndpoint.connectionStatus}
                latency={runtimeState.localEndpoint.latency}
                disconnectedLabel="待启动"
              />
              <EndpointBadge
                label="云端"
                icon={<Cloud size={12} />}
                status={runtimeState.cloudEndpoint.connectionStatus}
                latency={runtimeState.cloudEndpoint.latency}
                disconnectedLabel="无信号"
              />
            </div>
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
          <aside className="home-sidebar">
            <nav className="home-tabs">
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
              <button
                className={`home-tab ${state.homeTab === "history" ? "active" : ""}`}
                type="button"
                onClick={() => updateHomeTab("history")}
              >
                <History size={18} />
                历史会话
              </button>
            </nav>
          </aside>

          <div className="home-content">
            {state.homeTab === "tasks" ? (
              <HomeTaskBoard state={state} setState={setState} onPatch={patchState} onRequestStartTask={requestStartTask} onBrowseDir={agentAvailable ? agent.browseDir : undefined} />
            ) : state.homeTab === "build" ? (
              <div className="launch-panel">
                <label htmlFor="intent">Hi, 今天想创造点什么？</label>
                <div className="launch-panel-mode-row">
                  <div className="dashboard-mode-switcher">
                    <button
                      className={`dashboard-mode-btn ${dashboardMode === "local" ? "active" : ""}`}
                      type="button"
                      onClick={() => setDashboardMode("local")}
                    >
                      <Monitor size={13} />
                      本地
                      {dashboardMode === "local" && <Check size={11} className="dashboard-mode-check" />}
                    </button>
                    <button
                      className={`dashboard-mode-btn ${dashboardMode === "cloud" ? "active" : ""}`}
                      type="button"
                      onClick={() => setDashboardMode("cloud")}
                    >
                      <Cloud size={13} />
                      云端
                      {dashboardMode === "cloud" && <Check size={11} className="dashboard-mode-check" />}
                    </button>
                  </div>
                </div>
                <textarea
                  id="intent"
                  value={state.intent}
                  onChange={(event) => patchState({ intent: event.target.value })}
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
            ) : (
              <SessionHistoryPanel
                records={sessionRecords.records}
                loading={sessionRecords.loading}
                onContinue={handleContinueFromHistory}
                onDelete={sessionRecords.deleteRecord}
                onRefresh={sessionRecords.refreshRecords}
              />
            )}
          </div>
        </section>
      </main>

      {showWorkspacePicker && (
        <>
          {docsError && (
            <div className="docs-error-toast">
              <div className="docs-error-toast-content">
                <FileText size={16} />
                <div>
                  <strong>文档读取失败</strong>
                  <p>{docsError}</p>
                </div>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => setDocsError(null)}
                >
                  关闭
                </button>
              </div>
            </div>
          )}
          <WorkspaceSelector
            onConfirm={confirmWorkspace}
            onCancel={cancelWorkspacePicker}
            onBrowse={(dirPath, browseMode) => agent.browseDirForMode(dirPath, browseMode)}
            onListBranches={(dirPath) => agent.listGitBranches(dirPath)}
            initialPath={state.workspacePath || "~"}
            mode={state.runtimeMode || dashboardMode}
          />
        </>
      )}

      {/* Preflight 错误提示 */}
      {preflightError && (
        <div className="preflight-error-toast">
          <div className="preflight-error-toast-content">
            <AlertTriangle size={16} />
            <div>
              <strong>Git 操作失败</strong>
              <p>{preflightError}</p>
            </div>
            <button
              className="ghost-button"
              type="button"
              onClick={() => setPreflightError(null)}
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── 端点状态徽章子组件 ──────────────────────

function EndpointBadge({
  label,
  icon,
  status,
  latency,
  disconnectedLabel,
}: {
  label: string;
  icon: React.ReactNode;
  status: string;
  latency: number;
  disconnectedLabel: string;
}) {
  return (
    <div className={`dual-endpoint-badge ${status}`}>
      <span className="endpoint-icon">{icon}</span>
      <span className="endpoint-label">{label}</span>
      {status === "connected" ? (
        <>
          <span className="endpoint-status-dot connected" />
          <span className="endpoint-status-text">已连接</span>
          {latency > 0 && (
            <span className="endpoint-latency">
              {latency < 150 ? <SignalHigh size={10} /> : <SignalMedium size={10} />}
              {latency < 100 ? `${latency}ms` : `${(latency / 1000).toFixed(1)}s`}
            </span>
          )}
        </>
      ) : status === "connecting" ? (
        <>
          <Loader2 size={10} className="agent-spin" />
          <span className="endpoint-status-text">连接中</span>
        </>
      ) : status === "error" ? (
        <>
          <span className="endpoint-status-dot error" />
          <span className="endpoint-status-text">{disconnectedLabel}</span>
        </>
      ) : (
        <>
          <span className="endpoint-status-dot disconnected" />
          <span className="endpoint-status-text">{disconnectedLabel}</span>
        </>
      )}
    </div>
  );
}
