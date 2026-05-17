import { AuthStorage } from "@earendil-works/pi-coding-agent";

/** 初始化 AuthStorage，从环境变量注入 API Key */
export function createAuthStorage(): AuthStorage {
  const storage = AuthStorage.create();

  if (process.env.DEEPSEEK_API_KEY) {
    storage.setRuntimeApiKey("deepseek", process.env.DEEPSEEK_API_KEY);
  }

  return storage;
}

/** 从环境变量加载 LLM 提供商配置 */
export function getDefaultProvider(): "deepseek"  {
  if (process.env.DEEPSEEK_API_KEY) return "deepseek";
  throw new Error(
    "No LLM API key configured. Set DEEPSEEK_API_KEY in environment.",
  );
}

export function getDefaultModel(): string {
  const provider = getDefaultProvider();
  if (provider === "deepseek") return "deepseek-v4-flash";
  throw new Error(`No default model configured for provider ${provider}`);
}
