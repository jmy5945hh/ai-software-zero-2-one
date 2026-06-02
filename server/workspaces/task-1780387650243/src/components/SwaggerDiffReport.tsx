import { useState } from "react";
import {
  AlertTriangle,
  Info,
  ArrowUpDown,
  CheckCircle,
  XCircle,
  Plus,
  Minus,
  Pencil,
  AlertOctagon,
  FileWarning,
  Layers,
  Server,
  Route,
  Code2,
} from "lucide-react";
import type { SwaggerDiffReport, DiffItem, DiffSeverity } from "../types/swagger-diff";

interface SwaggerDiffReportProps {
  report: SwaggerDiffReport;
}

type FilterSeverity = "all" | "breaking" | "non-breaking" | "info";
type SortBy = "severity" | "type" | "path";

/**
 * Swagger 差异报告展示组件
 * 包含汇总统计、变更列表、过滤与排序功能。
 */
export function SwaggerDiffReport({ report }: SwaggerDiffReportProps) {
  const [filter, setFilter] = useState<FilterSeverity>("all");
  const [sortBy, setSortBy] = useState<SortBy>("severity");

  // ── 过滤与排序 ─────────────────────────
  const severityOrder: Record<DiffSeverity, number> = {
    breaking: 0,
    "non-breaking": 1,
    info: 2,
  };

  const filtered = report.changes
    .filter((c) => filter === "all" || c.severity === filter)
    .sort((a, b) => {
      if (sortBy === "severity") return severityOrder[a.severity] - severityOrder[b.severity];
      if (sortBy === "type") return a.type.localeCompare(b.type);
      return (a.path ?? "").localeCompare(b.path ?? "");
    });

  const severityIcon = (severity: DiffSeverity) => {
    switch (severity) {
      case "breaking":
        return <XCircle size={16} />;
      case "non-breaking":
        return <AlertTriangle size={16} />;
      case "info":
        return <Info size={16} />;
    }
  };

  const severityLabel = (severity: DiffSeverity) => {
    switch (severity) {
      case "breaking":
        return <span className="diff-severity breaking">破坏性</span>;
      case "non-breaking":
        return <span className="diff-severity non-breaking">兼容</span>;
      case "info":
        return <span className="diff-severity info">提示</span>;
    }
  };

  const typeIcon = (type: string) => {
    if (type.includes("added")) return <Plus size={14} />;
    if (type.includes("removed")) return <Minus size={14} />;
    if (type.includes("changed")) return <Pencil size={14} />;
    return <ArrowUpDown size={14} />;
  };

  const compatibilityConfig = {
    compatible: { icon: CheckCircle, label: "向后兼容", className: "compat-ok" },
    breaking: { icon: AlertOctagon, label: "存在破坏性变更", className: "compat-breaking" },
    unknown: { icon: FileWarning, label: "无法判断", className: "compat-unknown" },
  };

  const compat = compatibilityConfig[report.compatibility];
  const CompatIcon = compat.icon;

  return (
    <div className="swagger-diff-report">
      {/* ── 报告头部 ──────────────────────── */}
      <div className="diff-report-header">
        <div className="diff-report-title">
          <ArrowUpDown size={20} />
          <h2>差异报告</h2>
        </div>
        <div className="diff-report-versions">
          <span className="diff-version-badge source">{report.sourceDoc.version}</span>
          <ArrowUpDown size={14} />
          <span className="diff-version-badge target">{report.targetDoc.version}</span>
        </div>
      </div>

      {/* ── 兼容性结论 ────────────────────── */}
      <div className={`diff-compatibility ${compat.className}`}>
        <CompatIcon size={22} />
        <div>
          <strong>{compat.label}</strong>
          <span>
            {report.sourceDoc.title} {report.sourceDoc.version} → {report.targetDoc.version}
          </span>
        </div>
        <span className="diff-timestamp">
          {new Date(report.comparedAt).toLocaleString("zh-CN")}
        </span>
      </div>

      {/* ── 汇总统计 ──────────────────────── */}
      <div className="diff-summary-cards">
        <div className="diff-summary-card total">
          <span>总变更</span>
          <strong>{report.summary.totalChanges}</strong>
        </div>
        <div className="diff-summary-card breaking">
          <XCircle size={14} />
          <span>破坏性</span>
          <strong>{report.summary.breakingChanges}</strong>
        </div>
        <div className="diff-summary-card non-breaking">
          <AlertTriangle size={14} />
          <span>兼容性</span>
          <strong>{report.summary.nonBreakingChanges}</strong>
        </div>
        <div className="diff-summary-card info">
          <Info size={14} />
          <span>提示</span>
          <strong>{report.summary.infoChanges}</strong>
        </div>
      </div>

      {/* ── 详细分类 ──────────────────────── */}
      <div className="diff-breakdown">
        <div className="diff-breakdown-item">
          <Route size={14} />
          <span>新增接口</span>
          <strong>{report.summary.pathsAdded}</strong>
        </div>
        <div className="diff-breakdown-item">
          <Route size={14} />
          <span>移除接口</span>
          <strong>{report.summary.pathsRemoved}</strong>
        </div>
        <div className="diff-breakdown-item">
          <Code2 size={14} />
          <span>参数变更</span>
          <strong>{report.summary.parametersChanged}</strong>
        </div>
        <div className="diff-breakdown-item">
          <Layers size={14} />
          <span>模型变更</span>
          <strong>{report.summary.schemasChanged}</strong>
        </div>
        <div className="diff-breakdown-item">
          <Server size={14} />
          <span>方法移除</span>
          <strong>{report.summary.methodsRemoved}</strong>
        </div>
      </div>

      {/* ── 过滤与排序工具栏 ──────────────── */}
      <div className="diff-toolbar">
        <div className="diff-filter-group">
          {(["all", "breaking", "non-breaking", "info"] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={`diff-filter-btn ${filter === f ? "active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f === "all" && "全部"}
              {f === "breaking" && "破坏性"}
              {f === "non-breaking" && "兼容性"}
              {f === "info" && "提示"}
            </button>
          ))}
        </div>
        <select
          className="diff-sort-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
        >
          <option value="severity">按严重程度</option>
          <option value="type">按变更类型</option>
          <option value="path">按接口路径</option>
        </select>
      </div>

      {/* ── 变更列表 ──────────────────────── */}
      <div className="diff-change-list">
        {filtered.length === 0 && (
          <div className="diff-empty">
            <CheckCircle size={32} />
            <p>没有匹配的变更项</p>
          </div>
        )}
        {filtered.map((item, idx) => (
          <div key={idx} className={`diff-change-item ${item.severity}`}>
            <div className="diff-change-icon">{severityIcon(item.severity)}</div>
            <div className="diff-change-content">
              <div className="diff-change-head">
                {severityLabel(item.severity)}
                <span className="diff-change-type">
                  {typeIcon(item.type)}
                  {item.type.replace(/-/g, " ")}
                </span>
              </div>
              <p className="diff-change-msg">{item.message}</p>
              {(item.oldValue || item.newValue) && (
                <div className="diff-change-values">
                  {item.oldValue && (
                    <div className="diff-old-value">
                      <Minus size={12} />
                      <code>{item.oldValue}</code>
                    </div>
                  )}
                  {item.newValue && (
                    <div className="diff-new-value">
                      <Plus size={12} />
                      <code>{item.newValue}</code>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
