
export type DeliverableCard = {
  id: string;
  title: string;
  detail: string;
  tag?: string;
  expandedContent?: { type: string; title: string; content: string };
};

export type TrajectoryTurn = {
  id: string;
  agent: string;
  action: string;
  output?: string;
  duration?: string;
};

export type StageContent = {
  summary: string;
  deliverables: DeliverableCard[];
  trajectory: TrajectoryTurn[];
};

export function getIntentContent(): StageContent {
  return {
    summary:
      "我已从你的描述中抽取出核心业务对象（客户、跟进记录、提醒规则、周报），并梳理了关键角色（销售、主管）和核心场景（线索跟踪、到期提醒、团队汇总）。建议先以 MVP 模式跑通主流程。",
    deliverables: [
      {
        id: "intent-d1",
        title: "核心对象识别",
        detail: "客户、跟进记录、周报 — 建议先以客户为根实体展开",
        tag: "分析",
      },
      {
        id: "intent-d2",
        title: "角色梳理",
        detail: "销售（日常操作）、主管（团队汇总）",
        tag: "分析",
      },
      {
        id: "intent-d3",
        title: "建议交付模式：MVP",
        detail: "先跑通销售→客户→提醒的主流程，最适合快速验证",
        tag: "建议",
      },
    ],
    trajectory: [
      {
        id: "t1",
        agent: "Product Agent",
        action: "解析输入，抽取业务对象和角色",
        output: "识别到 4 个核心对象、2 个关键角色",
        duration: "3s",
      },
      {
        id: "t2",
        agent: "Product Agent",
        action: "分析场景依赖关系",
        output: "线索跟踪→到期提醒→团队汇总，形成主流程闭环",
        duration: "2s",
      },
      {
        id: "t3",
        agent: "Product Agent",
        action: "生成交付模式建议",
        output: "MVP 模式：聚焦销售日常最核心场景",
        duration: "1s",
      },
    ],
  };
}

export function getScopeContent(): StageContent {
  return {
    summary:
      "基于意图分析，我建议本轮聚焦销售日常最核心的 4 个模块。未选模块将进入后续迭代建议池。「主管看板」依赖前面所有模块的数据，建议放入下一迭代。",
    deliverables: [
      {
        id: "scope-d1",
        title: "模块依赖分析",
        detail: "线索池→客户详情→跟进提醒→沟通记录→团队周报→主管看板",
        tag: "分析",
      },
      {
        id: "scope-d2",
        title: "风险提示",
        detail: "「主管看板」依赖前面所有模块的数据，建议放入下一迭代",
        tag: "风险",
      },
    ],
    trajectory: [
      {
        id: "t1",
        agent: "Architect Agent",
        action: "根据意图分析结果，拆解功能模块",
        output: "6 个功能模块，4 个为核心必选",
        duration: "4s",
      },
      {
        id: "t2",
        agent: "Architect Agent",
        action: "分析模块间依赖关系",
        output: "依赖链：线索池→客户详情→跟进提醒→沟通记录",
        duration: "2s",
      },
      {
        id: "t3",
        agent: "Architect Agent",
        action: "标记风险模块",
        output: "主管看板跨模块依赖，建议延后",
        duration: "1s",
      },
    ],
  };
}

export function getSpecContent(): StageContent {
  return {
    summary:
      "我已生成 4 类机器可读资产：业务对象模型、页面地图、API 契约、权限模型。这些是后续代码和测试的唯一事实来源。",
    deliverables: [
      {
        id: "spec-d1",
        title: "API 契约 12 个端点",
        detail: "覆盖 CRUD、提醒调度、报表聚合",
        tag: "契约",
        expandedContent: {
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
    post:
      summary: 创建客户
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
      summary: 获取团队周报`,
        },
      },
      {
        id: "spec-d2",
        title: "权限模型确认",
        detail: "销售仅看本人客户、主管查看团队汇总",
        tag: "权限",
        expandedContent: {
          type: "document",
          title: "权限矩阵",
          content: `# 权限模型\n\n## 角色定义\n\n| 角色 | 权限范围 |\n|------|---------|\n| 销售 | 仅查看、编辑本人负责的客户 |\n| 主管 | 查看团队内所有客户和汇总报表 |\n| 管理员 | 全部数据 + 系统配置 |\n\n## 数据访问规则\n\n- 销售查询客户列表：自动过滤 owner_id = current_user\n- 主管查询客户列表：自动过滤 team_id = current_team\n- 周报聚合：按 team 维度\n- 提醒规则：每个销售仅管理自己客户的提醒`,
        },
      },
      {
        id: "spec-d3",
        title: "数据模型 ER",
        detail: "Customer(1)→(N)FollowUp(1)→(N)Reminder; Customer(1)→(N)Report",
        tag: "模型",
      },
    ],
    trajectory: [
      {
        id: "t1",
        agent: "Architect Agent",
        action: "根据技术方案设计结果，生成数据模型",
        output: "4 个核心实体：Customer、FollowUp、Reminder、Report",
        duration: "5s",
      },
      {
        id: "t2",
        agent: "Architect Agent",
        action: "生成 API 契约（OpenAPI 格式）",
        output: "12 个端点定义，覆盖 CRUD + 调度 + 聚合",
        duration: "4s",
      },
      {
        id: "t3",
        agent: "Architect Agent",
        action: "定义权限模型和访问规则",
        output: "3 个角色、4 条数据访问规则",
        duration: "2s",
      },
    ],
  };
}

export function getBuildContent(): StageContent {
  return {
    summary:
      "Frontend Agent 生成页面组件、Architect Agent 维护 API 契约、Test Agent 同步编写测试。所有产出基于同一个 ChangeSet 上下文，5 个任务并行执行中。",
    deliverables: [
      {
        id: "build-d1",
        title: "页面结构",
        detail: "Frontend Agent 已完成 lead-list.tsx、customer-detail.tsx",
        tag: "代码",
      },
      {
        id: "build-d2",
        title: "OpenAPI 契约",
        detail: "Architect Agent 输出了 12 个端点定义",
        tag: "契约",
      },
      {
        id: "build-d3",
        title: "Mock 数据",
        detail: "Frontend Agent 已生成 leads.json、customers.json",
        tag: "数据",
      },
      {
        id: "build-d4",
        title: "单元测试",
        detail: "Test Agent 覆盖提醒逻辑和报表聚合",
        tag: "测试",
        expandedContent: {
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
        id: "build-d5",
        title: "变更日志",
        detail: "DevOps Agent 已记录本次变更摘要",
        tag: "文档",
      },
    ],
    trajectory: [
      {
        id: "t1",
        agent: "Frontend Agent",
        action: "读取 Spec，生成页面组件骨架",
        output: "lead-list.tsx、customer-detail.tsx 已创建",
        duration: "12s",
      },
      {
        id: "t2",
        agent: "Architect Agent",
        action: "维护 API 契约，同步端点定义",
        output: "12 个端点 OpenAPI 定义已输出",
        duration: "8s",
      },
      {
        id: "t3",
        agent: "Frontend Agent",
        action: "生成 Mock 数据文件",
        output: "leads.json、customers.json 已写入",
        duration: "5s",
      },
      {
        id: "t4",
        agent: "Test Agent",
        action: "根据验收标准编写单元测试",
        output: "提醒逻辑、报表聚合测试用例已生成",
        duration: "10s",
      },
    ],
  };
}

export function getQualityContent(): StageContent {
  return {
    summary:
      "Agent Team 完成开发后，自动触发质量门禁。4 项检查中 2 项通过、2 项未通过，需要你的审查决策。API 测试和 E2E 存在未通过项。",
    deliverables: [
      {
        id: "quality-d1",
        title: "✓ 代码检视通过",
        detail: "代码风格、类型安全、最佳实践检查全部通过",
        tag: "通过",
      },
      {
        id: "quality-d2",
        title: "✓ 单元测试通过 (12/12)",
        detail: "所有单元测试通过，覆盖率 87%",
        tag: "通过",
      },
      {
        id: "quality-d3",
        title: "⚠️ API 测试 8/10 通过",
        detail: "提醒调度接口和报表聚合接口返回格式与契约不一致",
        tag: "未通过",
        expandedContent: {
          type: "code",
          title: "API 测试失败详情",
          content: `API 测试结果\n═══════════════════════════════════\n\n✅ GET /customers             200 OK\n✅ POST /customers            201 Created\n✅ GET /customers/{id}        200 OK\n✅ PATCH /customers/{id}      200 OK\n✅ GET /customers/{id}/follow-ups  200 OK\n✅ POST /customers/{id}/follow-ups 201 Created\n✅ GET /reminders             200 OK\n✅ POST /reminders            201 Created\n❌ GET /reports/weekly        200 OK (响应格式不符合契约)\n  期望: { teamId, period, members[], stats{} }\n  实际: { team, week, data[] }\n❌ GET /customers?status=all   200 OK (返回字段缺失 owner 信息)\n  期望: 包含 owner.name, owner.id\n  实际: 仅返回客户基础信息`,
        },
      },
      {
        id: "quality-d4",
        title: "❌ UI E2E 测试失败",
        detail: "主管视图下团队外客户出现在搜索结果中，存在权限边界问题",
        tag: "未通过",
        expandedContent: {
          type: "html",
          title: "E2E 失败场景预览",
          content: `<div style="padding:24px;font-family:sans-serif;">
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
    ],
    trajectory: [
      {
        id: "t1",
        agent: "Test Agent",
        action: "执行代码检视扫描",
        output: "代码风格、类型安全、最佳实践全部通过",
        duration: "6s",
      },
      {
        id: "t2",
        agent: "Test Agent",
        action: "运行单元测试套件",
        output: "12/12 通过，覆盖率 87%",
        duration: "8s",
      },
      {
        id: "t3",
        agent: "Test Agent",
        action: "执行 API 契约测试",
        output: "8/10 通过，2 个接口响应格式不符",
        duration: "12s",
      },
      {
        id: "t4",
        agent: "Test Agent",
        action: "运行 UI E2E 测试",
        output: "发现权限边界问题：主管搜索结果含团队外客户",
        duration: "18s",
      },
    ],
  };
}

export function getVerifyContent(): StageContent {
  return {
    summary:
      "AI 分析了 2 个失败项并生成了修复方案。建议授权 Frontend Agent 和 Test Agent 自动修复并复测，预计耗时 2-3 分钟。",
    deliverables: [
      {
        id: "verify-d1",
        title: "修复方案 A：API 响应格式",
        detail: "调整 /reports/weekly 和 /customers 返回格式，对齐 OpenAPI 契约",
        tag: "修复",
        expandedContent: {
          type: "code",
          title: "差异对比",
          content: `// search-api.ts - 修复前\nexport async function searchCustomers(query: string) {\n  const res = await fetch(\`/api/customers?q=\${query}\`);\n  return res.json(); // 缺少团队过滤\n}\n\n// search-api.ts - 修复后\nexport async function searchCustomers(query: string) {\n  const res = await fetch(\`/api/customers?q=\${query}&team_id=\${getCurrentTeam()}\`);\n  const data = await res.json();\n  return data.filter(c => c.team_id === getCurrentTeam());\n}`,
        },
      },
      {
        id: "verify-d2",
        title: "修复方案 B：E2E 权限边界",
        detail: "补充团队边界过滤、增加 API 断言、追加主管视图 E2E 用例",
        tag: "修复",
      },
    ],
    trajectory: [
      {
        id: "t1",
        agent: "Test Agent",
        action: "分析失败项根因",
        output: "API 响应格式不符契约 + 权限过滤缺失",
        duration: "4s",
      },
      {
        id: "t2",
        agent: "Architect Agent",
        action: "生成修复方案和影响范围分析",
        output: "2 个修复方案，涉及 4 个文件",
        duration: "6s",
      },
      {
        id: "t3",
        agent: "Architect Agent",
        action: "等待用户授权执行修复",
        output: "待确认",
        duration: "—",
      },
    ],
  };
}

export function getReleaseContent(): StageContent {
  return {
    summary:
      "本次交付包含源码 diff、可执行 Spec、测试报告、发布记录、风险摘要和回滚方案。所有资产已沉淀到 ChangeSet Memory，可发布到 Sandbox 预览。",
    deliverables: [
      {
        id: "release-d1",
        title: "Sandbox 预览地址",
        detail: "https://sandbox.zero-one.dev/preview/cs-2026-0518",
        tag: "预览",
        expandedContent: {
          type: "html",
          title: "应用预览",
          content: "",
        },
      },
      {
        id: "release-d2",
        title: "变更摘要",
        detail: "新增 4 个页面、6 个组件、12 个 API 端点、18 个测试用例",
        tag: "文档",
        expandedContent: {
          type: "document",
          title: "变更摘要",
          content: `# 变更摘要 CS-2026-0518\n\n## 新增文件 (18)\n- src/pages/lead-list.tsx\n- src/pages/customer-detail.tsx\n- src/components/reminder-center.tsx\n- src/components/weekly-report.tsx\n- src/hooks/use-follow-up.ts\n- src/domain/customer.ts\n- src/domain/follow-up.ts\n- src/domain/reminder.ts\n- src/mocks/leads.json\n- src/mocks/customers.json\n- tests/unit/reminder.test.ts\n- tests/unit/weekly-report.test.ts\n- tests/e2e/lead-flow.spec.ts\n- src/api/openapi.yaml\n\n## 修改文件 (2)\n- src/app.tsx (新增路由)\n- package.json (新增依赖)\n\n## 风险项 (3)\n1. 权限过滤逻辑需在实际权限服务接入后验证\n2. Mock 数据需在对接真实 CRM 后替换\n3. 周报聚合在大数据量下需添加缓存`,
        },
      },
      {
        id: "release-d3",
        title: "回滚方案已就绪",
        detail: "可通过 ChangeSet 回滚至 Spec 基线版本，所有变更可追溯",
        tag: "安全",
      },
    ],
    trajectory: [
      {
        id: "t1",
        agent: "DevOps Agent",
        action: "收集所有产出物，打包交付清单",
        output: "源码 diff + Spec + 测试报告 + 回滚方案",
        duration: "5s",
      },
      {
        id: "t2",
        agent: "DevOps Agent",
        action: "生成 Sandbox 预览环境",
        output: "https://sandbox.zero-one.dev/preview/cs-2026-0518",
        duration: "15s",
      },
      {
        id: "t3",
        agent: "DevOps Agent",
        action: "等待用户确认发布策略",
        output: "待确认",
        duration: "—",
      },
    ],
  };
}

export function getContentForStage(stepIndex: number): StageContent {
  const id = (["intent", "scope", "spec", "build", "quality", "verify", "release"] as const)[stepIndex];
  switch (id) {
    case "intent": return getIntentContent();
    case "scope": return getScopeContent();
    case "spec": return getSpecContent();
    case "build": return getBuildContent();
    case "quality": return getQualityContent();
    case "verify": return getVerifyContent();
    case "release": return getReleaseContent();
    default: return getIntentContent();
  }
}
