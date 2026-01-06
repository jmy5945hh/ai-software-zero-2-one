import React, { useState } from 'react';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  HomeOutlined,
  UserOutlined,
  TeamOutlined,
  ShoppingCartOutlined,
  AppstoreOutlined,
  DashboardOutlined,
  FileTextOutlined,
  LogoutOutlined,
  MenuOutlined
} from '@ant-design/icons';
import { Layout, Menu, Button, theme, Dropdown, Space, Avatar, Drawer } from 'antd';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useMenuStore } from '../stores/menuStore';
import { User } from '../types/user';

const { Header, Sider, Content } = Layout;

interface MenuItem {
  key: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  children?: MenuItem[];
}

const LayoutComponent: React.FC = () => {
  const [userMenuVisible, setUserMenuVisible] = useState(false);
  const [mobileMenuVisible, setMobileMenuVisible] = useState(false);
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const { user, logout } = useAuthStore();
  const { collapsed, toggleCollapsed, setCollapsed } = useMenuStore();
  const location = useLocation();
  const navigate = useNavigate();

  // Generate menu items based on user role
  const getMenuItems = (userRole: string): MenuItem[] => {
    switch(userRole) {
      case '客户经理':
        return [
          {
            key: '/home',
            label: <Link to="/home">首页</Link>,
            icon: <HomeOutlined />,
          },
          {
            key: 'customer-visit',
            label: '客户拜访管理',
            icon: <UserOutlined />,
            children: [
              {
                key: '/customer-visit',
                label: <Link to="/customer-visit">拜访记录列表</Link>,
              },
              {
                key: '/customer-visit/create',
                label: <Link to="/customer-visit/create">新增拜访记录</Link>,
              },
            ],
          },
          {
            key: 'gift-application',
            label: '礼品申请管理',
            icon: <ShoppingCartOutlined />,
            children: [
              {
                key: '/gift-application',
                label: <Link to="/gift-application">申请列表</Link>,
              },
              {
                key: '/gift-application/create',
                label: <Link to="/gift-application/create">新增申请</Link>,
              },
            ],
          },
        ];
      case '运营人员':
        return [
          {
            key: '/home',
            label: <Link to="/home">首页</Link>,
            icon: <HomeOutlined />,
          },
          {
            key: 'homepage-management',
            label: '首页管理',
            icon: <AppstoreOutlined />,
            children: [
              {
                key: '/homepage-management/carousel',
                label: <span>轮播图管理</span>,
              },
              {
                key: '/homepage-management/news',
                label: <span>新闻管理</span>,
              },
            ],
          },
          {
            key: '/dashboard',
            label: <Link to="/dashboard">运营数据</Link>,
            icon: <DashboardOutlined />,
          },
          {
            key: '/gift-ledger',
            label: <Link to="/gift-ledger">礼品台账</Link>,
            icon: <FileTextOutlined />,
          },
        ];
      case '审批人员':
        return [
          {
            key: '/home',
            label: <Link to="/home">首页</Link>,
            icon: <HomeOutlined />,
          },
          {
            key: 'gift-approval',
            label: '礼品审批管理',
            icon: <TeamOutlined />,
            children: [
              {
                key: '/gift-approval/pending',
                label: <span>待审批列表</span>,
              },
              {
                key: '/gift-approval/approved',
                label: <span>已审批列表</span>,
              },
            ],
          },
          {
            key: '/gift-ledger',
            label: <Link to="/gift-ledger">礼品台账</Link>,
            icon: <FileTextOutlined />,
          },
        ];
      case '分行管理者':
        return [
          {
            key: '/home',
            label: <Link to="/home">首页</Link>,
            icon: <HomeOutlined />,
          },
          {
            key: '/dashboard',
            label: <Link to="/dashboard">运营数据大屏</Link>,
            icon: <DashboardOutlined />,
          },
          {
            key: '/gift-ledger',
            label: <Link to="/gift-ledger">礼品台账</Link>,
            icon: <FileTextOutlined />,
          },
        ];
      default:
        return [];
    }
  };

  const menuItems = user ? getMenuItems(user.role) : [];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userMenu = (
    <Menu>
      <Menu.Item key="profile" icon={<UserOutlined />}>
        个人资料
      </Menu.Item>
      <Menu.Item key="logout" icon={<LogoutOutlined />} onClick={handleLogout}>
        退出登录
      </Menu.Item>
    </Menu>
  );

  // Responsive layout configuration
  const isMobile = window.innerWidth < 768;

  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setCollapsed(true);
      } else {
        setCollapsed(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setCollapsed]);

  return (
    <Layout style={{ height: '100vh' }}>
      {/* Mobile menu drawer */}
      {isMobile && (
        <Drawer
          placement="left"
          closable={false}
          onClose={() => setMobileMenuVisible(false)}
          open={mobileMenuVisible}
          width={200}
        >
          <div style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            fontWeight: 'bold',
            color: 'white',
            background: '#001529',
            marginBottom: 16
          }}>
            招财银行运营门户
          </div>
          <Menu
            theme="dark"
            mode="inline"
            defaultSelectedKeys={[location.pathname]}
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={() => setMobileMenuVisible(false)}
          />
        </Drawer>
      )}

      {/* Desktop Sider */}
      {!isMobile && (
        <Sider trigger={null} collapsible collapsed={collapsed}>
          <div style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: '0 16px',
            fontSize: collapsed ? '20px' : '18px',
            fontWeight: 'bold',
            color: 'white',
            background: '#001529'
          }}>
            {!collapsed && '招财银行运营门户'}
          </div>
          <Menu
            theme="dark"
            mode="inline"
            defaultSelectedKeys={[location.pathname]}
            selectedKeys={[location.pathname]}
            items={menuItems}
          />
        </Sider>
      )}

      <Layout>
        <Header style={{
          padding: '0 16px',
          background: colorBgContainer,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {isMobile ? (
              <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={() => setMobileMenuVisible(true)}
                style={{
                  fontSize: '16px',
                  width: 64,
                  height: 64,
                }}
              />
            ) : (
              <Button
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={toggleCollapsed}
                style={{
                  fontSize: '16px',
                  width: 64,
                  height: 64,
                }}
              />
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span>欢迎您，{user?.realName} ({user?.role})</span>
            <Dropdown
              overlay={userMenu}
              trigger={['click']}
              visible={userMenuVisible}
              onVisibleChange={setUserMenuVisible}
            >
              <Space style={{ cursor: 'pointer' }}>
                <Avatar icon={<UserOutlined />} />
              </Space>
            </Dropdown>
          </div>
        </Header>
        <Content
          style={{
            margin: isMobile ? '8px' : '16px',
            padding: isMobile ? '16px' : '24px',
            minHeight: 280,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default LayoutComponent;