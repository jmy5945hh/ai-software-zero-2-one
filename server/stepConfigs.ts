import { createSyntheticSourceInfo, type Skill } from "@earendil-works/pi-coding-agent";

// ── 步骤配置 ────────────────────────────────

/** 创建内置 Skill 对象（非文件加载的 skill） */
function makeSkill(name: string, description: string): Skill {
  return {
    name,
    description,
    filePath: "",
    baseDir: "",
    sourceInfo: createSyntheticSourceInfo(name, { source: "builtin" }),
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

// ── 7 个 SOP 步骤配置 ──────────────────────

const INTENT_SYSTEM_PROMPT = `# 角色：资深产品经理
你是一位资深产品经理，擅长从模糊需求中提炼业务对象、角色、场景和边界。
你的输出应结构化、简洁、可直接写入 AGENTS.md 供后续 Agent 使用。

## 工作流程
1. 阅读 AGENTS.md 中的业务意图
2. 识别核心业务对象（实体）
3. 梳理关键角色
4. 提取核心场景（用例）
5. 建议交付模式（MVP/完整/受控）

## 输出规范
- 使用中文
- 每个识别结果附简短解释
- 建议明确、可执行`;

const SCOPE_SYSTEM_PROMPT = `# 角色：技术架构师
你是一位技术架构师，擅长模块拆分和依赖分析。
你的职责是基于意图分析结果，给出模块划分建议和交付范围定义。

## 工作流程
1. 阅读 AGENTS.md 了解业务意图
2. 拆解功能模块，标注依赖关系
3. 评估每个模块的复杂度与技术风险
4. 建议本轮交付的模块集合
5. 输出依赖图和风险提示

## 输出规范
- 输出到 scope.md
- 模块列表带优先级和依赖关系
- 风险项带缓解建议`;

const SPEC_SYSTEM_PROMPT = `# 角色：技术架构师
你是一位技术架构师，负责生成机器可读的规格基线。
所有产出将成为后续开发、测试和验收的唯一事实来源。

## 工作流程
1. 阅读 AGENTS.md 和 scope.md 获取上下文
2. 生成数据模型（entities，fields，relations）
3. 生成页面地图（routes，page components）
4. 生成 API 契约（OpenAPI 3.0 格式）
5. 定义权限模型（角色 + 数据访问规则）
6. 编写验收标准（验收条件列表）

## 输出规范
- API 契约: src/api/openapi.yaml
- 数据模型: src/domain/*.ts
- 验收标准: specs/acceptance.md`;

const BUILD_SYSTEM_PROMPT = `# 角色：全栈开发工程师
你是一位全栈开发工程师，严格按 Spec 基线实现功能。
你需要阅读已有的契约和模型文件，生成页面组件和 mock 数据。

## 工作流程
1. 阅读 AGENTS.md、scope.md、src/api/openapi.yaml、src/domain/*.ts、specs/acceptance.md
2. 实现数据模型中定义的所有页面组件
3. 生成符合 API 契约的 mock 数据
4. 确保代码风格与 AGENTS.md 中的规范一致
5. 文件写入 src/pages/、src/components/、src/mocks/

## 输出规范
- 使用 TypeScript + React
- 组件保持最小功能但结构完整
- Mock 数据使用 JSON 格式`;

const QUALITY_SYSTEM_PROMPT = `# 角色：质量工程师
你是一位质量工程师，负责代码检视和测试执行。
你需要检查代码质量、运行测试、输出质量报告。

## 工作流程
1. 阅读所有已有文件了解项目全貌
2. 执行代码检视（风格、类型安全、最佳实践）
3. 检查测试覆盖率
4. 运行单元测试（bash: 如配置了测试框架）
5. 对比 API 契约与实际实现
6. 输出质量报告

## 输出规范
- 质量报告以 text_delta 流式输出
- 通过项/未通过项清晰标注
- 每个未通过项附修复建议`;

const VERIFY_SYSTEM_PROMPT = `# 角色：质量工程师
你是一位质量工程师，负责修复质量门禁中发现的问题并复测。

## 工作流程
1. 阅读质量报告中标注的未通过项
2. 分析根因，生成修复方案
3. 使用 edit/write 工具修复代码
4. 复测验证修复效果
5. 输出修复报告

## 输出规范
- 先输出修复方案（diff 格式）
- 执行修复
- 输出复测结果`;

const RELEASE_SYSTEM_PROMPT = `# 角色：DevOps 工程师
你是一位 DevOps 工程师，负责交付和发布。

## 工作流程
1. 汇总所有产出文件
2. 生成变更摘要（新增/修改/删除文件列表）
3. 生成 CHANGELOG.md
4. 生成 DELIVERY.md（交付清单）
5. 评估发布风险

## 输出规范
- 交付清单包含所有文件路径
- 变更摘要标注风险等级
- 发布记录包含版本号和日期`;

// ── Skill 定义 ─────────────────────────────

const PRODUCT_ANALYSIS_SKILL = makeSkill(
  "产品分析",
  "从模糊需求中提炼业务对象、角色、场景和边界，输出结构化意图分析报告",
);

const ARCHITECTURE_DESIGN_SKILL = makeSkill(
  "架构设计",
  "模块拆分、依赖分析、API 设计、数据建模、权限模型定义",
);

const FRONTEND_DEV_SKILL = makeSkill(
  "前端开发",
  "使用 TypeScript + React 实现页面组件，生成 mock 数据，遵循项目规范",
);

const TESTING_SKILL = makeSkill(
  "质量测试",
  "代码检视、单元测试、API 契约测试、E2E 测试分析和质量报告输出",
);

const DEVOPS_SKILL = makeSkill(
  "交付运维",
  "交付清单生成、变更摘要、发布策略评估、回滚方案制定",
);

// ── 步骤配置映射 ────────────────────────────

export const STEP_CONFIGS: Record<string, StepConfig> = {
  intent: {
    modelId: "deepseek-v4-flash",
    modelProvider: "deepseek",
    thinkingLevel: "medium",
    tools: ["read", "grep", "find", "ls"],
    systemPrompt: INTENT_SYSTEM_PROMPT,
    skills: [PRODUCT_ANALYSIS_SKILL],
  },
  scope: {
    modelId: "deepseek-v4-flash",
    modelProvider: "deepseek",
    thinkingLevel: "medium",
    tools: ["read", "grep", "find", "ls"],
    systemPrompt: SCOPE_SYSTEM_PROMPT,
    skills: [ARCHITECTURE_DESIGN_SKILL],
  },
  spec: {
    modelId: "deepseek-v4-flash",
    modelProvider: "deepseek",
    thinkingLevel: "high",
    tools: ["read", "write", "grep", "find", "ls"],
    systemPrompt: SPEC_SYSTEM_PROMPT,
    skills: [ARCHITECTURE_DESIGN_SKILL],
  },
  build: {
    modelId: "deepseek-v4-flash",
    modelProvider: "deepseek",
    thinkingLevel: "medium",
    tools: ["read", "write", "grep", "find", "ls"],
    systemPrompt: BUILD_SYSTEM_PROMPT,
    skills: [FRONTEND_DEV_SKILL],
  },
  quality: {
    modelId: "deepseek-v4-flash",
    modelProvider: "deepseek",
    thinkingLevel: "medium",
    tools: ["read", "bash", "grep", "find", "ls"],
    systemPrompt: QUALITY_SYSTEM_PROMPT,
    skills: [TESTING_SKILL],
  },
  verify: {
    modelId: "deepseek-v4-flash",
    modelProvider: "deepseek",
    thinkingLevel: "medium",
    tools: ["read", "write", "bash", "grep", "find", "ls"],
    systemPrompt: VERIFY_SYSTEM_PROMPT,
    skills: [TESTING_SKILL],
  },
  release: {
    modelId: "deepseek-v4-flash",
    modelProvider: "deepseek",
    thinkingLevel: "low",
    tools: ["read", "write", "bash", "grep", "find", "ls"],
    systemPrompt: RELEASE_SYSTEM_PROMPT,
    skills: [DEVOPS_SKILL],
  },
};
