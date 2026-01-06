import axios from 'axios';
import { useAuthStore } from '../store/authStore';

// 创建API客户端
const apiClient = axios.create({
  baseURL: 'http://localhost:8080/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// 请求拦截器
apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // 处理401未授权错误
    if (error.response && error.response.status === 401) {
      useAuthStore.getState().logout();
      // 可以在这里添加重定向到登录页的逻辑
    }
    return Promise.reject(error);
  }
);

export default apiClient;
