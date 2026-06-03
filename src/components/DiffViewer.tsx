import { useMemo } from "react";

// ── Types ──────────────────────────────────

type DiffLineType = "add" | "del" | "ctx" | "hunk" | "file-header";

type ParsedDiffLine = {
  type: DiffLineType;
  content: string;
  oldLine: number | null;
  newLine: number | null;
};

type ParsedFileDiff = {
  oldPath: string;
  newPath: string;
  lines: ParsedDiffLine[];
  additions: number;
  deletions: number;
};

// ── Parser ─────────────────────────────────

/**
 * Parse unified git diff output into structured file diffs.
 * Handles:
 *   diff --git a/file b/file
 *   --- a/file
 *   +++ b/file
 *   @@ -old,count +new,count @@
 *   context / added / deleted lines
 */
function parseDiff(text: string): ParsedFileDiff[] {
  const files: ParsedFileDiff[] = [];
  let currentFile: ParsedFileDiff | null = null;
  let oldLine = 0;
  let newLine = 0;

  const lines = text.split("\n");

  for (const line of lines) {
    // File header: diff --git a/... b/...
    const fileHeaderMatch = line.match(/^diff --git a\/(.+?) b\/(.+?)$/);
    if (fileHeaderMatch) {
      if (currentFile) files.push(currentFile);
      currentFile = {
        oldPath: fileHeaderMatch[1],
        newPath: fileHeaderMatch[2],
        lines: [],
        additions: 0,
        deletions: 0,
      };
      currentFile.lines.push({ type: "file-header", content: line, oldLine: null, newLine: null });
      continue;
    }

    if (!currentFile) {
      // Lines before any file header — treat as context
      if (!files.length) {
        currentFile = {
          oldPath: "",
          newPath: "",
          lines: [],
          additions: 0,
          deletions: 0,
        };
        files.push(currentFile);
      } else {
        currentFile = files[files.length - 1];
      }
    }

    // Hunk header: @@ -old,count +new,count @@
    const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkMatch) {
      oldLine = parseInt(hunkMatch[1], 10);
      newLine = parseInt(hunkMatch[2], 10);
      currentFile.lines.push({ type: "hunk", content: line, oldLine: null, newLine: null });
      continue;
    }

    // Skip ---/+++ lines (we have file header)
    if (line.startsWith("--- ") || line.startsWith("+++ ")) {
      currentFile.lines.push({ type: "ctx", content: line, oldLine: null, newLine: null });
      continue;
    }

    // Added line
    if (line.startsWith("+")) {
      currentFile.lines.push({ type: "add", content: line, oldLine: null, newLine });
      currentFile.additions++;
      newLine++;
      continue;
    }

    // Deleted line
    if (line.startsWith("-")) {
      currentFile.lines.push({ type: "del", content: line, oldLine, newLine: null });
      currentFile.deletions++;
      oldLine++;
      continue;
    }

    // Context line
    currentFile.lines.push({ type: "ctx", content: line, oldLine, newLine });
    oldLine++;
    newLine++;
  }

  if (currentFile) files.push(currentFile);
  return files;
}

// ── Simple syntax highlighting for diff content ──

const SYNTAX_MAP: Record<string, RegExp[]> = {
  keyword: [
    /\b(import|export|from|const|let|var|function|return|if|else|for|while|class|extends|interface|type|async|await|new|throw|try|catch|finally|default|switch|case|break|continue|typeof|instanceof|void|delete|in|of|this|super|yield|static|private|public|protected|readonly|abstract|declare|namespace|module|enum|implements)\b/g,
  ],
  string: [
    /("(?:[^"\\]|\\.)*")/g,
    /('(?:[^'\\]|\\.)*')/g,
    /(`(?:[^`\\]|\\.)*`)/g,
  ],
  comment: [
    /(\/\/.*$)/gm,
    /(\/\*[\s\S]*?\*\/)/g,
  ],
  number: [
    /\b(\d+\.?\d*)\b/g,
  ],
  tag: [
    /(&lt;\/?[\w-]+)/g,
    /(&gt;)/g,
  ],
};

function highlightLine(text: string): string {
  let escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Apply syntax highlighting patterns
  const patterns: [string, RegExp][] = [
    ["comment", /(\/\/.*$)/gm],
    ["string", /("(?:[^"\\]|\\.)*")/g],
    ["string", /('(?:[^'\\]|\\.)*')/g],
    ["string", /(`(?:[^`\\]|\\.)*`)/g],
    ["keyword", /\b(import|export|from|const|let|var|function|return|if|else|for|while|class|extends|interface|type|async|await|new|throw|try|catch|finally|default|switch|case|break|continue|typeof|instanceof|void|delete|in|of|this|super|yield|static|private|public|protected|readonly|abstract|declare|namespace|module|enum|implements)\b/g],
    ["number", /\b(\d+\.?\d*)\b/g],
    ["tag", /(&lt;\/?[\w-]+)/g],
  ];

  for (const [cls, re] of patterns) {
    escaped = escaped.replace(re, `<span class="hl-${cls}">$1</span>`);
  }

  return escaped;
}

// ── Component ──────────────────────────────

type DiffViewerProps = {
  content: string;
  maxLines?: number;
  className?: string;
  showFileHeaders?: boolean;
};

export function DiffViewer({ content, maxLines, className = "", showFileHeaders = true }: DiffViewerProps) {
  const files = useMemo(() => parseDiff(content), [content]);

  if (!content || files.length === 0) {
    return <div className="diff-viewer-empty">No changes</div>;
  }

  const totalLines = files.reduce((sum, f) => sum + f.lines.length, 0);
  const truncated = maxLines != null && totalLines > maxLines;

  let lineCount = 0;
  let hasMore = false;

  return (
    <div className={`diff-viewer ${className}`}>
      {files.map((file, fi) => {
        if (truncated && lineCount >= maxLines!) {
          hasMore = true;
          return null;
        }

        const fileLines: React.ReactNode[] = [];
        let fileLineCount = 0;

        for (const line of file.lines) {
          if (truncated && lineCount >= maxLines!) {
            hasMore = true;
            break;
          }

          fileLines.push(
            <DiffLineRow key={`${fi}-${lineCount}`} line={line} />
          );
          lineCount++;
          fileLineCount++;
        }

        return (
          <div key={fi} className="diff-file">
            {showFileHeaders && file.newPath && (
              <div className="diff-file-header">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <span className="diff-file-path">{file.newPath}</span>
                <span className="diff-file-stats">
                  <span className="diff-stat-add">+{file.additions}</span>
                  <span className="diff-stat-del">-{file.deletions}</span>
                </span>
              </div>
            )}
            <div className="diff-file-lines">
              {fileLines}
            </div>
          </div>
        );
      })}
      {hasMore && (
        <div className="diff-more">
          ... 共 {totalLines} 行，弹窗查看完整内容
        </div>
      )}
    </div>
  );
}

// ── Single diff line row ───────────────────

function DiffLineRow({ line }: { line: ParsedDiffLine }) {
  const lineNumStr = (n: number | null) => (n != null ? String(n) : "");

  switch (line.type) {
    case "file-header":
      return null; // handled by file header block

    case "hunk":
      return (
        <div className="diff-line hunk">
          <span className="diff-gutter" />
          <span className="diff-old-num" />
          <span className="diff-new-num" />
          <span className="diff-content hunk-text">{line.content}</span>
        </div>
      );

    case "add":
      return (
        <div className="diff-line add">
          <span className="diff-gutter add" />
          <span className="diff-old-num" />
          <span className="diff-new-num">{line.newLine}</span>
          <span
            className="diff-content add"
            dangerouslySetInnerHTML={{ __html: highlightLine(line.content) }}
          />
        </div>
      );

    case "del":
      return (
        <div className="diff-line del">
          <span className="diff-gutter del" />
          <span className="diff-old-num">{line.oldLine}</span>
          <span className="diff-new-num" />
          <span
            className="diff-content del"
            dangerouslySetInnerHTML={{ __html: highlightLine(line.content) }}
          />
        </div>
      );

    default:
      return (
        <div className="diff-line ctx">
          <span className="diff-gutter" />
          <span className="diff-old-num">{line.oldLine}</span>
          <span className="diff-new-num">{line.newLine}</span>
          <span
            className="diff-content ctx"
            dangerouslySetInnerHTML={{ __html: highlightLine(line.content) }}
          />
        </div>
      );
  }
}

// ── Re-export parser for external use ──────

export { parseDiff };
export type { ParsedDiffLine, ParsedFileDiff, DiffLineType };
