import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { AuthStorage } from "@earendil-works/pi-coding-agent";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ModelsConfig {
  defaultModel?: string;
  defaultProvider?: string;
  providers: Record<string, {
    baseUrl: string;
    apiKey?: string;
    api: string;
    models: Array<{ id: string }>;
  }>;
}

let _modelsConfig: ModelsConfig | null = null;

export function getModelsConfig(): ModelsConfig {
  if (!_modelsConfig) {
    const filePath = join(__dirname, "models.json");
    _modelsConfig = JSON.parse(readFileSync(filePath, "utf-8")) as ModelsConfig;
  }
  return _modelsConfig;
}

/**
 * 获取 DeepSeek API Key，优先级：
 * 1. DEEPSEEK_API_KEY 环境变量
 * 2. models.json 中对应 provider 的 apiKey 字段
 */
export function getDeepSeekApiKey(): string {
  if (process.env.DEEPSEEK_API_KEY) return process.env.DEEPSEEK_API_KEY;
  const config = getModelsConfig();
  return config.providers.deepseek?.apiKey || "";
}

/**
 * 获取指定 provider 的 API Key，优先级：
 * 1. {PROVIDER}_API_KEY 环境变量（大写，如 ZHIPU_API_KEY）
 * 2. models.json 中对应 provider 的 apiKey 字段
 */
export function getProviderApiKey(provider: string): string {
  const envKey = `${provider.toUpperCase()}_API_KEY`;
  if (process.env[envKey]) return process.env[envKey]!;
  const config = getModelsConfig();
  return config.providers[provider]?.apiKey || "";
}

/** 初始化 AuthStorage，从环境变量注入所有已配置的 API Key */
export function createAuthStorage(): AuthStorage {
  const storage = AuthStorage.create();
  const config = getModelsConfig();
  for (const provider of Object.keys(config.providers)) {
    const key = getProviderApiKey(provider);
    if (key) {
      storage.setRuntimeApiKey(provider, key);
    }
  }
  return storage;
}

/** 从 models.json 获取默认提供商 */
export function getDefaultProvider(): string {
  const config = getModelsConfig();
  const provider = config.defaultProvider || "deepseek";
  if (provider === "deepseek" && !getDeepSeekApiKey()) {
    throw new Error(
      "No LLM API key configured. Set DEEPSEEK_API_KEY in environment.",
    );
  }
  return provider;
}

/** 从 models.json 获取默认模型 ID */
export function getDefaultModel(): string {
  const config = getModelsConfig();
  return config.defaultModel || "deepseek-v4-flash";
}
