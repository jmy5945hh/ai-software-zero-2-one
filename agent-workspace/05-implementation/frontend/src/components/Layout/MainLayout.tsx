import React, { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Button } from 'antd';
import { UserOutlined, MenuOutlined, MessageOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import AIAssistant from '../AIAssistant';
import '../../styles/MainLayout.css';

const { Header, Content, Sider } = Layout;

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [aiVisible, setAiVisible] = useState(false);
  const { userInfo, logout } = useAuthStore();
  const navigate = useNavigate();

  // 根据用户角色生成导航菜单
  const generateMenuItems = () => {
    const commonItems = [
      { key: 'home', label: <Link to="/">首页</Link> },
    ];

    const roleItems: Record<string, any[]> = {
      '客户经理': [
        { key: 'customer-visit', label: <Link to="/customer-visit">客户拜访管理</Link> },
        { key: 'gift-application', label: <Link to="/gift-application">礼品申请</Link> },
      ],
      '审批人员': [
        { key: 'gift-approval', label: <Link to="/gift-approval">礼品审批</Link> },
      ],
      '运营人员': [
        { key: 'customer-visit', label: <Link to="/customer-visit">客户拜访管理</Link> },
        { key: 'gift-application', label: <Link to="/gift-application">礼品申请</Link> },
        { key: 'gift-approval', label: <Link to="/gift-approval">礼品审批</Link> },
        { key: 'operation-data', label: <Link to="/operation-data">运营数据大屏</Link> },
      ],
      '分行管理者': [
        { key: 'operation-data', label: <Link to="/operation-data">运营数据大屏</Link> },
      ],
    };

    return [...commonItems, ...(roleItems[userInfo?.role || '客户经理'] || [])];
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userMenu = (
    <Menu>
      <Menu.Item key="user-info">
        <div>
          <p>{userInfo?.realName}</p>
          <p style={{ fontSize: '12px', color: '#666' }}>{userInfo?.role}</p>
        </div>
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item key="logout" onClick={handleLogout}>
        退出登录
      </Menu.Item>
    </Menu>
  );

  return (
    <Layout className="main-layout">
      <Header className="main-header">
        <div className="header-left">
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            className="menu-toggle"
          />
          <div className="system-logo">招财银行北京分行运营门户系统</div>
        </div>
        <div className="header-right">
          <Button
            type="text"
            icon={<MessageOutlined />}
            onClick={() => setAiVisible(!aiVisible)}
            className="ai-toggle"
          />
          <Dropdown overlay={userMenu} placement="bottomRight">
            <div className="user-info">
              <Avatar icon={<UserOutlined />} />  
              <span className="user-name">{userInfo?.realName}</span>
            </div>
          </Dropdown>
        </div>
      </Header>
      <Layout>
        <Sider
          collapsible
          collapsed={collapsed}
          className="main-sider"
          breakpoint="lg"
          onCollapse={setCollapsed}
        >
          <Menu
            mode="inline"
            selectedKeys={[window.location.pathname.replace('/', '') || 'home']}
            items={generateMenuItems()}
          />
        </Sider>
        <Layout className="main-content-wrapper">
          <Content className="main-content">
            {children}
          </Content>
        </Layout>
        <AIAssistant visible={aiVisible} onClose={() => setAiVisible(false)} />
      </Layout>
    </Layout>
  );
};

export default MainLayout;
