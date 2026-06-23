"use client";

import type { FC } from "react";

/**
 * Token 用量徽章组件
 *
 * 展示输入 token、输出 token、缓存读取(cacheRead)、总 token 数。
 * - 输入/输出/缓存用不同颜色区分
 * - 总 token 数加粗突出
 * - 无数据时显示「—」占位
 */

type TokenUsageData = {
  inputTokens: number;
  outputTokens: number;
  cacheRead: number;
  totalTokens: number;
  contextWindow: number;
};

type TokenUsageBadgeProps = {
  /** Token 用量数据，为 null 时显示占位 */
  usage?: TokenUsageData | null;
  className?: string;
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${n}`;
}

export const TokenUsageBadge: FC<TokenUsageBadgeProps> = ({ usage, className }) => {
  if (!usage) {
    return (
      <div className={`token-usage-badge ${className ?? ""}`}>
        <span className="token-usage-text">— tokens</span>
      </div>
    );
  }

  return (
    <div
      className={`token-usage-badge ${className ?? ""}`}
      title={`输入: ${usage.inputTokens.toLocaleString()} | 输出: ${usage.outputTokens.toLocaleString()} | 缓存: ${usage.cacheRead.toLocaleString()} | 总计: ${usage.totalTokens.toLocaleString()}${usage.contextWindow > 0 ? ` | 上下文: ${formatTokens(usage.contextWindow)}` : ''}`}
    >
      <span className="token-usage-item token-usage-input">
        <span className="token-usage-dot input" />
        <span className="token-usage-label">输入</span>
        <span className="token-usage-value">{formatTokens(usage.inputTokens)}</span>
      </span>
      <span className="token-usage-sep" />
      <span className="token-usage-item token-usage-output">
        <span className="token-usage-dot output" />
        <span className="token-usage-label">输出</span>
        <span className="token-usage-value">{formatTokens(usage.outputTokens)}</span>
      </span>
      <span className="token-usage-sep" />
      <span className="token-usage-item token-usage-cache">
        <span className="token-usage-dot cache" />
        <span className="token-usage-label">缓存</span>
        <span className="token-usage-value">{formatTokens(usage.cacheRead)}</span>
      </span>
      <span className="token-usage-sep" />
      <span className="token-usage-item token-usage-total">
        <span className="token-usage-label">总计</span>
        <span className="token-usage-value total">{formatTokens(usage.totalTokens)}</span>
      </span>
    </div>
  );
};
