import { useState, useEffect, useCallback } from "react";
import { Folder, FolderOpen, File, ChevronRight, Home, Check, X } from "lucide-react";

export type BrowseEntry = {
  name: string;
  type: "dir" | "file";
  path: string;
};

type WorkspaceSelectorProps = {
  onConfirm: (path: string) => void;
  onCancel: () => void;
  /** 浏览目录的回调（传入路径，返回条目列表） */
  onBrowse?: (dirPath: string) => Promise<BrowseEntry[]>;
  /** 初始路径 */
  initialPath?: string;
};

/**
 * 工作空间选择器 — 模态弹窗。
 * 支持手动输入路径 + 可选的目录浏览器。
 * 用户选择后回调 onConfirm，取消则 onCancel。
 */
export function WorkspaceSelector({
  onConfirm,
  onCancel,
  onBrowse,
  initialPath,
}: WorkspaceSelectorProps) {
  const [currentPath, setCurrentPath] = useState(initialPath || "~");
  const [entries, setEntries] = useState<BrowseEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBrowser, setShowBrowser] = useState(false);

  // 父目录（浏览模式下路径为服务端解析后的绝对路径）
  const parentPath = currentPath === "/" ? null : currentPath.split("/").slice(0, -1).join("/") || "/";

  // 当浏览器激活时加载目录内容
  const loadDir = useCallback(async (dirPath: string) => {
    if (!onBrowse) return;
    setLoading(true);
    setError(null);
    try {
      const result = await onBrowse(dirPath);
      setEntries(result);
    } catch (err) {
      setError((err as Error).message || "无法读取目录");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [onBrowse]);

  useEffect(() => {
    if (showBrowser && onBrowse) {
      loadDir(currentPath);
    }
  }, [showBrowser, currentPath, onBrowse, loadDir]);

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

  // 键盘确认
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onConfirm(currentPath);
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <div className="ws-selector-backdrop" onClick={onCancel}>
      <div className="ws-selector-modal" onClick={(e) => e.stopPropagation()}>
        {/* 头部 */}
        <div className="ws-selector-header">
          <div>
            <span className="eyebrow">选择工作空间</span>
            <h2>选择项目目录作为 Agent 工作空间</h2>
          </div>
          <button className="ghost-button" type="button" onClick={onCancel}>
            <X size={16} />
          </button>
        </div>

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

        {/* 操作按钮 */}
        <div className="ws-selector-actions">
          <button className="ghost-button" type="button" onClick={onCancel}>
            取消
          </button>
          <button
            className="primary-action"
            type="button"
            onClick={() => onConfirm(currentPath)}
          >
            <Check size={16} />
            确认使用此工作空间
          </button>
        </div>
      </div>
    </div>
  );
}
