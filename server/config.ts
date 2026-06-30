import { AuthStorage } from "@earendil-works/pi-coding-agent";

/**
 * 获取 DeepSeek API Key，优先级：
 * 1. DEEPSEEK_API_KEY 环境变量
 * 2. 代码中配置的默认值（仅用于演示/开发）
 */
const DEFAULT_DEEPSEEK_API_KEY = ""; // 在此填入默认 Key，留空则强制从环境变量读取

export function getDeepSeekApiKey(): string {
  return process.env.DEEPSEEK_API_KEY || DEFAULT_DEEPSEEK_API_KEY;
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
