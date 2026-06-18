import assert from "node:assert/strict";
import test from "node:test";
import type http from "http";
import { isHttpRequestAuthorized } from "./httpAuth";

function request(url: string, authorization?: string): http.IncomingMessage {
  return { method: "GET", url, headers: { authorization } } as http.IncomingMessage;
}

test("HTTP auth is optional locally and enforced when configured", () => {
  assert.equal(isHttpRequestAuthorized(request("/api/projects"), undefined), true);
  assert.equal(isHttpRequestAuthorized(request("/health"), "secret"), true);
  assert.equal(isHttpRequestAuthorized(request("/api/projects"), "secret"), false);
  assert.equal(isHttpRequestAuthorized(request("/api/projects", "Bearer secret"), "secret"), true);
});
