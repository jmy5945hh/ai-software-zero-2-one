import { RUNTIME_MODE_KEY, type RuntimeMode } from "../types/runtime";

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
  return wsUrl.replace(/^ws/, "http").replace(/\/agent$/, "").replace(/\/server\/agent$/, "/server");
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

/** 获取指定模式的 HTTP API origin（用于 REST 调用） */
export function getAgentHttpOrigin(mode: RuntimeMode): string {
  return getAgentWsOrigin(mode);
}

/** 调用 Agent HTTP API，并自动附加与 WebSocket 相同的认证 token。 */
export function agentFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  mode?: RuntimeMode,
): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getSecret(mode || getActiveRuntimeMode());
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

// ── 内部辅助 ──────────────────────────────────

function getWsUrl(mode: RuntimeMode): string {
  if (mode === "cloud") {
    const url = import.meta.env.VITE_CLOUD_AGENT_WS_URL as string | undefined;
    if (url) return url;
    // 云端未配置时 fallback 到旧有逻辑（开发环境用 localhost）
    if (import.meta.env.DEV) {
      return `ws://${window.location.hostname}:3100/server/agent`;
    }
    return `ws://${window.location.host}/server/agent`;
  }

  // 本地模式
  const url = import.meta.env.VITE_LOCAL_AGENT_WS_URL as string | undefined;
  if (url) {
    // 远程部署场景：浏览器从公网访问 VM，但 env 变量仍指向 localhost
    // 此时自动替换为浏览器实际访问的主机名，确保请求能到达 VM 上的 agent server
    try {
      const parsed = new URL(url);
      const targetIsLocal = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
      const browserIsRemote = window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";
      if (targetIsLocal && browserIsRemote) {
        parsed.hostname = window.location.hostname;
        return parsed.toString();
      }
    } catch { /* URL 解析失败时直接返回原值 */ }
    return url;
  }
  // 默认值：ws://localhost:3100/server/agent
  return "ws://localhost:3100/server/agent";
}

function getActiveRuntimeMode(): RuntimeMode {
  if (typeof localStorage !== "undefined" && localStorage.getItem(RUNTIME_MODE_KEY) === "cloud") {
    return "cloud";
  }
  return "local";
}

function getSecret(mode: RuntimeMode): string | undefined {
  if (mode === "cloud") {
    return import.meta.env.VITE_CLOUD_AGENT_SECRET as string | undefined;
  }
  return import.meta.env.VITE_LOCAL_AGENT_SECRET as string | undefined;
}
