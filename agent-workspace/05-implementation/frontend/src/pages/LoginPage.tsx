import React, { useState } from 'react';
import { Form, Input, Button, message, Card } from 'antd';
import { UserOutlined, LockOutlined, EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import apiClient from '../utils/apiClient';
import '../styles/LoginPage.css';

const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const handleLogin = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const response = await apiClient.post('/auth/login', values);
      const { token, userInfo } = response.data;
      login(token, userInfo);
      message.success('登录成功');
      navigate('/');
    } catch (error: any) {
      if (error.response) {
        message.error(error.response.data.message || '登录失败，请检查账号密码');
      } else {
        message.error('网络错误，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-header">
        <h1>招财银行北京分行运营门户系统</h1>
      </div>
      <Card className="login-form-card">
        <Form
          name="login"
          initialValues={{ remember: true }}
          onFinish={handleLogin}
          layout="vertical"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入账号' }, { min: 4, message: '账号长度不能少于4位' }]}
          >
            <Input
              prefix={<UserOutlined className="site-form-item-icon" />}
              placeholder="请输入账号"
              size="large"
            />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }, { min: 6, message: '密码长度不能少于6位' }]}
          >
            <Input.Password
              prefix={<LockOutlined className="site-form-item-icon" />}
              placeholder="请输入密码"
              iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
              size="large"
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block size="large">
              登录
            </Button>
          </Form.Item>
          <div className="login-form-footer">
            <a href="#" onClick={(e) => { e.preventDefault(); message.info('请联系管理员重置密码'); }}>
              忘记密码?
            </a>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default LoginPage;
