import type {
  SwaggerDoc,
  SwaggerDiffReport,
  DiffItem,
  DiffSummary,
  PathItem,
  OperationObject,
  ParameterObject,
} from "../types/swagger-diff";

type HttpMethod = "get" | "post" | "put" | "delete" | "patch";

const METHODS: HttpMethod[] = ["get", "post", "put", "delete", "patch"];

/**
 * 对比两个 Swagger 文档，生成结构化差异报告。
 * 当前为简化实现，实际生产场景可集成 openapi-diff 等专业库。
 */
export function diffSwaggerDocs(
  source: SwaggerDoc,
  target: SwaggerDoc,
): SwaggerDiffReport {
  const changes: DiffItem[] = [];

  // ── info 对比 ─────────────────────────
  if (source.info.version !== target.info.version) {
    changes.push({
      type: "info-changed",
      severity: "info",
      message: `API 版本从 ${source.info.version} 升级到 ${target.info.version}`,
      oldValue: source.info.version,
      newValue: target.info.version,
    });
  }
  if (source.info.title !== target.info.title) {
    changes.push({
      type: "info-changed",
      severity: "info",
      message: "接口标题已变更",
      oldValue: source.info.title,
      newValue: target.info.title,
    });
  }

  // ── servers 对比 ──────────────────────
  const sourceUrls = new Set(source.servers?.map((s) => s.url) ?? []);
  const targetUrls = new Set(target.servers?.map((s) => s.url) ?? []);

  for (const url of sourceUrls) {
    if (!targetUrls.has(url)) {
      changes.push({
        type: "server-changed",
        severity: "non-breaking",
        message: `服务器 ${url} 已被移除`,
        oldValue: url,
      });
    }
  }
  for (const url of targetUrls) {
    if (!sourceUrls.has(url)) {
      changes.push({
        type: "server-changed",
        severity: "non-breaking",
        message: `新增服务器 ${url}`,
        newValue: url,
      });
    }
  }

  // ── paths 对比 ────────────────────────
  const sourcePaths = new Set(Object.keys(source.paths));
  const targetPaths = new Set(Object.keys(target.paths));

  // 新增路径
  for (const p of targetPaths) {
    if (!sourcePaths.has(p)) {
      const methods = getMethods(target.paths[p]);
      for (const m of methods) {
        changes.push({
          type: "path-added",
          severity: "non-breaking",
          message: `新增 ${m.toUpperCase()} ${p} 接口`,
          path: p,
          method: m.toUpperCase(),
        });
      }
    }
  }

  // 移除路径
  for (const p of sourcePaths) {
    if (!targetPaths.has(p)) {
      const methods = getMethods(source.paths[p]);
      for (const m of methods) {
        changes.push({
          type: "path-removed",
          severity: "breaking",
          message: `${m.toUpperCase()} ${p} 接口已被移除`,
          path: p,
          method: m.toUpperCase(),
        });
      }
    }
  }

  // 共同路径，对比方法级别
  for (const p of sourcePaths) {
    if (!targetPaths.has(p)) continue;
    const srcMethods = getMethods(source.paths[p]);
    const tgtMethods = getMethods(target.paths[p]);

    const srcMethodSet = new Set(srcMethods);
    const tgtMethodSet = new Set(tgtMethods);

    // 新增方法
    for (const m of tgtMethods) {
      if (!srcMethodSet.has(m)) {
        changes.push({
          type: "method-added",
          severity: "non-breaking",
          message: `路径 ${p} 新增 ${m.toUpperCase()} 方法`,
          path: p,
          method: m.toUpperCase(),
        });
      }
    }

    // 移除方法
    for (const m of srcMethods) {
      if (!tgtMethodSet.has(m)) {
        changes.push({
          type: "method-removed",
          severity: "breaking",
          message: `路径 ${p} 的 ${m.toUpperCase()} 方法已被移除`,
          path: p,
          method: m.toUpperCase(),
        });
      }
    }

    // 相同方法，对比操作细节
    for (const m of srcMethods) {
      if (!tgtMethodSet.has(m)) continue;
      const srcOp = getOperation(source.paths[p], m);
      const tgtOp = getOperation(target.paths[p], m);
      if (srcOp && tgtOp) {
        compareOperations(p, m, srcOp, tgtOp, changes);
      }
    }
  }

  // ── schemas 对比 ──────────────────────
  const srcSchemas = source.components?.schemas ?? {};
  const tgtSchemas = target.components?.schemas ?? {};
  const srcSchemaNames = new Set(Object.keys(srcSchemas));
  const tgtSchemaNames = new Set(Object.keys(tgtSchemas));

  for (const name of tgtSchemaNames) {
    if (!srcSchemaNames.has(name)) {
      changes.push({
        type: "schema-added",
        severity: "non-breaking",
        message: `新增 ${name} 数据模型`,
        newValue: name,
      });
    }
  }

  for (const name of srcSchemaNames) {
    if (!tgtSchemaNames.has(name)) {
      changes.push({
        type: "schema-removed",
        severity: "breaking",
        message: `${name} 数据模型已被移除`,
        oldValue: name,
      });
    }
  }

  for (const name of srcSchemaNames) {
    if (!tgtSchemaNames.has(name)) continue;
    const srcSchema = srcSchemas[name];
    const tgtSchema = tgtSchemas[name];
    if (JSON.stringify(srcSchema) !== JSON.stringify(tgtSchema)) {
      changes.push({
        type: "schema-changed",
        severity: "breaking",
        message: `${name} 模型结构已变更`,
        path: name,
        oldValue: describeSchema(srcSchema),
        newValue: describeSchema(tgtSchema),
      });
    }
  }

  // ── 汇总统计 ──────────────────────────
  const summary = computeSummary(changes);
  const compatibility = summary.breakingChanges > 0 ? "breaking" : "compatible";

  return {
    sourceDoc: { title: source.info.title, version: source.info.version },
    targetDoc: { title: target.info.title, version: target.info.version },
    comparedAt: new Date().toISOString(),
    summary,
    changes,
    compatibility,
  };
}

// ── 辅助函数 ───────────────────────────────

function getMethods(item: PathItem): HttpMethod[] {
  return METHODS.filter((m) => item[m] != null);
}

function getOperation(item: PathItem, method: HttpMethod): OperationObject | undefined {
  return item[method];
}

function compareOperations(
  path: string,
  method: HttpMethod,
  src: OperationObject,
  tgt: OperationObject,
  changes: DiffItem[],
): void {
  // deprecated 标记
  if (!src.deprecated && tgt.deprecated) {
    changes.push({
      type: "deprecated-added",
      severity: "non-breaking",
      message: `${method.toUpperCase()} ${path} 已被标记为废弃`,
      path,
      method: method.toUpperCase(),
    });
  }

  // 参数对比
  const srcParams = src.parameters ?? [];
  const tgtParams = tgt.parameters ?? [];
  const srcParamMap = new Map(srcParams.map((p) => [p.name, p]));
  const tgtParamMap = new Map(tgtParams.map((p) => [p.name, p]));

  // 新增参数
  for (const p of tgtParams) {
    if (!srcParamMap.has(p.name)) {
      changes.push({
        type: "parameter-added",
        severity: p.required ? "breaking" : "non-breaking",
        message: `${method.toUpperCase()} ${path} 新增${p.required ? "必填" : "可选"}参数 ${p.name}`,
        path,
        method: method.toUpperCase(),
        parameter: p.name,
        newValue: describeParam(p),
      });
    }
  }

  // 移除参数
  for (const p of srcParams) {
    if (!tgtParamMap.has(p.name)) {
      changes.push({
        type: "parameter-removed",
        severity: p.required ? "breaking" : "non-breaking",
        message: `${method.toUpperCase()} ${path} 参数 ${p.name} 已被移除`,
        path,
        method: method.toUpperCase(),
        parameter: p.name,
        oldValue: describeParam(p),
      });
    }
  }

  // 参数变更
  for (const p of srcParams) {
    const tgtP = tgtParamMap.get(p.name);
    if (!tgtP) continue;
    // required 从 false 变 true 是破坏性变更
    if (!p.required && tgtP.required) {
      changes.push({
        type: "parameter-changed",
        severity: "breaking",
        message: `${method.toUpperCase()} ${path} 的参数 ${p.name} 从可选变为必填`,
        path,
        method: method.toUpperCase(),
        parameter: p.name,
        oldValue: "非必填",
        newValue: "必填",
      });
    }
    // schema 类型变更
    const srcType = p.schema?.type;
    const tgtType = tgtP.schema?.type;
    if (srcType && tgtType && srcType !== tgtType) {
      changes.push({
        type: "parameter-changed",
        severity: "breaking",
        message: `${method.toUpperCase()} ${path} 的参数 ${p.name} 类型从 ${srcType} 变为 ${tgtType}`,
        path,
        method: method.toUpperCase(),
        parameter: p.name,
        oldValue: srcType,
        newValue: tgtType,
      });
    }
  }

  // 响应对比（简化：仅检测 200/201 状态码是否存在）
  const src200 = src.responses?.["200"] ?? src.responses?.["201"];
  const tgt200 = tgt.responses?.["200"] ?? tgt.responses?.["201"];
  if (src200 && !tgt200) {
    changes.push({
      type: "response-changed",
      severity: "breaking",
      message: `${method.toUpperCase()} ${path} 的 200/201 响应已被移除`,
      path,
      method: method.toUpperCase(),
    });
  }
}

function describeParam(p: ParameterObject): string {
  return `${p.name} (${p.in}, ${p.required ? "必填" : "可选"}, ${p.schema?.type ?? "unknown"})`;
}

function describeSchema(schema: unknown): string {
  if (!schema || typeof schema !== "object") return "unknown";
  const s = schema as Record<string, unknown>;
  const props = s.properties ? Object.keys(s.properties as Record<string, unknown>).join(", ") : "无属性";
  const required = s.required ? `必填: ${(s.required as string[]).join(", ")}` : "";
  return [props, required].filter(Boolean).join(" / ");
}

function computeSummary(changes: DiffItem[]): DiffSummary {
  const summary: DiffSummary = {
    totalChanges: changes.length,
    breakingChanges: 0,
    nonBreakingChanges: 0,
    infoChanges: 0,
    pathsAdded: 0,
    pathsRemoved: 0,
    methodsAdded: 0,
    methodsRemoved: 0,
    parametersChanged: 0,
    schemasChanged: 0,
  };

  for (const c of changes) {
    if (c.severity === "breaking") summary.breakingChanges++;
    else if (c.severity === "non-breaking") summary.nonBreakingChanges++;
    else summary.infoChanges++;

    switch (c.type) {
      case "path-added":
        summary.pathsAdded++;
        break;
      case "path-removed":
        summary.pathsRemoved++;
        break;
      case "method-added":
        summary.methodsAdded++;
        break;
      case "method-removed":
        summary.methodsRemoved++;
        break;
      case "parameter-added":
      case "parameter-removed":
      case "parameter-changed":
        summary.parametersChanged++;
        break;
      case "schema-added":
      case "schema-removed":
      case "schema-changed":
        summary.schemasChanged++;
        break;
    }
  }

  return summary;
}
