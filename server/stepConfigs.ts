import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getDefaultModel } from "./config.js";
import { createSyntheticSourceInfo, type Skill } from "@earendil-works/pi-coding-agent";

// ── 步骤配置 ────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROMPTS_DIR = join(__dirname, "prompts");
const SKILLS_DIR = join(__dirname, "skills");

/** 从 prompts 目录加载 md 文件作为 system prompt */
function loadPrompt(step: string): string {
  const filePath = join(PROMPTS_DIR, `${step}.md`);
  return readFileSync(filePath, "utf-8");
}

/** 从 skills 目录加载 md 文件构造 Skill 对象 */
function loadSkill(fileName: string): Skill {
  const filePath = join(SKILLS_DIR, fileName);
  const content = readFileSync(filePath, "utf-8");

  // 从 # 标题提取 name
  const nameMatch = content.match(/^#\s+(.+)/m);
  const name = nameMatch ? nameMatch[1].trim() : fileName.replace(/\.md$/, "");

  // 从 ## 能力 段落提取 description
  const descMatch = content.match(/^##\s+能力\s*\n+([^#]+)/m);
  const description = descMatch ? descMatch[1].trim() : "";

  return {
    name,
    description,
    filePath,
    baseDir: SKILLS_DIR,
    sourceInfo: createSyntheticSourceInfo(name, { source: "file" }),
    disableModelInvocation: false,
  };
}

export type StepConfig = {
  /** 模型 ID */
  modelId: string;
  /** 模型提供商 */
  modelProvider: "deepseek";
  /** v0.2: 该节点需要的核心能力 */
  capability: "analysis" | "prototype" | "architecture" | "implementation" | "quality" | "verification" | "release";
  /** v0.2: 运行态模型路由建议 */
  modelTier: "small" | "medium" | "large";
  /** 推理深度 */
  thinkingLevel: "low" | "medium" | "high";
  /** v0.2: 触发模型/推理升级的条件 */
  escalationPolicy: string[];
  /** v0.2: 该节点完成前需要满足的验证口径 */
  verificationGate: string;
  /** 可用工具白名单 */
  tools: string[];
  /** System prompt（作为 AGENTS.md 的内容注入） */
  systemPrompt: string;
  /** Skill 定义 */
  skills: Skill[];
};

// ── Skill 定义（从 skills/*.md 加载）────────

const FRONTEND_DEV_SKILL = loadSkill("frontend-dev.md");
const TESTING_SKILL = loadSkill("testing.md");
const DEVOPS_SKILL = loadSkill("devops.md");

// ── 步骤配置映射 ────────────────────────────

export const STEP_CONFIGS: Record<string, StepConfig> = {
  intent: {
    modelId: getDefaultModel(),
    modelProvider: "deepseek",
    capability: "analysis",
    modelTier: "medium",
    thinkingLevel: "medium",
    escalationPolicy: ["需求存在业务歧义", "任务影响多个模块", "需要识别 UI/非 UI workflow 分支"],
    verificationGate: "Spec 包含验收标准、UI 变化判断和初步测试计划",
    tools: ["read", "grep", "find", "ls", "ask_user_question", "write"],
    systemPrompt: loadPrompt("intent"),
    skills: [],
  },
  prototype: {
    modelId: getDefaultModel(),
    modelProvider: "deepseek",
    capability: "prototype",
    modelTier: "medium",
    thinkingLevel: "medium",
    escalationPolicy: ["交互路径超过 3 个页面", "存在复杂状态流转", "用户选择严格审查"],
    verificationGate: "生成可预览 HTML、原型交接文档和 prototype.json",
    tools: ["read", "write", "grep", "find", "ls", "ask_user_question"],
    systemPrompt: loadPrompt("prototype"),
    skills: [],
  },
  plan: {
    modelId: getDefaultModel(),
    modelProvider: "deepseek",
    capability: "architecture",
    modelTier: "large",
    thinkingLevel: "medium",
    escalationPolicy: ["跨模块架构调整", "新增依赖或存储结构", "测试策略无法直接映射到需求"],
    verificationGate: "技术方案包含模块边界、风险、测试入口和回退策略",
    tools: ["read", "grep", "find", "ls", "ask_user_question", "write"],
    systemPrompt: loadPrompt("plan"),
    skills: [],
  },
  coding: {
    modelId: getDefaultModel(),
    modelProvider: "deepseek",
    capability: "implementation",
    modelTier: "large",
    thinkingLevel: "high",
    escalationPolicy: ["构建失败", "同一问题修复失败两次", "代码影响共享基础设施"],
    verificationGate: "代码可构建，并说明需要运行的 Web/API/业务验证",
    tools: ["read", "write", "grep", "find", "ls", "bash"],
    systemPrompt: loadPrompt("coding"),
    skills: [FRONTEND_DEV_SKILL],
  },
  quality: {
    modelId: getDefaultModel(),
    modelProvider: "deepseek",
    capability: "quality",
    modelTier: "medium",
    thinkingLevel: "medium",
    escalationPolicy: ["质量报告存在高风险项", "安全/鉴权/命令执行边界变化", "自动修复后仍失败"],
    verificationGate: "质量报告区分代码问题、测试缺口、业务风险和修复建议",
    tools: ["read", "bash", "grep", "find", "ls"],
    systemPrompt: loadPrompt("quality"),
    skills: [TESTING_SKILL],
  },
  verify: {
    modelId: getDefaultModel(),
    modelProvider: "deepseek",
    capability: "verification",
    modelTier: "medium",
    thinkingLevel: "medium",
    escalationPolicy: ["黑盒测试失败且根因不明", "业务场景覆盖不足", "需要生成复杂测试数据"],
    verificationGate: "Web/API/业务场景验证结果形成可追溯证据",
    tools: ["read", "write", "bash", "grep", "find", "ls"],
    systemPrompt: loadPrompt("verify"),
    skills: [TESTING_SKILL],
  },
  release: {
    modelId: getDefaultModel(),
    modelProvider: "deepseek",
    capability: "release",
    modelTier: "small",
    thinkingLevel: "low",
    escalationPolicy: ["存在未覆盖风险", "发布或回退策略不明确", "用户选择质量优先"],
    verificationGate: "DELIVERY.md 包含变更、验证证据、风险、回退和后续建议",
    tools: ["read", "write", "bash", "grep", "find", "ls"],
    systemPrompt: loadPrompt("release"),
    skills: [DEVOPS_SKILL],
  },
};
