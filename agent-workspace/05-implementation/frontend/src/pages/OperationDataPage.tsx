import React, { useState } from 'react';
import { Card, Row, Col, Radio, DatePicker, Button } from 'antd';
import { ArrowUpOutlined, ReloadOutlined } from '@ant-design/icons';
// 暂时移除echarts-for-react，后续安装类型声明后再添加
import MainLayout from '../components/Layout/MainLayout';

import '../styles/OperationDataPage.css';

const { RangePicker } = DatePicker;

const OperationDataPage: React.FC = () => {
  const [timeDimension, setTimeDimension] = useState('month'); // day, week, month
  const [loading, setLoading] = useState(false);
  
  // 关键指标数据
  const [keyMetrics] = useState({
    visitCount: 125,
    visitGrowth: 12,
    successCount: 48,
    successGrowth: 8,
    giftQuantity: 86,
    giftQuantityGrowth: 5,
    giftAmount: 43000,
    giftAmountGrowth: 3,
  });

  // 模拟数据加载
  const fetchData = async () => {
    setLoading(true);
    try {
      // 实际项目中，这里会调用API获取真实数据
      // 客户拜访统计
      // const visitStatsResponse = await apiClient.get('/stats/visit', {
      //   params: {
      //     timeDimension,
      //     startDate: dateRange[0].toISOString().split('T')[0],
      //     endDate: dateRange[1].toISOString().split('T')[0],
      //   },
      // });
      //
      // // 礼品申请统计
      // const giftStatsResponse = await apiClient.get('/stats/gift', {
      //   params: {
      //     timeDimension,
      //     startDate: dateRange[0].toISOString().split('T')[0],
      //     endDate: dateRange[1].toISOString().split('T')[0],
      //   },
      // });

      // 模拟数据延迟
      await new Promise(resolve => setTimeout(resolve, 1000));
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      setLoading(false);
    }
  };

  // 处理时间维度切换
  const handleTimeDimensionChange = (e: any) => {
    setTimeDimension(e.target.value);
  };

  // 处理日期范围变化
  const handleDateRangeChange = () => {
    // 暂时移除日期范围处理
  };

  // 处理手动刷新
  const handleRefresh = () => {
    fetchData();
  };

  // 图表配置暂时移除，后续修复

  return (
    <MainLayout>
      <div className="operation-data-page">
        <div className="page-header">
          <h1>运营数据大屏</h1>
          <Button type="text" icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>
            刷新数据
          </Button>
        </div>

        {/* 维度切换区 */}
        <Card className="dimension-switch-card">
          <div className="dimension-switch">
            <div className="time-dimension">
              <span className="label">时间维度:</span>
              <Radio.Group value={timeDimension} onChange={handleTimeDimensionChange}>
                <Radio.Button value="day">天</Radio.Button>
                <Radio.Button value="week">周</Radio.Button>
                <Radio.Button value="month">月</Radio.Button>
              </Radio.Group>
            </div>
            <div className="date-range">
              <span className="label">统计日期:</span>
              <RangePicker onChange={handleDateRangeChange} />
            </div>
          </div>
        </Card>

        {/* 关键指标概览区 */}
        <Row gutter={[16, 16]} className="key-metrics-row">
          <Col xs={24} sm={12} lg={6}>
            <Card className="metric-card">
              <div className="custom-statistic">
                <div className="statistic-title">客户拜访次数</div>
                <div className="statistic-content">
                  <ArrowUpOutlined 
                    style={{ color: keyMetrics.visitGrowth >= 0 ? '#52c41a' : '#ff4d4f', fontSize: '16px', marginRight: '4px' }}
                  />
                  <span style={{ fontSize: '28px', fontWeight: 'bold' }}>{keyMetrics.visitCount}</span>
                  <span style={{ marginLeft: '4px' }}>次</span>
                </div>
                <div className="statistic-extra">环比: {keyMetrics.visitGrowth >= 0 ? '+' : ''}{keyMetrics.visitGrowth}%</div>
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card className="metric-card">
              <div className="custom-statistic">
                <div className="statistic-title">营销成功次数</div>
                <div className="statistic-content">
                  <ArrowUpOutlined 
                    style={{ color: keyMetrics.successGrowth >= 0 ? '#52c41a' : '#ff4d4f', fontSize: '16px', marginRight: '4px' }}
                  />
                  <span style={{ fontSize: '28px', fontWeight: 'bold' }}>{keyMetrics.successCount}</span>
                  <span style={{ marginLeft: '4px' }}>次</span>
                </div>
                <div className="statistic-extra">环比: {keyMetrics.successGrowth >= 0 ? '+' : ''}{keyMetrics.successGrowth}%</div>
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card className="metric-card">
              <div className="custom-statistic">
                <div className="statistic-title">礼品领用数量</div>
                <div className="statistic-content">
                  <ArrowUpOutlined 
                    style={{ color: keyMetrics.giftQuantityGrowth >= 0 ? '#52c41a' : '#ff4d4f', fontSize: '16px', marginRight: '4px' }}
                  />
                  <span style={{ fontSize: '28px', fontWeight: 'bold' }}>{keyMetrics.giftQuantity}</span>
                  <span style={{ marginLeft: '4px' }}>份</span>
                </div>
                <div className="statistic-extra">环比: {keyMetrics.giftQuantityGrowth >= 0 ? '+' : ''}{keyMetrics.giftQuantityGrowth}%</div>
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card className="metric-card">
              <div className="custom-statistic">
                <div className="statistic-title">礼品总金额</div>
                <div className="statistic-content">
                  <ArrowUpOutlined 
                    style={{ color: keyMetrics.giftAmountGrowth >= 0 ? '#52c41a' : '#ff4d4f', fontSize: '16px', marginRight: '4px' }}
                  />
                  <span style={{ fontSize: '28px', fontWeight: 'bold' }}>{keyMetrics.giftAmount}</span>
                  <span style={{ marginLeft: '4px' }}>元</span>
                </div>
                <div className="statistic-extra">环比: {keyMetrics.giftAmountGrowth >= 0 ? '+' : ''}{keyMetrics.giftAmountGrowth}%</div>
              </div>
            </Card>
          </Col>
        </Row>

        {/* 客户拜访趋势图 */}
        <Card className="chart-card">
          <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fafafa', borderRadius: 8 }}>
            客户拜访趋势图（图表组件待修复）
          </div>
        </Card>

        {/* 礼品支出分析和分类占比 */}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card className="chart-card">
              <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fafafa', borderRadius: 8 }}>
                礼品支出分析（图表组件待修复）
              </div>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card className="chart-card">
              <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fafafa', borderRadius: 8 }}>
                礼品分类占比（图表组件待修复）
              </div>
            </Card>
          </Col>
        </Row>
      </div>
    </MainLayout>
  );
};

export default OperationDataPage;
