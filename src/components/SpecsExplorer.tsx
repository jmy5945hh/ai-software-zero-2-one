import { useState, useEffect, useCallback, useRef } from "react";
import {
  Folder,
  FileText,
  ChevronRight,
  Save,
  Loader2,
} from "lucide-react";
import { agentFetch } from "../agent/config";

type TreeNode = {
  name: string;
  type: "file" | "folder";
  children?: TreeNode[];
};

type SpecsExplorerProps = {
  workspacePath: string;
};

/**
 * SpecsExplorer — 浏览 workspacePath/specs 目录下的所有文档，支持编辑。
 * 通过 HTTP 请求 server 的 /specs-tree、/specs-file、/specs-save 端点。
 */
export function SpecsExplorer({ workspacePath }: SpecsExplorerProps) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [isMarkdown, setIsMarkdown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
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

  // 加载 specs 目录树
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    agentFetch(`/server/specs-tree?path=${encodeURIComponent(workspacePath)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setTree(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [workspacePath]);

  // 读取文件内容
  const openFile = useCallback(
    async (filePath: string) => {
      setSelectedFile(filePath);
      setDirty(false);
      try {
        const res = await agentFetch(
          `/specs-file?path=${encodeURIComponent(workspacePath)}&file=${encodeURIComponent(filePath)}`,
        );
        const data = await res.json();
        setFileContent(data.content || "");
        setIsMarkdown(data.isMarkdown || false);
      } catch {
        setFileContent("// 读取失败");
        setIsMarkdown(false);
      }
    },
    [workspacePath],
  );

  // 保存文件
  const saveFile = useCallback(async () => {
    if (!selectedFile) return;
    setSaving(true);
    try {
      await agentFetch("/server/specs-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: workspacePath,
          file: selectedFile,
          content: fileContent,
        }),
      });
      setDirty(false);
    } catch {
      // 静默失败
    } finally {
      setSaving(false);
    }
  }, [selectedFile, workspacePath, fileContent]);

  if (loading) {
    return (
      <div className="specs-explorer-loading">
        <Loader2 size={20} className="spin-icon" />
        <span>加载 specs 目录...</span>
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <div className="specs-explorer-empty">
        <p>specs 目录为空或不存在</p>
      </div>
    );
  }

  return (
    <div className="specs-explorer" ref={splitRef}>
      {/* 左侧文件树 */}
      <div className="specs-explorer-tree" style={{ width: treeWidth, flexShrink: 0 }}>
        {tree.map((node) => (
          <TreeNodeItem
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
      {/* 右侧编辑器 */}
      <div className="specs-explorer-editor" style={{ flex: 1, minWidth: 0 }}>
        {selectedFile ? (
          <>
            <div className="specs-editor-header">
              <span className="specs-editor-filename">{selectedFile}</span>
              {isMarkdown && <span className="specs-editor-badge">Markdown</span>}
              <button
                className="primary-action small"
                type="button"
                onClick={saveFile}
                disabled={!dirty || saving}
              >
                {saving ? (
                  <Loader2 size={14} className="spin-icon" />
                ) : (
                  <Save size={14} />
                )}
                保存
              </button>
            </div>
            <textarea
              className="specs-editor-textarea"
              value={fileContent}
              onChange={(e) => {
                setFileContent(e.target.value);
                setDirty(true);
              }}
              spellCheck={false}
            />
          </>
        ) : (
          <div className="specs-editor-placeholder">
            <FileText size={32} />
            <p>从左侧选择文件进行编辑</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 文件树节点 ──────────────────────────────

function TreeNodeItem({
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
      <div className="specs-tree-folder">
        <button
          className="specs-tree-toggle"
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
            <TreeNodeItem
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
      className={`specs-tree-file ${selectedFile === fullPath ? "active" : ""}`}
      type="button"
      style={{ paddingLeft: 8 + depth * 16 + 12 }}
      onClick={() => onSelect(fullPath)}
    >
      <FileText size={14} />
      <span>{node.name}</span>
    </button>
  );
}
