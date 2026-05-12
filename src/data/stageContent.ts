// 为每个 SOP 阶段提供模拟的 AI 流式输出内容

export type StageContentBlock = {
  id: string;
  type: "summary" | "visual" | "finding" | "decision" | "event";
  title: string;
  detail: string;
  clickable?: boolean;
  target?: { type: string; title: string; content: string };
};

// ── 意图校准 ────────────────────────────────
export function getIntentContent(): StageContentBlock[] {
  return [
    {
      id: "intent-summary",
      type: "summary",
      title: "AI 已完成意图解析",
      detail:
        "我已从你的描述中抽取出核心业务对象（客户、跟进记录、提醒规则、周报），并梳理了关键角色（销售、主管）和核心场景（线索跟踪、到期提醒、团队汇总）。",
    },
    {
      id: "intent-visual",
      type: "visual",
      title: "业务概念关系",
      detail: "思维导图：销售→管理客户→产生跟进记录→触发提醒→聚合周报→主管查看",
    },
    {
      id: "intent-finding-1",
      type: "finding",
      title: "识别到 3 个核心对象",
      detail: "客户、跟进记录、周报。建议先以客户为根实体展开。",
    },
    {
      id: "intent-finding-2",
      type: "finding",
      title: "建议交付模式：MVP",
      detail: "先跑通销售→客户→提醒的主流程,最适合快速验证。",
    },
  ];
}

// ── 范围锁定 ────────────────────────────────
export function getScopeContent(): StageContentBlock[] {
  return [
    {
      id: "scope-summary",
      type: "summary",
      title: "AI 建议本轮交付范围",
      detail:
        "基于意图分析，我建议本轮聚焦销售日常最核心的 4 个模块。未选模块将进入后续迭代建议池。",
    },
    {
      id: "scope-visual",
      type: "visual",
      title: "模块依赖关系",
      detail: "模块拓扑：线索池→客户详情→跟进提醒→沟通记录→团队周报→主管看板",
    },
    {
      id: "scope-finding",
      type: "finding",
      title: "风险提示",
      detail: "「主管看板」依赖前面所有模块的数据，建议放入下一迭代。",
    },
  ];
}

// ── Spec 基线 ────────────────────────────────
export function getSpecContent(): StageContentBlock[] {
  return [
    {
      id: "spec-summary",
      type: "summary",
      title: "可执行 Spec 已生成",
      detail:
        "我已生成 4 类机器可读资产：业务对象模型、页面地图、API 契约、权限模型。这些是后续代码和测试的唯一事实来源。",
    },
    {
      id: "spec-visual",
      type: "visual",
      title: "数据模型 ER",
      detail: "Customer(1)→(N)FollowUp(1)→(N)Reminder; Customer(1)→(N)Report",
    },
    {
      id: "spec-finding-1",
      type: "finding",
      title: "API 契约 12 个端点",
      detail: "覆盖 CRUD、提醒调度、报表聚合，点击查看完整 OpenAPI 文档。",
      clickable: true,
      target: {
        type: "code",
        title: "API 契约 (OpenAPI)",
        content: `openapi: "3.0.0"
info:
  title: 销售线索跟进系统
  version: "1.0.0"
paths:
  /customers:
    get:
      summary: 获取客户列表
      parameters:
        - name: status
          in: query
          schema:
            type: string
            enum: [active, inactive, all]
      responses:
        "200":
          description: 客户列表
    post:
      summary: 创建客户
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/CustomerInput"
  /customers/{id}:
    get:
      summary: 获取客户详情
    patch:
      summary: 更新客户信息
  /customers/{id}/follow-ups:
    get:
      summary: 获取客户跟进记录
    post:
      summary: 创建跟进记录
  /reminders:
    get:
      summary: 获取待处理提醒
    post:
      summary: 创建提醒规则
  /reports/weekly:
    get:
      summary: 获取团队周报
components:
  schemas:
    CustomerInput:
      type: object
      properties:
        name:
          type: string
        phone:
          type: string
        company:
          type: string
        status:
          type: string
          enum: [new, contacted, negotiating, closed]`,
      },
    },
    {
      id: "spec-finding-2",
      type: "finding",
      title: "权限模型确认",
      detail: "销售仅看本人客户、主管查看团队汇总。点击查看完整权限矩阵。",
      clickable: true,
      target: {
        type: "document",
        title: "权限矩阵",
        content: `# 权限模型

## 角色定义

| 角色 | 权限范围 |
|------|---------|
| 销售 | 仅查看、编辑本人负责的客户 |
| 主管 | 查看团队内所有客户和汇总报表 |
| 管理员 | 全部数据 + 系统配置 |

## 数据访问规则

- 销售查询客户列表：自动过滤 owner_id = current_user
- 主管查询客户列表：自动过滤 team_id = current_team
- 周报聚合：按 team 维度，销售仅看本人数据参与聚合
- 提醒规则：每个销售仅管理自己客户的提醒`,
      },
    },
  ];
}

// ── Agent 开发 ──────────────────────────────
export function getBuildContent(): StageContentBlock[] {
  return [
    {
      id: "build-summary",
      type: "summary",
      title: "Agent Team 正在并行构建",
      detail:
        "Frontend Agent 生成页面组件、Architect Agent 维护 API 契约、Test Agent 同步编写测试。所有产出基于同一个 ChangeSet 上下文。",
    },
    {
      id: "build-visual",
      type: "visual",
      title: "构建进展",
      detail: "5个任务并行：页面结构 ✓ → OpenAPI ✓ → Mock数据 ⏳ → 单元测试 ⏳ → 变更日志 ○",
    },
    {
      id: "build-event-1",
      type: "event",
      title: "生成页面结构",
      detail: "Frontend Agent 已完成 lead-list.tsx、customer-detail.tsx",
    },
    {
      id: "build-event-2",
      type: "event",
      title: "生成 OpenAPI 契约",
      detail: "Architect Agent 输出了 12 个端点定义",
    },
    {
      id: "build-event-3",
      type: "event",
      title: "写入 Mock 数据",
      detail: "Frontend Agent 已生成 leads.json、customers.json",
    },
    {
      id: "build-event-4",
      type: "event",
      title: "生成单元测试",
      detail: "Test Agent 覆盖提醒逻辑和报表聚合",
      clickable: true,
      target: {
        type: "code",
        title: "单元测试示例",
        content: `// reminder.test.ts
import { describe, it, expect } from "vitest";
import { generateReminder } from "../src/hooks/use-follow-up";

describe("提醒生成逻辑", () => {
  it("超过3天未跟进应生成提醒", () => {
    const lastFollowUp = new Date("2026-04-20");
    const reminder = generateReminder(lastFollowUp);
    expect(reminder.urgent).toBe(true);
    expect(reminder.message).toContain("3 天");
  });

  it("今天刚跟进不应生成提醒", () => {
    const lastFollowUp = new Date();
    const reminder = generateReminder(lastFollowUp);
    expect(reminder).toBeNull();
  });
});`,
      },
    },
    {
      id: "build-event-5",
      type: "event",
      title: "更新变更日志",
      detail: "DevOps Agent 已记录本次变更摘要",
    },
  ];
}

// ── 质量门禁 ────────────────────────────────
export function getQualityContent(): StageContentBlock[] {
  return [
    {
      id: "quality-summary",
      type: "summary",
      title: "质量门禁审查报告",
      detail:
        "Agent Team 完成开发后，自动触发质量门禁。4 项检查中 2 项通过、2 项未通过，需要你的审查决策。",
    },
    {
      id: "quality-visual",
      type: "visual",
      title: "质量指标",
      detail: "雷达图：代码检视 ✓ | 单元测试 ✓ | API测试 80% | E2E ❌",
    },
    {
      id: "quality-finding-1",
      type: "finding",
      title: "✓ 代码检视通过",
      detail: "代码风格、类型安全、最佳实践检查全部通过。",
    },
    {
      id: "quality-finding-2",
      type: "finding",
      title: "✓ 单元测试通过 (12/12)",
      detail: "所有单元测试通过，覆盖率 87%。",
    },
    {
      id: "quality-finding-3",
      type: "finding",
      title: "⚠️ API 测试 8/10 通过",
      detail:
        "提醒调度接口和报表聚合接口返回格式与契约不一致，需要修复。点击查看失败详情。",
      clickable: true,
      target: {
        type: "code",
        title: "API 测试失败详情",
        content: `API 测试结果
═══════════════════════════════════

✅ GET /customers             200 OK
✅ POST /customers            201 Created
✅ GET /customers/{id}        200 OK
✅ PATCH /customers/{id}      200 OK
✅ GET /customers/{id}/follow-ups  200 OK
✅ POST /customers/{id}/follow-ups 201 Created
✅ GET /reminders             200 OK
✅ POST /reminders            201 Created
❌ GET /reports/weekly        200 OK (响应格式不符合契约)
  期望: { teamId, period, members[], stats{} }
  实际: { team, week, data[] }
❌ GET /customers?status=all   200 OK (返回字段缺失 owner 信息)
  期望: 包含 owner.name, owner.id
  实际: 仅返回客户基础信息`,
      },
    },
    {
      id: "quality-finding-4",
      type: "finding",
      title: "❌ UI E2E 测试失败",
      detail:
        "主管视图下团队外客户出现在搜索结果中，存在权限边界问题。点击查看 E2E 失败截图。",
      clickable: true,
      target: {
        type: "html",
        title: "E2E 失败场景预览",
        html: `<div style="padding:24px;font-family:sans-serif;">
  <div style="background:#FFF3E0;border-left:4px solid #FF9800;border-radius:8px;padding:16px;margin-bottom:16px;">
    <strong>⚠️ 测试场景：主管搜索客户</strong>
    <p style="margin-top:8px;color:#666;">步骤：登录主管账号 → 搜索"科技" → 结果集应仅包含团队内客户</p>
  </div>
  
  <div style="border:1px solid #E6E2DA;border-radius:12px;overflow:hidden;">
    <div style="background:#F9F8F4;padding:12px;display:flex;align-items:center;justify-content:space-between;">
      <strong>搜索结果</strong>
      <span style="color:#C27B66;font-size:12px;">期望 3 项，实际 5 项</span>
    </div>
    <div style="padding:4px;">
      <div style="padding:12px;border-bottom:1px solid #E6E2DA;">✓ 杭州云启科技 <span style="color:#8C9A84;font-size:12px;">(本团队)</span></div>
      <div style="padding:12px;border-bottom:1px solid #E6E2DA;">✓ 上海星河制造 <span style="color:#8C9A84;font-size:12px;">(本团队)</span></div>
      <div style="padding:12px;border-bottom:1px solid #E6E2DA;">✓ 深圳蓝芯智能 <span style="color:#8C9A84;font-size:12px;">(本团队)</span></div>
      <div style="padding:12px;border-bottom:1px solid #E6E2DA;background:#FFF3E0;">✗ 北京量子创新 <span style="color:#C27B66;font-size:12px;">(团队外！)</span></div>
      <div style="padding:12px;background:#FFF3E0;">✗ 成都智算科技 <span style="color:#C27B66;font-size:12px;">(团队外！)</span></div>
    </div>
  </div>
</div>`,
      },
    },
  ];
}

// ── 验证修复 ────────────────────────────────
export function getVerifyContent(): StageContentBlock[] {
  return [
    {
      id: "verify-summary",
      type: "summary",
      title: "修复方案评估",
      detail:
        "AI 分析了 2 个失败项并生成了修复方案。建议授权 Frontend Agent 和 Test Agent 自动修复并复测，预计耗时 2-3 分钟。",
    },
    {
      id: "verify-visual",
      type: "visual",
      title: "修复范围影响分析",
      detail: "变更文件：permission-filter.ts (新增) → lead-list.tsx → search-api.ts → lead-flow.spec.ts",
    },
    {
      id: "verify-finding-1",
      type: "finding",
      title: "修复方案 A：API 响应格式",
      detail: "调整 /reports/weekly 和 /customers 返回格式，对齐 OpenAPI 契约。",
      clickable: true,
      target: {
        type: "code",
        title: "差异对比",
        content: `// search-api.ts - 修复前
export async function searchCustomers(query: string) {
  const res = await fetch(\`/api/customers?q=\${query}\`);
  return res.json(); // 缺少团队过滤
}

// search-api.ts - 修复后
export async function searchCustomers(query: string) {
  const res = await fetch(\`/api/customers?q=\${query}&team_id=\${getCurrentTeam()}\`);
  const data = await res.json();
  // 在前端二次确保不泄露团队外数据
  return data.filter(c => c.team_id === getCurrentTeam());
}`,
      },
    },
    {
      id: "verify-finding-2",
      type: "finding",
      title: "修复方案 B：E2E 权限边界",
      detail: "补充团队边界过滤、增加 API 断言、追加主管视图 E2E 用例。",
    },
  ];
}

// ── 发布交付 ────────────────────────────────
export function getReleaseContent(): StageContentBlock[] {
  return [
    {
      id: "release-summary",
      type: "summary",
      title: "交付包准备就绪",
      detail:
        "本次交付包含源码 diff、可执行 Spec、测试报告、发布记录、风险摘要和回滚方案。所有资产已沉淀到 ChangeSet Memory。",
    },
    {
      id: "release-visual",
      type: "visual",
      title: "交付清单",
      detail: "应用预览 ✓ | 测试报告 ✓ | 变更摘要 ✓ | 回滚方案 ✓",
    },
    {
      id: "release-finding-1",
      type: "finding",
      title: "Sandbox 预览地址",
      detail: "https://sandbox.zero-one.dev/preview/cs-2026-0518 - 点击预览完整应用。",
      clickable: true,
      target: {
        type: "html",
        title: "应用预览",
        html: "",
      },
    },
    {
      id: "release-finding-2",
      type: "finding",
      title: "变更摘要",
      detail: "新增 4 个页面、6 个组件、12 个 API 端点、18 个测试用例。",
      clickable: true,
      target: {
        type: "document",
        title: "变更摘要",
        content: `# 变更摘要 CS-2026-0518

## 新增文件 (18)
- src/pages/lead-list.tsx
- src/pages/customer-detail.tsx  
- src/components/reminder-center.tsx
- src/components/weekly-report.tsx
- src/hooks/use-follow-up.ts
- src/domain/customer.ts
- src/domain/follow-up.ts
- src/domain/reminder.ts
- src/mocks/leads.json
- src/mocks/customers.json
- tests/unit/reminder.test.ts
- tests/unit/weekly-report.test.ts
- tests/e2e/lead-flow.spec.ts
- src/api/openapi.yaml

## 修改文件 (2)
- src/app.tsx (新增路由)
- package.json (新增依赖)

## 风险项 (3)
1. 权限过滤逻辑需在实际权限服务接入后验证
2. Mock 数据需在对接真实 CRM 后替换
3. 周报聚合在大数据量下需添加缓存`,
      },
    },
    {
      id: "release-finding-3",
      type: "finding",
      title: "回滚方案已就绪",
      detail: "可通过 ChangeSet 回滚至 Spec 基线版本，所有变更可追溯。",
    },
  ];
}

// ── 根据 SOP 阶段获取内容 ──────────────────
export function getContentForStage(stepIndex: number): StageContentBlock[] {
  const id = (["intent", "scope", "spec", "build", "quality", "verify", "release"] as const)[stepIndex];
  switch (id) {
    case "intent": return getIntentContent();
    case "scope": return getScopeContent();
    case "spec": return getSpecContent();
    case "build": return getBuildContent();
    case "quality": return getQualityContent();
    case "verify": return getVerifyContent();
    case "release": return getReleaseContent();
    default: return [];
  }
}
