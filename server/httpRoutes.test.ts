import assert from "node:assert/strict";
import test from "node:test";
import { resolveHttpRouteGroup } from "./httpRoutes";

test("HTTP endpoints keep their transport modules", () => {
  const cases = [
    ["/api/projects", "api"],
    ["/task/init", "session"],
    ["/session/meta?sessionId=1", "session"],
    ["/repo-diff-files?path=/repo", "session"],
    ["/step-snapshot?sessionId=1", "session"],
    ["/project-build?path=/repo", "build"],
    ["/read-file?file=/tmp/result", "build"],
    ["/qa-review?path=/repo", "build"],
    ["/specs-tree?path=/repo", "workspace"],
    ["/workspace-tree?taskId=1", "workspace"],
    ["/repo-file?path=/repo", "workspace"],
  ] as const;

  for (const [url, expected] of cases) {
    assert.equal(resolveHttpRouteGroup(url), expected, url);
  }
  assert.equal(resolveHttpRouteGroup("/unknown"), null);
});
