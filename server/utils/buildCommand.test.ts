import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { resolveBuildCommand } from "./buildCommand.js";

test("build commands are limited to project-declared scripts", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "build-command-"));
  fs.writeFileSync(path.join(cwd, "package.json"), JSON.stringify({ scripts: { build: "tsc" } }));

  assert.deepEqual(resolveBuildCommand("npm run build", cwd), {
    executable: "npm",
    args: ["run", "build"],
  });
  assert.throws(() => resolveBuildCommand("npm run missing", cwd));
  assert.throws(() => resolveBuildCommand("npm run build && rm -rf /", cwd));
});
