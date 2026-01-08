/**
 * Axios 实例封装
 * 统一处理请求和响应拦截器
 */

import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { message } from 'antd';
import { getToken, removeToken } from './auth';

/**
 * 创建 Axios 实例
 */
const instance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * 请求拦截器
 * 自动注入 JWT Token
 */
instance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getToken();

    // 如果存在 Token,添加到请求头
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * 响应拦截器
 * 统一处理错误和 401 跳转
 */
instance.interceptors.response.use(
  (response) => {
    // 直接返回响应数据
    return response.data;
  },
  (error: AxiosError) => {
    if (error.response) {
      const { status, data } = error.response as any;

      // 处理 401 未授权错误
      if (status === 401) {
        message.error('登录已过期,请重新登录');
        removeToken();

        // 延迟跳转,确保 Token 已清除
        setTimeout(() => {
          window.location.href = '/login';
        }, 1000);

        return Promise.reject(error);
      }

      // 处理 403 禁止访问错误
      if (status === 403) {
        message.error('没有权限访问该资源');
        return Promise.reject(error);
      }

      // 处理 404 资源不存在错误
      if (status === 404) {
        message.error('请求的资源不存在');
        return Promise.reject(error);
      }

      // 处理 500 服务器错误
      if (status >= 500) {
        message.error('服务器错误,请稍后重试');
        return Promise.reject(error);
      }

      // 处理其他错误,显示后端返回的错误信息
      if (data?.message) {
        message.error(data.message);
      } else {
        message.error('请求失败,请稍后重试');
      }
    } else if (error.request) {
      // 请求已发送但没有收到响应
      message.error('网络错误,请检查网络连接');
    } else {
      // 请求配置出错
      message.error('请求配置错误');
    }

    return Promise.reject(error);
  }
);

/**
 * 封装的 request 函数
 */
const request = async <T = unknown>(config: Parameters<typeof instance.request>[0]): Promise<T> => {
  return instance.request(config) as Promise<T>;
};

export default request;
