import apiClient from './axios';
import { User, LoginCredentials, AuthResponse } from '../types/user';

export const authAPI = {
  login: (credentials: LoginCredentials) => {
    // In a real app, this would be an actual API call
    // For now, we'll return mock data
    return Promise.resolve({
      data: {
        token: `mock-jwt-token-${Date.now()}`,
        user: {
          id: '1',
          username: credentials.username,
          realName: credentials.username === 'manager' ? '分行管理者' : 
                   credentials.username === 'approver' ? '审批人员' :
                   credentials.username === 'operator' ? '运营人员' : '客户经理',
          department: '北京分行',
          role: credentials.username === 'manager' ? '分行管理者' : 
                 credentials.username === 'approver' ? '审批人员' :
                 credentials.username === 'operator' ? '运营人员' : '客户经理',
          email: `${credentials.username}@bank.com`,
          phone: '13800138000',
          status: '激活'
        } as User
      } as AuthResponse
    });
  },

  logout: () => {
    return apiClient.post('/auth/logout');
  },

  getCurrentUser: () => {
    return apiClient.get('/users/me');
  }
};