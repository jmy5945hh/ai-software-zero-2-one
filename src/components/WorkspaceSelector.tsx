import { useState, useEffect, useCallback, useRef } from "react";
import { Folder, FolderOpen, File, ChevronRight, ChevronDown, Home, Check, X, GitBranch, Globe, Monitor, Cloud, Check as CheckIcon, Loader2, RefreshCw } from "lucide-react";

export type BrowseEntry = {
  name: string;
  type: "dir" | "file";
  path: string;
};

export type RuntimeMode = "local" | "cloud";

type WorkspaceSelectorProps = {
  onConfirm: (path: string, mode: RuntimeMode, gitConfig?: { branch: string; shouldPull: boolean }) => void;
  onCancel: () => void;
  /** 浏览目录的回调（传入路径和模式，返回条目列表） */
  onBrowse?: (dirPath: string, mode?: RuntimeMode) => Promise<BrowseEntry[]>;
  /** 初始路径 */
  initialPath?: string;
  /** 运行时模式：本地显示文件路径，云端显示 Git 仓库信息 */
  mode?: RuntimeMode;
  /** 列出 Git 分支的回调 */
  onListBranches?: (dirPath: string) => Promise<{ branches: string[]; current: string | null; isRepo: boolean }>;
};

/**
 * 工作空间选择器 — 模态弹窗。
 * - 本地模式：手动输入路径 + 可选的目录浏览器 + Git 分支检测。
 * - 云端模式：Git 仓库地址 + 分支。
 * 用户选择后回调 onConfirm，取消则 onCancel。
 */
export function WorkspaceSelector({
  onConfirm,
  onCancel,
  onBrowse,
  initialPath,
  mode = "local",
  onListBranches,
}: WorkspaceSelectorProps) {
  // ── 本地模式状态 ──
  const [currentPath, setCurrentPath] = useState(initialPath || "~");
  const [entries, setEntries] = useState<BrowseEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBrowser, setShowBrowser] = useState(false);

  // ── 内部模式状态（可切换） ──
  const [internalMode, setInternalMode] = useState<RuntimeMode>(mode);

  // ── 云端模式状态 ──
  const [gitUrl, setGitUrl] = useState("https://github.com/jmy5945hh/ant-design-pro-for-edd.git");
  const [gitBranch, setGitBranch] = useState("001_chatbot");

  // ── 本地模式 Git 检测状态 ──
  const [isGitRepo, setIsGitRepo] = useState(false);
  const [gitBranches, setGitBranches] = useState<string[]>([]);
  const [currentBranch, setCurrentBranch] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [shouldPull, setShouldPull] = useState(false);
  const [gitLoading, setGitLoading] = useState(false);
  const [gitError, setGitError] = useState<string | null>(null);
  const [gitRefreshKey, setGitRefreshKey] = useState(0);
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);
  const branchInputRef = useRef<HTMLInputElement>(null);
  const branchPickerRef = useRef<HTMLDivElement>(null);

  // 父目录（浏览模式下路径为服务端解析后的绝对路径）
  const parentPath = currentPath === "/" ? null : currentPath.split("/").slice(0, -1).join("/") || "/";

  // 当浏览器激活时加载目录内容
  const loadDir = useCallback(async (dirPath: string) => {
    if (!onBrowse) return;
    setLoading(true);
    setError(null);
    try {
      const result = await onBrowse(dirPath, internalMode);
      setEntries(result);
    } catch (err) {
      setError((err as Error).message || "无法读取目录");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [onBrowse, internalMode]);

  useEffect(() => {
    if (showBrowser && onBrowse) {
      loadDir(currentPath);
    }
  }, [showBrowser, currentPath, onBrowse, loadDir]);

  // ── 自动检测 Git 仓库 ──
  useEffect(() => {
    if (internalMode === "cloud" || !onListBranches) return;
    let cancelled = false;
    const detect = async () => {
      setGitLoading(true);
      setGitError(null);
      try {
        const result = await onListBranches(currentPath);
        if (cancelled) return;
        setIsGitRepo(result.isRepo);
        setGitBranches(result.branches);
        setCurrentBranch(result.current);
        setSelectedBranch(result.current || "");
        setBranchMenuOpen(false);
      } catch (err) {
        if (!cancelled) {
          setIsGitRepo(false);
          setGitBranches([]);
          setCurrentBranch(null);
          setSelectedBranch("");
          setGitError(err instanceof Error ? err.message : "Git 检测失败");
        }
      } finally {
        if (!cancelled) setGitLoading(false);
      }
    };
    const timer = window.setTimeout(detect, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [currentPath, internalMode, onListBranches, gitRefreshKey]);

  useEffect(() => {
    if (!branchMenuOpen) return;
    const closeMenu = (event: MouseEvent) => {
      if (!branchPickerRef.current?.contains(event.target as Node)) {
        setBranchMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, [branchMenuOpen]);

  // 点击进入子目录
  const enterDir = (entry: BrowseEntry) => {
    if (entry.type === "dir") {
      setCurrentPath(entry.path);
    }
  };

  // 返回上级
  const goUp = () => {
    if (parentPath) {
      setCurrentPath(parentPath);
    }
  };

  // 键盘确认（本地模式）
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleConfirm();
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  // 云端模式回车确认
  const handleGitKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && gitUrl.trim()) {
      const branch = gitBranch.trim() || "main";
      onConfirm(`${gitUrl.trim()}#${branch}`, "cloud");
    } else if (e.key === "Escape") {
      onCancel();
    }
  };



  const isCloud = internalMode === "cloud";

  const handleConfirm = () => {
    if (internalMode === "cloud") {
      const url = gitUrl.trim();
      if (!url) return;
      const branch = gitBranch.trim() || "main";
      onConfirm(`${url}#${branch}`, internalMode);
    } else {
      if (isGitRepo && selectedBranch) {
        onConfirm(currentPath, internalMode, { branch: selectedBranch, shouldPull });
      } else {
        onConfirm(currentPath, internalMode);
      }
    }
  };

  return (
    <div className="ws-selector-backdrop" onClick={onCancel}>
      <div className="ws-selector-modal" onClick={(e) => e.stopPropagation()}>
        {/* 头部 */}
        <div className="ws-selector-header">
          <div>
            <span className="eyebrow">{isCloud ? "选择 Git 仓库" : "选择工作空间"}</span>
            <h2>{isCloud ? "输入 Git 仓库地址和分支" : "选择项目目录与开发分支"}</h2>
          </div>
          <button className="ghost-button" type="button" onClick={onCancel}>
            <X size={16} />
          </button>
        </div>

        {/* 模式切换器 */}
        <div className="ws-selector-mode-switcher">
          <button
            className={`ws-mode-btn ${internalMode === "local" ? "active" : ""}`}
            type="button"
            onClick={() => setInternalMode("local")}
          >
            <Monitor size={15} />
            本地
            {internalMode === "local" && <CheckIcon size={13} className="ws-mode-check" />}
          </button>
          <button
            className={`ws-mode-btn ${internalMode === "cloud" ? "active" : ""}`}
            type="button"
            onClick={() => setInternalMode("cloud")}
          >
            <Cloud size={15} />
            云端
            {internalMode === "cloud" && <CheckIcon size={13} className="ws-mode-check" />}
          </button>
        </div>

        {isCloud ? (
          <>
            {/* ── 云端模式：Git 仓库地址 + 分支 ── */}
            <div className="ws-selector-path-row">
              <label>Git 仓库地址</label>
              <div className="ws-selector-input-group">
                <input
                  className="ws-selector-path-input"
                  type="text"
                  value={gitUrl}
                  onChange={(e) => {
                    setGitUrl(e.target.value);
                    setError(null);
                  }}
                  onKeyDown={handleGitKeyDown}
                  placeholder="https://github.com/user/repo.git"
                  autoFocus
                />
              </div>
            </div>

            <div className="ws-selector-path-row">
              <label>分支</label>
              <div className="ws-selector-input-group">
                <input
                  className="ws-selector-path-input"
                  type="text"
                  value={gitBranch}
                  onChange={(e) => setGitBranch(e.target.value)}
                  onKeyDown={handleGitKeyDown}
                  placeholder="main"
                />
              </div>
            </div>

            {error && <span className="ws-selector-error">{error}</span>}

            {/* 快捷模板 */}
            <div className="ws-selector-shortcuts">
              <span>快捷分支：</span>
              {["main", "master", "develop", "feature/"].map((b) => (
                <button
                  key={b}
                  className={`ghost-button${gitBranch === b ? " active-shortcut" : ""}`}
                  type="button"
                  onClick={() => {
                    setGitBranch(b);
                    setError(null);
                  }}
                >
                  <GitBranch size={13} />
                  {b}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* ── 本地模式：文件路径 ── */}
            {/* 路径输入 */}
            <div className="ws-selector-path-row">
              <label>项目路径</label>
              <div className="ws-selector-input-group">
                <input
                  className="ws-selector-path-input"
                  type="text"
                  value={currentPath}
                  onChange={(e) => {
                    setCurrentPath(e.target.value);
                    setError(null);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="/Users/username/projects/my-app"
                  autoFocus
                />
                {onBrowse && (
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => {
                      setShowBrowser(!showBrowser);
                      setError(null);
                    }}
                  >
                    <Folder size={15} />
                    {showBrowser ? "收起" : "浏览"}
                  </button>
                )}
              </div>
              {error && <span className="ws-selector-error">{error}</span>}
            </div>

            {/* 目录浏览器 */}
            {showBrowser && (
              <div className="ws-selector-browser">
                {/* 面包屑 */}
                <div className="ws-selector-breadcrumb">
                  <button
                    className="ws-selector-breadcrumb-btn"
                    type="button"
                    onClick={goUp}
                    disabled={!parentPath}
                    title={parentPath ? `返回 ${parentPath}` : "已是根目录"}
                  >
                    <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} />
                  </button>
                  <span className="ws-selector-breadcrumb-path">
                    {currentPath}
                  </span>
                </div>

                {/* 条目列表 */}
                <div className="ws-selector-entry-list">
                  {loading ? (
                    <div className="ws-selector-loading">加载中…</div>
                  ) : entries.length === 0 ? (
                    <div className="ws-selector-empty">此目录为空</div>
                  ) : (
                    entries.map((entry) => (
                      <button
                        key={entry.path}
                        className={`ws-selector-entry ${entry.type === "dir" ? "is-dir" : ""}`}
                        type="button"
                        onClick={() => enterDir(entry)}
                        disabled={entry.type !== "dir"}
                      >
                        {entry.type === "dir" ? (
                          <FolderOpen size={16} />
                        ) : (
                          <File size={16} />
                        )}
                        <span>{entry.name}</span>
                        {entry.type === "dir" && (
                          <ChevronRight size={14} className="ws-selector-entry-arrow" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* 快捷路径 */}
            <div className="ws-selector-shortcuts">
              <span>快捷路径：</span>
              <button
                className="ghost-button"
                type="button"
                onClick={() => {
                  setCurrentPath("~");
                  setError(null);
                }}
              >
                <Home size={13} />
                主目录
              </button>
              <button
                className="ghost-button"
                type="button"
                onClick={() => {
                  setCurrentPath(initialPath || "~");
                  setError(null);
                }}
              >
                重置
              </button>
            </div>

            {/* 本地 Git 检测与分支设置 */}
            {gitLoading ? (
              <div className="ws-selector-git-status is-loading">
                <Loader2 size={14} className="agent-spin" />
                <div>
                  <strong>正在检测 Git 仓库</strong>
                  <span>检测完成后将自动列出可用分支</span>
                </div>
              </div>
            ) : gitError ? (
              <div className="ws-selector-git-status is-error">
                <GitBranch size={14} />
                <div>
                  <strong>Git 信息读取失败</strong>
                  <span>{gitError}</span>
                </div>
                <button
                  className="ws-selector-git-refresh"
                  type="button"
                  onClick={() => setGitRefreshKey((value) => value + 1)}
                  title="重新检测"
                >
                  <RefreshCw size={13} />
                </button>
              </div>
            ) : isGitRepo ? (
              <div className="ws-selector-git-section">
                <div className="ws-selector-git-header">
                  <GitBranch size={14} />
                  <span>Git 仓库已检测到</span>
                  {currentBranch && <span className="ws-selector-current-branch">当前：{currentBranch}</span>}
                  <button
                    className="ws-selector-git-refresh"
                    type="button"
                    onClick={() => setGitRefreshKey((value) => value + 1)}
                    title="刷新分支列表"
                  >
                    <RefreshCw size={13} />
                  </button>
                </div>
                <div className="ws-selector-path-row">
                  <label>分支</label>
                  <div className="ws-selector-branch-control" ref={branchPickerRef}>
                    <div className="ws-selector-input-group">
                      <input
                        ref={branchInputRef}
                        className="ws-selector-branch-input"
                        type="text"
                        value={selectedBranch}
                        onChange={(e) => {
                          setSelectedBranch(e.target.value);
                          setBranchMenuOpen(false);
                        }}
                        placeholder={currentBranch || "输入新分支名称"}
                      />
                      <button
                        className="ws-selector-branch-picker"
                        type="button"
                        aria-label="查看可用分支"
                        aria-expanded={branchMenuOpen}
                        aria-controls="local-git-branch-menu"
                        title="查看可用分支"
                        onClick={() => setBranchMenuOpen((open) => !open)}
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                    {branchMenuOpen && (
                      <div
                        id="local-git-branch-menu"
                        className="ws-selector-branch-menu"
                        role="listbox"
                        aria-label="可用分支"
                      >
                        {gitBranches.map((b) => (
                          <button
                            key={b}
                            className="ws-selector-branch-option"
                            type="button"
                            role="option"
                            aria-selected={b === selectedBranch}
                            onClick={() => {
                              setSelectedBranch(b);
                              setBranchMenuOpen(false);
                              branchInputRef.current?.focus();
                            }}
                          >
                            <span>{b}</span>
                            {b === currentBranch && <small>当前</small>}
                            {b === selectedBranch && <Check size={13} />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="ws-selector-branch-hint">
                    已加载 {gitBranches.length} 个可选分支；也可直接输入新分支名称，留空则保持当前分支。
                  </span>
                </div>
                <label className="ws-selector-pull-checkbox">
                  <input
                    type="checkbox"
                    checked={shouldPull}
                    onChange={(e) => setShouldPull(e.target.checked)}
                  />
                  <span>开发前拉取最新代码 (git pull)</span>
                </label>
              </div>
            ) : (
              <div className="ws-selector-git-status">
                <GitBranch size={14} />
                <div>
                  <strong>当前目录不是 Git 仓库</strong>
                  <span>可继续使用该目录，任务将在当前文件夹中执行</span>
                </div>
                <button
                  className="ws-selector-git-refresh"
                  type="button"
                  onClick={() => setGitRefreshKey((value) => value + 1)}
                  title="重新检测"
                >
                  <RefreshCw size={13} />
                </button>
              </div>
            )}
          </>
        )}

        {/* 操作按钮 */}
        <div className="ws-selector-actions">
          <button className="ghost-button" type="button" onClick={onCancel}>
            取消
          </button>
          <button
            className="primary-action"
            type="button"
            onClick={handleConfirm}
            disabled={isCloud && !gitUrl.trim()}
          >
            <Check size={16} />
            {isCloud ? "确认使用此仓库" : "确认目录与分支"}
          </button>
        </div>
      </div>
    </div>
  );
}
