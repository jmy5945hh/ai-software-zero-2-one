import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DashboardPage } from "./pages/DashboardPage";
import { TaskPage } from "./pages/TaskPage";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { AgentDashboard } from "./pages/AgentDashboard";
import { RuntimeProvider } from "./stores/runtimeStore";
import { UserProvider, useUser } from "./contexts/UserContext";

/**
 * 登录守卫 — 未登录时重定向到 /login
 */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

/**
 * 首页守卫 — 已登录时重定向到 /dashboard
 */
function GuestOnly({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

/**
 * 顶层应用组件 — 通过 react-router-dom 路由切换。
 * - "/" → 落地页（产品愿景 + 运行时模式选择）
 * - "/login" → 登录页
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
    <BrowserRouter basename={import.meta.env.VITE_ROUTER_BASE || ""}>
      <UserProvider>
        <RuntimeProvider>
          <Routes>
            <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
            <Route path="/" element={<RequireAuth><LandingPage /></RequireAuth>} />
            <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
            <Route path="/task" element={<RequireAuth><TaskPage /></RequireAuth>} />
            <Route path="/agent" element={<RequireAuth><AgentDashboard /></RequireAuth>} />
          </Routes>
        </RuntimeProvider>
      </UserProvider>
    </BrowserRouter>
  );
}
