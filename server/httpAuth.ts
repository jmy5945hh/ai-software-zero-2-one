import type http from "http";

const PUBLIC_PATHS = new Set(["/health"]);

export function isHttpRequestAuthorized(
  req: http.IncomingMessage,
  secret: string | undefined,
): boolean {
  if (!secret || req.method === "OPTIONS") return true;

  const pathname = req.url ? new URL(req.url, "http://localhost").pathname : "";
  if (PUBLIC_PATHS.has(pathname)) return true;

  return req.headers.authorization === `Bearer ${secret}`;
}

export function rejectUnauthorizedRequest(res: http.ServerResponse): void {
  res.writeHead(401, {
    "Content-Type": "application/json",
    "WWW-Authenticate": "Bearer",
  });
  res.end(JSON.stringify({ error: "Unauthorized" }));
}
