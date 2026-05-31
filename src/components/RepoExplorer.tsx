import { useState, useEffect, useCallback, useRef } from "react";
import {
  Folder,
  FileText,
  ChevronRight,
  GitBranch,
  Loader2,
  FileDiff,
} from "lucide-react";

type TreeNode = {
  name: string;
  type: "file" | "folder";
  children?: TreeNode[];
};

type RepoExplorerProps = {
  workspacePath: string;
};

type RepoTab = "tree" | "diff";

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
  const [diffContent, setDiffContent] = useState("");
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
      const res = await fetch(`/repo-diff?path=${encodeURIComponent(workspacePath)}`);
      const data = await res.json();
      setDiffContent(data.diff || "No changes");
    } catch {
      setDiffContent("// 获取 diff 失败");
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

      {/* Diff 视图 */}
      {tab === "diff" && (
        <div className="repo-explorer-content">
          {diffLoading ? (
            <div className="repo-explorer-loading">
              <Loader2 size={20} className="spin-icon" />
              <span>加载 Diff...</span>
            </div>
          ) : (
            <div className="repo-diff-viewer">
              <div className="repo-diff-header">
                <span className="repo-diff-label">工作区变更 (git diff HEAD)</span>
                <button
                  className="ghost-button small"
                  type="button"
                  onClick={loadDiff}
                >
                  刷新
                </button>
              </div>
              <pre className="repo-diff-content">
                <code>{diffContent}</code>
              </pre>
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
