/**
 * 认证相关类型定义
 */

/**
 * 用户角色类型
 */
export type Role = 'CUSTOMER_MANAGER' | 'OPERATIONS' | 'APPROVER' | 'MANAGER';

/**
 * 用户角色常量
 */
export const Role = {
  CUSTOMER_MANAGER: 'CUSTOMER_MANAGER' as const,
  OPERATIONS: 'OPERATIONS' as const,
  APPROVER: 'APPROVER' as const,
  MANAGER: 'MANAGER' as const,
};

/**
 * 用户状态类型
 */
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED';

/**
 * 用户状态常量
 */
export const UserStatus = {
  ACTIVE: 'ACTIVE' as const,
  INACTIVE: 'INACTIVE' as const,
  LOCKED: 'LOCKED' as const,
};

/**
 * 用户信息接口
 */
export interface User {
  user_id: string;
  username: string;
  name: string;
  role: Role;
  department: string;
  status: UserStatus;
}

/**
 * 登录请求接口
 */
export interface LoginRequest {
  username: string;
  password: string;
}

/**
 * 登录响应接口
 */
export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

/**
 * API 响应基础接口
 */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

/**
 * Token 存储键名
 */
export const TOKEN_KEY = 'access_token';
