import type {
  SwaggerDoc,
  SwaggerDiffReport,
  DiffItem,
  DiffSummary,
} from "../types/swagger-diff";

// ── 模拟 Swagger 文档 v1（旧版本）───────────

export const mockSwaggerV1: SwaggerDoc = {
  openapi: "3.0.3",
  info: {
    title: "用户服务 API",
    version: "1.2.0",
    description: "提供用户注册、登录、信息管理功能",
  },
  servers: [{ url: "https://api.example.com/v1", description: "生产环境" }],
  paths: {
    "/api/users": {
      get: {
        operationId: "listUsers",
        summary: "获取用户列表",
        tags: ["用户"],
        parameters: [
          { name: "page", in: "query", schema: { type: "integer" } },
          { name: "limit", in: "query", schema: { type: "integer" } },
        ],
        responses: {
          "200": { description: "用户列表" },
        },
      },
      post: {
        operationId: "createUser",
        summary: "创建用户",
        tags: ["用户"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  email: { type: "string" },
                  age: { type: "integer" },
                },
                required: ["name", "email"],
              },
            },
          },
        },
        responses: {
          "201": { description: "创建成功" },
        },
      },
    },
    "/api/users/{userId}": {
      get: {
        operationId: "getUserById",
        summary: "获取用户详情",
        tags: ["用户"],
        parameters: [
          { name: "userId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "用户详情" },
        },
      },
      delete: {
        operationId: "deleteUser",
        summary: "删除用户",
        tags: ["用户"],
        parameters: [
          { name: "userId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "204": { description: "删除成功" },
        },
      },
    },
    "/api/health": {
      get: {
        operationId: "healthCheck",
        summary: "健康检查",
        tags: ["系统"],
        responses: {
          "200": { description: "服务正常" },
        },
      },
    },
  },
  components: {
    schemas: {
      User: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          email: { type: "string" },
          age: { type: "integer" },
        },
        required: ["id", "name", "email"],
      },
      ErrorResponse: {
        type: "object",
        properties: {
          code: { type: "integer" },
          message: { type: "string" },
        },
      },
    },
  },
};

// ── 模拟 Swagger 文档 v2（新版本，有破坏性变更）───

export const mockSwaggerV2: SwaggerDoc = {
  openapi: "3.0.3",
  info: {
    title: "用户服务 API",
    version: "2.0.0",
    description: "提供用户注册、登录、信息管理功能（v2 重构版）",
  },
  servers: [
    { url: "https://api.example.com/v2", description: "生产环境" },
    { url: "https://staging.example.com/v2", description: "预发布环境" },
  ],
  paths: {
    "/api/users": {
      get: {
        operationId: "listUsers",
        summary: "获取用户列表（支持分页）",
        tags: ["用户"],
        parameters: [
          { name: "page", in: "query", required: true, schema: { type: "integer" } },
          { name: "limit", in: "query", schema: { type: "integer" } },
          { name: "sort", in: "query", schema: { type: "string", enum: ["name", "email", "createdAt"] } },
        ],
        responses: {
          "200": { description: "用户列表（分页）" },
        },
      },
      post: {
        operationId: "createUser",
        summary: "创建用户",
        tags: ["用户"],
        deprecated: true,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  email: { type: "string" },
                  phone: { type: "string" },
                },
                required: ["name", "email", "phone"],
              },
            },
          },
        },
        responses: {
          "201": { description: "创建成功" },
        },
      },
    },
    "/api/users/{userId}": {
      get: {
        operationId: "getUserById",
        summary: "获取用户详情",
        tags: ["用户"],
        parameters: [
          { name: "userId", in: "path", required: true, schema: { type: "string" } },
          { name: "fields", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "用户详情" },
        },
      },
    },
    "/api/users/{userId}/profile": {
      get: {
        operationId: "getUserProfile",
        summary: "获取用户扩展资料",
        tags: ["用户"],
        parameters: [
          { name: "userId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "用户扩展资料" },
        },
      },
    },
  },
  components: {
    schemas: {
      User: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
        },
        required: ["id", "name", "email", "phone"],
      },
      PaginatedResponse: {
        type: "object",
        properties: {
          data: { type: "array", items: { $ref: "#/components/schemas/User" } },
          total: { type: "integer" },
          page: { type: "integer" },
        },
      },
    },
  },
};

// ── 模拟差异报告 ────────────────────────────

const mockChanges: DiffItem[] = [
  {
    type: "info-changed",
    severity: "info",
    message: "API 版本从 1.2.0 升级到 2.0.0",
    oldValue: "1.2.0",
    newValue: "2.0.0",
  },
  {
    type: "server-changed",
    severity: "non-breaking",
    message: "基础 URL 从 /v1 变更为 /v2",
    oldValue: "https://api.example.com/v1",
    newValue: "https://api.example.com/v2",
  },
  {
    type: "server-changed",
    severity: "non-breaking",
    message: "新增预发布环境服务器",
    newValue: "https://staging.example.com/v2",
  },
  {
    type: "parameter-changed",
    severity: "breaking",
    message: "GET /api/users 的 page 参数从可选变为必填",
    path: "/api/users",
    method: "GET",
    parameter: "page",
    oldValue: "非必填",
    newValue: "必填",
  },
  {
    type: "parameter-added",
    severity: "non-breaking",
    message: "GET /api/users 新增 sort 参数（枚举: name, email, createdAt）",
    path: "/api/users",
    method: "GET",
    parameter: "sort",
    newValue: "枚举: name, email, createdAt",
  },
  {
    type: "deprecated-added",
    severity: "non-breaking",
    message: "POST /api/users 已被标记为废弃，建议迁移到新接口",
    path: "/api/users",
    method: "POST",
  },
  {
    type: "schema-changed",
    severity: "breaking",
    message: "POST /api/users 请求体中 age 字段被移除，新增必填字段 phone",
    path: "/api/users",
    method: "POST",
    oldValue: "必填: name, email / 可选: age",
    newValue: "必填: name, email, phone",
  },
  {
    type: "path-added",
    severity: "non-breaking",
    message: "新增 GET /api/users/{userId}/profile 接口",
    path: "/api/users/{userId}/profile",
    method: "GET",
  },
  {
    type: "method-removed",
    severity: "breaking",
    message: "DELETE /api/users/{userId} 接口已被移除",
    path: "/api/users/{userId}",
    method: "DELETE",
  },
  {
    type: "parameter-added",
    severity: "non-breaking",
    message: "GET /api/users/{userId} 新增 fields 参数",
    path: "/api/users/{userId}",
    method: "GET",
    parameter: "fields",
    newValue: "string",
  },
  {
    type: "path-removed",
    severity: "breaking",
    message: "GET /api/health 健康检查接口已被移除",
    path: "/api/health",
    method: "GET",
  },
  {
    type: "schema-added",
    severity: "non-breaking",
    message: "新增 PaginatedResponse 分页响应模型",
    newValue: "PaginatedResponse",
  },
  {
    type: "schema-changed",
    severity: "breaking",
    message: "User 模型新增必填字段 phone 和 createdAt",
    oldValue: "必填: id, name, email",
    newValue: "必填: id, name, email, phone",
  },
];

const mockSummary: DiffSummary = {
  totalChanges: 13,
  breakingChanges: 5,
  nonBreakingChanges: 7,
  infoChanges: 1,
  pathsAdded: 1,
  pathsRemoved: 1,
  methodsAdded: 0,
  methodsRemoved: 1,
  parametersChanged: 3,
  schemasChanged: 2,
};

export const mockDiffReport: SwaggerDiffReport = {
  sourceDoc: { title: "用户服务 API", version: "1.2.0" },
  targetDoc: { title: "用户服务 API", version: "2.0.0" },
  comparedAt: new Date().toISOString(),
  summary: mockSummary,
  changes: mockChanges,
  compatibility: "breaking",
};

// ── localStorage 的 key ────────────────────

const STORAGE_KEY = "zero-one-swagger-diff";

/** 从 localStorage 读取历史报告 */
export function loadStoredReports(): SwaggerDiffReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** 保存报告到 localStorage */
export function saveReport(report: SwaggerDiffReport): void {
  const reports = loadStoredReports();
  reports.unshift(report);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports.slice(0, 20)));
}

/** 清空历史 */
export function clearReports(): void {
  localStorage.removeItem(STORAGE_KEY);
}
