import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  ModelRegistry,
  SettingsManager,
  type AgentSession,
} from "@earendil-works/pi-coding-agent";
import { createAuthStorage, getDefaultProvider } from "./config";
import { STEP_CONFIGS, type StepConfig } from "./stepConfigs";
import { createAskUserQuestionTool } from "./customTools";

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
      retry: { enabled: true, maxRetries: 2 },
    });
  }

  /** 为指定步骤创建 AgentSession */
  async createSession(
    taskId: string,
    step: string,
    workspaceDir: string,
  ): Promise<AgentSession> {
    const stepConfig = STEP_CONFIGS[step] as StepConfig | undefined;
    if (!stepConfig) throw new Error(`Unknown SOP step: ${step}`);

    const provider = stepConfig.modelProvider || getDefaultProvider();

    // Ensure API key is set on authStorage (each createSession call)
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key) {
      throw new Error("DEEPSEEK_API_KEY not found in environment");
    }
    this.authStorage.setRuntimeApiKey("deepseek", key);
    const model = this.modelRegistry.find(provider, stepConfig.modelId);
    if (!model) {
      throw new Error(
        `Model not found: ${provider}/${stepConfig.modelId}. ` +
        `Check server/models.json and your API key.`,
      );
    }
    console.log("[AgentRunner] Model found: %s", model.id);

    const loader = new DefaultResourceLoader({
      cwd: workspaceDir,
      agentDir: workspaceDir,
      systemPrompt: stepConfig.systemPrompt,
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
