/**
 * 连接器工厂 — 单例缓存 + 模式路由。
 *
 * 同一模式复用实例，避免重复连接。
 * 切换模式时自动断开旧连接、建立新连接。
 */
import type { IRuntimeConnector, RuntimeMode } from "../types/runtime";
import { LocalRuntimeConnector } from "./LocalRuntimeConnector";
import { CloudRuntimeConnector } from "./CloudRuntimeConnector";

const instances = new Map<RuntimeMode, IRuntimeConnector>();

/** 按模式获取连接器单例 */
export function getConnector(mode: RuntimeMode): IRuntimeConnector {
  const existing = instances.get(mode);
  if (existing) return existing;

  const connector: IRuntimeConnector =
    mode === "local"
      ? new LocalRuntimeConnector()
      : new CloudRuntimeConnector();

  instances.set(mode, connector);
  return connector;
}

/** 切换运行时模式：断开旧连接，建立新连接 */
export async function switchRuntime(
  from: RuntimeMode | null,
  to: RuntimeMode,
): Promise<IRuntimeConnector> {
  // 断开所有已缓存的旧连接（除目标模式外）
  for (const [mode, connector] of instances) {
    if (mode !== to) {
      connector.disconnect();
    }
  }

  // 获取或创建新连接器
  const connector = getConnector(to);

  // 建立新连接
  await connector.connect();

  return connector;
}

/** 获取当前活跃的模式 */
export function getActiveMode(): RuntimeMode | null {
  for (const [mode, connector] of instances) {
    // 简单判断：local 恒连接，cloud 检查是否在 connected
    if (mode === "local") return mode;
    // cloud 状态通过 store 管理，这里只做存在性检查
    if (mode === "cloud") return mode;
  }
  return null;
}
