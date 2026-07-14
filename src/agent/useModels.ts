import { useCallback, useEffect, useState } from "react";
import type { ModelsConfigResponse, ModelInfo } from "../data/types";
import { getAgentHttpOrigin } from "./config";
import { RUNTIME_MODE_KEY } from "../types/runtime";

function getActiveRuntimeMode(): "local" | "cloud" {
  if (typeof localStorage !== "undefined" && localStorage.getItem(RUNTIME_MODE_KEY) === "cloud") {
    return "cloud";
  }
  return "local";
}

type ModelsState = {
  /** 按 provider 分组的模型列表 */
  providers: Record<string, { name: string; models: ModelInfo[] }>;
  /** 展平的模型列表（含 provider 信息），用于 UI 渲染 */
  flatModels: Array<{
    provider: string;
    modelId: string;
    label: string;
    detail: string;
    /** 完整模型信息 */
    modelInfo: ModelInfo;
  }>;
  defaultModel: string;
  defaultProvider: string;
  loading: boolean;
  error: string | null;
};

/**
 * 从 Agent Server HTTP API 获取 models.json 配置。
 * 返回按 provider 分组的模型列表和展平列表。
 */
export function useModels(): ModelsState & { reload: () => void } {
  const [state, setState] = useState<ModelsState>({
    providers: {},
    flatModels: [],
    defaultModel: "deepseek-v4-flash",
    defaultProvider: "deepseek",
    loading: true,
    error: null,
  });

  const fetchModels = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      const origin = getAgentHttpOrigin(getActiveRuntimeMode());
      const res = await fetch(`${origin}/api/models`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ModelsConfigResponse;

      const providers: Record<string, { name: string; models: ModelInfo[] }> = {};
      const flatModels: ModelsState["flatModels"] = [];

      for (const [providerKey, provider] of Object.entries(data.providers)) {
        const providerName = providerKey.charAt(0).toUpperCase() + providerKey.slice(1);
        providers[providerKey] = { name: providerName, models: provider.models };

        for (const model of provider.models) {
          flatModels.push({
            provider: providerKey,
            modelId: model.id,
            label: model.name || model.id,
            detail: `${providerName} · ${model.contextWindow?.toLocaleString() || "?"} ctx`,
            modelInfo: model,
          });
        }
      }

      setState({
        providers,
        flatModels,
        defaultModel: data.defaultModel,
        defaultProvider: data.defaultProvider,
        loading: false,
        error: null,
      });
    } catch (err) {
      console.warn("[useModels] Failed to fetch models:", err);
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to fetch models",
      }));
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  return { ...state, reload: fetchModels };
}
