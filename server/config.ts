import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { AuthStorage } from "@earendil-works/pi-coding-agent";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ModelsConfig {
  providers: Record<string, {
    baseUrl: string;
    apiKey?: string;
    api: string;
    models: Array<{ id: string }>;
  }>;
}

let _modelsConfig: ModelsConfig | null = null;

function getModelsConfig(): ModelsConfig {
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

/** 初始化 AuthStorage，从环境变量注入 API Key */
export function createAuthStorage(): AuthStorage {
  const storage = AuthStorage.create();
  const key = getDeepSeekApiKey();
  if (key) {
    storage.setRuntimeApiKey("deepseek", key);
  }
  return storage;
}

/** 从环境变量加载 LLM 提供商配置 */
export function getDefaultProvider(): "deepseek" {
  if (getDeepSeekApiKey()) return "deepseek";
  throw new Error(
    "No LLM API key configured. Set DEEPSEEK_API_KEY in environment.",
  );
}

export function getDefaultModel(): string {
  const provider = getDefaultProvider();
  if (provider === "deepseek") return "deepseek-v4-flash";
  throw new Error(`No default model configured for provider ${provider}`);
}
