import type { RuntimeMode } from "../types/runtime";

/**
 * Agent WebSocket URL 构造。
 * - 云端模式：读取 VITE_CLOUD_AGENT_WS_URL + VITE_CLOUD_AGENT_SECRET
 * - 本地模式：读取 VITE_LOCAL_AGENT_WS_URL（fallback ws://localhost:3100/agent）+ VITE_LOCAL_AGENT_SECRET
 *
 * Token 认证参数自动附加到 URL query 中。
 */

/** 将 ws://xxx/agent 格式转为 http://xxx（用于 REST API 调用） */
export function getAgentWsOrigin(mode: RuntimeMode): string {
  const wsUrl = getWsUrl(mode);
  return wsUrl.replace(/^ws/, "http").replace(/\/agent$/, "");
}

/** 构建指定模式的 WebSocket URL（含 token） */
export function buildAgentWsUrl(mode: RuntimeMode): string {
  const base = getWsUrl(mode);
  const token = getSecret(mode);
  if (token) {
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}token=${encodeURIComponent(token)}`;
  }
  return base;
}

// ── 内部辅助 ──────────────────────────────────

function getWsUrl(mode: RuntimeMode): string {
  if (mode === "cloud") {
    const url = import.meta.env.VITE_CLOUD_AGENT_WS_URL as string | undefined;
    if (url) return url;
    // 云端未配置时 fallback 到旧有逻辑（开发环境用 localhost）
    if (import.meta.env.DEV) {
      return `ws://${window.location.hostname}:3100/agent`;
    }
    return `ws://${window.location.host}/agent`;
  }

  // 本地模式
  const url = import.meta.env.VITE_LOCAL_AGENT_WS_URL as string | undefined;
  if (url) return url;
  // 默认值：ws://localhost:3100/agent
  return "ws://localhost:3100/agent";
}

function getSecret(mode: RuntimeMode): string | undefined {
  if (mode === "cloud") {
    return import.meta.env.VITE_CLOUD_AGENT_SECRET as string | undefined;
  }
  return import.meta.env.VITE_LOCAL_AGENT_SECRET as string | undefined;
}
