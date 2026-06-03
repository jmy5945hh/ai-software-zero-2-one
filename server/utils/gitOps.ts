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
