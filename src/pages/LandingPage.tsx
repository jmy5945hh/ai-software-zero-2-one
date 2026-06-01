import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  ArrowRight,
  Eye,
  Zap,
  Package,
  UserCircle,
  Monitor,
  Cloud,
  Check,
  Shield,
  FolderOpen,
  Cpu,
  Globe,
  Layers,
  Clock,
  Users,
} from "lucide-react";
import { TypewriterText } from "../components/TypewriterText";

/**
 * 落地页 —— "/"
 * 产品愿景 / 运行时模式选择（本地·云端）/ 核心价值点 / 优势卡片。
 */
export function LandingPage() {
  const navigate = useNavigate();
  const [selectedRuntime, setSelectedRuntime] = useState<"local" | "cloud">("cloud");

  return (
    <>
      <main className="intro-shell">
        {/* ── 顶部导航 ─────────────────────── */}
        <header className="intro-nav">
          <div className="brand clickable" onClick={() => navigate("/")}>
            <div className="brand-mark">
              <Sparkles size={18} />
            </div>
            <div>
              <strong>AI原生研发平台</strong>
            </div>
          </div>
          <div className="intro-nav-right">
            <div className="home-user-info">
              <UserCircle size={18} />
              <div>
                <strong>景梦园</strong>
                <span>80123456</span>
              </div>
            </div>
          </div>
        </header>

        {/* ── SECTION 1: 产品愿景 ──────────── */}
        <section className="intro-hero">
          <div className="home-copy">
            <h1>
              <TypewriterText
                text="创意需求 👉 可运行软件"
                speed={90}
                startDelay={500}
                showCursor
              />
            </h1>
            <p>没关系, 就让我们从"一句话需求"开始</p>
          </div>
        </section>

        {/* ── SECTION 2: 运行时模式选择 ──────── */}
        <section className="intro-runtime">

          <div className="intro-runtime-cards" onClick={(e) => {
              // 单击卡片切换选中
              const card = (e.target as HTMLElement).closest('[data-runtime]');
              if (!card) return;
              const mode = card.getAttribute('data-runtime') as 'local' | 'cloud';
              setSelectedRuntime(mode);

              // 单击 CTA 按钮区进入
              const cta = (e.target as HTMLElement).closest('.intro-runtime-cta');
              if (cta) {
                localStorage.setItem("zero-one-runtime-mode", mode);
                navigate("/dashboard");
              }
            }}
          >
            {/* Overlap wrapper for visual stacking */}

            <div className={`intro-runtime-overlap-card ${selectedRuntime === "cloud" ? "selected" : "deselected"}`} data-runtime="cloud">
              {/* 云端运行时 */}
              <div className="intro-runtime-card cloud">
                <div className="intro-runtime-card-header">
                  <div className="intro-runtime-icon cloud-icon">
                    <Cloud size={28} />
                  </div>
                  <Check size={16} className={`intro-runtime-check ${selectedRuntime === "cloud" ? "checked" : ""}`} />
                </div>
                <h3>云端 Agent 运行时</h3>
                
                <ul className="intro-runtime-features">
                  <li>
                    <Globe size={13} />
                    7×24 在线
                  </li>
                  <li>
                    <Layers size={13} />
                    定时任务
                  </li>
                  <li>
                    <Clock size={13} />
                    远程执行
                  </li>
                  <li>
                    <Users size={13} />
                    协作共享
                  </li>
                </ul>
                <span className="intro-runtime-cta">
                  云端Agent，马上开始！
                  <ArrowRight size={14} />
                </span>
              </div>
            </div>
            <div className={`intro-runtime-overlap-card ${selectedRuntime === "local" ? "selected" : "deselected"}`} data-runtime="local">
              {/* 本地运行时 */}
              <div className="intro-runtime-card local">
                <div className="intro-runtime-card-header">
                  <div className="intro-runtime-icon local-icon">
                    <Monitor size={28} />
                  </div>
                  <Check size={16} className={`intro-runtime-check ${selectedRuntime === "local" ? "checked" : ""}`} />
                </div>
                <h3>本地 CLI Agent</h3>
                <ul className="intro-runtime-features">
                  <li>
                    <Shield size={13} />
                    快速响应
                  </li>
                  <li>
                    <FolderOpen size={13} />
                    文件系统
                  </li>
                  <li>
                    <Cpu size={13} />
                    本地工具
                  </li>
                  <li>
                    <Zap size={13} />
                    低延迟
                  </li>
                </ul>
                <span className="intro-runtime-cta">
                  本地CLI底座模式
                  <ArrowRight size={14} />
                </span>
              </div>
            </div>

          </div>
        </section>

        {/* ── SECTION 3: 用户核心价值点 ────── */}
        {/* <section className="intro-values">
          <h2 className="intro-section-label">产品特性</h2>
          <div className="intro-values-grid">
            <div className="intro-value-card">
              <div className="intro-value-icon">
                <Zap size={20} />
              </div>
              <h3>极简启航</h3>
              <p>
                不需要 PRD、原型图、技术栈选型。一句话说清业务目标，AI
                自动理解并启动完整研发流程。
              </p>
            </div>
            <div className="intro-value-card">
              <div className="intro-value-icon">
                <Eye size={20} />
              </div>
              <h3>透明掌控</h3>
              <p>
                Agent 思考过程实时可见，产出物以结构化总结、可视化看板呈现。你评价结果，而非纠结过程。
              </p>
            </div>
            <div className="intro-value-card">
              <div className="intro-value-icon">
                <Package size={20} />
              </div>
              <h3>即时交付</h3>
              <p>
                每一次对话都在产出价值。从需求到可运行软件，分钟级完成，迭代如呼吸般自然。
              </p>
            </div>
          </div>
        </section> */}

        {/* ── SECTION 4: 产品优势卡片 ──────── */}
        <section className="intro-advantages">
          <h2 className="intro-section-label">为您真减负的革新产品</h2>

          {/* 卡片 1: 逃离循环 */}
          <div className="intro-card">
            <div className="intro-card-illustration">
              <div className="ill-escape-loop">
                <div className="ill-loop-ring ring-1" />
                <div className="ill-loop-ring ring-2" />
                <div className="ill-loop-ring ring-3" />
                <div className="ill-loop-solid" />
                <div className="ill-person">
                  <div className="ill-person-head" />
                  <div className="ill-person-body" />
                </div>
              </div>
            </div>
            <div className="intro-card-body">
              <div className="intro-card-tag">认知减负</div>
              <h3>逃离循环，认知 0 负担</h3>
              <p>
                传统 AI 工具让人深陷多轮对话的泥潭——你被迫翻阅 Agent
                的每一步原始输出，在「提问→检查→追问→修正」的循环中不断消耗认知。
              </p>
              <div className="intro-card-highlight">
                <p>
                  01 将你从 Agent Loop 中解放出来。复杂过程被压缩为结构化总结、可视化看板与直观的交互界面。你站在循环之上，只做决策，不耗心力。
                </p>
              </div>
            </div>
          </div>

          {/* 卡片 2: 智研 SOP */}
          <div className="intro-card reverse">
            <div className="intro-card-body">
              <div className="intro-card-tag">开箱即用</div>
              <h3>智研 SOP，开箱即用</h3>
              <p>
                其它 AI 开发工具需要你手动配置 Skills、编写 Rules、适配企业工具栈——还没开始写需求，先花半天折腾环境。
              </p>
              <div className="intro-card-highlight">
                <p>
                  01 内置 7 步完整研发 SOP：意图校准 → 范围锁定 → Spec 基线 → Agent 开发 → 质量门禁 → 验证修复 → 发布交付。打开浏览器即用，专注于业务价值创造。
                </p>
              </div>
            </div>
            <div className="intro-card-illustration">
              <div className="ill-sop-pipeline">
                <div className="ill-sop-row">
                  {["意图校准", "范围锁定", "Spec基线", "Agent开发"].map((label, i) => (
                    <div className="ill-sop-node" key={i}>
                      <div className="ill-sop-dot" />
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
                <div className="ill-sop-connector">
                  <svg width="16" height="24" viewBox="0 0 16 24" fill="none">
                    <path d="M8 0 L8 18 Q8 24 12 24 L16 24" stroke="var(--primary-mid)" strokeWidth="1.5" fill="none" />
                  </svg>
                </div>
                <div className="ill-sop-row">
                  {["质量门禁", "验证修复", "发布交付"].map((label, i) => (
                    <div className="ill-sop-node" key={i}>
                      <div className={`ill-sop-dot${i === 2 ? ' end' : ''}`} />
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 卡片 3: 全时工作 */}
          <div className="intro-card">
            <div className="intro-card-illustration">
              <div className="ill-cloud-clock">
                <div className="ill-cloud">
                  <div className="ill-cloud-part part-1" />
                  <div className="ill-cloud-part part-2" />
                  <div className="ill-cloud-part part-3" />
                </div>
                <div className="ill-clock">
                  <div className="ill-clock-face" />
                  <div className="ill-clock-hand hour" />
                  <div className="ill-clock-hand minute" />
                </div>
              </div>
            </div>
            <div className="intro-card-body">
              <div className="intro-card-tag">永不离线</div>
              <h3>全时工作，无惧倦怠</h3>
              <p>
                人类工程师需要睡眠、休假、开会——研发进度天然受限于人的时间与精力边界。
              </p>
              <div className="intro-card-highlight">
                <p>
                  01 以云端 Agent 提供服务，支持定时任务，7×24 小时全天候工作。你下班时，它仍在推进；你醒来时，产物已就绪。研发速度不再是你的速度，而是 AI 的速度。
                </p>
              </div>
            </div>
          </div>

          {/* 卡片 4: 高定扩展 */}
          <div className="intro-card reverse">
            <div className="intro-card-body">
              <div className="intro-card-tag">深度开放</div>
              <h3>高定扩展，兼容并蓄</h3>
              <p>
                标准化 SOP 是起点，不是天花板。你可自由定义多 Agent 协作拓扑，组装专属于你的研发工作流。
              </p>
              <div className="intro-card-highlight">
                <p>
                  从 System Prompt 到 MCP 工具链、Skills 扩展，开放至最细粒度的可编程层——既满足开箱即用的便利，也容纳企业级深度定制。
                </p>
              </div>
            </div>
            <div className="intro-card-illustration">
              <div className="ill-blocks">
                <div className="ill-block block-1" />
                <div className="ill-block block-2" />
                <div className="ill-block block-3" />
                <div className="ill-block block-4" />
                <div className="ill-block block-5" />
                <div className="ill-block block-6" />
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
