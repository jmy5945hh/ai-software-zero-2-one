import assert from "node:assert/strict";
import test from "node:test";
import { resolveHttpRouteGroup } from "./httpRoutes.js";

test("HTTP endpoints keep their transport modules", () => {
  const cases = [
    ["/api/projects", "api"],
    ["/task/init", "session"],
    ["/session/meta?sessionId=1", "session"],
    ["/repo-diff-files?path=/repo", "session"],
    ["/step-snapshot?sessionId=1", "session"],
    ["/rollback/status?taskId=1", "session"],
    ["/project-build?path=/repo", "build"],
    ["/read-file?file=/tmp/result", "build"],
    ["/qa-review?path=/repo", "build"],
    ["/verification-plan", "build"],
    ["/verification-run", "build"],
    ["/delivery-report", "build"],
    ["/specs-tree?path=/repo", "workspace"],
    ["/workspace-tree?taskId=1", "workspace"],
    ["/repo-file?path=/repo", "workspace"],
    ["/git-branches?dirPath=/repo", "workspace"],
    ["/git-preflight", "workspace"],
  ] as const;

  for (const [url, expected] of cases) {
    assert.equal(resolveHttpRouteGroup(url), expected, url);
  }
  assert.equal(resolveHttpRouteGroup("/unknown"), null);
});
