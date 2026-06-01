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
 * 状态通过 localStorage 持久化，页面间共享。
 */
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/dashboard"
          element={
            <RuntimeProvider>
              <DashboardPage />
            </RuntimeProvider>
          }
        />
        <Route path="/task" element={<TaskPage />} />
        <Route
          path="/agent"
          element={
            <RuntimeProvider>
              <AgentDashboard />
            </RuntimeProvider>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
