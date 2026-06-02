import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SwaggerDiffPage } from "./pages/SwaggerDiffPage";

/**
 * 应用入口路由
 * "/" → Swagger API 差异对比工具
 */
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SwaggerDiffPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
