import { useEffect, useCallback } from "react";
import { X, Maximize2 } from "lucide-react";
import { MarkdownRenderer } from "./MarkdownRenderer";

export type ModalContent = {
  type: "code" | "markdown" | "json" | "diff" | "html";
  title: string;
  content: string;
  language?: string;
};

type ContentModalProps = {
  content: ModalContent | null;
  onClose: () => void;
};

/**
 * 全屏模态弹窗 —— 用于查看大段代码、文档、HTML 预览等内容。
 * ESC 或点击遮罩关闭。
 */
export function ContentModal({ content, onClose }: ContentModalProps) {
  // ESC 关闭
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
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

  if (!content) return null;

  return (
    <>
      {/* 遮罩 */}
      <div className="content-modal-backdrop" onClick={onClose} />

      {/* 弹窗主体 */}
      <div className="content-modal" aria-label="内容查看">
        {/* 头部 */}
        <div className="content-modal-header">
          <div className="content-modal-title">
            <Maximize2 size={16} />
            <span className="content-modal-type-tag">{getTypeLabel(content.type)}</span>
            <strong>{content.title}</strong>
          </div>
          <button
            className="content-modal-close"
            type="button"
            onClick={onClose}
            title="关闭 (ESC)"
          >
            <X size={18} />
          </button>
        </div>

        {/* 内容 */}
        <div className="content-modal-body">
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

/** Diff 查看器 */
function DiffViewer({ content }: { content: string }) {
  const lines = parseDiffLines(content);
  return (
    <div className="content-modal-diff">
      {lines.map((line, i) => (
        <div key={i} className={`cm-diff-line ${line.type}`}>
          <span className="cm-diff-num">{i + 1}</span>
          <span className="cm-diff-text">{line.content}</span>
        </div>
      ))}
    </div>
  );
}

type DiffLine = { type: "add" | "del" | "ctx"; content: string };

function parseDiffLines(text: string): DiffLine[] {
  return text.split("\n").map((line) => {
    if (line.startsWith("+") && !line.startsWith("+++")) return { type: "add", content: line };
    if (line.startsWith("-") && !line.startsWith("---")) return { type: "del", content: line };
    return { type: "ctx", content: line };
  });
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
