import { useEffect, useCallback, useState } from "react";
import { X, Maximize2, Edit3, Save, RotateCcw } from "lucide-react";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { DiffViewer } from "./DiffViewer";
import { agentFetch } from "../agent/config";

export type ModalContent = {
  type: "code" | "markdown" | "json" | "diff" | "html";
  title: string;
  content: string;
  language?: string;
  /** 可编辑文件的路径（用于保存时写回） */
  filePath?: string;
  /** 工作空间路径 */
  workspacePath?: string;
};

type ContentModalProps = {
  content: ModalContent | null;
  onClose: () => void;
};

/**
 * 全屏模态弹窗 —— 用于查看大段代码、文档、HTML 预览等内容。
 * ESC 或点击遮罩关闭。
 * Markdown 文件支持原地编辑保存。
 */
export function ContentModal({ content, onClose }: ContentModalProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // 当 content 变化时重置编辑状态
  useEffect(() => {
    setEditing(false);
    setEditValue("");
    setSaveError(null);
  }, [content]);

  // ESC 关闭
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (editing) {
          setEditing(false);
          setEditValue("");
          setSaveError(null);
        } else {
          onClose();
        }
      }
    },
    [onClose, editing],
  );

  useEffect(() => {
    if (!content) return;
    window.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [content, handleKey]);

  const handleStartEdit = () => {
    setEditValue(content?.content || "");
    setEditing(true);
    setSaveError(null);
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setEditValue("");
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!content?.filePath || !content?.workspacePath) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await agentFetch("/specs-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: content.workspacePath,
          file: content.filePath,
          content: editValue,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "保存失败" }));
        throw new Error(err.error || "保存失败");
      }
      // 保存成功：更新 content 内容，退出编辑模式
      content.content = editValue;
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  if (!content) return null;

  const isMarkdown = content.type === "markdown";
  const isEditable = isMarkdown && content.filePath && content.workspacePath;

  return (
    <>
      {/* 遮罩 */}
      <div className="content-modal-backdrop" onClick={editing ? undefined : onClose} />

      {/* 弹窗主体 */}
      <div className="content-modal" aria-label="内容查看">
        {/* 头部 */}
        <div className="content-modal-header">
          <div className="content-modal-title">
            <Maximize2 size={16} />
            <span className="content-modal-type-tag">
              {editing ? "编辑" : getTypeLabel(content.type)}
            </span>
            <strong>{content.title}</strong>
          </div>
          <div className="content-modal-header-actions">
            {isEditable && !editing && (
              <button
                className="content-modal-edit-btn"
                type="button"
                onClick={handleStartEdit}
                title="编辑此文件"
              >
                <Edit3 size={15} />
                <span>编辑</span>
              </button>
            )}
            {editing && (
              <>
                <button
                  className="content-modal-save-btn"
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  title="保存"
                >
                  <Save size={15} />
                  <span>{saving ? "保存中..." : "保存"}</span>
                </button>
                <button
                  className="content-modal-cancel-btn"
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={saving}
                  title="取消"
                >
                  <RotateCcw size={15} />
                  <span>取消</span>
                </button>
              </>
            )}
            <button
              className="content-modal-close"
              type="button"
              onClick={onClose}
              title="关闭 (ESC)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 内容 */}
        <div className="content-modal-body">
          {editing ? (
            <div className="content-modal-editor">
              <textarea
                className="content-modal-textarea"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                spellCheck={false}
              />
              {saveError && (
                <div className="content-modal-save-error">
                  <X size={14} />
                  <span>{saveError}</span>
                </div>
              )}
            </div>
          ) : (
            <>
              {content.type === "code" && (
                <CodeViewer language={content.language || "text"} code={content.content} />
              )}

              {content.type === "markdown" && (
                <MarkdownRenderer>{content.content}</MarkdownRenderer>
              )}

              {content.type === "json" && (
                <CodeViewer language="json" code={formatJson(content.content)} />
              )}

              {content.type === "diff" && (
                <DiffViewer content={content.content} />
              )}

              {content.type === "html" && (
                <div className="content-modal-html">
                  {content.content ? (
                    <iframe
                      srcDoc={content.content}
                      title={content.title}
                      sandbox="allow-scripts"
                      className="content-modal-iframe"
                    />
                  ) : (
                    <div className="content-modal-placeholder">
                      <p>沙盒预览将在发布后可用</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

/** 带语法标签的代码查看器 */
function CodeViewer({ language, code }: { language: string; code: string }) {
  return (
    <div className="content-modal-code">
      <span className="content-modal-lang">{language}</span>
      <pre className="content-modal-pre"><code>{code}</code></pre>
    </div>
  );
}

function formatJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

function getTypeLabel(type: ModalContent["type"]): string {
  const map: Record<string, string> = {
    code: "代码",
    markdown: "文档",
    json: "JSON",
    diff: "变更",
    html: "预览",
  };
  return map[type] || type;
}
