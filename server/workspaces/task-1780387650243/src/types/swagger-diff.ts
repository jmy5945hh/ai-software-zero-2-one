// ── Swagger/OpenAPI 文档结构 ──────────────────

/** Swagger 文档的简化结构（仅对比关心的字段） */
export interface SwaggerDoc {
  /** OpenAPI 版本 */
  openapi: string;
  /** 接口信息 */
  info: {
    title: string;
    version: string;
    description?: string;
  };
  /** 服务器地址 */
  servers?: Array<{ url: string; description?: string }>;
  /** 路径与方法 */
  paths: Record<string, PathItem>;
  /** 组件 schemas */
  components?: {
    schemas?: Record<string, SchemaObject>;
  };
}

export interface PathItem {
  get?: OperationObject;
  post?: OperationObject;
  put?: OperationObject;
  delete?: OperationObject;
  patch?: OperationObject;
  summary?: string;
  description?: string;
}

export interface OperationObject {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject;
  responses?: Record<string, ResponseObject>;
  deprecated?: boolean;
}

export interface ParameterObject {
  name: string;
  in: "query" | "path" | "header" | "cookie";
  required?: boolean;
  description?: string;
  schema?: SchemaObject;
}

export interface RequestBodyObject {
  required?: boolean;
  description?: string;
  content: Record<string, MediaTypeObject>;
}

export interface MediaTypeObject {
  schema?: SchemaObject;
}

export interface ResponseObject {
  description: string;
  content?: Record<string, MediaTypeObject>;
}

export interface SchemaObject {
  type?: string;
  properties?: Record<string, SchemaObject>;
  required?: string[];
  items?: SchemaObject;
  $ref?: string;
  description?: string;
  enum?: string[];
}

// ── 差异结果类型 ────────────────────────────

/** 差异严重程度 */
export type DiffSeverity = "breaking" | "non-breaking" | "info";

/** 差异类型枚举 */
export type DiffType =
  | "path-added"
  | "path-removed"
  | "method-added"
  | "method-removed"
  | "parameter-added"
  | "parameter-removed"
  | "parameter-changed"
  | "response-changed"
  | "schema-added"
  | "schema-removed"
  | "schema-changed"
  | "info-changed"
  | "server-changed"
  | "deprecated-added";

/** 单条差异项 */
export interface DiffItem {
  /** 差异类型 */
  type: DiffType;
  /** 严重程度 */
  severity: DiffSeverity;
  /** 人类可读描述 */
  message: string;
  /** 影响的路径（如 /api/users） */
  path?: string;
  /** 影响的方法（如 GET） */
  method?: string;
  /** 影响的参数名 */
  parameter?: string;
  /** 旧值（如适用） */
  oldValue?: string;
  /** 新值（如适用） */
  newValue?: string;
}

/** 汇总统计 */
export interface DiffSummary {
  totalChanges: number;
  breakingChanges: number;
  nonBreakingChanges: number;
  infoChanges: number;
  pathsAdded: number;
  pathsRemoved: number;
  methodsAdded: number;
  methodsRemoved: number;
  parametersChanged: number;
  schemasChanged: number;
}

/** 完整差异报告 */
export interface SwaggerDiffReport {
  /** 源文档标识 */
  sourceDoc: { title: string; version: string };
  /** 目标文档标识 */
  targetDoc: { title: string; version: string };
  /** 对比时间 ISO 字符串 */
  comparedAt: string;
  /** 汇总统计 */
  summary: DiffSummary;
  /** 差异项列表 */
  changes: DiffItem[];
  /** 兼容性结论 */
  compatibility: "compatible" | "breaking" | "unknown";
}

// ── 输入状态 ────────────────────────────────

export type InputMethod = "paste" | "upload" | "mock";

export interface SwaggerInputState {
  label: string;
  method: InputMethod;
  content: string;
  fileName?: string;
}
