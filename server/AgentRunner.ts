import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  ModelRegistry,
  SettingsManager,
  type AgentSession,
} from "@earendil-works/pi-coding-agent";
import { createAuthStorage, getDefaultProvider, getDefaultModel, getDeepSeekApiKey, getModelsConfig, getProviderApiKey } from "./config.js";
import { STEP_CONFIGS, type StepConfig } from "./stepConfigs.js";
import { createAskUserQuestionTool } from "./customTools.js";

/**
 * AgentRunner — 根据步骤配置创建 AgentSession。
 * 管理 SDK 基础设施（AuthStorage、ModelRegistry、SettingsManager）。
 */
export class AgentRunner {
  private authStorage: AuthStorage;
  private modelRegistry: ModelRegistry;
  private settingsManager: SettingsManager;

  constructor(modelsJsonPath: string) {
    this.authStorage = createAuthStorage();

    this.modelRegistry = ModelRegistry.create(
      this.authStorage,
      modelsJsonPath,
    );

    this.settingsManager = SettingsManager.inMemory({
      compaction: { enabled: false },
      retry: { enabled: false },
    });
  }

  /** 为总结 Agent 创建独立 AgentSession（轻量模型 + 干净上下文） */
  async createSummarizationSession(
    workspaceDir: string,
  ): Promise<AgentSession> {
    const provider = getDefaultProvider();
    const key = getDeepSeekApiKey();
    if (!key) throw new Error("DEEPSEEK_API_KEY not found in environment");
    this.authStorage.setRuntimeApiKey("deepseek", key);

    const model = this.modelRegistry.find(provider, getDefaultModel());
    if (!model) throw new Error(`Model not found: ${provider}/${getDefaultModel()}`);

    const loader = new DefaultResourceLoader({
      cwd: workspaceDir,
      agentDir: workspaceDir,
      systemPrompt: `你是一个任务总结专家。你的唯一职责是将用户提供的 Agent 工作摘要转化为严格的 JSON 结构化输出。

规则：
1. 只输出 JSON，不输出任何其他内容（不要加 markdown 代码块、不要解释）
2. 严格遵守用户提供的 JSON schema
3. 忠于原文，不添加原文中没有的内容`,
    });
    await loader.reload();

    const { session } = await createAgentSession({
      model,
      thinkingLevel: "low",
      authStorage: this.authStorage,
      modelRegistry: this.modelRegistry,
      settingsManager: this.settingsManager,
      tools: [],
      customTools: [],
      cwd: workspaceDir,
      resourceLoader: loader,
    });

    return session;
  }

  /** 为编译命令检测 Agent 创建独立 AgentSession */
  async createBuildCommandSession(
    workspaceDir: string,
  ): Promise<AgentSession> {
    const provider = getDefaultProvider();
    const key = getDeepSeekApiKey();
    if (!key) throw new Error("DEEPSEEK_API_KEY not found in environment");
    this.authStorage.setRuntimeApiKey("deepseek", key);

    const model = this.modelRegistry.find(provider, getDefaultModel());
    if (!model) throw new Error(`Model not found: ${provider}/${getDefaultModel()}`);

    const loader = new DefaultResourceLoader({
      cwd: workspaceDir,
      agentDir: workspaceDir,
      systemPrompt: `你是一个项目构建配置分析专家。你的唯一职责是根据项目的构建配置文件，输出正确的编译命令。

规则：
1. 只输出编译命令本身，不要有任何额外说明文字（不要加 markdown 代码块、不要解释）
2. 例如：npm run build、npm run compile、make、go build ./...、cargo build 等
3. 请先探索项目目录结构，找到构建配置文件（package.json、pom.xml、build.gradle、Cargo.toml、Makefile 等）所在的目录。如果构建配置文件在子目录中，请在命令前加上 "cd <子目录> && " 前缀，例如 "cd my-app && mvn compile" 或 "cd frontend && npm run build"`,
    });
    await loader.reload();

    const { session } = await createAgentSession({
      model,
      thinkingLevel: "low",
      authStorage: this.authStorage,
      modelRegistry: this.modelRegistry,
      settingsManager: this.settingsManager,
      tools: ["read", "grep", "find", "ls"],
      customTools: [],
      cwd: workspaceDir,
      resourceLoader: loader,
    });

    return session;
  }

  /** 为编译分析 Agent 创建独立 AgentSession */
  async createBuildSession(
    workspaceDir: string,
  ): Promise<AgentSession> {
    const provider = getDefaultProvider();
    const key = getDeepSeekApiKey();
    if (!key) throw new Error("DEEPSEEK_API_KEY not found in environment");
    this.authStorage.setRuntimeApiKey("deepseek", key);

    const model = this.modelRegistry.find(provider, getDefaultModel());
    if (!model) throw new Error(`Model not found: ${provider}/${getDefaultModel()}`);

    const loader = new DefaultResourceLoader({
      cwd: workspaceDir,
      agentDir: workspaceDir,
      systemPrompt: `你是一个项目编译分析专家。你的唯一职责是分析编译输出结果，生成结构化的编译报告。

规则：
1. 只输出 JSON，不输出任何其他内容（不要加 markdown 代码块、不要解释）
2. 严格遵守用户提供的 JSON schema
3. 忠于原文，不添加原文中没有的内容`,
    });
    await loader.reload();

    const { session } = await createAgentSession({
      model,
      thinkingLevel: "low",
      authStorage: this.authStorage,
      modelRegistry: this.modelRegistry,
      settingsManager: this.settingsManager,
      tools: [],
      customTools: [],
      cwd: workspaceDir,
      resourceLoader: loader,
    });

    return session;
  }

  /** 为指定步骤创建 AgentSession */
  async createSession(
    taskId: string,
    step: string,
    workspaceDir: string,
    systemPromptOverride?: string,
    modelIdOverride?: string,
    modelProviderOverride?: string,
  ): Promise<AgentSession> {
    const stepConfig = STEP_CONFIGS[step] as StepConfig | undefined;
    if (!stepConfig) throw new Error(`Unknown SOP step: ${step}`);

    const modelId = modelIdOverride || stepConfig.modelId;
    let provider = modelProviderOverride || stepConfig.modelProvider || getDefaultProvider();

    console.log("[AgentRunner] createSession step=%s modelIdOverride=%s modelProviderOverride=%s stepConfig.modelId=%s stepConfig.modelProvider=%s → resolved provider=%s modelId=%s",
      step, modelIdOverride, modelProviderOverride, stepConfig.modelId, stepConfig.modelProvider, provider, modelId);

    console.log("[AgentRunner] modelRegistry loadError=%s", this.modelRegistry.getError() || "none");

    // If modelId is not found under the resolved provider,
    // search across all providers to find the correct one.
    let model = this.modelRegistry.find(provider, modelId);
    console.log("[AgentRunner] modelRegistry.find(%s, %s) = %s", provider, modelId, model ? model.id : "undefined");
    if (!model) {
      const allProviders = Object.keys(getModelsConfig().providers);
      console.log("[AgentRunner] Searching across all providers: %j", allProviders);
      for (const p of allProviders) {
        if (p === provider) continue;
        const m = this.modelRegistry.find(p, modelId);
        console.log("[AgentRunner]   check provider=%s modelId=%s → %s", p, modelId, m ? m.id : "undefined");
        if (m) {
          console.log("[AgentRunner] Auto-resolved provider: %s → %s for model %s", provider, p, modelId);
          provider = p;
          model = m;
          break;
        }
      }
    }

    if (!model) {
      throw new Error(
        `Model not found: ${provider}/${modelId}. ` +
        `Check server/models.json and your API key.`,
      );
    }

    // Ensure API key is set on authStorage (each createSession call)
    const key = getProviderApiKey(provider);
    if (!key) {
      throw new Error(
        `API key not found for provider "${provider}". ` +
        `Set ${provider.toUpperCase()}_API_KEY in environment.`,
      );
    }
    this.authStorage.setRuntimeApiKey(provider, key);
    console.log("[AgentRunner] Model found: %s", model.id);

    const systemPrompt = systemPromptOverride ?? `${stepConfig.systemPrompt}\n\n${buildStepRuntimeContract(step, stepConfig)}`;
    const loader = new DefaultResourceLoader({
      cwd: workspaceDir,
      agentDir: workspaceDir,
      systemPrompt,
      skillsOverride: (current) => ({
        skills: [...current.skills, ...stepConfig.skills],
        diagnostics: current.diagnostics,
      }),
    });
    await loader.reload();

    const customTools = stepConfig.tools.includes("ask_user_question")
      ? [createAskUserQuestionTool(taskId, step)]
      : [];

    const { session } = await createAgentSession({
      model,
      thinkingLevel: stepConfig.thinkingLevel,
      authStorage: this.authStorage,
      modelRegistry: this.modelRegistry,
      settingsManager: this.settingsManager,
      tools: stepConfig.tools,
      customTools,
      cwd: workspaceDir,
      resourceLoader: loader,
    });

    return session;
  }
}

function buildStepRuntimeContract(step: string, config: StepConfig): string {
  return `## v0.2 Runtime Contract

- step: ${step}
- capability: ${config.capability}
- modelTierHint: ${config.modelTier}
- thinkingLevel: ${config.thinkingLevel}
- verificationGate: ${config.verificationGate}
- escalationPolicy:
${config.escalationPolicy.map((item) => `  - ${item}`).join("\n")}

Follow the user's delivery policy from the task prompt. Minimize user interruptions according to the autonomy level, but always stop before irreversible high-risk changes when risk confirmation is required.`;
}
