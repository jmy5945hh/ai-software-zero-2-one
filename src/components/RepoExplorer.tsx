import { useState, useEffect, useCallback, useRef } from "react";
import {
  Folder,
  FileText,
  ChevronRight,
  GitBranch,
  Loader2,
  FileDiff,
  FilePlus,
  FileMinus,
} from "lucide-react";
import { DiffViewer } from "./DiffViewer";

type TreeNode = {
  name: string;
  type: "file" | "folder";
  children?: TreeNode[];
};

type DiffFileInfo = {
  path: string;
  diff: string;
  additions: number;
  deletions: number;
  changeType: "create" | "modify" | "delete";
};

type RepoExplorerProps = {
  workspacePath: string;
};

type RepoTab = "tree" | "diff";

/**
 * Build a tree structure from flat file paths.
 */
function buildFileTree(files: DiffFileInfo[]): TreeNode[] {
  const root: TreeNode[] = [];
  const map = new Map<string, TreeNode[]>();

  for (const f of files) {
    const parts = f.path.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const parentPath = parts.slice(0, i).join("/");
      const key = parentPath ? `${parentPath}/${part}` : part;

      if (isLast) {
        current.push({ name: part, type: "file" });
      } else {
        let folder = current.find((n) => n.name === part && n.type === "folder") as TreeNode | undefined;
        if (!folder) {
          folder = { name: part, type: "folder", children: [] };
          current.push(folder);
        }
        current = folder.children!;
      }
    }
  }

  return root;
}

/**
 * RepoExplorer — 浏览项目仓库目录（排除 specs 目录），
 * 支持切换「目录树」和「代码 Diff」两种视图。
 */
export function RepoExplorer({ workspacePath }: RepoExplorerProps) {
  const [tab, setTab] = useState<RepoTab>("tree");
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [diffFiles, setDiffFiles] = useState<DiffFileInfo[]>([]);
  const [selectedDiffFile, setSelectedDiffFile] = useState<string | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [treeWidth, setTreeWidth] = useState(240);
  const splitRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // 拖拽调整左右分栏宽度
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current || !splitRef.current) return;
      const rect = splitRef.current.getBoundingClientRect();
      const newWidth = Math.max(180, Math.min(500, ev.clientX - rect.left));
      setTreeWidth(newWidth);
    };

    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  // 加载仓库目录树
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/repo-tree?path=${encodeURIComponent(workspacePath)}`)
      .then((r) => {
        if (!r.ok) throw new Error("Server error");
        return r.json();
      })
      .then((data) => {
        if (!cancelled && Array.isArray(data)) {
          setTree(data);
        }
        if (!cancelled) setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [workspacePath]);

  // 加载 diff
  const loadDiff = useCallback(async () => {
    setDiffLoading(true);
    try {
      const res = await fetch(`/repo-diff-files?path=${encodeURIComponent(workspacePath)}`);
      const data = await res.json();
      const files: DiffFileInfo[] = data.files || [];
      setDiffFiles(files);
      // Auto-select first file
      if (files.length > 0) {
        setSelectedDiffFile(files[0].path);
      } else {
        setSelectedDiffFile(null);
      }
    } catch {
      setDiffFiles([]);
      setSelectedDiffFile(null);
    } finally {
      setDiffLoading(false);
    }
  }, [workspacePath]);

  // 切换到 diff tab 时自动加载
  useEffect(() => {
    if (tab === "diff") {
      loadDiff();
    }
  }, [tab, loadDiff]);

  // 读取文件内容
  const openFile = useCallback(
    async (filePath: string) => {
      setSelectedFile(filePath);
      try {
        const res = await fetch(
          `/repo-file?path=${encodeURIComponent(workspacePath)}&file=${encodeURIComponent(filePath)}`,
        );
        const data = await res.json();
        setFileContent(data.content || "");
      } catch {
        setFileContent("// 读取失败");
      }
    },
    [workspacePath],
  );

  // Get selected diff content
  const selectedDiff = selectedDiffFile
    ? diffFiles.find((f) => f.path === selectedDiffFile)
    : null;

  // Build file tree from diff files
  const diffFileTree = useRef<TreeNode[]>([]);
  diffFileTree.current = buildFileTree(diffFiles);

  return (
    <div className="repo-explorer">
      {/* Tab 切换 */}
      <div className="repo-explorer-tabs">
        <button
          className={`repo-explorer-tab ${tab === "tree" ? "active" : ""}`}
          type="button"
          onClick={() => setTab("tree")}
        >
          <GitBranch size={14} />
          目录
        </button>
        <button
          className={`repo-explorer-tab ${tab === "diff" ? "active" : ""}`}
          type="button"
          onClick={() => setTab("diff")}
        >
          <FileDiff size={14} />
          Diff
        </button>
      </div>

      {/* 目录树视图 */}
      {tab === "tree" && (
        <div className="repo-explorer-content">
          {loading ? (
            <div className="repo-explorer-loading">
              <Loader2 size={20} className="spin-icon" />
              <span>加载仓库目录...</span>
            </div>
          ) : tree.length === 0 ? (
            <div className="repo-explorer-empty">
              <p>仓库目录为空</p>
            </div>
          ) : (
            <div className="repo-explorer-split" ref={splitRef}>
              <div className="repo-explorer-tree" style={{ width: treeWidth, flexShrink: 0 }}>
                {tree.map((node) => (
                  <RepoTreeNode
                    key={node.name}
                    node={node}
                    path=""
                    depth={0}
                    selectedFile={selectedFile}
                    onSelect={openFile}
                  />
                ))}
              </div>
              <div className="repo-split-handle" onMouseDown={handleMouseDown} />
              <div className="repo-explorer-preview" style={{ flex: 1, minWidth: 0 }}>
                {selectedFile ? (
                  <>
                    <div className="repo-preview-header">
                      <span className="repo-preview-filename">{selectedFile}</span>
                    </div>
                    <pre className="repo-preview-code">
                      <code>{fileContent}</code>
                    </pre>
                  </>
                ) : (
                  <div className="repo-preview-placeholder">
                    <FileText size={32} />
                    <p>从左侧选择文件查看内容</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Diff 视图 — 左侧变更文件树 + 右侧 Diff 内容 */}
      {tab === "diff" && (
        <div className="repo-explorer-content">
          {diffLoading ? (
            <div className="repo-explorer-loading">
              <Loader2 size={20} className="spin-icon" />
              <span>加载 Diff...</span>
            </div>
          ) : diffFiles.length === 0 ? (
            <div className="repo-explorer-empty">
              <FileDiff size={32} />
              <p>工作区无变更</p>
            </div>
          ) : (
            <div className="repo-diff-split">
              {/* 左侧：变更文件树 */}
              <div className="repo-diff-tree" style={{ width: treeWidth, flexShrink: 0 }}>
                <div className="repo-diff-tree-header">
                  <span className="repo-diff-tree-label">变更文件</span>
                  <button
                    className="ghost-button small"
                    type="button"
                    onClick={loadDiff}
                    title="刷新"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                  </button>
                </div>
                <div className="repo-diff-tree-list">
                  {diffFileTree.current.map((node) => (
                    <DiffTreeNode
                      key={node.name}
                      node={node}
                      path=""
                      depth={0}
                      diffFiles={diffFiles}
                      selectedFile={selectedDiffFile}
                      onSelect={setSelectedDiffFile}
                    />
                  ))}
                </div>
              </div>
              <div className="repo-split-handle" onMouseDown={handleMouseDown} />
              {/* 右侧：Diff 内容 */}
              <div className="repo-diff-preview" style={{ flex: 1, minWidth: 0 }}>
                {selectedDiff ? (
                  <div className="repo-diff-viewer">
                    <div className={`repo-diff-header diff-type-${selectedDiff.changeType}`}>
                      <span className={`repo-diff-type-badge diff-type-${selectedDiff.changeType}`}>
                        {selectedDiff.changeType === "create" ? "新增" : selectedDiff.changeType === "delete" ? "删除" : "修改"}
                      </span>
                      <span className="repo-diff-label">{selectedDiff.path}</span>
                      <span className="repo-diff-stats">
                        <span className="diff-stat-add">+{selectedDiff.additions}</span>
                        <span className="diff-stat-del">-{selectedDiff.deletions}</span>
                      </span>
                    </div>
                    <DiffViewer content={selectedDiff.diff} />
                  </div>
                ) : (
                  <div className="repo-preview-placeholder">
                    <FileDiff size={32} />
                    <p>从左侧选择文件查看变更</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 文件树节点 ──────────────────────────────

function RepoTreeNode({
  node,
  path: parentPath,
  depth = 0,
  selectedFile,
  onSelect,
}: {
  node: TreeNode;
  path: string;
  depth?: number;
  selectedFile: string | null;
  onSelect: (filePath: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const fullPath = parentPath ? `${parentPath}/${node.name}` : node.name;

  if (node.type === "folder") {
    return (
      <div className="repo-tree-folder">
        <button
          className="repo-tree-toggle"
          type="button"
          style={{ paddingLeft: 8 + depth * 16 }}
          onClick={() => setExpanded(!expanded)}
        >
          <ChevronRight
            size={14}
            style={{
              transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.2s",
            }}
          />
          <Folder size={14} />
          <span>{node.name}</span>
        </button>
        {expanded &&
          node.children?.map((child) => (
            <RepoTreeNode
              key={child.name}
              node={child}
              path={fullPath}
              depth={depth + 1}
              selectedFile={selectedFile}
              onSelect={onSelect}
            />
          ))}
      </div>
    );
  }

  return (
    <button
      className={`repo-tree-file ${selectedFile === fullPath ? "active" : ""}`}
      type="button"
      style={{ paddingLeft: 8 + depth * 16 + 12 }}
      onClick={() => onSelect(fullPath)}
    >
      <FileText size={14} />
      <span>{node.name}</span>
    </button>
  );
}

// ── Diff 文件树节点 ─────────────────────────

function DiffTreeNode({
  node,
  path: parentPath,
  depth = 0,
  diffFiles,
  selectedFile,
  onSelect,
}: {
  node: TreeNode;
  path: string;
  depth?: number;
  diffFiles: DiffFileInfo[];
  selectedFile: string | null;
  onSelect: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const fullPath = parentPath ? `${parentPath}/${node.name}` : node.name;

  if (node.type === "folder") {
    return (
      <div className="repo-tree-folder">
        <button
          className="repo-tree-toggle"
          type="button"
          style={{ paddingLeft: 8 + depth * 16 }}
          onClick={() => setExpanded(!expanded)}
        >
          <ChevronRight
            size={14}
            style={{
              transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.2s",
            }}
          />
          <Folder size={14} />
          <span>{node.name}</span>
        </button>
        {expanded &&
          node.children?.map((child) => (
            <DiffTreeNode
              key={child.name}
              node={child}
              path={fullPath}
              depth={depth + 1}
              diffFiles={diffFiles}
              selectedFile={selectedFile}
              onSelect={onSelect}
            />
          ))}
      </div>
    );
  }

  const info = diffFiles.find((f) => f.path === fullPath);
  const isSelected = selectedFile === fullPath;

  const changeIcon = () => {
    if (!info) return <FileDiff size={14} className="diff-icon-mod" />;
    switch (info.changeType) {
      case "create":
        return <FilePlus size={14} className="diff-icon-create" />;
      case "delete":
        return <FileMinus size={14} className="diff-icon-delete" />;
      default:
        return <FileDiff size={14} className="diff-icon-modify" />;
    }
  };

  return (
    <button
      className={`repo-tree-file diff-file diff-type-${info?.changeType || "modify"} ${isSelected ? "active" : ""}`}
      type="button"
      style={{ paddingLeft: 8 + depth * 16 + 12 }}
      onClick={() => onSelect(fullPath)}
    >
      {changeIcon()}
      <span className="diff-file-name">{node.name}</span>
      {info && (
        <span className="diff-file-stats-inline">
          <span className="diff-stat-add">+{info.additions}</span>
          <span className="diff-stat-del">-{info.deletions}</span>
        </span>
      )}
    </button>
  );
}
