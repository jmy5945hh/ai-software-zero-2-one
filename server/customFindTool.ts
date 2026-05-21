import { existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import type { FindOperations } from "@earendil-works/pi-coding-agent";

/**
 * Convert a glob pattern to a RegExp.
 * Supports: *, **, ?, {a,b}, [abc]
 */
function globToRegex(pattern: string): RegExp {
  let regexStr = "";
  let i = 0;

  while (i < pattern.length) {
    const ch = pattern[i];

    if (ch === "/" && pattern.slice(i, i + 3) === "/**") {
      // /**/ matches zero or more directory levels
      regexStr += "(?:/|/.*/)?";
      i += 3;
      // skip any additional /** patterns
      while (pattern.slice(i, i + 3) === "/**") i += 3;
    } else if (ch === "*" && pattern[i + 1] === "*") {
      // ** matches everything including path separators
      regexStr += ".*";
      i += 2;
    } else if (ch === "*") {
      // * matches anything except path separator
      regexStr += "[^/]*";
      i += 1;
    } else if (ch === "?") {
      regexStr += "[^/]";
      i += 1;
    } else if (ch === "{") {
      const end = pattern.indexOf("}", i);
      if (end === -1) {
        regexStr += "\\{";
        i += 1;
      } else {
        const inner = pattern.slice(i + 1, end);
        regexStr += `(?:${inner.split(",").map((s) => s.trim()).map(escapeRegex).join("|")})`;
        i = end + 1;
      }
    } else if (ch === "[") {
      const end = pattern.indexOf("]", i);
      if (end === -1) {
        regexStr += "\\[";
        i += 1;
      } else {
        regexStr += pattern.slice(i, end + 1);
        i = end + 1;
      }
    } else {
      regexStr += escapeRegex(ch);
      i += 1;
    }
  }

  return new RegExp(`^${regexStr}$`);
}

function escapeRegex(s: string): string {
  return s.replace(/[.+^${}()|\\]/g, "\\$&");
}

/**
 * Check if a glob pattern matches only filenames (no path separators).
 */
function isBasenameOnly(pattern: string): boolean {
  return !pattern.includes("/") && !pattern.startsWith("**");
}

/**
 * Recursively walk a directory, collecting files that match the given regex.
 */
async function walk(
  dir: string,
  regex: RegExp,
  baseDir: string,
  ignoreSet: Set<string>,
  limit: number,
  results: string[],
): Promise<void> {
  if (results.length >= limit) return;

  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return; // skip unreadable directories
  }

  for (const entry of entries) {
    if (results.length >= limit) break;

    const fullPath = join(dir, entry);
    const relativePath = relative(baseDir, fullPath);

    // Check ignore patterns
    if (ignoreSet.has(entry) || ignoreSet.has(relativePath)) continue;
    // Check if any parent directory is ignored
    const parts = relativePath.split(sep);
    let ignored = false;
    for (let i = 1; i <= parts.length; i++) {
      if (ignoreSet.has(parts.slice(0, i).join(sep))) {
        ignored = true;
        break;
      }
    }
    if (ignored) continue;

    try {
      const entryStat = await stat(fullPath);
      if (entryStat.isDirectory()) {
        // Always recurse into directories
        await walk(fullPath, regex, baseDir, ignoreSet, limit, results);
      } else if (entryStat.isFile() || entryStat.isSymbolicLink()) {
        if (regex.test(relativePath)) {
          results.push(fullPath);
        }
      }
    } catch {
      // skip unreadable entries
    }
  }
}

/**
 * Custom FindOperations that uses Node.js fs APIs instead of the `fd` command.
 */
export const nodeFindOperations: FindOperations = {
  exists: (absolutePath: string) => existsSync(absolutePath),

  glob: async (
    pattern: string,
    cwd: string,
    options: { ignore: string[]; limit: number },
  ): Promise<string[]> => {
    const ignoreSet = new Set(options.ignore);
    const results: string[] = [];

    // Build regex from glob pattern
    const regex = globToRegex(pattern);

    if (isBasenameOnly(pattern)) {
      // Fast path: only match filenames, no need to walk full depth
      // We still need to walk to find files, but the regex is simpler
      await walk(cwd, regex, cwd, ignoreSet, options.limit, results);
    } else {
      await walk(cwd, regex, cwd, ignoreSet, options.limit, results);
    }

    return results;
  },
};
