import fs from "fs";
import path from "path";

/**
 * 递归读取目录结构，返回 { name, type, children? }[]
 * 用于 specs 目录树展示
 */
export function readSpecsTree(dir: string): Array<{ name: string; type: "file" | "folder"; children?: any[] }> {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const result: Array<{ name: string; type: "file" | "folder"; children?: any[] }> = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) {
      const children = readSpecsTree(path.join(dir, entry.name));
      result.push({ name: entry.name, type: "folder", children });
    } else if (entry.isFile()) {
      result.push({ name: entry.name, type: "file" });
    }
  }
  return result;
}

/**
 * 递归读取项目仓库目录树（排除 specs 目录、.git、node_modules、隐藏文件）
 */
export function readRepoTree(dir: string): Array<{ name: string; type: "file" | "folder"; children?: any[] }> {
  try {
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const result: Array<{ name: string; type: "file" | "folder"; children?: any[] }> = [];
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      if (entry.name === "node_modules") continue;
      if (entry.name === "specs") continue;
      if (entry.isDirectory()) {
        const children = readRepoTree(path.join(dir, entry.name));
        result.push({ name: entry.name, type: "folder", children });
      } else if (entry.isFile()) {
        result.push({ name: entry.name, type: "file" });
      }
    }
    return result;
  } catch {
    return [];
  }
}

/**
 * 安全读取文件内容，带路径穿越防护
 * @param basePath 允许的基路径
 * @param relativePath 相对路径
 * @returns 文件内容
 */
export function readFileSafe(basePath: string, relativePath: string): string {
  const fullPath = path.resolve(basePath, relativePath);
  if (!fullPath.startsWith(path.resolve(basePath))) {
    throw new Error("Forbidden: path traversal detected");
  }
  return fs.readFileSync(fullPath, "utf-8");
}

/**
 * 安全写入文件内容，自动创建父目录，带路径穿越防护
 * @param basePath 允许的基路径
 * @param relativePath 相对路径
 * @param content 文件内容
 */
export function writeFileSafe(basePath: string, relativePath: string, content: string): void {
  const fullPath = path.resolve(basePath, relativePath);
  if (!fullPath.startsWith(path.resolve(basePath))) {
    throw new Error("Forbidden: path traversal detected");
  }
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, content, "utf-8");
}

/**
 * 检查路径是否存在
 */
export function existsSync(filePath: string): boolean {
  return fs.existsSync(filePath);
}
