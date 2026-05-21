import { useEffect, useState } from "react";
import type { AppState } from "../data/types";
import { createDefaultState } from "../data";

const STORAGE_KEY = "zero-one-software.prototype.v4";

/**
 * 将 AppState 持久化到 localStorage，页面间（home / workspace）共享同一份状态。
 */
export function useStoredState() {
  const [state, setState] = useState<AppState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved
        ? { ...createDefaultState(), ...JSON.parse(saved) }
        : createDefaultState();
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
