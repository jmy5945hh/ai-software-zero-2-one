import http from "http";
import https from "https";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import { existsSync } from "../utils/fileOps.js";
import { executeBuildCommand } from "../utils/buildCommand.js";
import type { WorkspaceManager } from "../WorkspaceManager.js";

const PORT = parseInt(process.env.AGENT_PORT || "3100", 10);

/**
 * 编译/QA 相关路由
 */
export function handleBuildRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  deps: { workspace: WorkspaceManager },
): boolean {
  const { workspace } = deps;

  if (req.method === "POST" && req.url === "/verification-plan") {
    readJsonBody(req).then(async (params) => {
      const sessionId = stringParam(params.sessionId);
      const taskId = stringParam(params.taskId);
      const intent = stringParam(params.intent);
      const resolvedPath = resolveWorkspacePath(workspace, params.workspacePath, taskId);
      if (!sessionId || !resolvedPath) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing sessionId and workspacePath/taskId" }));
        return;
      }

      const outputDir = ensureSessionOutputDir(sessionId);
      const outputFile = path.join(outputDir, "verification_plan.json");
      const plan = createVerificationPlan({
        intent,
        workspacePath: resolvedPath,
        deliveryConfig: params.deliveryConfig,
      });
      const content = JSON.stringify(plan, null, 2);
      fs.writeFileSync(outputFile, content, "utf-8");

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, filePath: outputFile, content }));
    }).catch((err) => {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Failed to generate verification plan" }));
    });
    return true;
  }

  if (req.method === "POST" && req.url === "/delivery-report") {
    readJsonBody(req).then(async (params) => {
      const sessionId = stringParam(params.sessionId);
      const taskId = stringParam(params.taskId);
      const intent = stringParam(params.intent);
      const resolvedPath = resolveWorkspacePath(workspace, params.workspacePath, taskId);
      if (!sessionId || !resolvedPath) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing sessionId and workspacePath/taskId" }));
        return;
      }

      const outputDir = ensureSessionOutputDir(sessionId);
      const outputFile = path.join(outputDir, "DELIVERY.md");
      const verificationPlanPath = path.join(outputDir, "verification_plan.json");
      const verificationResultPath = path.join(outputDir, "verification_result.json");
      const qualityResultPath = path.join(outputDir, "quality_result.toml");
      const content = createDeliveryReport({
        intent,
        workspacePath: resolvedPath,
        deliveryConfig: params.deliveryConfig,
        verificationPlan: readOptionalFile(verificationPlanPath),
        verificationResult: readOptionalFile(verificationResultPath),
        qualityResult: readOptionalFile(qualityResultPath),
      });
      fs.writeFileSync(outputFile, content, "utf-8");

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, filePath: outputFile, content }));
    }).catch((err) => {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Failed to generate delivery report" }));
    });
    return true;
  }

  if (req.method === "POST" && req.url === "/verification-run") {
    readJsonBody(req).then(async (params) => {
      const sessionId = stringParam(params.sessionId);
      const taskId = stringParam(params.taskId);
      const resolvedPath = resolveWorkspacePath(workspace, params.workspacePath, taskId);
      if (!sessionId || !resolvedPath) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing sessionId and workspacePath/taskId" }));
        return;
      }

      const outputDir = ensureSessionOutputDir(sessionId);
      const planPath = path.join(outputDir, "verification_plan.json");
      const outputFile = path.join(outputDir, "verification_result.json");
      const planContent = readOptionalFile(planPath);
      const plan = parseVerificationPlan(planContent);
      const result = await runVerificationPlan(plan, resolvedPath);
      const content = JSON.stringify(result, null, 2);
      fs.writeFileSync(outputFile, content, "utf-8");

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, filePath: outputFile, content }));
    }).catch((err) => {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Failed to run verification" }));
    });
    return true;
  }

  // 项目编译
  if (req.method === "GET" && req.url?.startsWith("/project-build")) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const projectPath = url.searchParams.get("path");
    const customCommand = url.searchParams.get("command");
    const taskId = url.searchParams.get("taskId");
    console.log("[project-build] path=%s command=%s taskId=%s", projectPath, customCommand, taskId);

    let resolvedPath = projectPath;
    if (!resolvedPath && taskId) {
      resolvedPath = workspace.getRepoDir(taskId);
    }
    if (!resolvedPath) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing 'path' or 'taskId' query parameter" }));
      return true;
    }

    try {
      if (!existsSync(resolvedPath)) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, output: "// 目录不存在", command: "" }));
        return true;
      }

      const command = customCommand;
      if (!command) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, output: "// 错误：模型未提供编译命令", command: "" }));
        return true;
      }

      const output = executeBuildCommand(command, resolvedPath);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, output, command }));
    } catch (err: any) {
      const errOutput = err.stdout || err.stderr || err.message || "";
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        success: false,
        output: errOutput,
        command: customCommand,
      }));
    }
    return true;
  }

  // 读取文件内容
  if (req.method === "GET" && req.url?.startsWith("/read-file")) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const filePath = url.searchParams.get("file") || "";
    const resolvedPath = filePath.replace(/^~/, process.env.HOME || process.env.USERPROFILE || "");
    try {
      const content = fs.readFileSync(resolvedPath, "utf-8");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ content }));
    } catch (err: any) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `文件读取失败: ${err.message}` }));
    }
    return true;
  }

  // QA 质量审查
  if (req.method === "GET" && req.url?.startsWith("/qa-review")) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const projectPath = url.searchParams.get("path");
    const sessionId = url.searchParams.get("sessionId");
    const taskId = url.searchParams.get("taskId");

    let resolvedPath = projectPath;
    if (!resolvedPath && taskId) {
      resolvedPath = workspace.getRepoDir(taskId);
    }
    if (!resolvedPath || !sessionId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing 'path'/'taskId' or 'sessionId' query parameter" }));
      return true;
    }

    const outputDir = path.join(
      process.env.HOME || process.env.USERPROFILE || "~",
      ".aiNativeDevPlatform",
      "sessions",
      sessionId,
    );

    try {
      fs.mkdirSync(outputDir, { recursive: true });
    } catch {
      // ignore
    }

    const outputFile = path.join(outputDir, "quality_result.toml");

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    res.write(`data: ${JSON.stringify({ type: "start", message: "QA 审查开始执行...", outputFile })}\n\n`);

    const cliCommand = `qa-review --scope untracked --output ${outputFile}`;

    const child = spawn("sh", ["-c", cliCommand], {
      cwd: resolvedPath,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });

    let fullOutput = "";

    child.stdout.on("data", (data: Buffer) => {
      const text = data.toString();
      fullOutput += text;
      const lines = text.split("\n").filter(Boolean);
      for (const line of lines) {
        res.write(`data: ${JSON.stringify({ type: "output", line })}\n\n`);
      }
    });

    child.stderr.on("data", (data: Buffer) => {
      const text = data.toString();
      fullOutput += text;
      const lines = text.split("\n").filter(Boolean);
      for (const line of lines) {
        res.write(`data: ${JSON.stringify({ type: "output", line })}\n\n`);
      }
    });

    child.on("close", async (code: number | null) => {
      let resultContent = "";
      try {
        if (fs.existsSync(outputFile)) {
          resultContent = fs.readFileSync(outputFile, "utf-8");
        }
      } catch {
        // 读取失败
      }

      res.write(`data: ${JSON.stringify({
        type: "complete",
        exitCode: code,
        outputFile,
        resultContent,
        fullOutput,
      })}\n\n`);
      res.end();
    });

    child.on("error", (err: Error) => {
      res.write(`data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`);
      res.end();
    });

    req.on("close", () => {
      child.kill();
    });

    return true;
  }

  return false;
}

function readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const MAX_BODY_SIZE = 1024 * 1024;
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY_SIZE) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("error", reject);
    req.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
  });
}

function stringParam(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function resolveWorkspacePath(workspace: WorkspaceManager, workspacePath: unknown, taskId: string): string {
  const explicitPath = stringParam(workspacePath);
  if (explicitPath) return explicitPath;
  return taskId ? workspace.getRepoDir(taskId) : "";
}

function ensureSessionOutputDir(sessionId: string): string {
  const outputDir = path.join(
    process.env.HOME || process.env.USERPROFILE || "~",
    ".aiNativeDevPlatform",
    "sessions",
    sessionId,
  );
  fs.mkdirSync(outputDir, { recursive: true });
  return outputDir;
}

function readOptionalFile(filePath: string): string {
  try {
    return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";
  } catch {
    return "";
  }
}

function createVerificationPlan(params: {
  intent: string;
  workspacePath: string;
  deliveryConfig: unknown;
}) {
  const packageJson = readPackageJson(params.workspacePath);
  const scripts = packageJson && typeof packageJson === "object" && "scripts" in packageJson
    ? packageJson.scripts as Record<string, unknown>
    : {};
  const scriptNames = Object.keys(scripts || {});
  const hasFrontend = hasAnyDependency(packageJson, ["react", "vue", "svelte", "vite", "next"]);
  const hasApi = hasServerSignals(params.workspacePath, packageJson);
  const verification = getDeliveryField(params.deliveryConfig, "verification", "full");
  const mode = getDeliveryField(params.deliveryConfig, "mode", "project-change");
  const generatedAt = new Date().toISOString();
  const cases = [
    {
      id: "build-smoke",
      type: "smoke",
      title: "项目构建/启动冒烟",
      command: pickScript(scriptNames, ["build", "typecheck", "test"]) || "人工确认项目启动命令",
      required: true,
      evidence: ["命令输出", "失败日志"],
    },
    ...(hasApi && verification !== "smoke" ? [{
      id: "api-contract",
      type: "api",
      title: "核心 API 合约与错误返回",
      command: pickScript(scriptNames, ["test:server", "test", "api:test"]) || "根据路由生成接口调用",
      probes: [
        { method: "GET", url: `http://127.0.0.1:${PORT}/health`, expectStatus: 200 },
        { method: "GET", url: `http://127.0.0.1:${PORT}/api/resources`, expectStatus: 200 },
      ],
      required: true,
      evidence: ["状态码", "响应字段", "错误返回"],
    }] : []),
    ...(hasFrontend && verification !== "smoke" ? [{
      id: "web-e2e",
      type: "web",
      title: "Web 主路径 E2E",
      command: pickScript(scriptNames, ["test:e2e", "e2e", "test"]) || "Playwright 主路径检查",
      required: true,
      evidence: ["截图", "DOM 状态", "console error"],
    }] : []),
    ...(verification === "full" ? [{
      id: "business-scenario",
      type: "business",
      title: "业务场景端到端验收",
      command: "按 Spec 验收标准串联页面、接口和持久化状态",
      required: mode !== "verification",
      evidence: ["场景步骤", "输入输出", "状态变化"],
    }, {
      id: "failure-recovery",
      type: "resilience",
      title: "异常恢复与边界输入",
      command: "覆盖空数据、超时、重复点击、未授权访问",
      required: false,
      evidence: ["错误提示", "日志", "恢复路径"],
    }] : []),
  ];

  return {
    version: "v0.2",
    generatedAt,
    intent: params.intent,
    workspacePath: params.workspacePath,
    deliveryConfig: params.deliveryConfig || {},
    detected: {
      packageManager: fs.existsSync(path.join(params.workspacePath, "package-lock.json")) ? "npm" : "unknown",
      scripts: scriptNames,
      hasFrontend,
      hasApi,
    },
    cases,
    exitCriteria: [
      "必选验证项有通过证据或明确失败原因",
      "失败项已自动修复并复测，或已标注为未覆盖风险",
      "交付报告包含变更、验证证据、残余风险和后续建议",
    ],
  };
}

function createDeliveryReport(params: {
  intent: string;
  workspacePath: string;
  deliveryConfig: unknown;
  verificationPlan: string;
  verificationResult: string;
  qualityResult: string;
}): string {
  const generatedAt = new Date().toISOString();
  const verificationStatus = params.verificationPlan ? "已生成验证计划" : "未生成验证计划";
  const verificationRunStatus = params.verificationResult ? "已执行可自动化验证" : "未执行自动化验证";
  const qualityStatus = params.qualityResult ? "已发现质量审查结果" : "未发现质量审查结果";
  const parsedResult = parseVerificationResult(params.verificationResult);
  const readinessText = parsedResult
    ? (parsedResult.readyForDelivery ? "可进入交付审查" : "存在失败或阻塞验证项")
    : "缺少验证执行结果";
  return `# DELIVERY

## 交付摘要

- 生成时间：${generatedAt}
- 任务目标：${params.intent || "未提供"}
- 工作空间：${params.workspacePath}
- 验证计划：${verificationStatus}
- 验证执行：${verificationRunStatus}
- 质量审查：${qualityStatus}
- 交付判断：${readinessText}

## 交付策略

\`\`\`json
${JSON.stringify(params.deliveryConfig || {}, null, 2)}
\`\`\`

## 验证证据

${params.verificationPlan || "尚未生成 verification_plan.json。"}

## 验证执行结果

${params.verificationResult || "尚未生成 verification_result.json。"}

## 质量审查摘要

${params.qualityResult || "尚未执行或尚未读取到 quality_result.toml。"}

## 残余风险

${parsedResult?.readyForDelivery ? "- 自动化可执行验证未发现阻塞项；仍需确认被标记为 skipped 的非必选场景是否接受。" : "- 存在 failed/blocked 验证项，必须修复或明确风险接受后才能放行。"}
- Web/API/业务场景若被标记为 blocked，需要由对应 QA Agent 或人工证据回填。

## 建议后续动作

1. 将 failed/blocked 证据交给 Repair Loop Agent 修复。
2. 复测后重新生成 verification_result.json。
3. 更新本报告，再进入发布交付。
`;
}

function readPackageJson(workspacePath: string): Record<string, unknown> | null {
  try {
    const content = fs.readFileSync(path.join(workspacePath, "package.json"), "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function hasAnyDependency(packageJson: Record<string, unknown> | null, names: string[]): boolean {
  if (!packageJson) return false;
  const deps = {
    ...(typeof packageJson.dependencies === "object" && packageJson.dependencies ? packageJson.dependencies : {}),
    ...(typeof packageJson.devDependencies === "object" && packageJson.devDependencies ? packageJson.devDependencies : {}),
  } as Record<string, unknown>;
  return names.some((name) => name in deps);
}

function hasServerSignals(workspacePath: string, packageJson: Record<string, unknown> | null): boolean {
  if (hasAnyDependency(packageJson, ["express", "fastify", "koa", "hono", "ws"])) return true;
  return fs.existsSync(path.join(workspacePath, "server")) || fs.existsSync(path.join(workspacePath, "src", "server"));
}

function pickScript(scriptNames: string[], candidates: string[]): string {
  const match = candidates.find((candidate) => scriptNames.includes(candidate));
  return match ? `npm run ${match}` : "";
}

function getDeliveryField(config: unknown, key: string, fallback: string): string {
  if (!config || typeof config !== "object") return fallback;
  const value = (config as Record<string, unknown>)[key];
  return typeof value === "string" ? value : fallback;
}

function parseVerificationPlan(content: string): { cases?: Array<Record<string, unknown>> } {
  if (!content.trim()) {
    return { cases: [] };
  }
  try {
    const parsed = JSON.parse(content) as { cases?: Array<Record<string, unknown>> };
    return parsed && Array.isArray(parsed.cases) ? parsed : { cases: [] };
  } catch {
    return { cases: [] };
  }
}

async function runVerificationPlan(plan: { cases?: Array<Record<string, unknown>> }, workspacePath: string) {
  const startedAt = new Date().toISOString();
  const results = [];
  for (const testCase of plan.cases || []) {
    results.push(await runVerificationCase(testCase, workspacePath));
  }
  const required = results.filter((item) => item.required);
  const failedRequired = required.filter((item) => item.status === "failed");
  const blockedRequired = required.filter((item) => item.status === "blocked");
  const passedRequired = required.filter((item) => item.status === "passed");
  const completedAt = new Date().toISOString();
  return {
    version: "v0.2",
    startedAt,
    completedAt,
    workspacePath,
    summary: {
      total: results.length,
      passed: results.filter((item) => item.status === "passed").length,
      failed: results.filter((item) => item.status === "failed").length,
      blocked: results.filter((item) => item.status === "blocked").length,
      skipped: results.filter((item) => item.status === "skipped").length,
      requiredPassed: passedRequired.length,
      requiredTotal: required.length,
      readyForDelivery: failedRequired.length === 0 && blockedRequired.length === 0,
    },
    results,
  };
}

async function runVerificationCase(testCase: Record<string, unknown>, workspacePath: string) {
  const id = stringParam(testCase.id) || "unknown";
  const title = stringParam(testCase.title) || id;
  const command = stringParam(testCase.command);
  const required = Boolean(testCase.required);
  const probes = parseProbeList(testCase.probes);
  const base = {
    id,
    title,
    type: stringParam(testCase.type) || "unknown",
    command,
    required,
    startedAt: new Date().toISOString(),
    completedAt: "",
    status: "skipped",
    output: "",
    reason: "",
  };

  if (probes.length > 0) {
    const probeResults = [];
    for (const probe of probes) {
      probeResults.push(await runHttpProbe(probe));
    }
    const failed = probeResults.filter((item) => !item.passed);
    return {
      ...base,
      completedAt: new Date().toISOString(),
      status: failed.length === 0 ? "passed" : "failed",
      output: JSON.stringify(probeResults, null, 2),
      reason: failed.length === 0 ? "API 探测全部通过。" : "存在 API 探测失败。",
    };
  }

  if (!isExecutableVerificationCommand(command)) {
    return {
      ...base,
      completedAt: new Date().toISOString(),
      status: required ? "blocked" : "skipped",
      reason: "该用例需要 Web/API/业务场景专用 Agent 回填证据，当前没有安全可执行命令。",
    };
  }

  try {
    const output = executeBuildCommand(command, workspacePath);
    return {
      ...base,
      completedAt: new Date().toISOString(),
      status: "passed",
      output: output.slice(0, 20_000),
      reason: "命令执行成功。",
    };
  } catch (err: any) {
    return {
      ...base,
      completedAt: new Date().toISOString(),
      status: "failed",
      output: String(err.stdout || err.stderr || err.message || "").slice(0, 20_000),
      reason: "命令执行失败。",
    };
  }
}

type HttpProbe = {
  method: "GET";
  url: string;
  expectStatus: number;
};

function parseProbeList(value: unknown): HttpProbe[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const method = stringParam(record.method).toUpperCase();
    const url = stringParam(record.url);
    const expectStatus = typeof record.expectStatus === "number" ? record.expectStatus : 200;
    if (method !== "GET" || !isLocalProbeUrl(url)) return [];
    return [{ method: "GET" as const, url, expectStatus }];
  });
}

function isLocalProbeUrl(urlText: string): boolean {
  try {
    const url = new URL(urlText);
    return ["http:", "https:"].includes(url.protocol)
      && ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function runHttpProbe(probe: HttpProbe): Promise<{
  method: string;
  url: string;
  expectStatus: number;
  status: number;
  passed: boolean;
  bodyPreview: string;
  error?: string;
}> {
  return new Promise((resolve) => {
    const url = new URL(probe.url);
    const client = url.protocol === "https:" ? https : http;
    const req = client.request(url, { method: probe.method, timeout: 3000 }, (res) => {
      let body = "";
      res.setEncoding("utf-8");
      res.on("data", (chunk) => {
        if (body.length < 4000) body += chunk;
      });
      res.on("end", () => {
        const status = res.statusCode || 0;
        resolve({
          method: probe.method,
          url: probe.url,
          expectStatus: probe.expectStatus,
          status,
          passed: status === probe.expectStatus,
          bodyPreview: body.slice(0, 1000),
        });
      });
    });
    req.on("timeout", () => {
      req.destroy(new Error("API 探测超时"));
    });
    req.on("error", (err) => {
      resolve({
        method: probe.method,
        url: probe.url,
        expectStatus: probe.expectStatus,
        status: 0,
        passed: false,
        bodyPreview: "",
        error: err.message,
      });
    });
    req.end();
  });
}

function isExecutableVerificationCommand(command: string): boolean {
  if (!command) return false;
  if (command.startsWith("人工确认") || command.startsWith("根据路由") || command.startsWith("Playwright") || command.startsWith("按 Spec") || command.startsWith("覆盖空数据")) {
    return false;
  }
  return /^(cd\s+\S+\s*&&\s*)?(npm|pnpm|yarn|bun)\s+/.test(command)
    || /^(make|go|cargo|gradle|\.\/gradlew|mvn)\s+/.test(command);
}

function parseVerificationResult(content: string): { readyForDelivery: boolean } | null {
  if (!content.trim()) return null;
  try {
    const parsed = JSON.parse(content) as { summary?: { readyForDelivery?: boolean } };
    return { readyForDelivery: Boolean(parsed.summary?.readyForDelivery) };
  } catch {
    return null;
  }
}
