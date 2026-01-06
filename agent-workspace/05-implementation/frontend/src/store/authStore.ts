import { create } from 'zustand';

interface UserInfo {
  id: number;
  username: string;
  realName: string;
  role: string;
  department: string;
}

interface AuthState {
  token: string | null;
  userInfo: UserInfo | null;
  isAuthenticated: boolean;
  login: (token: string, userInfo: UserInfo) => void;
  logout: () => void;
  updateUserInfo: (userInfo: Partial<UserInfo>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('token') || null,
  userInfo: localStorage.getItem('userInfo') ? JSON.parse(localStorage.getItem('userInfo') || '{}') : null,
  isAuthenticated: !!localStorage.getItem('token'),
  
  login: (token, userInfo) => {
    localStorage.setItem('token', token);
    localStorage.setItem('userInfo', JSON.stringify(userInfo));
    set({ token, userInfo, isAuthenticated: true });
  },
  
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userInfo');
    set({ token: null, userInfo: null, isAuthenticated: false });
  },
  
  updateUserInfo: (updatedInfo) => {
    set((state) => {
      if (!state.userInfo) return state;
      const newUserInfo = { ...state.userInfo, ...updatedInfo };
      localStorage.setItem('userInfo', JSON.stringify(newUserInfo));
      return { userInfo: newUserInfo };
    });
  },
}));
