import { ChevronRight, Sparkles } from "lucide-react";
import type { AppState, DrawerContent } from "../data/types";

/**
 * 各 SOP 阶段的决策操作区 UI。
 * 从 DecisionBoard 中拆分以控制文件长度。
 */

export function IntentDecision({
  state,
  onPatch,
  onContinue,
}: {
  state: AppState;
  onPatch: (patch: Partial<AppState>) => void;
  onContinue: () => void;
}) {
  return (
    <>
      <div className="decision-grid">
        {[
          ["mvp", "MVP 快速交付", "先跑通主流程,最适合融资演示"],
          ["governed", "企业受控交付", "加入权限、审计和质量门禁"],
          ["full", "完整产品化交付", "覆盖多角色、报表和发布策略"],
        ].map(([value, title, detail]) => (
          <button
            className={`choice-card ${state.scope === value ? "selected" : ""}`}
            type="button"
            key={value}
            onClick={() =>
              onPatch({ scope: value as "mvp" | "governed" | "full" })
            }
          >
            <strong>{title}</strong>
            <span>{detail}</span>
          </button>
        ))}
      </div>
      <button className="primary-action" type="button" onClick={onContinue}>
        确认方向,进入范围定义
        <ChevronRight size={16} />
      </button>
    </>
  );
}

export function ScopeDecision({
  state,
  onPatch,
  onContinue,
}: {
  state: AppState;
  onPatch: (patch: Partial<AppState>) => void;
  onContinue: () => void;
}) {
  const modules = [
    { id: "线索池", deps: [] },
    { id: "客户详情", deps: ["线索池"] },
    { id: "跟进提醒", deps: ["客户详情"] },
    { id: "沟通记录", deps: ["客户详情"] },
    { id: "团队周报", deps: ["跟进提醒", "沟通记录"] },
    { id: "主管看板", deps: ["团队周报"] },
  ];

  return (
    <>
      <div className="decision-grid scope-grid">
        {modules.map((mod) => {
          const selected = state.selectedModules.includes(mod.id);
          return (
            <button
              key={mod.id}
              className={`choice-card multi ${selected ? "selected" : ""}`}
              type="button"
              onClick={() =>
                onPatch({
                  selectedModules: selected
                    ? state.selectedModules.filter((m) => m !== mod.id)
                    : [...state.selectedModules, mod.id],
                })
              }
            >
              <strong>
                <span className="module-check-icon">{selected ? "✓" : ""}</span>
                {mod.id}
              </strong>
              {mod.deps.length > 0 && (
                <span>依赖: {mod.deps.join("、")}</span>
              )}
              {mod.deps.length === 0 && <span>基础模块</span>}
            </button>
          );
        })}
      </div>
      <button className="primary-action" type="button" onClick={onContinue}>
        锁定范围,生成 Spec
        <ChevronRight size={16} />
      </button>
    </>
  );
}

export function SpecDecision({
  state,
  onPatch,
  onContinue,
  onPreview,
}: {
  state: AppState;
  onPatch: (patch: Partial<AppState>) => void;
  onContinue: () => void;
  onPreview: (content: DrawerContent) => void;
}) {
  return (
    <>
      <div className="decision-spec-actions">
        <button
          className="ghost-button"
          type="button"
          onClick={() =>
            onPreview({
              type: "document",
              title: "可执行 Spec 完整文档",
              content: `# 可执行 Spec 基线\n\n本 Spec 是后续代码、测试、发布和回滚的唯一事实来源。\n\n## 业务对象\n- Customer（客户）\n- FollowUp（跟进记录）\n- Reminder（提醒）\n- WeeklyReport（周报）\n\n## 验收标准（8条）\n1. 销售可创建客户并查看客户详情\n2. 每次沟通后记录跟进信息\n3. 超过3天未跟进自动生成提醒\n4. 主管可查看团队所有客户\n5. 每周一自动生成团队周报\n6. 销售仅查看本人客户\n7. 提醒支持自定义规则\n8. 所有操作有权限校验`,
            } as DrawerContent)
          }
        >
          查看完整 Spec →
        </button>
      </div>
      <button
        className="primary-action"
        type="button"
        onClick={() => {
          onPatch({ specConfirmed: true });
          onContinue();
        }}
      >
        确认 Spec 基线,启动 Agent Team
        <ChevronRight size={16} />
      </button>
    </>
  );
}

export function BuildDecision({
  onContinue,
}: {
  onContinue: () => void;
}) {
  return (
    <button className="primary-action" type="button" onClick={onContinue}>
      查看质量门禁
      <ChevronRight size={16} />
    </button>
  );
}

export function QualityDecision({
  state,
  onPatch,
  onContinue,
  onPreview,
}: {
  state: AppState;
  onPatch: (patch: Partial<AppState>) => void;
  onContinue: () => void;
  onPreview: (content: DrawerContent) => void;
}) {
  return (
    <div className="decision-quality-actions">
      <button
        className="primary-action"
        type="button"
        onClick={() => {
          onPatch({ qualityPassed: true });
          onContinue();
        }}
      >
        质量通过,进入验证
        <ChevronRight size={16} />
      </button>
      <button
        className="ghost-button"
        type="button"
        onClick={() =>
          onPreview({
            type: "document",
            title: "质量门禁完整报告",
            content: `# 质量门禁审查报告\n\n## 通过项\n- ✅ 代码检视：全部通过\n- ✅ 单元测试：12/12 通过，覆盖率 87%\n\n## 未通过项\n- ⚠️ API 测试：8/10 通过\n  - 提醒调度接口响应格式不符契约\n  - 报表聚合接口字段命名不一致\n- ❌ UI E2E：发现权限边界问题\n  - 主管搜索结果含团队外客户\n\n## 建议\n授权进入验证修复阶段，AI 将自动修复上述问题。`,
          } as DrawerContent)
        }
      >
        查看完整报告
      </button>
    </div>
  );
}

export function VerifyDecision({
  state,
  onPatch,
  onContinue,
  onPreview,
}: {
  state: AppState;
  onPatch: (patch: Partial<AppState>) => void;
  onContinue: () => void;
  onPreview: (content: DrawerContent) => void;
}) {
  if (!state.fixApproved) {
    return (
      <div className="decision-verify-actions">
        <button
          className="primary-action"
          type="button"
          onClick={() => onPatch({ fixApproved: true })}
        >
          授权 Agent 自动修复
          <Sparkles size={16} />
        </button>
        <button
          className="ghost-button"
          type="button"
          onClick={() =>
            onPreview({
              type: "code",
              title: "修复差异对比",
              language: "diff",
              content: `--- a/src/api/search-api.ts
+++ b/src/api/search-api.ts
@@ -2,6 +2,8 @@
 export async function searchCustomers(query: string) {
-  const res = await fetch(\`/api/customers?q=\${query}\`);
-  return res.json();
+  const res = await fetch(\`/api/customers?q=\${query}&team_id=\${getCurrentTeam()}\`);
+  const data = await res.json();
+  // 前端二次确保权限边界
+  return data.filter(c => c.team_id === getCurrentTeam());`,
            } as DrawerContent)
          }
        >
          查看修复方案
        </button>
      </div>
    );
  }
  return (
    <button className="primary-action" type="button" onClick={onContinue}>
      复测通过,进入发布准备
      <ChevronRight size={16} />
    </button>
  );
}

export function ReleaseDecision({
  state,
  onPatch,
}: {
  state: AppState;
  onPatch: (patch: Partial<AppState>) => void;
}) {
  return (
    <button
      className="primary-action"
      type="button"
      onClick={() => onPatch({ releaseApproved: true })}
    >
      {state.releaseApproved ? "已发布到 Sandbox" : "确认发布到 Sandbox"}
      <ChevronRight size={16} />
    </button>
  );
}
