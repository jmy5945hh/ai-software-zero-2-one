import { useRef, useEffect, useState, useCallback } from "react";
import { X, Copy, Check, ExternalLink } from "lucide-react";
import type { DrawerContent } from "../data/types";
import { DiffViewer } from "./DiffViewer";

type DrawerProps = {
  content: DrawerContent;
  onClose: () => void;
};

/**
 * 右侧抽屉式预览窗口 —— 预览 AI 输出的代码、文档或 HTML。
 * 支持拖拽调整宽度，从右侧滑入。
 */
export function Drawer({ content, onClose }: DrawerProps) {
  const [width, setWidth] = useState(520);
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // diff 类型默认更宽
  useEffect(() => {
    if (content?.type === "diff") setWidth(620);
  }, [content?.type]);

  // 拖拽调整宽度
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      setWidth(Math.max(340, Math.min(900, newWidth)));
    };

    const handleMouseUp = () => setIsDragging(false);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  // ESC 关闭
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // 复制到剪贴板
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 降级：使用旧 API
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!content) return null;

  return (
    <>
      {/* 遮罩层 */}
      <div className="drawer-backdrop" onClick={onClose} />

      {/* 抽屉主体 */}
      <aside
        ref={drawerRef}
        className={`drawer ${content.type === "diff" ? "drawer-wide" : ""}`}
        style={{ width }}
        aria-label="内容预览"
      >
        {/* 拖拽手柄 */}
        <div
          className="drawer-handle"
          onMouseDown={handleMouseDown}
          aria-label="拖拽调整宽度"
        />

        {/* 头部 */}
        <div className="drawer-header">
          <div className="drawer-title">
            <span className="eyebrow">{content.type === "code" ? "代码" : content.type === "html" ? "预览" : content.type === "diff" ? "变更" : "文档"}</span>
            <strong>{content.title}</strong>
            {content.type === "diff" && (
              <span className="drawer-diff-stats">
                <span className="diff-stat-add">+{content.additions}</span>
                <span className="diff-stat-del">-{content.deletions}</span>
              </span>
            )}
          </div>
          <div className="drawer-actions">
            {(content.type === "code" || content.type === "document" || content.type === "diff") && (
              <button
                className="ghost-button small"
                type="button"
                onClick={() => copyToClipboard(content.content)}
                title="复制内容"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            )}
            {content.type === "html" && (
              <button className="ghost-button small" type="button" title="新窗口打开">
                <ExternalLink size={14} />
              </button>
            )}
            <button
              className="ghost-button small"
              type="button"
              onClick={onClose}
              title="关闭"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* 内容区 */}
        <div className="drawer-body">
          {content.type === "code" && (
            <CodePreview language={content.language} code={content.content} />
          )}

          {content.type === "document" && (
            <DocumentPreview markdown={content.content} />
          )}

          {content.type === "html" && (
            <HtmlPreview html={content.html} />
          )}

          {content.type === "file" && (
            <CodePreview language={getLanguageFromPath(content.path)} code={content.content} />
          )}

          {content.type === "diff" && (
            <DiffViewer content={content.content} />
          )}
        </div>
      </aside>
    </>
  );
}

/**
 * 代码预览 —— 带语法高亮的代码块。
 */
function CodePreview({
  language,
  code,
}: {
  language: string;
  code: string;
}) {
  return (
    <div className="code-preview">
      <div className="code-lang-badge">{language}</div>
      <pre className="code-block">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/**
 * 文档预览 —— Markdown 渲染（简化版）。
 */
function DocumentPreview({ markdown }: { markdown: string }) {
  const html = simpleMarkdownToHtml(markdown);
  return (
    <div
      className="document-preview"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * HTML 预览 —— iframe 渲染。
 */
function HtmlPreview({ html }: { html: string }) {
  return (
    <div className="html-preview">
      {html ? (
        <iframe
          srcDoc={html}
          title="HTML 预览"
          sandbox="allow-scripts"
          className="preview-iframe"
        />
      ) : (
        <div className="preview-placeholder">
          <p>沙盒预览将在发布后可用</p>
        </div>
      )}
    </div>
  );
}

// ── 工具函数 ────────────────────────────────

function getLanguageFromPath(path: string): string {
  const ext = path.split(".").pop() || "";
  const map: Record<string, string> = {
    ts: "TypeScript",
    tsx: "TSX",
    js: "JavaScript",
    jsx: "JSX",
    json: "JSON",
    yaml: "YAML",
    yml: "YAML",
    md: "Markdown",
    css: "CSS",
    html: "HTML",
  };
  return map[ext] || ext;
}

/**
 * 简易 Markdown → HTML，仅处理标题、粗体、代码块、列表。
 */
function simpleMarkdownToHtml(md: string): string {
  let html = md
    // 代码块 (用 ``` 包裹)
    .replace(/```([\s\S]*?)```/g, (_: string, code: string) => {
      return `<pre class="md-code"><code>${escapeHtml(code.trim())}</code></pre>`;
    })
    // 内联代码
    .replace(/`([^`]+)`/g, "<code class=\"md-inline\">$1</code>")
    // 标题
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // 粗体
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    // 表格分隔行
    .replace(/^\|[-| ]+\|$/gm, "")
    // 表格行
    .replace(/^\|(.+)\|$/gm, (_: string, cells: string) => {
      const tds = cells
        .split("|")
        .map((c: string) => `<td>${c.trim()}</td>`)
        .join("");
      return `<tr>${tds}</tr>`;
    })
    // 包裹相邻 tr
    .replace(/(<tr>[\s\S]*?<\/tr>)+/g, "<table>$&</table>")
    // 无序列表
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>[\s\S]*?<\/li>)+/g, "<ul>$&</ul>")
    // 段落
    .replace(/\n\n/g, "</p><p>")
    // 单换行
    .replace(/\n/g, "<br/>");

  html = `<p>${html}</p>`;
  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
