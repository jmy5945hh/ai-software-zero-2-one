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
    const model = this.modelRegistry.find(provider, stepConfig.modelId);
    if (!model) {
      throw new Error(
        `Model not found: ${provider}/${stepConfig.modelId}. ` +
        `Check server/models.json and your API key.`,
      );
    }

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

    const { session } = await createAgentSession({
      model,
      thinkingLevel: stepConfig.thinkingLevel,
      authStorage: this.authStorage,
      modelRegistry: this.modelRegistry,
      settingsManager: this.settingsManager,
      tools: stepConfig.tools,
      cwd: workspaceDir,
      resourceLoader: loader,
    });

    return session;
  }
}
