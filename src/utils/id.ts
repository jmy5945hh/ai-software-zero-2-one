/** 生成 32 位随机 hex 字符串（用于 taskId / sessionId） */
export function generateId(): string {
  return Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("");
}
