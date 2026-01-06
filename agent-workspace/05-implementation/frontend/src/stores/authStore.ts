import { create } from 'zustand';
import { User } from '../types/user';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  token: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  setToken: (token: string) => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  token: null,
  login: async (username, password) => {
    // In a real application, this would make an API call to authenticate
    // For now, we'll simulate a successful login
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Mock user data based on the PRD
      const mockUser: User = {
        id: '1',
        username,
        realName: username === 'manager' ? '分行管理者' : 
                 username === 'approver' ? '审批人员' :
                 username === 'operator' ? '运营人员' : '客户经理',
        department: '北京分行',
        role: username === 'manager' ? '分行管理者' : 
               username === 'approver' ? '审批人员' :
               username === 'operator' ? '运营人员' : '客户经理',
        email: `${username}@bank.com`,
        phone: '13800138000',
        status: '激活'
      };
      
      set({ 
        user: mockUser, 
        isAuthenticated: true, 
        token: `mock-jwt-token-${Date.now()}` 
      });
      
      return true;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  },
  logout: () => set({ user: null, isAuthenticated: false, token: null }),
  setToken: (token) => set({ token }),
  setUser: (user) => set({ user, isAuthenticated: true })
}));