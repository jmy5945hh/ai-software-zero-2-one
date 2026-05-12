import { useEffect, useState, useMemo, useCallback } from "react";
import type { View, HomeTab, AppState, DrawerContent } from "./data/types";
import { createDefaultState, titleFromIntent, formatTime, workflow } from "./data";

import {
  Sparkles,
  Play,
  ListTodo,
  UserCircle,
} from "lucide-react";

import { HomeTaskBoard } from "./components/HomeTaskBoard";
import { TypewriterText } from "./components/TypewriterText";
import { SopNav } from "./components/SopNav";
import { LeftPanel } from "./components/LeftPanel";
import { DecisionBoard } from "./components/DecisionBoard";
import { Drawer } from "./components/Drawer";

const STORAGE_KEY = "zero-one-software.prototype.v3";

/**
 * 顶层应用组件 —— 路由 home / workspace 两个视图。
 * 采用 localStorage 持久化状态。
 */
export function App() {
  const [state, setState] = useStoredState();
  const [drawerContent, setDrawerContent] = useState<DrawerContent>(null);

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

  if (state.view === "home") {
    return (
      <HomeView
        state={state}
        onPatch={patchState}
        setState={setState}
      />
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
    />
  );
}

// ── Home 视图 ───────────────────────────────

function HomeView({
  state,
  onPatch,
  setState,
}: {
  state: AppState;
  onPatch: (patch: Partial<AppState>) => void;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}) {
  const updateHomeTab = (tab: HomeTab) =>
    onPatch({ homeTab: tab, previewTaskId: null });

  const startTaskFromIntent = () => {
    if (!state.intent.trim()) return;
    setState((previous) => ({
      ...createDefaultState(),
      intent: previous.intent.trim(),
      view: "workspace",
      createdAt: new Date().toISOString(),
    }));
    window.scrollTo({ top: 0 });
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
        <div className="home-user-info">
          <UserCircle size={18} />
          <div>
            <strong>景梦园</strong>
            <span>80123456</span>
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
          <HomeTaskBoard state={state} setState={setState} onPatch={onPatch} />
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
}: {
  state: AppState;
  taskTitle: string;
  progress: number;
  onPatch: (patch: Partial<AppState>) => void;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  onPreview: (content: DrawerContent) => void;
  drawerContent: DrawerContent;
  onCloseDrawer: () => void;
}) {
  const continueTask = () => {
    const nextIndex = Math.min(state.stepIndex + 1, workflow.length - 1);
    onPatch({
      stepIndex: nextIndex,
      activeStage: workflow[nextIndex].id,
      specConfirmed: state.specConfirmed || state.stepIndex >= 2,
    });
    window.scrollTo({ top: 0 });
  };

  const handleStepClick = (index: number) => {
    onPatch({
      stepIndex: index,
      activeStage: workflow[index].id,
    });
    window.scrollTo({ top: 0 });
  };

  const resetDemo = () => {
    localStorage.removeItem(STORAGE_KEY);
    setState(createDefaultState());
    window.scrollTo({ top: 0 });
  };

  const handleFileClick = (path: string, name: string) => {
    const ext = path.split(".").pop() || "";
    const mockContent = getMockFileContent(path, name);
    onPreview({
      type: ["ts", "tsx", "js", "jsx", "json", "yaml", "yml", "css"].includes(
        ext,
      )
        ? "code"
        : ["md"].includes(ext)
          ? "document"
          : "file",
      title: name,
      path,
      content: mockContent,
      language: getLanguageFromPath(path),
      html: "",
    } as DrawerContent);
  };

  return (
    <main className="workspace-shell">
      {/* Topbar 信息条（精简版） */}
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
        <button
          className="ghost-button danger-lite"
          type="button"
          onClick={resetDemo}
        >
          重置演示
        </button>
      </div>
      {/* 顶部横置 SOP 导航 */}
      <SopNav
        workflow={workflow}
        stepIndex={state.stepIndex}
        progress={progress}
        onStepClick={handleStepClick}
      />

      {/* 主内容区：左侧面板 + 决策台 */}
      <div className="workspace-grid">
        <LeftPanel
          activeTaskCard={state.activeTaskCard}
          stepIndex={state.stepIndex}
          onFileClick={handleFileClick}
          onBackToTasks={() =>
            setState((prev) => ({ ...prev, view: "home" }))
          }
        />

        <DecisionBoard
          state={state}
          onPatch={onPatch}
          onContinue={continueTask}
          onPreview={onPreview}
        />
      </div>



      {/* 右侧抽屉 */}
      <Drawer content={drawerContent} onClose={onCloseDrawer} />
    </main>
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
    ts: "TypeScript",
    tsx: "TSX",
    js: "JavaScript",
    jsx: "JSX",
    json: "JSON",
    yaml: "YAML",
    yml: "YAML",
    md: "Markdown",
    css: "CSS",
    html: "HTML",
    diff: "Diff",
  };
  return map[ext] || ext;
}

function getMockFileContent(path: string, name: string): string {
  if (name.includes("openapi") || name.endsWith(".yaml")) {
    return `openapi: "3.0.0"
info:
  title: 销售线索跟进系统
  version: "1.0.0"
paths:
  /customers:
    get:
      summary: 获取客户列表
      responses:
        "200":
          description: 客户列表
  /customers/{id}:
    get:
      summary: 获取客户详情
  /reminders:
    get:
      summary: 获取待处理提醒`;
  }
  if (name.endsWith(".test.ts")) {
    return `import { describe, it, expect } from "vitest";
import { generateReminder } from "../src/hooks/use-follow-up";

describe("提醒生成逻辑", () => {
  it("超过3天未跟进应生成提醒", () => {
    const lastFollowUp = new Date("2026-04-20");
    const reminder = generateReminder(lastFollowUp);
    expect(reminder.urgent).toBe(true);
  });
});`;
  }
  if (name.endsWith(".tsx")) {
    return `import { useState } from "react";

export function ${name.replace(".tsx", "")}() {
  const [data, setData] = useState([]);

  return (
    <div className="page">
      <h1>${name.replace(".tsx", "")}</h1>
    </div>
  );
}`;
  }
  if (name.endsWith(".json")) {
    return JSON.stringify([{ id: 1, name: "示例数据" }], null, 2);
  }
  if (name.endsWith(".md")) {
    return `# ${name.replace(".md", "")}\n\n内容待生成...`;
  }
  return `// ${name}\n// Agent 生成于 ${new Date().toLocaleDateString("zh-CN")}`;
}
