import assert from "node:assert/strict";
import test from "node:test";
import { resolveWsHandlerGroup } from "./wsHandler";

test("WebSocket methods keep their handler modules", () => {
  assert.equal(resolveWsHandlerGroup("session.create"), "session");
  assert.equal(resolveWsHandlerGroup("summarization.trigger"), "summarization");
  assert.equal(resolveWsHandlerGroup("build.detectCommand"), "build");
  assert.equal(resolveWsHandlerGroup("workspace.retryClone"), "workspace");
  assert.equal(resolveWsHandlerGroup("workspace.initStatus"), "workspace");
  assert.equal(resolveWsHandlerGroup("unknown.method"), null);
});
