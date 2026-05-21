import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
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
  /** 推理深度 */
  thinkingLevel: "low" | "medium" | "high";
  /** 可用工具白名单 */
  tools: string[];
  /** System prompt（作为 AGENTS.md 的内容注入） */
  systemPrompt: string;
  /** Skill 定义 */
  skills: Skill[];
};

// ── Skill 定义（从 skills/*.md 加载）────────

const PRODUCT_ANALYSIS_SKILL = loadSkill("product-analysis.md");
const ARCHITECTURE_DESIGN_SKILL = loadSkill("architecture-design.md");
const FRONTEND_DEV_SKILL = loadSkill("frontend-dev.md");
const TESTING_SKILL = loadSkill("testing.md");
const DEVOPS_SKILL = loadSkill("devops.md");

// ── 步骤配置映射 ────────────────────────────

export const STEP_CONFIGS: Record<string, StepConfig> = {
  intent: {
    modelId: "deepseek-v4-flash",
    modelProvider: "deepseek",
    thinkingLevel: "medium",
    tools: ["read", "grep", "find", "ls", "ask_user_question", "write"],
    systemPrompt: loadPrompt("intent"),
    skills: [],
  },
  scope: {
    modelId: "deepseek-v4-flash",
    modelProvider: "deepseek",
    thinkingLevel: "medium",
    tools: ["read", "grep", "find", "ls", "ask_user_question", "write"],
    systemPrompt: loadPrompt("scope"),
    skills: [],
  },
  spec: {
    modelId: "deepseek-v4-flash",
    modelProvider: "deepseek",
    thinkingLevel: "high",
    tools: ["read", "write", "grep", "find", "ls"],
    systemPrompt: loadPrompt("spec"),
    skills: [ARCHITECTURE_DESIGN_SKILL],
  },
  build: {
    modelId: "deepseek-v4-flash",
    modelProvider: "deepseek",
    thinkingLevel: "medium",
    tools: ["read", "write", "grep", "find", "ls"],
    systemPrompt: loadPrompt("build"),
    skills: [FRONTEND_DEV_SKILL],
  },
  quality: {
    modelId: "deepseek-v4-flash",
    modelProvider: "deepseek",
    thinkingLevel: "medium",
    tools: ["read", "bash", "grep", "find", "ls"],
    systemPrompt: loadPrompt("quality"),
    skills: [TESTING_SKILL],
  },
  verify: {
    modelId: "deepseek-v4-flash",
    modelProvider: "deepseek",
    thinkingLevel: "medium",
    tools: ["read", "write", "bash", "grep", "find", "ls"],
    systemPrompt: loadPrompt("verify"),
    skills: [TESTING_SKILL],
  },
  release: {
    modelId: "deepseek-v4-flash",
    modelProvider: "deepseek",
    thinkingLevel: "low",
    tools: ["read", "write", "bash", "grep", "find", "ls"],
    systemPrompt: loadPrompt("release"),
    skills: [DEVOPS_SKILL],
  },
};
