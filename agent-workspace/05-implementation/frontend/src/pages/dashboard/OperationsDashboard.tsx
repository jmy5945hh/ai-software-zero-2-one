import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Select, Divider } from 'antd';
import ReactECharts from 'echarts-for-react';
import { dashboardAPI } from '../api/dashboardAPI';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';

const { Option } = Select;

const OperationsDashboard: React.FC = () => {
  const [overviewData, setOverviewData] = useState({
    totalVisits: 0,
    successfulVisits: 0,
    totalGifts: 0,
    totalGiftAmount: 0
  });
  const [visitTrendsData, setVisitTrendsData] = useState({
    dates: [] as string[],
    visitCounts: [] as number[]
  });
  const [giftExpensesData, setGiftExpensesData] = useState({
    months: [] as string[],
    expenses: [] as number[]
  });
  const [giftExpensesByTypeData, setGiftExpensesByTypeData] = useState([] as { type: string; amount: number; percentage: number }[]);
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('month');
  const [loading, setLoading] = useState(true);

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch overview data
      const overviewRes = await dashboardAPI.getOverview();
      setOverviewData(overviewRes.data);

      // Fetch visit trends
      const trendsRes = await dashboardAPI.getVisitTrends({ timeRange });
      setVisitTrendsData(trendsRes.data);

      // Fetch gift expenses
      const expensesRes = await dashboardAPI.getGiftExpenses({ timeRange });
      setGiftExpensesData(expensesRes.data);

      // Fetch gift expenses by type
      const expensesByTypeRes = await dashboardAPI.getGiftExpensesByType();
      setGiftExpensesByTypeData(expensesByTypeRes.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [timeRange]);

  // Visit trends chart options
  const visitTrendsOption = {
    title: {
      text: '拜访次数趋势',
      left: 'center'
    },
    tooltip: {
      trigger: 'axis'
    },
    xAxis: {
      type: 'category',
      data: visitTrendsData.dates
    },
    yAxis: {
      type: 'value'
    },
    series: [{
      data: visitTrendsData.visitCounts,
      type: 'line',
      smooth: true,
      name: '拜访次数'
    }]
  };

  // Gift expenses chart options
  const giftExpensesOption = {
    title: {
      text: '礼品支出趋势',
      left: 'center'
    },
    tooltip: {
      trigger: 'axis'
    },
    xAxis: {
      type: 'category',
      data: giftExpensesData.months
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: '¥{value}'
      }
    },
    series: [{
      data: giftExpensesData.expenses,
      type: 'bar',
      name: '支出金额'
    }]
  };

  // Gift expenses by type chart options
  const giftExpensesByTypeOption = {
    title: {
      text: '礼品支出占比',
      left: 'center'
    },
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b}: ¥{c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left'
    },
    series: [{
      name: '支出占比',
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: false,
      label: {
        show: true,
        formatter: '{b}: ¥{c}'
      },
      emphasis: {
        label: {
          show: true,
          fontSize: '16',
          fontWeight: 'bold'
        }
      },
      labelLine: {
        show: true
      },
      data: giftExpensesByTypeData.map(item => ({
        value: item.amount,
        name: item.type
      }))
    }]
  };

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>运营数据大屏</h2>
        <Select 
          defaultValue="month" 
          style={{ width: 120 }} 
          onChange={(value: 'day' | 'week' | 'month') => setTimeRange(value)}
        >
          <Option value="day">按天</Option>
          <Option value="week">按周</Option>
          <Option value="month">按月</Option>
        </Select>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="拜访总次数"
              value={overviewData.totalVisits}
              precision={0}
              valueStyle={{ color: '#3f8600' }}
              prefix={<ArrowUpOutlined />}
              suffix="次"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="成功拜访次数"
              value={overviewData.successfulVisits}
              precision={0}
              valueStyle={{ color: '#1890ff' }}
              prefix={<ArrowUpOutlined />}
              suffix="次"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="礼品申请总数量"
              value={overviewData.totalGifts}
              precision={0}
              valueStyle={{ color: '#722ed1' }}
              prefix={<ArrowUpOutlined />}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="礼品支出总额"
              value={overviewData.totalGiftAmount}
              precision={2}
              valueStyle={{ color: '#cf1322' }}
              prefix={<ArrowUpOutlined />}
              suffix="元"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Card title="拜访次数趋势">
            <ReactECharts option={visitTrendsOption} style={{ height: '400px' }} />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="礼品支出趋势">
            <ReactECharts option={giftExpensesOption} style={{ height: '400px' }} />
          </Card>
        </Col>
      </Row>

      <Divider style={{ margin: '24px 0' }} />

      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card title="礼品支出占比">
            <ReactECharts option={giftExpensesByTypeOption} style={{ height: '400px' }} />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default OperationsDashboard;