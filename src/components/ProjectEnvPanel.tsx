import { useState } from "react";
import {
  Wrench,
  Bot,
  Variable,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Check,
  X,
  Pencil,
} from "lucide-react";

// ── 子 Tab 类型 ─────────────────────────────

type EnvSubTab = "skills" | "subagent" | "envvars";

const envSubTabs: Array<{ value: EnvSubTab; label: string; icon: typeof Wrench }> = [
  { value: "skills", label: "Skills", icon: Wrench },
  { value: "subagent", label: "SubAgent", icon: Bot },
  { value: "envvars", label: "环境变量", icon: Variable },
];

// ── 数据类型 ────────────────────────────────

type Skill = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
};

type SubAgent = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
};

type EnvVar = {
  id: string;
  key: string;
  value: string;
  masked: boolean;
  description: string;
};

let nextId = 100;

function genId(): string {
  return String(nextId++);
}

// ── 模拟数据 ────────────────────────────────

const initialSkills: Skill[] = [
  { id: genId(), name: "Web E2E", description: "端到端 Web 自动化测试", enabled: true },
  { id: genId(), name: "API Contract", description: "API 契约测试与验证", enabled: true },
  { id: genId(), name: "Code Review", description: "代码变更检视与质量门禁", enabled: true },
  { id: genId(), name: "Release Check", description: "发布前检查清单自动化", enabled: false },
];

const initialSubAgents: SubAgent[] = [
  { id: genId(), name: "代码审查员", description: "自动审查代码变更，检查正确性、安全性和可维护性", enabled: true },
  { id: genId(), name: "测试工程师", description: "根据需求自动生成测试用例并执行", enabled: true },
  { id: genId(), name: "架构师", description: "扫描架构依赖，识别模块边界和循环依赖", enabled: false },
];

const initialEnvVars: EnvVar[] = [
  { id: genId(), key: "NODE_ENV", value: "production", masked: false, description: "运行环境" },
  { id: genId(), key: "API_BASE_URL", value: "https://api.example.com", masked: false, description: "API 基础地址" },
  { id: genId(), key: "DB_CONNECTION_STRING", value: "postgresql://user:pass@host:5432/db", masked: true, description: "数据库连接串" },
  { id: genId(), key: "REDIS_URL", value: "redis://localhost:6379", masked: true, description: "Redis 连接地址" },
];

// ── 通用编辑状态 ────────────────────────────

type EditState<T> = {
  id: string | null;
  draft: T;
};

function createBlankSkill(): Skill {
  return { id: "", name: "", description: "", enabled: true };
}

function createBlankSubAgent(): SubAgent {
  return { id: "", name: "", description: "", enabled: true };
}

function createBlankEnvVar(): EnvVar {
  return { id: "", key: "", value: "", masked: false, description: "" };
}

// ── 组件 ────────────────────────────────────

export function ProjectEnvPanel() {
  const [activeTab, setActiveTab] = useState<EnvSubTab>("skills");

  // Skills state
  const [skills, setSkills] = useState<Skill[]>(initialSkills);
  const [skillEdit, setSkillEdit] = useState<EditState<Skill> | null>(null);

  // SubAgent state
  const [subAgents, setSubAgents] = useState<SubAgent[]>(initialSubAgents);
  const [agentEdit, setAgentEdit] = useState<EditState<SubAgent> | null>(null);

  // EnvVar state
  const [envVars, setEnvVars] = useState<EnvVar[]>(initialEnvVars);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [envEdit, setEnvEdit] = useState<EditState<EnvVar> | null>(null);

  // ── Skills handlers ────────────────────────

  const startSkillEdit = (s: Skill) => {
    setSkillEdit({ id: s.id, draft: { ...s } });
  };

  const startSkillAdd = () => {
    setSkillEdit({ id: null, draft: createBlankSkill() });
  };

  const saveSkill = () => {
    if (!skillEdit || !skillEdit.draft.name.trim()) return;
    if (skillEdit.id) {
      setSkills((prev) => prev.map((s) => (s.id === skillEdit.id ? { ...skillEdit.draft, id: s.id } : s)));
    } else {
      setSkills((prev) => [...prev, { ...skillEdit.draft, id: genId() }]);
    }
    setSkillEdit(null);
  };

  const cancelSkillEdit = () => setSkillEdit(null);

  const deleteSkill = (id: string) => {
    setSkills((prev) => prev.filter((s) => s.id !== id));
  };

  const toggleSkill = (id: string) => {
    setSkills((prev) => prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)));
  };

  // ── SubAgent handlers ──────────────────────

  const startAgentEdit = (a: SubAgent) => {
    setAgentEdit({ id: a.id, draft: { ...a } });
  };

  const startAgentAdd = () => {
    setAgentEdit({ id: null, draft: createBlankSubAgent() });
  };

  const saveAgent = () => {
    if (!agentEdit || !agentEdit.draft.name.trim()) return;
    if (agentEdit.id) {
      setSubAgents((prev) => prev.map((a) => (a.id === agentEdit.id ? { ...agentEdit.draft, id: a.id } : a)));
    } else {
      setSubAgents((prev) => [...prev, { ...agentEdit.draft, id: genId() }]);
    }
    setAgentEdit(null);
  };

  const cancelAgentEdit = () => setAgentEdit(null);

  const deleteAgent = (id: string) => {
    setSubAgents((prev) => prev.filter((a) => a.id !== id));
  };

  const toggleAgent = (id: string) => {
    setSubAgents((prev) => prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)));
  };

  // ── EnvVar handlers ────────────────────────

  const toggleVisible = (id: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startEnvEdit = (v: EnvVar) => {
    setEnvEdit({ id: v.id, draft: { ...v } });
  };

  const startEnvAdd = () => {
    setEnvEdit({ id: null, draft: createBlankEnvVar() });
  };

  const saveEnv = () => {
    if (!envEdit || !envEdit.draft.key.trim()) return;
    if (envEdit.id) {
      setEnvVars((prev) => prev.map((v) => (v.id === envEdit.id ? { ...envEdit.draft, id: v.id } : v)));
    } else {
      setEnvVars((prev) => [...prev, { ...envEdit.draft, id: genId() }]);
    }
    setEnvEdit(null);
  };

  const cancelEnvEdit = () => setEnvEdit(null);

  const deleteEnv = (id: string) => {
    setEnvVars((prev) => prev.filter((v) => v.id !== id));
  };

  // ── 渲染：编辑行 ───────────────────────────

  const renderEditRow = (
    edit: EditState<Skill | SubAgent> | null,
    onField: (field: string, value: string) => void,
    onSave: () => void,
    onCancel: () => void,
  ) => {
    if (!edit) return null;
    return (
      <div className="project-env-edit-row">
        <input
          className="project-env-input"
          placeholder="名称"
          value={edit.draft.name}
          onChange={(e) => onField("name", e.target.value)}
          autoFocus
        />
        <input
          className="project-env-input"
          placeholder="描述"
          value={edit.draft.description}
          onChange={(e) => onField("description", e.target.value)}
        />
        <button className="project-env-confirm-btn" type="button" onClick={onSave} title="保存">
          <Check size={14} />
        </button>
        <button className="project-env-cancel-btn" type="button" onClick={onCancel} title="取消">
          <X size={14} />
        </button>
      </div>
    );
  };

  return (
    <div className="project-env-panel">
      {/* 标题 */}
      <div className="project-env-header">
        <div className="project-env-title">
          <span className="eyebrow">配置</span>
          <h2>项目环境管理</h2>
        </div>
      </div>

      {/* 子 Tab 导航 */}
      <div className="project-env-tabs" role="tablist">
        {envSubTabs.map(({ value, label, icon: Icon }) => (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === value}
            key={value}
            className={activeTab === value ? "active" : ""}
            onClick={() => setActiveTab(value)}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* ═══════════ Skills 面板 ═══════════ */}
      {activeTab === "skills" && (
        <div className="project-env-section" role="tabpanel">
          <div className="project-env-section-header">
            <p className="project-env-section-desc">管理项目可用的 Skills 工具集，启用后将在交付工作台中自动挂载。</p>
            <button className="project-env-add-btn" type="button" onClick={startSkillAdd}>
              <Plus size={14} />
              新增 Skill
            </button>
          </div>

          {skillEdit && skillEdit.id === null && (
            <div className="project-env-edit-row">
              <input
                className="project-env-input"
                placeholder="名称"
                value={skillEdit.draft.name}
                onChange={(e) => setSkillEdit({ ...skillEdit, draft: { ...skillEdit.draft, name: e.target.value } })}
                autoFocus
              />
              <input
                className="project-env-input"
                placeholder="描述"
                value={skillEdit.draft.description}
                onChange={(e) => setSkillEdit({ ...skillEdit, draft: { ...skillEdit.draft, description: e.target.value } })}
              />
              <button className="project-env-confirm-btn" type="button" onClick={saveSkill} title="保存">
                <Check size={14} />
              </button>
              <button className="project-env-cancel-btn" type="button" onClick={cancelSkillEdit} title="取消">
                <X size={14} />
              </button>
            </div>
          )}

          <div className="project-env-list">
            {skills.map((skill) => {
              const editing = skillEdit?.id === skill.id;
              return (
                <div key={skill.id} className={`project-env-item ${editing ? "editing" : ""}`}>
                  {editing ? (
                    <div className="project-env-edit-row inline">
                      <input
                        className="project-env-input"
                        placeholder="名称"
                        value={skillEdit!.draft.name}
                        onChange={(e) => setSkillEdit({ ...skillEdit!, draft: { ...skillEdit!.draft, name: e.target.value } })}
                        autoFocus
                      />
                      <input
                        className="project-env-input"
                        placeholder="描述"
                        value={skillEdit!.draft.description}
                        onChange={(e) => setSkillEdit({ ...skillEdit!, draft: { ...skillEdit!.draft, description: e.target.value } })}
                      />
                      <button className="project-env-confirm-btn" type="button" onClick={saveSkill} title="保存">
                        <Check size={14} />
                      </button>
                      <button className="project-env-cancel-btn" type="button" onClick={cancelSkillEdit} title="取消">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="project-env-item-info">
                        <strong>{skill.name}</strong>
                        <span>{skill.description}</span>
                      </div>
                      <div className="project-env-item-actions">
                        <button className="project-env-icon-btn" type="button" onClick={() => startSkillEdit(skill)} title="编辑">
                          <Pencil size={13} />
                        </button>
                        <button className="project-env-icon-btn danger" type="button" onClick={() => deleteSkill(skill.id)} title="删除">
                          <Trash2 size={13} />
                        </button>
                        <div className="project-env-item-toggle">
                          <input type="checkbox" checked={skill.enabled} onChange={() => toggleSkill(skill.id)} />
                          <span className="toggle-track">
                            <span className="toggle-thumb" />
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════ SubAgent 面板 ═══════════ */}
      {activeTab === "subagent" && (
        <div className="project-env-section" role="tabpanel">
          <div className="project-env-section-header">
            <p className="project-env-section-desc">配置专用 SubAgent，在交付流程中自动委派特定任务给对应的 Agent。</p>
            <button className="project-env-add-btn" type="button" onClick={startAgentAdd}>
              <Plus size={14} />
              新增 SubAgent
            </button>
          </div>

          {agentEdit && agentEdit.id === null && (
            <div className="project-env-edit-row">
              <input
                className="project-env-input"
                placeholder="名称"
                value={agentEdit.draft.name}
                onChange={(e) => setAgentEdit({ ...agentEdit, draft: { ...agentEdit.draft, name: e.target.value } })}
                autoFocus
              />
              <input
                className="project-env-input"
                placeholder="描述"
                value={agentEdit.draft.description}
                onChange={(e) => setAgentEdit({ ...agentEdit, draft: { ...agentEdit.draft, description: e.target.value } })}
              />
              <button className="project-env-confirm-btn" type="button" onClick={saveAgent} title="保存">
                <Check size={14} />
              </button>
              <button className="project-env-cancel-btn" type="button" onClick={cancelAgentEdit} title="取消">
                <X size={14} />
              </button>
            </div>
          )}

          <div className="project-env-list">
            {subAgents.map((agent) => {
              const editing = agentEdit?.id === agent.id;
              return (
                <div key={agent.id} className={`project-env-item ${editing ? "editing" : ""}`}>
                  {editing ? (
                    <div className="project-env-edit-row inline">
                      <input
                        className="project-env-input"
                        placeholder="名称"
                        value={agentEdit!.draft.name}
                        onChange={(e) => setAgentEdit({ ...agentEdit!, draft: { ...agentEdit!.draft, name: e.target.value } })}
                        autoFocus
                      />
                      <input
                        className="project-env-input"
                        placeholder="描述"
                        value={agentEdit!.draft.description}
                        onChange={(e) => setAgentEdit({ ...agentEdit!, draft: { ...agentEdit!.draft, description: e.target.value } })}
                      />
                      <button className="project-env-confirm-btn" type="button" onClick={saveAgent} title="保存">
                        <Check size={14} />
                      </button>
                      <button className="project-env-cancel-btn" type="button" onClick={cancelAgentEdit} title="取消">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="project-env-item-info">
                        <strong>{agent.name}</strong>
                        <span>{agent.description}</span>
                      </div>
                      <div className="project-env-item-actions">
                        <button className="project-env-icon-btn" type="button" onClick={() => startAgentEdit(agent)} title="编辑">
                          <Pencil size={13} />
                        </button>
                        <button className="project-env-icon-btn danger" type="button" onClick={() => deleteAgent(agent.id)} title="删除">
                          <Trash2 size={13} />
                        </button>
                        <div className="project-env-item-toggle">
                          <input type="checkbox" checked={agent.enabled} onChange={() => toggleAgent(agent.id)} />
                          <span className="toggle-track">
                            <span className="toggle-thumb" />
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════ 环境变量面板 ═══════════ */}
      {activeTab === "envvars" && (
        <div className="project-env-section" role="tabpanel">
          <div className="project-env-section-header">
            <p className="project-env-section-desc">管理项目运行时的环境变量，敏感字段会自动脱敏显示。</p>
            <button className="project-env-add-btn" type="button" onClick={startEnvAdd}>
              <Plus size={14} />
              新增环境变量
            </button>
          </div>

          {/* 新增行 */}
          {envEdit && envEdit.id === null && (
            <div className="project-env-new-row">
              <input
                className="project-env-input"
                placeholder="变量名"
                value={envEdit.draft.key}
                onChange={(e) => setEnvEdit({ ...envEdit, draft: { ...envEdit.draft, key: e.target.value } })}
                autoFocus
              />
              <input
                className="project-env-input"
                placeholder="值"
                value={envEdit.draft.value}
                onChange={(e) => setEnvEdit({ ...envEdit, draft: { ...envEdit.draft, value: e.target.value } })}
              />
              <input
                className="project-env-input"
                placeholder="描述（可选）"
                value={envEdit.draft.description}
                onChange={(e) => setEnvEdit({ ...envEdit, draft: { ...envEdit.draft, description: e.target.value } })}
              />
              <button className="project-env-confirm-btn" type="button" onClick={saveEnv} title="保存">
                <Check size={14} />
              </button>
              <button className="project-env-cancel-btn" type="button" onClick={cancelEnvEdit} title="取消">
                <X size={14} />
              </button>
            </div>
          )}

          {/* 变量列表 */}
          <div className="project-env-vars-list">
            <div className="project-env-vars-header">
              <span className="project-env-vars-col-name">变量名</span>
              <span className="project-env-vars-col-value">值</span>
              <span className="project-env-vars-col-desc">描述</span>
              <span className="project-env-vars-col-actions">操作</span>
            </div>
            {envVars.map((v) => {
              const editing = envEdit?.id === v.id;
              return (
                <div key={v.id} className={`project-env-var-row ${editing ? "editing" : ""}`}>
                  {editing ? (
                    <>
                      <span className="project-env-vars-col-name">
                        <input
                          className="project-env-input inline"
                          value={envEdit!.draft.key}
                          onChange={(e) => setEnvEdit({ ...envEdit!, draft: { ...envEdit!.draft, key: e.target.value } })}
                        />
                      </span>
                      <span className="project-env-vars-col-value">
                        <input
                          className="project-env-input inline"
                          value={envEdit!.draft.value}
                          onChange={(e) => setEnvEdit({ ...envEdit!, draft: { ...envEdit!.draft, value: e.target.value } })}
                        />
                      </span>
                      <span className="project-env-vars-col-desc">
                        <input
                          className="project-env-input inline"
                          value={envEdit!.draft.description}
                          onChange={(e) => setEnvEdit({ ...envEdit!, draft: { ...envEdit!.draft, description: e.target.value } })}
                        />
                      </span>
                      <span className="project-env-vars-col-actions">
                        <button className="project-env-icon-btn" type="button" onClick={saveEnv} title="保存">
                          <Check size={13} />
                        </button>
                        <button className="project-env-icon-btn" type="button" onClick={cancelEnvEdit} title="取消">
                          <X size={13} />
                        </button>
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="project-env-vars-col-name">
                        <code>{v.key}</code>
                      </span>
                      <span className="project-env-vars-col-value">
                        <code className={v.masked && !visibleKeys.has(v.id) ? "masked" : ""}>
                          {v.masked && !visibleKeys.has(v.id) ? "••••••••" : v.value}
                        </code>
                      </span>
                      <span className="project-env-vars-col-desc">{v.description}</span>
                      <span className="project-env-vars-col-actions">
                        {v.masked && (
                          <button className="project-env-icon-btn" type="button" onClick={() => toggleVisible(v.id)} title={visibleKeys.has(v.id) ? "隐藏" : "显示"}>
                            {visibleKeys.has(v.id) ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                        )}
                        <button className="project-env-icon-btn" type="button" onClick={() => startEnvEdit(v)} title="编辑">
                          <Pencil size={13} />
                        </button>
                        <button className="project-env-icon-btn danger" type="button" onClick={() => deleteEnv(v.id)} title="删除">
                          <Trash2 size={13} />
                        </button>
                      </span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
