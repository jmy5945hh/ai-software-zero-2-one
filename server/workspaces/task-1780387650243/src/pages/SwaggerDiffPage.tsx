import { useState, useCallback } from "react";
import {
  ArrowRightLeft,
  Sparkles,
  History,
  RotateCcw,
  Trash2,
  Download,
  SplitSquareHorizontal,
  AlertTriangle,
} from "lucide-react";
import { SwaggerInputPanel } from "../components/SwaggerInputPanel";
import { SwaggerDiffReport } from "../components/SwaggerDiffReport";
import { diffSwaggerDocs } from "../utils/diff-engine";
import {
  mockSwaggerV1,
  mockSwaggerV2,
  loadStoredReports,
  saveReport,
  clearReports,
} from "../mocks/swagger-diff";
import type {
  SwaggerInputState,
  SwaggerDoc,
  SwaggerDiffReport as SwaggerDiffReportType,
} from "../types/swagger-diff";

type CompareStatus = "idle" | "comparing" | "done" | "error";

/**
 * Swagger 差异对比页面
 * 提供两个输入面板，支持粘贴/上传/示例数据三种方式输入 Swagger 文档，
 * 自动对比并生成结构化差异报告。
 */
export function SwaggerDiffPage() {
  // ── 输入状态 ───────────────────────────
  const [sourceInput, setSourceInput] = useState<SwaggerInputState>({
    label: "源文档（旧版本）",
    method: "mock",
    content: "",
  });
  const [targetInput, setTargetInput] = useState<SwaggerInputState>({
    label: "目标文档（新版本）",
    method: "mock",
    content: "",
  });

  const [status, setStatus] = useState<CompareStatus>("idle");
  const [report, setReport] = useState<SwaggerDiffReportType | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [history, setHistory] = useState<SwaggerDiffReportType[]>(() =>
    loadStoredReports(),
  );
  const [showHistory, setShowHistory] = useState(false);

  // ── 解析并对比 ─────────────────────────
  const handleCompare = useCallback(() => {
    setStatus("comparing");
    setErrorMsg("");

    try {
      // 解析源文档
      let sourceDoc: SwaggerDoc;
      if (sourceInput.method === "mock") {
        sourceDoc = mockSwaggerV1;
      } else {
        sourceDoc = JSON.parse(sourceInput.content) as SwaggerDoc;
      }

      // 解析目标文档
      let targetDoc: SwaggerDoc;
      if (targetInput.method === "mock") {
        targetDoc = mockSwaggerV2;
      } else {
        targetDoc = JSON.parse(targetInput.content) as SwaggerDoc;
      }

      // 校验基本结构
      if (!sourceDoc.openapi || !sourceDoc.paths) {
        throw new Error("源文档缺少必要的 openapi 版本或 paths 字段");
      }
      if (!targetDoc.openapi || !targetDoc.paths) {
        throw new Error("目标文档缺少必要的 openapi 版本或 paths 字段");
      }

      // 执行对比
      const result = diffSwaggerDocs(sourceDoc, targetDoc);
      setReport(result);
      saveReport(result);
      setHistory((prev) => [result, ...prev.slice(0, 19)]);
      setStatus("done");
    } catch (err) {
      setErrorMsg((err as Error).message || "解析失败，请检查 JSON 格式");
      setStatus("error");
    }
  }, [sourceInput, targetInput]);

  // ── 重置 ───────────────────────────────
  const handleReset = useCallback(() => {
    setSourceInput({ label: "源文档（旧版本）", method: "mock", content: "" });
    setTargetInput({ label: "目标文档（新版本）", method: "mock", content: "" });
    setReport(null);
    setStatus("idle");
    setErrorMsg("");
  }, []);

  // ── 从历史恢复 ─────────────────────────
  const handleHistorySelect = useCallback((r: SwaggerDiffReportType) => {
    setReport(r);
    setStatus("done");
    setShowHistory(false);
  }, []);

  // ── 导出报告为 JSON ────────────────────
  const handleExport = useCallback(() => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `swagger-diff-${report.sourceDoc.version}-to-${report.targetDoc.version}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [report]);

  // ── 清空历史 ───────────────────────────
  const handleClearHistory = useCallback(() => {
    clearReports();
    setHistory([]);
  }, []);

  const canCompare =
    sourceInput.method === "mock" || sourceInput.content.trim().length > 0;
  const canCompare2 =
    targetInput.method === "mock" || targetInput.content.trim().length > 0;
  const ready = canCompare && canCompare2 && status !== "comparing";

  return (
    <main className="swagger-diff-shell">
      {/* ── 顶部导航 ──────────────────────── */}
      <header className="swagger-diff-nav">
        <div className="brand">
          <div className="brand-mark">
            <Sparkles size={18} />
          </div>
          <div>
            <strong>AI原生研发平台</strong>
            <span>Swagger API 差异对比</span>
          </div>
        </div>
        <div className="swagger-diff-nav-actions">
          <button
            type="button"
            className={`ghost-button ${showHistory ? "active" : ""}`}
            onClick={() => setShowHistory(!showHistory)}
          >
            <History size={14} />
            历史记录
          </button>
          {report && (
            <button type="button" className="ghost-button" onClick={handleExport}>
              <Download size={14} />
              导出 JSON
            </button>
          )}
          <button type="button" className="ghost-button" onClick={handleReset}>
            <RotateCcw size={14} />
            重置
          </button>
        </div>
      </header>

      {/* ── 主内容区 ──────────────────────── */}
      <div className="swagger-diff-body">
        {/* ── 历史记录侧边栏 ──────────────── */}
        {showHistory && (
          <aside className="swagger-diff-history">
            <div className="diff-history-header">
              <h3>
                <History size={16} />
                对比历史
              </h3>
              {history.length > 0 && (
                <button
                  type="button"
                  className="ghost-button danger-lite"
                  onClick={handleClearHistory}
                >
                  <Trash2 size={12} />
                  清空
                </button>
              )}
            </div>
            {history.length === 0 ? (
              <p className="diff-history-empty">暂无历史记录</p>
            ) : (
              <div className="diff-history-list">
                {history.map((r, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`diff-history-item ${
                      report === r ? "active" : ""
                    }`}
                    onClick={() => handleHistorySelect(r)}
                  >
                    <div className="diff-history-versions">
                      <span className="diff-version-badge source">
                        {r.sourceDoc.version}
                      </span>
                      <ArrowRightLeft size={12} />
                      <span className="diff-version-badge target">
                        {r.targetDoc.version}
                      </span>
                    </div>
                    <div className="diff-history-meta">
                      <span
                        className={`diff-compat-tag ${r.compatibility}`}
                      >
                        {r.compatibility === "breaking" ? "破坏性" : "兼容"}
                      </span>
                      <span className="diff-history-time">
                        {new Date(r.comparedAt).toLocaleDateString("zh-CN")}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </aside>
        )}

        {/* ── 对比主区域 ──────────────────── */}
        <div className="swagger-diff-content">
          {/* 输入区：左右面板 */}
          <div className="swagger-diff-inputs">
            <SwaggerInputPanel
              label="源文档（旧版本）"
              value={sourceInput}
              onChange={setSourceInput}
              isSource
            />

            <div className="swagger-diff-divider">
              <div className="swagger-diff-divider-line" />
              <ArrowRightLeft
                size={20}
                className="swagger-diff-divider-icon"
              />
              <div className="swagger-diff-divider-line" />
            </div>

            <SwaggerInputPanel
              label="目标文档（新版本）"
              value={targetInput}
              onChange={setTargetInput}
            />
          </div>

          {/* 操作区 */}
          <div className="swagger-diff-actions">
            <button
              type="button"
              className="primary-action wide"
              disabled={!ready}
              onClick={handleCompare}
            >
              {status === "comparing" ? (
                <>对比中...</>
              ) : (
                <>
                  <SplitSquareHorizontal size={16} />
                  开始对比
                </>
              )}
            </button>
            {(status === "done" || status === "error") && (
              <button
                type="button"
                className="ghost-button"
                onClick={handleReset}
              >
                <RotateCcw size={14} />
                重新对比
              </button>
            )}
          </div>

          {/* 错误提示 */}
          {status === "error" && (
            <div className="swagger-diff-error">
              <AlertTriangle size={18} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 差异报告 */}
          {report && status === "done" && (
            <SwaggerDiffReport report={report} />
          )}
        </div>
      </div>
    </main>
  );
}
