import { useEffect, useState } from "react";
import type { AppState } from "../data/types";
import { createDefaultState, getTaskWorkflow, getWorkflowStepIndex, normalizeDeliveryConfig } from "../data";

export const STORAGE_KEY = "zero-one-software.prototype.v4";

/**
 * 将 AppState 持久化到 localStorage，页面间（home / workspace）共享同一份状态。
 */
export function useStoredState() {
  const [state, setState] = useState<AppState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return createDefaultState();
      const parsed = JSON.parse(saved) as Partial<AppState>;
      const defaults = createDefaultState();
      const activeStage = parsed.activeStage || defaults.activeStage;
      const prototype = parsed.prototype || defaults.prototype;
      const taskWorkflow = getTaskWorkflow(prototype);
      return {
        ...defaults,
        ...parsed,
        deliveryConfig: normalizeDeliveryConfig(parsed.deliveryConfig),
        activeStage,
        prototype,
        stepIndex: getWorkflowStepIndex(activeStage, parsed.stepIndex, taskWorkflow),
      };
    } catch {
      return createDefaultState();
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage full, ignore
    }
  }, [state]);

  return [state, setState] as const;
}
