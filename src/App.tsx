import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DashboardPage } from "./pages/DashboardPage";
import { TaskPage } from "./pages/TaskPage";
import { LandingPage } from "./pages/LandingPage";
import { AgentDashboard } from "./pages/AgentDashboard";
import { RuntimeProvider } from "./stores/runtimeStore";

/**
 * 顶层应用组件 — 通过 react-router-dom 路由切换。
 * - "/" → 落地页（产品愿景 + 运行时模式选择）
 * - "/dashboard" → 控制台（任务看板 / 想法输入 + 运行时连接状态）
 * - "/task" → 任务执行（SOP 导航 + 决策面板）
 * - "/agent" → Agent 运行时管理中心
 *
 * RuntimeProvider 提升到根部，确保所有页面共享同一运行时状态，
 * 避免 TaskPage 等页面因缺少 Provider 而读到默认值。
 * 状态通过 localStorage 持久化，页面间共享。
 */
export function App() {
  return (
    <BrowserRouter>
      <RuntimeProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/task" element={<TaskPage />} />
          <Route path="/agent" element={<AgentDashboard />} />
        </Routes>
      </RuntimeProvider>
    </BrowserRouter>
  );
}
