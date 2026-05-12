import { useState } from "react";
import {
  Sparkles,
  TriangleAlert,
  ShieldCheck,
  FolderOpen,
  FileText,
  ChevronRight,
  Folder,
  File,
  GitBranch,
} from "lucide-react";
import type { TaskCard, FileNode } from "../data/types";
import { categoryMeta, priorityLabel, getFileTreeForStage } from "../data";

type LeftPanelProps = {
  activeTaskCard: TaskCard | null;
  stepIndex: number;
  onFileClick: (path: string, name: string) => void;
  onBackToTasks: () => void;
};

/**
 * 左侧面板 —— 故事卡驻留 + 工作空间目录。
 * 让研发人员随时看到当前任务上下文和 Agent 工作空间状态。
 */
export function LeftPanel({
  activeTaskCard,
  stepIndex,
  onFileClick,
  onBackToTasks,
}: LeftPanelProps) {
  return (
    <aside className="left-panel">
      {/* 故事卡驻留 */}
      <TaskCardResident
        taskCard={activeTaskCard}
        onBackToTasks={onBackToTasks}
      />

      {/* 工作空间目录 */}
      <WorkspaceTree stepIndex={stepIndex} onFileClick={onFileClick} />
    </aside>
  );
}

/**
 * 故事卡驻留组件 —— 始终显示当前研发任务的上下文。
 */
function TaskCardResident({
  taskCard,
  onBackToTasks,
}: {
  taskCard: TaskCard | null;
  onBackToTasks: () => void;
}) {
  if (!taskCard) {
    return (
      <section className="left-card story-resident">
        <div className="left-card-header">
          <Sparkles size={16} />
          <span>当前任务</span>
        </div>
        <div className="story-resident-empty">
          <p>还未选择任务卡片</p>
          <button
            className="ghost-button"
            type="button"
            onClick={onBackToTasks}
          >
            返回任务列表
          </button>
        </div>
      </section>
    );
  }

  const meta = categoryMeta[taskCard.category];
  const Icon = meta.icon;

  return (
    <section className={`left-card story-resident ${meta.accent}`}>
      <div className="left-card-header">
        <Icon size={16} />
        <span>{meta.label} · {taskCard.source}</span>
      </div>

      <div className="story-resident-body">
        <h3>{taskCard.title}</h3>
        <p>{taskCard.summary}</p>
      </div>

      <div className="story-resident-meta">
        <span className={`priority-tag ${taskCard.priority}`}>
          {priorityLabel(taskCard.priority)}
        </span>
        <button
          className="ghost-button small"
          type="button"
          onClick={onBackToTasks}
        >
          <GitBranch size={12} />
          切换任务
        </button>
      </div>
    </section>
  );
}

/**
 * 工作空间文件树 —— 根据当前 SOP 阶段动态展示文件结构。
 */
function WorkspaceTree({
  stepIndex,
  onFileClick,
}: {
  stepIndex: number;
  onFileClick: (path: string, name: string) => void;
}) {
  const files = getFileTreeForStage(stepIndex);

  return (
    <section className="left-card workspace-tree">
      <div className="left-card-header">
        <FolderOpen size={16} />
        <span>Workspace</span>
        <em>cs-2026-0518</em>
      </div>

      <div className="file-tree">
        {files.map((node) => (
          <FileTreeNode
            key={node.name}
            node={node}
            depth={0}
            path={node.name}
            onFileClick={onFileClick}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * 递归渲染文件树节点
 */
function FileTreeNode({
  node,
  depth,
  path,
  onFileClick,
}: {
  node: FileNode;
  depth: number;
  path: string;
  onFileClick: (path: string, name: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  if (node.type === "folder") {
    return (
      <div className="tree-folder" style={{ paddingLeft: depth * 16 }}>
        <button
          className="tree-folder-toggle"
          type="button"
          onClick={() => setExpanded(!expanded)}
        >
          <ChevronRight
            size={14}
            style={{
              transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.2s",
            }}
          />
          <Folder size={14} className="tree-icon" />
          <span>{node.name}</span>
        </button>

        {expanded &&
          node.children?.map((child) => (
            <FileTreeNode
              key={child.name}
              node={child}
              depth={depth + 1}
              path={`${path}/${child.name}`}
              onFileClick={onFileClick}
            />
          ))}
      </div>
    );
  }

  return (
    <button
      className={`tree-file ${node.highlight ? "highlight" : ""}`}
      type="button"
      style={{ paddingLeft: depth * 16 + 12 }}
      onClick={() => onFileClick(path, node.name)}
    >
      <FileText size={14} className="tree-icon" />
      <span>{node.name}</span>
      {node.highlight && <span className="tree-new-badge">new</span>}
    </button>
  );
}
