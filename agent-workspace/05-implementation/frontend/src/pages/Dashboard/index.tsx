/**
 * 仪表盘/首页组件
 */

import React from 'react';
import { Card, Row, Col, Statistic, Typography, Space } from 'antd';
import {
  CalendarOutlined,
  GiftOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title } = Typography;

/**
 * 仪表盘组件
 */
const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ padding: '24px' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Title level={2}>工作台</Title>

        {/* 统计卡片 */}
        <Row gutter={16}>
          <Col span={6}>
            <Card>
              <Statistic
                title="本月拜访记录"
                value={0}
                prefix={<CalendarOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="待审批礼品申请"
                value={0}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="本月礼品发放"
                value={0}
                prefix={<GiftOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="已完成拜访"
                value={0}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#13c2c2' }}
              />
            </Card>
          </Col>
        </Row>

        {/* 快捷入口 */}
        <Card title="快捷入口">
          <Space>
            <a onClick={() => navigate('/visits/create')}>新建拜访记录</a>
            <a onClick={() => navigate('/gifts/requisitions/create')}>新建礼品申请</a>
            <a onClick={() => navigate('/gifts/ledger')}>查看礼品台账</a>
          </Space>
        </Card>

        {/* 欢迎信息 */}
        <Card title="欢迎使用招财银行北京分行运营门户系统">
          <p>这是一个功能强大的运营管理系统，包含以下核心功能：</p>
          <ul>
            <li>拜访记录管理：记录客户拜访信息，跟踪拜访进度</li>
            <li>礼品申请管理：在线提交礼品申请，简化审批流程</li>
            <li>礼品台账管理：查看所有礼品发放历史记录</li>
          </ul>
          <p>请从左侧菜单选择您需要的功能模块。</p>
        </Card>
      </Space>
    </div>
  );
};

export default Dashboard;
