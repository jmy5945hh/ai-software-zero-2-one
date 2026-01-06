import React, { useState, useEffect } from 'react';
import { Carousel, Card, Row, Col, List, Typography, Button } from 'antd';
import { CalendarOutlined, GiftOutlined, BarChartOutlined, FileTextOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import MainLayout from '../components/Layout/MainLayout';

import '../styles/HomePage.css';

const { Title, Text } = Typography;

// 轮播图数据接口
interface Banner {
  id: number;
  title: string;
  imageUrl: string;
  linkUrl: string;
  orderNum: number;
  isActive: boolean;
}

// 新闻数据接口
interface News {
  id: number;
  title: string;
  content: string;
  author: string;
  publishTime: string;
}

const HomePage: React.FC = () => {
  const [banners] = useState<Banner[]>([
    {
      id: 1,
      title: '最新分行公告',
      imageUrl: 'https://via.placeholder.com/800x200/1E90FF/FFFFFF?text=最新分行公告',
      linkUrl: '#',
      orderNum: 1,
      isActive: true,
    },
    {
      id: 2,
      title: '客户拜访培训通知',
      imageUrl: 'https://via.placeholder.com/800x200/228B22/FFFFFF?text=客户拜访培训通知',
      linkUrl: '#',
      orderNum: 2,
      isActive: true,
    },
    {
      id: 3,
      title: '礼品管理新规',
      imageUrl: 'https://via.placeholder.com/800x200/FFD700/000000?text=礼品管理新规',
      linkUrl: '#',
      orderNum: 3,
      isActive: true,
    },
  ]);

  const [news] = useState<News[]>([
    {
      id: 1,
      title: '2026年第一季度客户拜访计划',
      content: '为了提高客户满意度，现将2026年第一季度客户拜访计划通知如下...',
      author: '运营部',
      publishTime: '2026-01-01',
    },
    {
      id: 2,
      title: '新礼品申请流程上线通知',
      content: '为了简化礼品申请流程，提高审批效率，新的礼品申请系统已上线...',
      author: '礼品管理部',
      publishTime: '2026-01-02',
    },
    {
      id: 3,
      title: '运营数据大屏功能更新',
      content: '运营数据大屏已更新，新增了客户拜访统计和礼品申请统计功能...',
      author: '数据部',
      publishTime: '2026-01-03',
    },
  ]);

  // 模拟数据加载
  useEffect(() => {
    const fetchData = async () => {
      try {
        // 实际项目中，这里会调用API获取真实数据
        // const bannerResponse = await apiClient.get('/content/banners');
        // setBanners(bannerResponse.data);
        
        // const newsResponse = await apiClient.get('/content/news', { params: { page: 1, size: 3 } });
        // setNews(newsResponse.data.data);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      }
    };
    fetchData();
  }, []);

  // 功能入口数据
  const featureItems = [
    {
      key: 'customer-visit',
      title: '客户拜访管理',
      icon: <CalendarOutlined />,
      description: '管理客户拜访记录',
      link: '/customer-visit',
    },
    {
      key: 'gift-application',
      title: '礼品申请',
      icon: <GiftOutlined />,
      description: '提交礼品领用申请',
      link: '/gift-application',
    },
    {
      key: 'gift-approval',
      title: '礼品审批',
      icon: <FileTextOutlined />,
      description: '审批礼品申请',
      link: '/gift-approval',
    },
    {
      key: 'operation-data',
      title: '运营数据大屏',
      icon: <BarChartOutlined />,
      description: '查看运营数据统计',
      link: '/operation-data',
    },
  ];

  // 待办事项数据
  const todoItems = [
    { id: 1, title: '待审批礼品申请', count: 2 },
    { id: 2, title: '未完成拜访记录', count: 5 },
  ];

  // 最近操作数据
  const recentActivities = [
    { id: 1, title: '新增拜访记录', time: '2026-01-01' },
    { id: 2, title: '提交礼品申请', time: '2026-01-02' },
  ];

  return (
    <MainLayout>
      <div className="home-page">
        {/* 轮播图区域 */}
        <Card className="carousel-card">
          <Carousel autoplay dots={true} effect="fade" className="home-carousel">
            {banners.map((banner) => (
              <div key={banner.id} className="carousel-item">
                <img src={banner.imageUrl} alt={banner.title} className="carousel-image" />
                <div className="carousel-content">
                  <h3>{banner.title}</h3>
                </div>
              </div>
            ))}
          </Carousel>
        </Card>

        {/* 主要内容区域 */}
        <Row gutter={[16, 16]} className="main-content-row">
          {/* 功能入口区 */}
          <Col xs={24} lg={8}>
            <Card title="功能入口" className="feature-card">
              <Row gutter={[16, 16]}>
                {featureItems.map((item) => (
                  <Col xs={12} key={item.key}>
                    <Link to={item.link} className="feature-item">
                      <div className="feature-icon">{item.icon}</div>
                      <div className="feature-info">
                        <div className="feature-title">{item.title}</div>
                        <div className="feature-description">{item.description}</div>
                      </div>
                    </Link>
                  </Col>
                ))}
              </Row>
            </Card>

            {/* 快捷操作区 */}
            <Card title="快捷操作" className="quick-action-card">
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12}>
                  <div className="action-section">
                    <Title level={5}>待办事项</Title>
                    <List
                      dataSource={todoItems}
                      renderItem={(item) => (
                        <List.Item className="todo-item">
                          <Text strong>{item.title}</Text>
                          <Text type="danger" className="todo-count">({item.count})</Text>
                        </List.Item>
                      )}
                    />
                  </div>
                </Col>
                <Col xs={24} sm={12}>
                  <div className="action-section">
                    <Title level={5}>最近操作</Title>
                    <List
                      dataSource={recentActivities}
                      renderItem={(item) => (
                        <List.Item className="activity-item">
                          <Text>{item.title}</Text>
                          <Text type="secondary" className="activity-time">{item.time}</Text>
                        </List.Item>
                      )}
                    />
                  </div>
                </Col>
              </Row>
            </Card>
          </Col>

          {/* 新闻列表区 */}
          <Col xs={24} lg={16}>
            <Card title="最新新闻" className="news-card">
              <List
                dataSource={news}
                renderItem={(item) => (
                  <List.Item key={item.id} className="news-item">
                    <List.Item.Meta
                      title={<a href="#">{item.title}</a>}
                      description={
                        <div>
                          <Text type="secondary">发布时间：{item.publishTime}</Text>
                          <p className="news-summary">{item.content.substring(0, 100)}...</p>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
              <div className="news-more">
                <Button type="link">查看更多新闻</Button>
              </div>
            </Card>
          </Col>
        </Row>
      </div>
    </MainLayout>
  );
};

export default HomePage;
