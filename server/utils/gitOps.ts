import fs from "fs";
import path from "path";
import { execSync } from "child_process";

/**
 * 获取仓库的 git diff（当前工作区变更）
 * @param projectPath 项目路径
 * @returns diff 文本，或描述性消息
 */
export function getRepoDiff(projectPath: string): string {
  // 检查目录是否存在
  if (!fs.existsSync(projectPath)) {
    return "// 目录不存在";
  }

  // 检查是否为 git 仓库
  const gitDir = path.join(projectPath, ".git");
  if (!fs.existsSync(gitDir)) {
    return "// 当前目录不是 Git 仓库，无法显示 Diff";
  }

  // 检查是否有提交记录
  try {
    execSync("git rev-parse HEAD", { cwd: projectPath, encoding: "utf-8", stdio: "pipe" });
  } catch {
    return "// Git 仓库暂无提交记录";
  }

  const diffOutput = execSync("git diff HEAD", {
    cwd: projectPath,
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
  });
  const stagedOutput = execSync("git diff --cached", {
    cwd: projectPath,
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
  });
  const combined = [diffOutput, stagedOutput].filter(Boolean).join("\n");
  return combined || "No changes";
}

/**
 * 获取按文件拆分的 git diff（当前工作区变更），包含新增的未跟踪文件
 * 返回 { files: { path: string, diff: string, additions: number, deletions: number }[] }
 */
export function getRepoDiffFiles(projectPath: string): {
  files: { path: string; diff: string; additions: number; deletions: number }[];
} {
  const fullDiff = getRepoDiff(projectPath);

  const files: { path: string; diff: string; additions: number; deletions: number }[] = [];

  // 1. 解析已跟踪文件的 diff
  if (fullDiff !== "No changes" && !fullDiff.startsWith("//")) {
    const lines = fullDiff.split("\n");
    let currentFile: string | null = null;
    let currentDiff: string[] = [];
    let adds = 0;
    let dels = 0;

    for (const line of lines) {
      const fileHeaderMatch = line.match(/^diff --git a\/(.+?) b\/(.+?)$/);
      if (fileHeaderMatch) {
        // Save previous file
        if (currentFile) {
          files.push({ path: currentFile, diff: currentDiff.join("\n"), additions: adds, deletions: dels });
        }
        currentFile = fileHeaderMatch[2];
        currentDiff = [line];
        adds = 0;
        dels = 0;
        continue;
      }

      if (currentFile) {
        currentDiff.push(line);
        if (line.startsWith("+") && !line.startsWith("+++")) adds++;
        if (line.startsWith("-") && !line.startsWith("---")) dels++;
      }
    }

    // Save last file
    if (currentFile) {
      files.push({ path: currentFile, diff: currentDiff.join("\n"), additions: adds, deletions: dels });
    }
  }

  // 2. 检测未跟踪的新增文件（git diff 不包含未跟踪文件）
  try {
    const untrackedOutput = execSync("git ls-files --others --exclude-standard", {
      cwd: projectPath,
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    });
    const untrackedFiles = untrackedOutput.split("\n").filter(Boolean);

    for (const filePath of untrackedFiles) {
      const fullPath = path.join(projectPath, filePath);
      if (!fs.existsSync(fullPath)) continue;

      const content = fs.readFileSync(fullPath, "utf-8");
      const lines = content.split("\n");
      // 生成类似 git diff --no-index /dev/null file 的格式
      const diff = [
        `diff --git a/dev/null b/${filePath}`,
        `new file mode 100644`,
        `index 0000000..0000000`,
        `--- /dev/null`,
        `+++ b/${filePath}`,
        `@@ -0,0 +1,${lines.length} @@`,
        ...lines.map((l) => `+${l}`),
      ].join("\n");

      files.push({
        path: filePath,
        diff,
        additions: lines.length,
        deletions: 0,
      });
    }
  } catch {
    // git ls-files 失败时静默忽略
  }

  return { files };
}

/**
 * 在指定目录下执行 shell 命令
 * @param command 要执行的命令
 * @param cwd 工作目录
 * @param maxBuffer 最大输出缓冲区（默认 10MB）
 * @returns 命令输出
 */
export function execCommand(command: string, cwd: string, maxBuffer: number = 10 * 1024 * 1024): string {
  return execSync(command, {
    cwd,
    encoding: "utf-8",
    maxBuffer,
    stdio: ["pipe", "pipe", "pipe"],
  });
}
