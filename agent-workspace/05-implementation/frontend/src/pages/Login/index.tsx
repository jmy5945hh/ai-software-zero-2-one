/**
 * 登录页面
 */

import React, { useState } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { login } from '@/services/authService';
import type { LoginRequest } from '@/types/auth';
import './style.css';

/**
 * 登录页面组件
 */
const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((state) => state.setAuth);

  // 获取登录前要访问的页面
  const from = (location.state as any)?.from?.pathname || '/';

  /**
   * 处理登录提交
   */
  const handleSubmit = async (values: LoginRequest) => {
    try {
      setLoading(true);

      // 调用登录 API
      const response = await login(values);

      // 保存认证信息到 Store
      setAuth(response.user, response.access_token);

      message.success('登录成功');

      // 跳转到目标页面
      navigate(from, { replace: true });
    } catch (error) {
      // 错误已在 request.ts 中处理
      console.error('登录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-header">
        <div className="login-logo">🏦</div>
        <h1 className="login-title">招财银行北京分行运营门户系统</h1>
      </div>

      <Card className="login-card" bordered={false}>
        <h2 className="login-subtitle">用户登录</h2>

        <Form onFinish={handleSubmit} autoComplete="off" size="large">
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入账号' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="请输入账号"
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请输入密码"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              size="large"
            >
              {loading ? '登录中...' : '登录'}
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <div className="login-footer">
        <p>© 2026 招财银行北京分行 版权所有</p>
      </div>
    </div>
  );
};

export default Login;
