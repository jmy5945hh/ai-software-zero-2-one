import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { RollbackManager } from "./RollbackManager";

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

test("restores a round, one file, and the complete task without changing the index", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "zero-one-rollback-test-"));
  const repo = path.join(root, "repo");
  fs.mkdirSync(repo);
  git(repo, ["init"]);
  git(repo, ["config", "user.name", "Test"]);
  git(repo, ["config", "user.email", "test@example.com"]);
  fs.writeFileSync(path.join(repo, "tracked.txt"), "baseline\n");
  git(repo, ["add", "tracked.txt"]);
  git(repo, ["commit", "-m", "initial"]);

  const manager = new RollbackManager(path.join(root, "state"));
  manager.ensureBaseline("task-1", repo);
  fs.writeFileSync(path.join(repo, "tracked.txt"), "before round\n");
  const checkpoint = manager.createCheckpoint("task-1", repo, "coding");
  fs.writeFileSync(path.join(repo, "tracked.txt"), "after round\n");
  fs.writeFileSync(path.join(repo, "new.txt"), "new\n");

  const indexBefore = git(repo, ["write-tree"]).trim();
  manager.rollbackRound("task-1", checkpoint.id);
  assert.equal(fs.readFileSync(path.join(repo, "tracked.txt"), "utf8"), "before round\n");
  assert.equal(fs.existsSync(path.join(repo, "new.txt")), false);
  assert.equal(git(repo, ["write-tree"]).trim(), indexBefore);

  fs.writeFileSync(path.join(repo, "tracked.txt"), "changed again\n");
  manager.rollbackFile("task-1", "tracked.txt");
  assert.equal(fs.readFileSync(path.join(repo, "tracked.txt"), "utf8"), "baseline\n");

  fs.writeFileSync(path.join(repo, "another.txt"), "new\n");
  manager.rollbackTask("task-1");
  assert.equal(fs.existsSync(path.join(repo, "another.txt")), false);
  assert.equal(git(repo, ["for-each-ref", "--format=%(refname)", "refs/zero-one"]).trim(), "");

  fs.rmSync(root, { recursive: true, force: true });
});

test("supports a plain local folder without creating .git", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "zero-one-plain-folder-test-"));
  const workspace = path.join(root, "new-project");
  fs.mkdirSync(workspace);
  fs.writeFileSync(path.join(workspace, "README.md"), "idea\n");

  const manager = new RollbackManager(path.join(root, "state"));
  manager.ensureBaseline("plain-task", workspace);
  fs.writeFileSync(path.join(workspace, "README.md"), "round one\n");
  const checkpoint = manager.createCheckpoint("plain-task", workspace, "coding");
  fs.writeFileSync(path.join(workspace, "README.md"), "round two\n");
  fs.writeFileSync(path.join(workspace, "src.ts"), "export {};\n");

  const diffFiles = manager.getDiffFiles("plain-task");
  assert.deepEqual(diffFiles.map((file) => [file.path, file.changeType]), [
    ["README.md", "modify"],
    ["src.ts", "create"],
  ]);

  manager.rollbackRound("plain-task", checkpoint.id);
  assert.equal(fs.readFileSync(path.join(workspace, "README.md"), "utf8"), "round one\n");
  assert.equal(fs.existsSync(path.join(workspace, "src.ts")), false);

  manager.rollbackTask("plain-task");
  assert.equal(fs.readFileSync(path.join(workspace, "README.md"), "utf8"), "idea\n");
  assert.equal(fs.existsSync(path.join(workspace, ".git")), false);

  fs.rmSync(root, { recursive: true, force: true });
});
