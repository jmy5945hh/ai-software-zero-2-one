import { useCallback, useEffect, useRef, useState } from "react";
import type { ModelsConfigResponse, ModelInfo } from "../data/types";
import { agentFetch, getLocalApiBase } from "./config";

const CACHE_TTL = 30_000; // 30 秒缓存

interface CacheEntry {
  data: ModelsConfigResponse;
  timestamp: number;
}

let cache: CacheEntry | null = null;

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

function buildState(data: ModelsConfigResponse): ModelsState {
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

  return {
    providers,
    flatModels,
    defaultModel: data.defaultModel,
    defaultProvider: data.defaultProvider,
    loading: false,
    error: null,
  };
}

/**
 * 从 Agent Server HTTP API 获取 models.json 配置。
 * 返回按 provider 分组的模型列表和展平列表。
 * 带 30 秒内存缓存，避免重复挂载时反复请求。
 */
export function useModels(): ModelsState & { reload: () => void } {
  const [state, setState] = useState<ModelsState>(() => {
    // 初始化时尝试使用缓存
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
      return buildState(cache.data);
    }
    return {
      providers: {},
      flatModels: [],
      defaultModel: "deepseek-v4-flash",
      defaultProvider: "deepseek",
      loading: true,
      error: null,
    };
  });

  const abortRef = useRef<AbortController | null>(null);

  const fetchModels = useCallback(async () => {
    // 取消上一次未完成的请求
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // 先检查缓存是否仍然有效
      if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
        setState(buildState(cache.data));
        return;
      }

      setState((prev) => ({ ...prev, loading: true, error: null }));

      const timeoutId = setTimeout(() => controller.abort(), 10_000);
      const res = await agentFetch(`${getLocalApiBase()}/api/models`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ModelsConfigResponse;

      // 写入缓存
      cache = { data, timestamp: Date.now() };

      setState(buildState(data));
    } catch (err) {
      // 如果是主动取消的请求，不更新状态
      if (err instanceof DOMException && err.name === "AbortError") return;
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
    return () => abortRef.current?.abort();
  }, [fetchModels]);

  return { ...state, reload: fetchModels };
}
