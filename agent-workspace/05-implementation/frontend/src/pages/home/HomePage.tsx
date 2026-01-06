import React from 'react';
import { Card, Row, Col, Typography, Carousel, List, Avatar } from 'antd';
import { 
  UserOutlined, 
  ShoppingCartOutlined, 
  FileTextOutlined, 
  DashboardOutlined 
} from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';

const { Title, Text } = Typography;

const HomePage: React.FC = () => {
  const { user } = useAuthStore();
  
  // Mock data for carousel
  const carouselItems = [
    {
      id: 1,
      title: '新年营销活动启动',
      description: '2024年新年营销活动正式开始，详情请查看营销指南',
      imageUrl: 'https://via.placeholder.com/800x300/4A90E2/FFFFFF?text=新年营销活动'
    },
    {
      id: 2,
      title: '系统功能更新',
      description: '运营门户系统功能优化，提升用户体验',
      imageUrl: 'https://via.placeholder.com/800x300/7ED321/FFFFFF?text=系统更新'
    },
    {
      id: 3,
      title: '培训通知',
      description: '新员工培训计划安排，请相关人员按时参加',
      imageUrl: 'https://via.placeholder.com/800x300/F5A623/FFFFFF?text=培训通知'
    }
  ];
  
  // Mock data for news
  const newsItems = [
    {
      id: 1,
      title: '关于2024年第一季度营销策略的通知',
      summary: '为提升第一季度业绩，特制定新的营销策略...',
      date: '2024-01-15',
      author: '运营部'
    },
    {
      id: 2,
      title: '系统维护通知',
      summary: '本周六凌晨2点至4点系统将进行维护，请提前做好准备...',
      date: '2024-01-14',
      author: '技术部'
    },
    {
      id: 3,
      title: '新客户经理培训安排',
      summary: '新入职客户经理培训将于下周一开始，请相关人员参加...',
      date: '2024-01-13',
      author: '人力资源部'
    },
    {
      id: 4,
      title: '礼品管理流程优化',
      summary: '为提高审批效率，礼品管理流程进行了优化...',
      date: '2024-01-12',
      author: '运营管理部'
    }
  ];
  
  // Quick access items based on user role
  const getQuickAccessItems = () => {
    switch(user?.role) {
      case '客户经理':
        return [
          { key: 'customer-visit', label: '客户拜访登记', icon: <UserOutlined />, path: '/customer-visit/create' },
          { key: 'gift-application', label: '礼品申请', icon: <ShoppingCartOutlined />, path: '/gift-application/create' },
          { key: 'visit-list', label: '拜访记录', icon: <FileTextOutlined />, path: '/customer-visit' },
          { key: 'dashboard', label: '个人数据', icon: <DashboardOutlined />, path: '/dashboard' }
        ];
      case '运营人员':
        return [
          { key: 'dashboard', label: '运营数据', icon: <DashboardOutlined />, path: '/dashboard' },
          { key: 'gift-ledger', label: '礼品台账', icon: <FileTextOutlined />, path: '/gift-ledger' },
          { key: 'news-management', label: '新闻管理', icon: <FileTextOutlined />, path: '/homepage-management/news' },
          { key: 'carousel-management', label: '轮播图管理', icon: <FileTextOutlined />, path: '/homepage-management/carousel' }
        ];
      case '审批人员':
        return [
          { key: 'pending-approval', label: '待审批', icon: <FileTextOutlined />, path: '/gift-approval/pending' },
          { key: 'approved-list', label: '已审批', icon: <FileTextOutlined />, path: '/gift-approval/approved' },
          { key: 'gift-ledger', label: '礼品台账', icon: <FileTextOutlined />, path: '/gift-ledger' },
          { key: 'dashboard', label: '审批数据', icon: <DashboardOutlined />, path: '/dashboard' }
        ];
      case '分行管理者':
        return [
          { key: 'dashboard', label: '运营大屏', icon: <DashboardOutlined />, path: '/dashboard' },
          { key: 'gift-ledger', label: '礼品台账', icon: <FileTextOutlined />, path: '/gift-ledger' },
          { key: 'visit-analytics', label: '拜访分析', icon: <UserOutlined />, path: '/customer-visit' },
          { key: 'gift-analytics', label: '礼品分析', icon: <ShoppingCartOutlined />, path: '/gift-analytics' }
        ];
      default:
        return [];
    }
  };

  return (
    <div>
      <Title level={2}>欢迎使用招财银行北京分行运营门户</Title>
      <Text type="secondary">当前用户：{user?.realName} ({user?.role})</Text>
      
      <div style={{ marginTop: 24 }}>
        <Row gutter={[16, 16]}>
          <Col span={18}>
            <Card title="系统公告" style={{ marginBottom: 16 }}>
              <Carousel autoplay>
                {carouselItems.map(item => (
                  <div key={item.id}>
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                      <img 
                        src={item.imageUrl} 
                        alt={item.title} 
                        style={{ maxWidth: '100%', height: 200, objectFit: 'cover', borderRadius: 8 }} 
                      />
                      <div style={{ marginTop: 12 }}>
                        <Title level={4}>{item.title}</Title>
                        <Text type="secondary">{item.description}</Text>
                      </div>
                    </div>
                  </div>
                ))}
              </Carousel>
            </Card>
            
            <Card title="分行新闻">
              <List
                itemLayout="vertical"
                size="large"
                pagination={{
                  onChange: page => {
                    console.log(page);
                  },
                  pageSize: 3,
                }}
                dataSource={newsItems}
                renderItem={item => (
                  <List.Item
                    key={item.id}
                    extra={
                      <Avatar size={64} src={`https://api.dicebear.com/7.x/miniavs/svg?seed=${item.id}`} />
                    }
                  >
                    <List.Item.Meta
                      title={<a href={`/news/${item.id}`}>{item.title}</a>}
                      description={`${item.date} | ${item.author}`}
                    />
                    {item.summary}
                  </List.Item>
                )}
              />
            </Card>
          </Col>
          
          <Col span={6}>
            <Card title="快捷入口">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {getQuickAccessItems().map(item => (
                  <Card 
                    key={item.key} 
                    size="small" 
                    style={{ cursor: 'pointer' }}
                    onClick={() => window.location.hash = `#${item.path}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{item.icon}</span>
                      <span>{item.label}</span>
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
            
            <Card title="系统使用指南" style={{ marginTop: 16 }}>
              <List
                size="small"
                dataSource={[
                  '首次使用请阅读用户手册',
                  '客户拜访记录需及时更新',
                  '礼品申请需提前3天提交',
                  '审批流程请按规范执行'
                ]}
                renderItem={item => <List.Item>{item}</List.Item>}
              />
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default HomePage;