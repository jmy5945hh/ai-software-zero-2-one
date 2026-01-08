/**
 * 认证相关 API 服务
 */

import request from '@/utils/request';
import type { LoginRequest, LoginResponse, User } from '@/types/auth';

/**
 * 用户登录
 */
export const login = async (data: LoginRequest): Promise<LoginResponse> => {
  return request<LoginResponse>({
    method: 'POST',
    url: '/api/v1/auth/login',
    data,
  });
};

/**
 * 获取当前用户信息
 */
export const getCurrentUser = async (): Promise<User> => {
  return request<User>({
    method: 'GET',
    url: '/api/v1/auth/me',
  });
};

/**
 * 更新当前用户信息
 */
export const updateCurrentUser = async (data: Partial<User>): Promise<User> => {
  return request<User>({
    method: 'PUT',
    url: '/api/v1/auth/me',
    data,
  });
};
