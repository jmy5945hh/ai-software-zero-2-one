/**
 * 首页组件 (临时占位)
 */

import React from 'react';
import { Button, Card, Typography, Space } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import './style.css';

const { Title, Paragraph, Text } = Typography;

/**
 * 首页组件
 */
const Home: React.FC = () => {
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();

  /**
   * 处理退出登录
   */
  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  return (
    <div className="home-container">
      <Card className="home-card">
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Title level={2}>欢迎来到招财银行北京分行运营门户系统</Title>
            <Paragraph>
              这是一个临时首页,后续将完善轮播图、新闻列表和功能入口等功能。
            </Paragraph>
          </div>

          <Card title="用户信息" size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text>
                <strong>用户名:</strong> {user?.name}
              </Text>
              <Text>
                <strong>账号:</strong> {user?.username}
              </Text>
              <Text>
                <strong>角色:</strong> {user?.role}
              </Text>
              <Text>
                <strong>部门:</strong> {user?.department}
              </Text>
            </Space>
          </Card>

          <Button
            type="primary"
            danger
            icon={<LogoutOutlined />}
            onClick={handleLogout}
            block
          >
            退出登录
          </Button>
        </Space>
      </Card>
    </div>
  );
};

export default Home;
