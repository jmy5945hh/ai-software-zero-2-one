import { useState, useCallback, useEffect } from "react";
import { FileText, Code2, X } from "lucide-react";
import { SpecsExplorer } from "./SpecsExplorer";
import { RepoExplorer } from "./RepoExplorer";

type ExplorerMode = "specs" | "repo" | null;

type WorkspaceExplorerProps = {
  workspacePath: string;
  taskId?: string;
  /** 外部触发打开 repo explorer */
  repoExplorerOpen?: boolean;
  /** 关闭 repo explorer */
  onCloseRepoExplorer?: () => void;
};

/**
 * WorkspaceExplorer — 左侧面板的 workspace 模块。
 * 展示两个按钮：展开 specs 文档 / 展开项目代码仓库。
 * 点击后展开对应的全屏覆盖式页面。
 */
export function WorkspaceExplorer({ workspacePath, taskId, repoExplorerOpen, onCloseRepoExplorer }: WorkspaceExplorerProps) {
  const [mode, setMode] = useState<ExplorerMode>(null);

  const handleClose = useCallback(() => {
    setMode(null);
    onCloseRepoExplorer?.();
  }, [onCloseRepoExplorer]);

  // 外部触发打开 repo explorer
  useEffect(() => {
    if (repoExplorerOpen) {
      setMode("repo");
    }
  }, [repoExplorerOpen]);

  return (
    <>
      {/* 两个按钮 */}
      <section className="workspace-explorer-buttons">
        <button
          className="workspace-explorer-btn"
          type="button"
          onClick={() => setMode("specs")}
        >
          <FileText size={18} />
          <span>Specs 文档</span>
        </button>
        <button
          className="workspace-explorer-btn"
          type="button"
          onClick={() => setMode("repo")}
        >
          <Code2 size={18} />
          <span>项目代码仓库</span>
        </button>
      </section>

      {/* 展开 specs 文档 */}
      {mode === "specs" && (
        <div className="workspace-explorer-overlay">
          <div className="workspace-explorer-header">
            <span className="eyebrow">Specs 文档</span>
            <strong>{workspacePath}/specs</strong>
            <button
              className="ghost-button small"
              type="button"
              onClick={handleClose}
            >
              <X size={14} />
              关闭
            </button>
          </div>
          <div className="workspace-explorer-body">
            <SpecsExplorer workspacePath={workspacePath} />
          </div>
        </div>
      )}

      {/* 展开项目代码仓库 */}
      {mode === "repo" && (
        <div className="workspace-explorer-overlay">
          <div className="workspace-explorer-header">
            <span className="eyebrow">项目代码仓库</span>
            <strong>{workspacePath}</strong>
            <button
              className="ghost-button small"
              type="button"
              onClick={handleClose}
            >
              <X size={14} />
              关闭
            </button>
          </div>
          <div className="workspace-explorer-body">
            <RepoExplorer workspacePath={workspacePath} taskId={taskId} />
          </div>
        </div>
      )}
    </>
  );
}
