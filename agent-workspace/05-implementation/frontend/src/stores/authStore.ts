/**
 * 认证状态管理
 * 使用 Zustand + persist 中间件实现状态持久化
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Role } from '@/types/auth';
import { setToken, removeToken } from '@/utils/auth';

/**
 * 认证状态接口
 */
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  setUser: (user: User) => void;
}

/**
 * 认证 Store
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      /**
       * 设置认证信息
       */
      setAuth: (user: User, token: string) => {
        // 存储 Token 到 localStorage
        setToken(token);

        set({
          user,
          token,
          isAuthenticated: true,
        });
      },

      /**
       * 清除认证信息
       */
      clearAuth: () => {
        // 清除 Token
        removeToken();

        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
      },

      /**
       * 更新用户信息
       */
      setUser: (user: User) => {
        set({ user });
      },
    }),
    {
      name: 'auth-storage', // localStorage 键名
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

/**
 * Hook: 获取当前用户
 */
export const useUser = (): User | null => {
  return useAuthStore((state) => state.user);
};

/**
 * Hook: 获取用户角色
 */
export const useUserRole = (): Role | null => {
  return useAuthStore((state) => state.user?.role || null);
};

/**
 * Hook: 判断是否已登录
 */
export const useIsAuthenticated = (): boolean => {
  return useAuthStore((state) => state.isAuthenticated);
};
