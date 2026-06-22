import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

export type ResolvedBuildCommand = {
  executable: string;
  args: string[];
  /** 实际执行目录（当命令包含 cd 前缀时与传入的 cwd 不同） */
  cwd: string;
};

const PACKAGE_MANAGERS = new Set(["npm", "pnpm", "yarn", "bun"]);
const GRADLE_TASKS = new Set(["build", "assemble", "check"]);
const SAFE_TOKEN = /^[a-zA-Z0-9@._/:=+\-/]+$/;

function readPackageScripts(cwd: string): Record<string, string> {
  const packagePath = path.join(cwd, "package.json");
  if (!fs.existsSync(packagePath)) return {};
  const parsed = JSON.parse(fs.readFileSync(packagePath, "utf-8")) as {
    scripts?: Record<string, string>;
  };
  return parsed.scripts || {};
}

/**
 * 解析命令中的 cd 前缀，返回 { remainingCommand, resolvedCwd }
 * 支持格式：cd <dir> && <command> 或 cd <dir> && cd <subdir> && <command>
 */
function resolveCdPrefix(rawCommand: string, baseCwd: string): { remainingCommand: string; resolvedCwd: string } {
  let cwd = baseCwd;
  let remaining = rawCommand.trim();

  const cdPattern = /^cd\s+(\S+)\s*&&\s*/;
  let match: RegExpExecArray | null;
  while ((match = cdPattern.exec(remaining)) !== null) {
    const dir = match[1];
    cwd = path.resolve(cwd, dir);
    remaining = remaining.slice(match[0].length);
  }

  return { remainingCommand: remaining, resolvedCwd: cwd };
}

export function resolveBuildCommand(command: string, baseCwd: string): ResolvedBuildCommand {
  const { remainingCommand, resolvedCwd } = resolveCdPrefix(command, baseCwd);
  const cwd = resolvedCwd;

  const tokens = remainingCommand.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens.some((token) => !SAFE_TOKEN.test(token))) {
    throw new Error("构建命令包含不支持的字符");
  }

  const [executable, ...args] = tokens;
  if (PACKAGE_MANAGERS.has(executable)) {
    const script = executable === "npm" || args[0] === "run" ? args[1] : args[0];
    const expectedLength = executable === "npm" || args[0] === "run" ? 2 : 1;
    if (!script || args.length !== expectedLength || !readPackageScripts(cwd)[script]) {
      throw new Error(`未在 package.json 中找到允许执行的构建脚本: ${script || "(empty)"}`);
    }
    return { executable, args, cwd };
  }

  if (executable === "make" && args.length <= 1) {
    const hasMakefile = ["Makefile", "makefile"].some((name) => fs.existsSync(path.join(cwd, name)));
    if (hasMakefile) return { executable, args, cwd };
  }

  if (executable === "go" && args[0] === "build" && args.length <= 2) {
    return { executable, args, cwd };
  }

  if (executable === "cargo" && args[0] === "build") {
    return { executable, args, cwd };
  }

  if (["gradle", "./gradlew"].includes(executable) && GRADLE_TASKS.has(args[0]) && args.length <= 2) {
    return { executable, args, cwd };
  }

  if (executable === "mvn" && ["compile", "package", "install", "test", "verify", "clean"].includes(args[0]) && args.length <= 4) {
    return { executable, args, cwd };
  }

  throw new Error(`不允许执行构建命令: ${command}`);
}

export function executeBuildCommand(command: string, baseCwd: string): string {
  const resolved = resolveBuildCommand(command, baseCwd);
  const result = spawnSync(resolved.executable, resolved.args, {
    cwd: resolved.cwd,
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
    shell: false,
  });

  const output = `${result.stdout || ""}${result.stderr || ""}`;
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const error = new Error(output || `构建进程退出码: ${result.status}`) as Error & {
      stdout?: string;
      stderr?: string;
    };
    error.stdout = result.stdout || "";
    error.stderr = result.stderr || "";
    throw error;
  }
  return output;
}
