import React, { useState, useEffect } from 'react';
import { Button, Card, Form, DatePicker, Table, Modal, Tabs, message } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import MainLayout from '../components/Layout/MainLayout';

import GiftApprovalDetail from '../components/GiftApproval/GiftApprovalDetail';
import '../styles/GiftApprovalPage.css';

const { RangePicker } = DatePicker;
const { TabPane } = Tabs;

// 礼品申请数据接口
interface GiftApplication {
  id: number;
  customerName: string;
  giftName: string;
  quantity: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  applicantName: string;
  approveName?: string;
  approveComment?: string;
  approveTime?: string;
  createdTime: string;
}

const GiftApprovalPage: React.FC = () => {
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('pending'); // pending: 待审批, approved: 已审批
  const [applications, setApplications] = useState<GiftApplication[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<GiftApplication | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  // 模拟数据加载
  const fetchApplications = async (_params?: any) => {
    setLoading(true);
    try {
      // 实际项目中，这里会调用API获取真实数据
      // const response = await apiClient.get('/gifts/applications', { params });
      // setApplications(response.data.data);
      // setTotal(response.data.total);

      // 模拟数据
      const mockData: GiftApplication[] = Array.from({ length: activeTab === 'pending' ? 8 : 12 }, (_, index) => ({
        id: index + 1,
        customerName: `客户${index + 1}`,
        giftName: `礼品${index % 3 + 1}`,
        quantity: index + 1,
        reason: `申请理由${index + 1}`,
        status: activeTab === 'pending' ? 'pending' : ['approved', 'rejected'][index % 2] as any,
        applicantName: `申请人${(index % 3) + 1}`,
        approveName: activeTab === 'pending' ? undefined : `审批人${(index % 2) + 1}`,
        approveComment: activeTab === 'pending' ? undefined : `审批意见${index + 1}`,
        approveTime: activeTab === 'pending' ? undefined : `2026-01-${String(index + 1).padStart(2, '0')}T10:00:00`,
        createdTime: `2026-01-${String(index + 1).padStart(2, '0')}T09:00:00`,
      }));

      setApplications(mockData.slice((page - 1) * pageSize, page * pageSize));
      setTotal(mockData.length);
    } catch (error) {
      message.error('获取礼品申请失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications({ status: activeTab === 'pending' ? 'pending' : undefined });
  }, [activeTab, page, pageSize]);

  // 处理标签页切换
  const handleTabChange = (key: string) => {
    setActiveTab(key);
    setPage(1); // 切换标签页时重置到第一页
  };

  // 处理搜索
  const handleSearch = (values: any) => {
    const params = {
      ...values,
      status: activeTab === 'pending' ? 'pending' : undefined,
      page,
      size: pageSize,
    };
    fetchApplications(params);
  };

  // 处理重置
  const handleReset = () => {
    form.resetFields();
    fetchApplications({ status: activeTab === 'pending' ? 'pending' : undefined, page, size: pageSize });
  };

  // 处理查看详情
  const handleViewDetail = (record: GiftApplication) => {
    setSelectedApplication(record);
    setIsDetailModalVisible(true);
  };

  // 处理审批完成
  const handleApprovalComplete = () => {
    setIsDetailModalVisible(false);
    fetchApplications({ status: activeTab === 'pending' ? 'pending' : undefined, page, size: pageSize });
  };

  // 表格列配置
  const columns = [
    {
      title: '申请ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
    },
    {
      title: '申请人',
      dataIndex: 'applicantName',
      key: 'applicantName',
    },
    {
      title: '领用人',
      dataIndex: 'customerName',
      key: 'customerName',
    },
    {
      title: '总金额',
      dataIndex: 'quantity',
      key: 'amount',
      render: (quantity: number) => `¥${quantity * 100}`,
    },
    {
      title: '计划领用日期',
      dataIndex: 'createdTime',
      key: 'plannedDate',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: '目的类型',
      dataIndex: 'reason',
      key: 'purposeType',
      ellipsis: true,
      width: 150,
    },
    {
      title: '关联拜访记录ID',
      dataIndex: 'id',
      key: 'visitId',
      width: 150,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        let statusText = '';
        let statusClass = '';
        switch (status) {
          case 'pending':
            statusText = '待审批';
            statusClass = 'status-pending';
            break;
          case 'approved':
            statusText = '已通过';
            statusClass = 'status-approved';
            break;
          case 'rejected':
            statusText = '已驳回';
            statusClass = 'status-rejected';
            break;
          default:
            statusText = status;
            statusClass = '';
        }
        return <span className={`status-tag ${statusClass}`}>{statusText}</span>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdTime',
      key: 'createdTime',
      render: (time: string) => new Date(time).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: GiftApplication) => (
        <Button
          type="text"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetail(record)}
          className="view-button"
        >
          查看详情
        </Button>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="gift-approval-page">
        <Card title="礼品审批" className="approval-card">
          <Tabs activeKey={activeTab} onChange={handleTabChange} className="approval-tabs">
            <TabPane tab="待审批列表" key="pending">
              {/* 筛选搜索区 */}
              <Card className="filter-card">
                <Form
                  form={form}
                  layout="inline"
                  onFinish={handleSearch}
                >
                  <Form.Item name="dateRange" label="时间区间">
                    <RangePicker />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit">
                      搜索
                    </Button>
                  </Form.Item>
                  <Form.Item>
                    <Button htmlType="button" onClick={handleReset}>
                      重置
                    </Button>
                  </Form.Item>
                </Form>
              </Card>

              {/* 数据列表区 */}
              <div className="table-container">
                <div className="record-count">记录数量: {total}条</div>
                <Table
                  columns={columns}
                  dataSource={applications}
                  rowKey="id"
                  loading={loading}
                  pagination={false}
                  scroll={{ x: 1000 }}
                />

                {/* 分页控件 */}
                <div className="pagination">
                  <Button
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    上一页
                  </Button>
                  <span className="page-info">
                    {page} / {Math.ceil(total / pageSize)}页，每页{pageSize}条
                  </span>
                  <Button
                    disabled={page >= Math.ceil(total / pageSize)}
                    onClick={() => setPage(page + 1)}
                  >
                    下一页
                  </Button>
                </div>
              </div>
            </TabPane>
            <TabPane tab="已审批列表" key="approved">
              {/* 筛选搜索区 */}
              <Card className="filter-card">
                <Form
                  form={form}
                  layout="inline"
                  onFinish={handleSearch}
                >
                  <Form.Item name="dateRange" label="时间区间">
                    <RangePicker />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit">
                      搜索
                    </Button>
                  </Form.Item>
                  <Form.Item>
                    <Button htmlType="button" onClick={handleReset}>
                      重置
                    </Button>
                  </Form.Item>
                </Form>
              </Card>

              {/* 数据列表区 */}
              <div className="table-container">
                <div className="record-count">记录数量: {total}条</div>
                <Table
                  columns={columns}
                  dataSource={applications}
                  rowKey="id"
                  loading={loading}
                  pagination={false}
                  scroll={{ x: 1000 }}
                />

                {/* 分页控件 */}
                <div className="pagination">
                  <Button
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    上一页
                  </Button>
                  <span className="page-info">
                    {page} / {Math.ceil(total / pageSize)}页，每页{pageSize}条
                  </span>
                  <Button
                    disabled={page >= Math.ceil(total / pageSize)}
                    onClick={() => setPage(page + 1)}
                  >
                    下一页
                  </Button>
                </div>
              </div>
            </TabPane>
          </Tabs>
        </Card>

        {/* 审批详情模态框 */}
        <Modal
          title="礼品申请审批"
          open={isDetailModalVisible}
          onCancel={() => setIsDetailModalVisible(false)}
          footer={null}
          width={800}
        >
          {selectedApplication && (
            <GiftApprovalDetail
              application={selectedApplication}
              onClose={() => setIsDetailModalVisible(false)}
              onApprovalComplete={handleApprovalComplete}
            />
          )}
        </Modal>
      </div>
    </MainLayout>
  );
};

export default GiftApprovalPage;
