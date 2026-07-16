import { RUNTIME_MODE_KEY, type RuntimeMode } from "../types/runtime";

/**
 * 统一的 HTTP base URL，以 /server 结尾。
 * 所有前端对后端的 HTTP 调用都基于此路径拼接。
 *
 * 示例返回值：http://localhost:3100/server
 */
export function getBaseUrl(mode: RuntimeMode): string {
  if (mode === "local") {
    return getLocalApiBase();
  }
  return getCloudApiBase();
}

/**
 * 本地模式 API base URL，优先读取 VITE_LOCAL_API_URL 环境变量。
 * 与 CloudRuntimeConnector 中 getCloudApiBase 模式对齐。
 */
export function getLocalApiBase(): string {
  return (import.meta.env.VITE_LOCAL_API_URL as string | undefined) || getBaseUrlRaw("local");
}

/**
 * 云端模式 API base URL，优先读取 VITE_CLOUD_API_URL 环境变量。
 */
export function getCloudApiBase(): string {
  return (import.meta.env.VITE_CLOUD_API_URL as string | undefined) || getBaseUrlRaw("cloud");
}

function getBaseUrlRaw(mode: RuntimeMode): string {
  const wsUrl = getWsUrl(mode);
  // ws://xxx/server/agent → http://xxx/server
  return wsUrl.replace(/^ws/, "http").replace(/\/agent$/, "");
}

/**
 * 构建 WebSocket URL（含 token 认证参数）。
 * 在 base URL 基础上追加 /agent。
 */
export function buildAgentWsUrl(mode: RuntimeMode): string {
  const base = getWsUrl(mode);
  const token = getSecret(mode);
  if (token) {
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}token=${encodeURIComponent(token)}`;
  }
  return base;
}

/**
 * 调用 Agent HTTP API，自动附加认证 token。
 * input 应为绝对路径（以 / 开头），例如 /api/models。
 * 调用方自行拼接 base URL，例如 getBaseUrl("local") + "/api/models"。
 */
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
    // 云端未配置时 fallback
    if (import.meta.env.DEV) {
      return `ws://${window.location.hostname}:3100/server/agent`;
    }
    return `ws://${window.location.host}/server/agent`;
  }

  // 本地模式
  const url = import.meta.env.VITE_LOCAL_AGENT_WS_URL as string | undefined;
  if (url) {
    // 远程部署场景：浏览器从公网访问 VM，但 env 变量仍指向 localhost
    // 此时自动替换为浏览器实际访问的主机名
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
