import { Wifi, WifiOff, Loader2, SignalLow, SignalMedium, SignalHigh, ShieldAlert } from "lucide-react";
import type { ConnectionStatus } from "../agent/types";

/**
 * Agent 连接状态徽章 — 共享组件，用于 Dashboard / TaskPage 等页面。
 */
export function AgentStatusBadge({
  status,
  quality,
}: {
  status: ConnectionStatus;
  quality: { latency: number; reconnectAttempt: number };
}) {
  const latencyMs = quality.latency;
  const latencyLabel =
    latencyMs <= 0
      ? null
      : latencyMs < 100
        ? `${latencyMs}ms`
        : `${Math.round(latencyMs / 100) / 10}s`;

  const LatencyIcon =
    !latencyMs || latencyMs <= 0
      ? SignalLow
      : latencyMs < 150
        ? SignalHigh
        : SignalMedium;

  return (
    <div className={`agent-status-badge ${status}`}>
      {status === "connected" ? (
        <>
          <Wifi size={13} />
          <span>Agent 已连接</span>
          {latencyLabel && (
            <span className="agent-latency">
              <LatencyIcon size={11} />
              {latencyLabel}
            </span>
          )}
        </>
      ) : status === "connecting" ? (
        <>
          <Loader2 size={13} className="agent-spin" />
          <span>连接中...</span>
        </>
      ) : status === "reconnecting" ? (
        <>
          <Loader2 size={13} className="agent-spin" />
          <span>重连 {quality.reconnectAttempt}...</span>
        </>
      ) : status === "auth_failed" ? (
        <>
          <ShieldAlert size={13} />
          <span className="agent-auth-failed-text">认证失败，请检查 Token</span>
        </>
      ) : (
        <>
          <WifiOff size={13} />
          <span className="agent-disconnected-text">Agent 未连接</span>
        </>
      )}
    </div>
  );
}
