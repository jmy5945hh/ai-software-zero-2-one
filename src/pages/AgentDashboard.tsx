/**
 * AgentDashboard — Agent 运行时管理中心首页。
 *
 * 功能：
 * - 运行时模式切换器（本地 / 云端）
 * - 状态面板（连接状态、资源监控、快捷操作）
 * - 项目列表（创建、启动、暂停、删除）
 */
import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Monitor,
  Cloud,
  Check,
  Activity,
  Cpu,
  HardDrive,
  Plus,
  FolderOpen,
  Settings,
  Zap,
  Shield,
  Globe,
  Clock,
  Wifi,
  Users,
  Layers,
  FileCode,
  Play,
  Pause,
  Trash2,
  Bot,
  AlertCircle,
  Loader2,
  BarChart3,
} from "lucide-react";
import { useRuntimeState, useRuntimeActions } from "../stores/runtimeStore";
import type { RuntimeMode, AgentProject, CreateProjectParams } from "../types/runtime";
import "../styles/AgentDashboard.css";

/** 阶段 Tag 类名映射 */
function phaseTagClass(phase: AgentProject["phase"]): string {
  return `project-tag phase-${phase}`;
}

/** 阶段显示名映射 */
function phaseLabel(phase: AgentProject["phase"]): string {
  const map: Record<string, string> = {
    draft: "草稿",
    building: "构建中",
    running: "运行中",
    paused: "已暂停",
    completed: "已完成",
    error: "异常",
  };
  return map[phase] || phase;
}

/** 相对时间格式化 */
function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}

// ── 本地模式特性 ──────────────────────────────
const localFeatures = [
  { icon: Shield, label: "离线安全" },
  { icon: FolderOpen, label: "本机文件" },
  { icon: Cpu, label: "Ollama 模型" },
  { icon: Zap, label: "低延迟" },
];

// ── 云端模式特性 ──────────────────────────────
const cloudFeatures = [
  { icon: Globe, label: "7×24 在线" },
  { icon: Layers, label: "模型池" },
  { icon: Clock, label: "远程执行" },
  { icon: Users, label: "协作共享" },
];

export function AgentDashboard() {
  const navigate = useNavigate();
  const state = useRuntimeState();
  const actions = useRuntimeActions();

  // ── 新建项目对话框状态 ───────────────────
  const [showNewProject, setShowNewProject] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  // ── 删除确认状态 ─────────────────────────
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // ── 切换到本地 ───────────────────────────
  const handleSwitchLocal = useCallback(() => {
    if (state.mode === "local" || state.switching) return;
    actions.switchMode("local");
  }, [state.mode, state.switching, actions]);

  // ── 切换到云端 ───────────────────────────
  const handleSwitchCloud = useCallback(() => {
    if (state.mode === "cloud" || state.switching) return;
    actions.switchMode("cloud");
  }, [state.mode, state.switching, actions]);

  // ── 新建项目 ─────────────────────────────
  const handleCreateProject = useCallback(async () => {
    if (!newName.trim()) return;
    const params: CreateProjectParams = {
      name: newName.trim(),
      description: newDesc.trim(),
    };
    await actions.createProject(params);
    setNewName("");
    setNewDesc("");
    setShowNewProject(false);
  }, [newName, newDesc, actions]);

  // ── 删除项目 ─────────────────────────────
  const handleDeleteProject = useCallback(
    async (id: string) => {
      await actions.deleteProject(id);
      setDeleteConfirmId(null);
    },
    [actions],
  );

  // ── 连接状态 Badge ────────────────────────
  const connectionBadge = () => {
    switch (state.connectionStatus) {
      case "connected":
        return <span className="indicator-badge ok"><Wifi size={10} />已连接</span>;
      case "connecting":
        return <span className="indicator-badge warn"><Loader2 size={10} className="spin-icon" />连接中</span>;
      case "disconnected":
        return <span className="indicator-badge off">未连接</span>;
      case "error":
        return <span className="indicator-badge warn"><AlertCircle size={10} />异常</span>;
    }
  };

  return (
    <div className="agent-dash-shell">
      {/* ── 顶部导航栏 ───────────────────── */}
      <nav className="dash-nav">
        <div className="brand" onClick={() => navigate("/")}>
          <div className="brand-mark">
            <Bot size={20} />
          </div>
          <div>
            <strong>Zero-One Agent</strong>
            <span>运行时管理中心</span>
          </div>
        </div>
        <div className="dash-user-pill">
          <Activity size={14} />
          {state.connectionStatus === "connected" ? "运行正常" : "未就绪"}
        </div>
      </nav>

      {/* ── 主体内容 ─────────────────────── */}
      <div className="dash-body">
        {/* 错误横幅 */}
        {state.error && (
          <div className="dash-error-banner">
            <AlertCircle size={16} />
            {state.error}
          </div>
        )}

        {/* Hero 标题 */}
        <div className="dash-hero">
          <span className="eyebrow">Runtime Manager</span>
          <h1>Agent 运行时管理中心</h1>
          <p>选择运行模式，管理你的 Agent 项目。本地运行更快更安全，云端运行更省心更持久。</p>
        </div>

        {/* 模式切换器 */}
        <div className="mode-switcher">
          {/* 本地模式卡片 */}
          <div
            className={`mode-card local-card${state.mode === "local" ? " active" : ""}${state.switching ? " switching" : ""}`}
            onClick={handleSwitchLocal}
          >
            <div className="switching-overlay">
              <div>
                <Loader2 size={16} className="spin-icon" />
                切换中...
              </div>
            </div>
            <div className="mode-card-header">
              <div className="mode-icon">
                <Monitor size={24} />
              </div>
              <div className="mode-check">
                <Check size={14} />
              </div>
            </div>
            <h2>本地运行时</h2>
            <p>使用本机 Ollama 模型，直接操作本地文件系统，离线可用，数据不出本机。</p>
            <ul className="mode-features">
              {localFeatures.map((f) => (
                <li key={f.label}>
                  <f.icon size={12} />
                  {f.label}
                </li>
              ))}
            </ul>
          </div>

          {/* 云端模式卡片 */}
          <div
            className={`mode-card cloud-card${state.mode === "cloud" ? " active" : ""}${state.switching ? " switching" : ""}`}
            onClick={handleSwitchCloud}
          >
            <div className="switching-overlay">
              <div>
                <Loader2 size={16} className="spin-icon" />
                切换中...
              </div>
            </div>
            <div className="mode-card-header">
              <div className="mode-icon">
                <Cloud size={24} />
              </div>
              <div className="mode-check">
                <Check size={14} />
              </div>
            </div>
            <h2>云端运行时</h2>
            <p>不占用本机资源，7×24 小时持续运行，模型池丰富，支持团队协作与共享。</p>
            <ul className="mode-features">
              {cloudFeatures.map((f) => (
                <li key={f.label}>
                  <f.icon size={12} />
                  {f.label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 状态面板行 */}
        <div className="status-row">
          {/* 运行时状态 */}
          <div className="status-box">
            <h3>运行时状态</h3>
            <div className="runtime-indicators">
              <div className="indicator-row">
                <span>当前模式</span>
                <span className={`indicator-badge ${state.mode === "local" ? "ok" : "ok"}`}>
                  {state.mode === "local" ? "本地" : "云端"}
                </span>
              </div>
              <div className="indicator-row">
                <span>连接状态</span>
                {connectionBadge()}
              </div>
              <div className="indicator-row">
                <span>模型就绪</span>
                <span className={`indicator-badge ${state.modelReady ? "ok" : "warn"}`}>
                  {state.modelReady ? "就绪" : "未检测到"}
                </span>
              </div>
              <div className="indicator-row">
                <span>活跃项目</span>
                <span className="indicator-badge ok">
                  {state.projects.filter((p) => p.phase === "running").length} 个
                </span>
              </div>
            </div>
          </div>

          {/* 资源监控 */}
          <div className="status-box">
            <h3>资源监控</h3>
            <div className="resource-bars">
              <div className="resource-bar">
                <div className="resource-bar-header">
                  <span>CPU</span>
                  <strong>{Math.round(state.resources.cpu)}%</strong>
                </div>
                <div className="resource-track">
                  <span className="resource-track-fill cpu" style={{ width: `${Math.min(state.resources.cpu, 100)}%` }} />
                </div>
              </div>
              <div className="resource-bar">
                <div className="resource-bar-header">
                  <span>内存</span>
                  <strong>{Math.round(state.resources.memory)}%</strong>
                </div>
                <div className="resource-track">
                  <span className="resource-track-fill memory" style={{ width: `${Math.min(state.resources.memory, 100)}%` }} />
                </div>
              </div>
              <div className="resource-bar">
                <div className="resource-bar-header">
                  <span>磁盘</span>
                  <strong>{Math.round(state.resources.disk)}%</strong>
                </div>
                <div className="resource-track">
                  <span className="resource-track-fill disk" style={{ width: `${Math.min(state.resources.disk, 100)}%` }} />
                </div>
              </div>
            </div>

            {/* 云端额外指标 */}
            {state.mode === "cloud" && state.resources.monthlyTokens && (
              <div className="cloud-extra-info">
                <div className="cloud-extra-item">
                  <span>活跃任务</span>
                  <strong>{state.resources.activeQueues ?? 0}</strong>
                </div>
                <div className="cloud-extra-item">
                  <span>月度额度</span>
                  <strong>
                    {(state.resources.monthlyTokens.used / 1000).toFixed(0)}K / {(state.resources.monthlyTokens.total / 1000).toFixed(0)}K
                  </strong>
                </div>
              </div>
            )}
          </div>

          {/* 快捷操作 */}
          <div className="status-box">
            <h3>快捷操作</h3>
            <div className="quick-actions">
              <button className="quick-action-btn" onClick={() => setShowNewProject(true)}>
                <Plus size={14} /> 新建项目
              </button>
              <button
                className="quick-action-btn"
                onClick={() => {
                  // File System Access API 选择目录
                  if ("showDirectoryPicker" in window) {
                    (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker()
                      .catch(() => {});
                  }
                }}
              >
                <FolderOpen size={14} /> 打开目录
              </button>
              <button className="quick-action-btn">
                <Settings size={14} /> 环境配置
              </button>
            </div>
          </div>
        </div>

        {/* 项目列表 */}
        <div className="project-section">
          <div className="project-section-header">
            <div>
              <h2>项目列表</h2>
              <span className="project-count">{state.projects.length} 个项目</span>
            </div>
            <button className="new-project-btn" onClick={() => setShowNewProject(true)}>
              <Plus size={14} />
              新建项目
            </button>
          </div>

          {/* 新建项目对话框 */}
          {showNewProject && (
            <div className="status-box" style={{ padding: "24px" }}>
              <h3 style={{ marginBottom: "16px" }}>新建 {state.mode === "local" ? "本地" : "云端"} Agent 项目</h3>
              <div style={{ display: "grid", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", color: "var(--muted-warm)", fontSize: "0.72rem", marginBottom: "4px" }}>
                    项目名称
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="输入项目名称..."
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid var(--line)",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "0.85rem",
                      background: "transparent",
                      color: "var(--text)",
                      outline: "none",
                      fontFamily: "var(--font-body)",
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
                  />
                </div>
                <div>
                  <label style={{ display: "block", color: "var(--muted-warm)", fontSize: "0.72rem", marginBottom: "4px" }}>
                    项目描述
                  </label>
                  <textarea
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="描述这个项目的目标..."
                    rows={3}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid var(--line)",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "0.85rem",
                      background: "transparent",
                      color: "var(--text)",
                      outline: "none",
                      resize: "vertical",
                      fontFamily: "var(--font-body)",
                    }}
                  />
                </div>
                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                  <button
                    className="ghost-button"
                    onClick={() => {
                      setShowNewProject(false);
                      setNewName("");
                      setNewDesc("");
                    }}
                  >
                    取消
                  </button>
                  <button className="primary-action" onClick={handleCreateProject} disabled={!newName.trim()}>
                    创建项目
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 项目卡片列表 */}
          {state.projects.length === 0 ? (
            <div className="empty-projects">
              <BarChart3 size={40} />
              <p>还没有项目。点击「新建项目」创建你的第一个 Agent 项目。</p>
            </div>
          ) : (
            <div className="project-list">
              {state.projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  deleting={deleteConfirmId === project.id}
                  onStart={() => actions.startProject(project.id)}
                  onPause={() => actions.pauseProject(project.id)}
                  onDeleteRequest={() => setDeleteConfirmId(project.id)}
                  onDeleteCancel={() => setDeleteConfirmId(null)}
                  onDeleteConfirm={() => handleDeleteProject(project.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 项目卡片子组件 ──────────────────────────

function ProjectCard({
  project,
  deleting,
  onStart,
  onPause,
  onDeleteRequest,
  onDeleteCancel,
  onDeleteConfirm,
}: {
  project: AgentProject;
  deleting: boolean;
  onStart: () => void;
  onPause: () => void;
  onDeleteRequest: () => void;
  onDeleteCancel: () => void;
  onDeleteConfirm: () => void;
}) {
  return (
    <div className="project-card">
      <div className="project-card-main">
        <div className="project-card-header">
          <h3>{project.name}</h3>
          <span className={phaseTagClass(project.phase)}>{phaseLabel(project.phase)}</span>
          <span className={`project-tag mode-${project.mode}`}>
            {project.mode === "local" ? "本地" : "云端"}
          </span>
        </div>

        {project.description && <p>{project.description}</p>}

        <div className="project-meta">
          <div className="project-meta-item">
            <Clock size={12} />
            {relativeTime(project.lastActivity)}
          </div>
          <div className="project-meta-item">
            <Zap size={12} />
            {project.toolCallCount} 次调用
          </div>
          <div className="project-meta-item">
            <FileCode size={12} />
            {project.fileCount} 文件
          </div>
          {project.phase !== "completed" && project.phase !== "error" && (
            <div className="project-progress">
              <span>进度</span>
              <div className="project-progress-track">
                <span className="project-progress-fill" style={{ width: `${project.progress}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="project-card-actions">
        {deleting ? (
          <div className="project-delete-confirm">
            <span>确认删除？</span>
            <button className="confirm-yes" onClick={onDeleteConfirm}>确认</button>
            <button className="confirm-no" onClick={onDeleteCancel}>取消</button>
          </div>
        ) : (
          <>
            {project.phase === "paused" || project.phase === "draft" ? (
              <button className="project-action-btn start" onClick={onStart}>
                <Play size={12} /> 启动
              </button>
            ) : null}
            {project.phase === "running" || project.phase === "building" ? (
              <button className="project-action-btn pause" onClick={onPause}>
                <Pause size={12} /> 暂停
              </button>
            ) : null}
            <button className="project-action-btn delete" onClick={onDeleteRequest}>
              <Trash2 size={12} /> 删除
            </button>
          </>
        )}
      </div>
    </div>
  );
}
