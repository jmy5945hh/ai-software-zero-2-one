/**
 * Token 存储和恢复工具函数
 */

import { TOKEN_KEY } from '@/types/auth';

/**
 * 存储 Token 到 localStorage
 */
export const setToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

/**
 * 从 localStorage 读取 Token
 */
export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

/**
 * 清除 Token
 */
export const removeToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
};

/**
 * 判断是否已登录
 */
export const isAuthenticated = (): boolean => {
  const token = getToken();
  return !!token && token.length > 0;
};
