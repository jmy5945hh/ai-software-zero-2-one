import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { WorkspacePage } from "./pages/WorkspacePage";

/**
 * 顶层应用组件 —— 通过 react-router-dom 路由切换 home / workspace 两个独立 URI。
 * - "/" → 首页（任务看板 / 想法输入）
 * - "/workspace" → 工作空间（SOP 导航 + 决策面板）
 *
 * 状态通过 localStorage 持久化，页面间共享。
 */
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/workspace" element={<WorkspacePage />} />
      </Routes>
    </BrowserRouter>
  );
}
