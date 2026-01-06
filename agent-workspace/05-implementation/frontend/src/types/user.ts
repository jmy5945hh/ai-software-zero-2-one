export interface User {
  id: string;
  username: string;
  realName: string;
  department: string;
  role: '客户经理' | '运营人员' | '审批人员' | '分行管理者';
  email: string;
  phone: string;
  status: '激活' | '禁用';
  createdAt?: string;
  updatedAt?: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}