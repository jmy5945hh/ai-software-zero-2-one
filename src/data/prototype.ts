import type { PrototypeState } from "./types";

export function getPrototypeArtifactPaths(taskId: string) {
  // 原型产物写入 ~/.aiNativeDevPlatform/sessions/{taskId}/ 目录
  return {
    manifestPath: `prototype.json`,
    htmlPath: `index.html`,
    handoffPath: `原型交接.md`,
  };
}

export function parsePrototypeManifest(content: string | undefined, taskId: string): PrototypeState | null {
  if (!content) return null;
  try {
    const value = JSON.parse(content) as Partial<PrototypeState>;
    const validMode = value.mode === "none" || value.mode === "new-page" || value.mode === "existing-change";
    const validStatus = value.status === "pending" || value.status === "reviewing" || value.status === "skipped";
    if (!validMode || !validStatus) return null;

    if (value.status === "skipped") {
      if (value.mode !== "none" || value.htmlPath || value.handoffPath) return null;
    } else {
      if (value.mode === "none") return null;
      const expected = getPrototypeArtifactPaths(taskId);
      if (value.htmlPath !== expected.htmlPath || value.handoffPath !== expected.handoffPath) return null;
    }

    return {
      mode: value.mode!,
      status: value.status!,
      htmlPath: value.htmlPath || "",
      handoffPath: value.handoffPath || "",
    };
  } catch {
    return null;
  }
}
