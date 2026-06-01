import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStoredState } from "../hooks/useStoredState";
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
  Wifi,
  WifiOff,
  Loader2,
  Monitor,
  Cloud,
  SignalHigh,
  SignalMedium,
} from "lucide-react";

import { HomeTaskBoard } from "../components/HomeTaskBoard";
import { TypewriterText } from "../components/TypewriterText";
import { WorkspaceSelector } from "../components/WorkspaceSelector";
import { SessionHistoryPanel } from "../components/SessionHistoryPanel";
import { useAgent } from "../agent";
import { useRuntimeState } from "../stores/runtimeStore";

/**
 * 控制台页 —— "/dashboard"
 * 任务看板 / 想法输入 / 工作空间选择 / 历史会话 + Agent 运行时连接状态。
 */
export function DashboardPage() {
  const navigate = useNavigate();
  const [state, setState] = useStoredState();
  const [showWorkspacePicker, setShowWorkspacePicker] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);
  const sessionRecords = useSessionRecords();

  const [pendingRecord, setPendingRecord] = useState<SessionRecord | null>(null);

  const taskIdForPicker = showWorkspacePicker && state.createdAt
    ? `task-${new Date(state.createdAt).getTime()}`
    : null;
  const agent = useAgent(taskIdForPicker);
  const agentAvailable = agent.connectionStatus === "connected" || agent.connectionStatus === "reconnecting";
  const runtimeState = useRuntimeState();

  const patchState = useCallback(
    (patch: Partial<AppState>) =>
      setState((previous) => ({ ...previous, ...patch })),
    [setState],
  );

  const requestStartTask = useCallback(
    (intent: string, notes: string, activeTaskCard: AppState["activeTaskCard"]) => {
      setDocsError(null);
      const sessionId = Array.from({ length: 32 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join("");
      setState((previous) => ({
        ...createDefaultState(),
        intent,
        notes,
        activeTaskCard,
        createdAt: new Date().toISOString(),
        sessionId,
      }));
      setShowWorkspacePicker(true);
    },
    [setState],
  );

  const confirmWorkspace = useCallback(
    async (path: string) => {
      setDocsError(null);
      const docsPath = state.activeTaskCard?.docs;
      if (docsPath && agentAvailable) {
        try {
          const docsContent = await agent.readFile(docsPath);
          if (!docsContent) {
            setDocsError(`文档文件为空: ${docsPath}`);
            return;
          }
          setState((previous) => ({
            ...previous,
            workspacePath: path,
            intent: `${previous.intent}\n\n--- 需求文档: ${docsPath} ---\n${docsContent}`,
            view: "workspace",
          }));
        } catch (err) {
          const msg = (err as Error).message || "未知错误";
          setDocsError(`读取文档失败: ${docsPath}\n${msg}`);
          return;
        }
      } else {
        setState((previous) => ({
          ...previous,
          workspacePath: path,
          view: "workspace",
        }));
      }
      setShowWorkspacePicker(false);
      try {
        const currentState = JSON.parse(
          localStorage.getItem("zero-one-software.prototype.v4") || "{}"
        );
        localStorage.setItem("zero-one-software.prototype.v4", JSON.stringify({
          ...currentState,
          workspacePath: path,
          view: "workspace",
        }));
      } catch { /* ignore */ }
      navigate(`/workspace?sessionId=${state.sessionId}`);
    },
    [setState, navigate, state, agentAvailable, agent],
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

      setState((previous) => ({
        ...previous,
        intent: followUpPrompt
          ? `${fullRecord.intent}\n\n--- 补充需求 ---\n${followUpPrompt}`
          : fullRecord.intent,
        workspacePath: fullRecord.workspacePath,
        stepIndex: fullRecord.stepIndex,
        activeStage: fullRecord.activeStage as AppState["activeStage"],
        scope: fullRecord.scope as AppState["scope"],
        selectedModules: fullRecord.selectedModules,
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
      }));
      navigate("/workspace");
    },
    [setState, navigate, sessionRecords],
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
            {/* Agent 运行时状态徽章 */}
            <div className={`agent-status-badge ${runtimeState.connectionStatus === "connected" ? "connected" : runtimeState.connectionStatus === "connecting" || runtimeState.connectionStatus === "error" ? "connecting" : "disconnected"}`}>
              {runtimeState.mode === "local" ? <Monitor size={13} /> : <Cloud size={13} />}
              <span className="agent-mode-label">{runtimeState.mode === "local" ? "本地" : "云端"}</span>
              <span className="agent-mode-sep">·</span>
              {runtimeState.connectionStatus === "connected" ? (
                <>
                  <Wifi size={11} />
                  <span>已连接</span>
                  {agent.connectionQuality.latency > 0 && (
                    <span className="agent-latency">
                      {agent.connectionQuality.latency < 150 ? <SignalHigh size={11} /> : <SignalMedium size={11} />}
                      {agent.connectionQuality.latency < 100
                        ? `${agent.connectionQuality.latency}ms`
                        : `${Math.round(agent.connectionQuality.latency / 100) / 10}s`}
                    </span>
                  )}
                </>
              ) : runtimeState.connectionStatus === "connecting" ? (
                <>
                  <Loader2 size={11} className="agent-spin" />
                  <span>连接中</span>
                </>
              ) : (
                <>
                  <WifiOff size={11} />
                  <span className="agent-disconnected-text">未连接</span>
                </>
              )}
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
            <button
              className={`home-tab ${state.homeTab === "history" ? "active" : ""}`}
              type="button"
              onClick={() => updateHomeTab("history")}
            >
              <History size={18} />
              历史会话
            </button>
          </div>

          {state.homeTab === "tasks" ? (
            <HomeTaskBoard state={state} setState={setState} onPatch={patchState} onRequestStartTask={requestStartTask} onBrowseDir={agentAvailable ? agent.browseDir : undefined} />
          ) : state.homeTab === "build" ? (
            <div className="launch-panel">
              <label htmlFor="intent">Hi, 今天想创造点什么？</label>
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
            onBrowse={agentAvailable ? agent.browseDir : undefined}
            initialPath={state.workspacePath || "~"}
            mode={runtimeState.mode}
          />
        </>
      )}
    </>
  );
}
