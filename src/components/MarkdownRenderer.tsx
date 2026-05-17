"use client";

import { useState, useEffect, useRef, useMemo, type FC } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import mermaid from "mermaid";
import { Check, Copy } from "lucide-react";

// ── Mermaid 初始化（全局一次） ──────────────
let mermaidInitialized = false;
function ensureMermaid() {
  if (!mermaidInitialized) {
    mermaid.initialize({ theme: "default", startOnLoad: false });
    mermaidInitialized = true;
  }
}

// ── 复制到剪贴板 hook ──────────────────────
function useCopyToClipboard(copiedDuration = 3000) {
  const [isCopied, setIsCopied] = useState(false);
  const copyToClipboard = (value: string) => {
    if (!value || typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(value).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), copiedDuration);
    });
  };
  return { isCopied, copyToClipboard };
}

// ── 代码块头部（语言标签 + 复制按钮）───────
const CodeHeader: FC<{ language?: string; code: string }> = ({ language, code }) => {
  const { isCopied, copyToClipboard } = useCopyToClipboard();
  return (
    <div className="code-block-header">
      <span className="code-lang-tag">{language || "text"}</span>
      <button
        className="code-copy-btn"
        type="button"
        onClick={() => copyToClipboard(code)}
        title="复制代码"
      >
        {isCopied ? <Check size={13} /> : <Copy size={13} />}
      </button>
    </div>
  );
};

// ── Mermaid 图表组件 ────────────────────────
const MermaidBlock: FC<{ code: string }> = ({ code }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    ensureMermaid();
    let cancelled = false;
    const id = `mermaid-${Math.random().toString(36).slice(2)}`;
    mermaid
      .render(id, code)
      .then((result) => {
        if (!cancelled) setSvg(result.svg);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) {
    return (
      <div className="mermaid-error">
        <span>⚠ Mermaid 图表渲染失败，请检查语法</span>
        <pre className="mermaid-error-code">{code}</pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="mermaid-loading">
        <span className="cursor-blink" />
        <span> 绘制图表中...</span>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="mermaid-container"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

// ── Markdown 渲染器 ─────────────────────────
type MarkdownRendererProps = {
  children: string;
  className?: string;
};

export function MarkdownRenderer({ children, className }: MarkdownRendererProps) {
  const components = useMemo(
    () => ({
      // ── 代码块 ──────────────────────────
      pre: ({ children, ...props }: any) => {
        // 提取 code 元素信息
        const codeEl = children?.props;
        const codeStr = String(codeEl?.children || "").replace(/\n$/, "");
        const language = codeEl?.className?.replace("language-", "") || "";

        // Mermaid 图表
        if (language === "mermaid") {
          return <MermaidBlock code={codeStr} />;
        }

        return (
          <div className="markdown-code-block">
            <CodeHeader language={language} code={codeStr} />
            <pre {...props}>{children}</pre>
          </div>
        );
      },
      // ── 内联代码 ─────────────────────────
      code: ({ children, className, ...props }: any) => {
        const isInline = !className;
        if (isInline) {
          return (
            <code className="inline-code" {...props}>
              {children}
            </code>
          );
        }
        return (
          <code className={className} {...props}>
            {children}
          </code>
        );
      },
    }),
    [],
  );

  return (
    <div className={`markdown-body ${className ?? ""}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
