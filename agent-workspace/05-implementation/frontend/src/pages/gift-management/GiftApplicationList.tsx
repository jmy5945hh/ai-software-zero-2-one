import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Space, 
  Input, 
  DatePicker, 
  Select, 
  Modal, 
  Tag,
  message 
} from 'antd';
import { SearchOutlined, PlusOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { giftAPI } from '../../api/giftAPI';
import { GiftApplication } from '../../types/gift';
import { useNavigate } from 'react-router-dom';

const { RangePicker } = DatePicker;

const GiftApplicationList: React.FC = () => {
  const [applications, setApplications] = useState<GiftApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [filters, setFilters] = useState({
    search: '',
    dateRange: [] as any[],
    status: '',
  });
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [applicationToCancel, setApplicationToCancel] = useState<string | null>(null);
  const navigate = useNavigate();

  // Fetch applications
  const fetchApplications = async (params?: any) => {
    setLoading(true);
    try {
      // Using mock data for now
      const response = await giftAPI.getApplications({
        ...params,
        search: filters.search,
        startDate: filters.dateRange[0]?.format('YYYY-MM-DD') || undefined,
        endDate: filters.dateRange[1]?.format('YYYY-MM-DD') || undefined,
        status: filters.status || undefined,
      });
      
      setApplications(response.data.items || []);
      setPagination({
        current: params?.page || 1,
        pageSize: params?.pageSize || 10,
        total: response.data.total || 0,
      });
    } catch (error) {
      message.error('获取礼品申请失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, [filters]);

  const handleTableChange = (pagination: any) => {
    fetchApplications({
      page: pagination.current,
      pageSize: pagination.pageSize,
    });
  };

  const handleSearch = (value: string) => {
    setFilters({ ...filters, search: value });
  };

  const handleDateRangeChange = (dates: any) => {
    setFilters({ ...filters, dateRange: dates || [] });
  };

  const handleStatusChange = (value: string) => {
    setFilters({ ...filters, status: value });
  };

  const handleCreate = () => {
    navigate('/gift-application/create');
  };

  const handleCancel = (id: string) => {
    setApplicationToCancel(id);
    setShowCancelModal(true);
  };

  const confirmCancel = async () => {
    if (!applicationToCancel) return;
    
    try {
      // In a real app, we would call the API to cancel the application
      message.success('申请已取消');
      fetchApplications();
    } catch (error) {
      message.error('取消申请失败');
    } finally {
      setShowCancelModal(false);
      setApplicationToCancel(null);
    }
  };

  const columns = [
    {
      title: '申请编号',
      dataIndex: 'id',
      key: 'id',
    },
    {
      title: '申请人',
      dataIndex: 'applicantId',
      key: 'applicantId',
      render: (id: string) => `用户${id}`,
    },
    {
      title: '领用人',
      dataIndex: 'recipientId',
      key: 'recipientId',
      render: (id: string) => id ? `用户${id}` : '-',
    },
    {
      title: '申请日期',
      dataIndex: 'applicationDate',
      key: 'applicationDate',
    },
    {
      title: '计划领用日期',
      dataIndex: 'plannedPickupDate',
      key: 'plannedPickupDate',
    },
    {
      title: '目的类型',
      dataIndex: 'purposeType',
      key: 'purposeType',
    },
    {
      title: '总金额',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (amount: number) => `¥${amount.toFixed(2)}`,
    },
    {
      title: '状态',
      dataIndex: 'applicationStatus',
      key: 'applicationStatus',
      render: (status: string) => {
        let color = 'default';
        let icon = null;
        
        if (status === '待审批') {
          color = 'orange';
          icon = <CheckCircleOutlined />;
        } else if (status === '已通过') {
          color = 'green';
          icon = <CheckCircleOutlined />;
        } else if (status === '已驳回') {
          color = 'red';
          icon = <CloseCircleOutlined />;
        } else if (status === '已取消') {
          color = 'gray';
        }
        
        return (
          <Tag color={color} icon={icon}>
            {status}
          </Tag>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: GiftApplication) => (
        <Space size="middle">
          <Button 
            type="link" 
            disabled={record.applicationStatus !== '待审批'}
            onClick={() => handleCancel(record.id)}
          >
            取消
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>礼品申请列表</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          新增礼品申请
        </Button>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Input
          placeholder="搜索申请人"
          prefix={<SearchOutlined />}
          style={{ width: 200 }}
          onPressEnter={(e) => handleSearch(e.currentTarget.value)}
          allowClear
        />
        <RangePicker onChange={handleDateRangeChange} style={{ width: 240 }} />
        <Select
          placeholder="选择状态"
          style={{ width: 150 }}
          onChange={handleStatusChange}
          allowClear
        >
          <Select.Option value="待审批">待审批</Select.Option>
          <Select.Option value="已通过">已通过</Select.Option>
          <Select.Option value="已驳回">已驳回</Select.Option>
          <Select.Option value="已取消">已取消</Select.Option>
        </Select>
        <Button type="primary" onClick={() => fetchApplications()}>查询</Button>
      </div>

      <Table
        columns={columns}
        dataSource={applications}
        rowKey="id"
        loading={loading}
        pagination={pagination}
        onChange={handleTableChange}
      />

      <Modal
        title="确认取消"
        open={showCancelModal}
        onOk={confirmCancel}
        onCancel={() => setShowCancelModal(false)}
        okText="确认"
        cancelText="取消"
      >
        <p>确定要取消这个礼品申请吗？此操作不可撤销。</p>
      </Modal>
    </div>
  );
};

export default GiftApplicationList;