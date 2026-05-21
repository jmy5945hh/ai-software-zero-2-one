import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStoredState } from "../hooks/useStoredState";
import { createDefaultState } from "../data";
import type { AppState, DrawerContent, HomeTab } from "../data/types";

import {
  Sparkles,
  Play,
  ListTodo,
  UserCircle,
} from "lucide-react";

import { HomeTaskBoard } from "../components/HomeTaskBoard";
import { TypewriterText } from "../components/TypewriterText";
import { WorkspaceSelector } from "../components/WorkspaceSelector";
import { useAgent } from "../agent";

/**
 * 首页路由页 —— "/"
 * 包含 Hero、Tab 切换、任务看板 / 想法输入、工作空间选择弹窗。
 */
export function HomePage() {
  const navigate = useNavigate();
  const [state, setState] = useStoredState();
  const [showWorkspacePicker, setShowWorkspacePicker] = useState(false);

  // Agent 连接用于文件浏览
  const taskIdForPicker = showWorkspacePicker && state.createdAt
    ? `task-${new Date(state.createdAt).getTime()}`
    : null;
  const agent = useAgent(taskIdForPicker);
  const agentAvailable = agent.connectionStatus === "connected" || agent.connectionStatus === "reconnecting";

  const patchState = useCallback(
    (patch: Partial<AppState>) =>
      setState((previous) => ({ ...previous, ...patch })),
    [setState],
  );

  const requestStartTask = useCallback(
    (intent: string, notes: string, activeTaskCard: AppState["activeTaskCard"]) => {
      setState((previous) => ({
        ...createDefaultState(),
        intent,
        notes,
        activeTaskCard,
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
      navigate("/workspace");
    },
    [setState, navigate],
  );

  const cancelWorkspacePicker = useCallback(() => {
    setShowWorkspacePicker(false);
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

  const startTaskFromIntent = () => {
    if (!state.intent.trim()) return;
    requestStartTask(state.intent.trim(), state.notes, null);
  };

  return (
    <>
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
            <HomeTaskBoard state={state} setState={setState} onPatch={patchState} onRequestStartTask={requestStartTask} />
          ) : (
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
          )}
        </section>
      </main>

      {showWorkspacePicker && (
        <WorkspaceSelector
          onConfirm={confirmWorkspace}
          onCancel={cancelWorkspacePicker}
          onBrowse={agentAvailable ? agent.browseDir : undefined}
          initialPath={state.workspacePath || "~"}
        />
      )}
    </>
  );
}
