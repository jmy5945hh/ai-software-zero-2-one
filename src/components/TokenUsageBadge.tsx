"use client";

import type { FC } from "react";

/**
 * Token 用量徽章组件（借鉴 assistant-ui ContextDisplay 理念）
 *
 * 展示当前会话的 token 消耗与上下文窗口占比。
 * - 环形进度条颜色：< 65% 绿，65-85% 黄，> 85% 红
 * - 目前 token 数据依赖后端事件，未接入时显示「—」占位
 */

type TokenUsageData = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  contextWindow: number;
};

type TokenUsageBadgeProps = {
  /** Token 用量数据，为 null 时显示占位 */
  usage?: TokenUsageData | null;
  className?: string;
};

const RING_SIZE = 14;
const RING_STROKE = 2.5;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function getUsagePercent(total: number, window: number): number {
  if (!total || !window) return 0;
  return Math.min((total / window) * 100, 100);
}

type Severity = "normal" | "warning" | "critical";

function getSeverity(percent: number): Severity {
  if (percent > 85) return "critical";
  if (percent >= 65) return "warning";
  return "normal";
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${n}`;
}

export const TokenUsageBadge: FC<TokenUsageBadgeProps> = ({ usage, className }) => {
  if (!usage) {
    return (
      <div className={`token-usage-badge ${className ?? ""}`}>
        <div className="token-usage-ring">
          <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
            <circle
              className="token-usage-ring-bg"
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
            />
            <circle
              className="token-usage-ring-fill normal"
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
              strokeDashoffset={CIRCUMFERENCE}
            />
          </svg>
        </div>
        <span className="token-usage-text">— tokens</span>
      </div>
    );
  }

  const percent = getUsagePercent(usage.totalTokens, usage.contextWindow);
  const severity = getSeverity(percent);
  const dashOffset = CIRCUMFERENCE - (percent / 100) * CIRCUMFERENCE;

  return (
    <div className={`token-usage-badge ${className ?? ""}`} title={`输入: ${formatTokens(usage.inputTokens)} | 输出: ${formatTokens(usage.outputTokens)} | 上下文: ${formatTokens(usage.contextWindow)}`}>
      <div className="token-usage-ring">
        <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
          <circle
            className="token-usage-ring-bg"
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
          />
          <circle
            className={`token-usage-ring-fill ${severity}`}
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            strokeDashoffset={dashOffset}
          />
        </svg>
      </div>
      <span className="token-usage-text">
        {formatTokens(usage.totalTokens)}
        {usage.contextWindow > 0 && ` / ${formatTokens(usage.contextWindow)}`}
      </span>
    </div>
  );
};
