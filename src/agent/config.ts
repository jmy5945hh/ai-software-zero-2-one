/**
 * Agent WebSocket URL 构造。
 * 自动附加 token 认证参数（若配置了 VITE_AGENT_SECRET）。
 */

export function buildAgentWsUrl(): string {
  const base =
    import.meta.env.VITE_AGENT_WS_URL ||
    (import.meta.env.DEV
      ? `ws://${window.location.hostname}:3100/agent`
      : `ws://${window.location.host}/agent`);

  const token = import.meta.env.VITE_AGENT_SECRET;
  if (token) {
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}token=${encodeURIComponent(token)}`;
  }
  return base;
}
