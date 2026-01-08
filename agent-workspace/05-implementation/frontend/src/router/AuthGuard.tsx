/**
 * 路由守卫组件
 * 用于保护需要认证的页面
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useIsAuthenticated } from '@/stores/authStore';

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * 认证守卫组件
 */
const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const isAuthenticated = useIsAuthenticated();
  const location = useLocation();

  // 未登录则跳转到登录页
  if (!isAuthenticated) {
    // 保存当前路径,登录后可以跳转回来
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default AuthGuard;
