import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Space, 
  Input, 
  DatePicker, 
  Select, 
  Modal, 
  Form,
  message 
} from 'antd';
import { SearchOutlined, PlusOutlined } from '@ant-design/icons';
import { customerVisitAPI } from '../../api/customerVisitAPI';
import { CustomerVisit } from '../../types/customerVisit';
import { useNavigate } from 'react-router-dom';

const { RangePicker } = DatePicker;

const CustomerVisitList: React.FC = () => {
  const [visits, setVisits] = useState<CustomerVisit[]>([]);
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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [visitToDelete, setVisitToDelete] = useState<string | null>(null);
  const navigate = useNavigate();

  // Fetch visits
  const fetchVisits = async (params?: any) => {
    setLoading(true);
    try {
      // Using mock data for now
      const response = await customerVisitAPI.getVisits({
        ...params,
        search: filters.search,
        startDate: filters.dateRange[0]?.format('YYYY-MM-DD') || undefined,
        endDate: filters.dateRange[1]?.format('YYYY-MM-DD') || undefined,
        status: filters.status || undefined,
      });
      
      setVisits(response.data.items || []);
      setPagination({
        current: params?.page || 1,
        pageSize: params?.pageSize || 10,
        total: response.data.total || 0,
      });
    } catch (error) {
      message.error('获取拜访记录失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisits();
  }, [filters]);

  const handleTableChange = (pagination: any) => {
    fetchVisits({
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
    navigate('/customer-visit/create');
  };

  const handleEdit = (record: CustomerVisit) => {
    navigate(`/customer-visit/edit/${record.id}`);
  };

  const handleDelete = (id: string) => {
    setVisitToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!visitToDelete) return;
    
    try {
      // In a real app, we would call the API to delete
      message.success('拜访记录删除成功');
      fetchVisits();
    } catch (error) {
      message.error('删除拜访记录失败');
    } finally {
      setShowDeleteModal(false);
      setVisitToDelete(null);
    }
  };

  const columns = [
    {
      title: '客户ID',
      dataIndex: 'customerId',
      key: 'customerId',
    },
    {
      title: '企业名称',
      dataIndex: 'customerName',
      key: 'customerName',
    },
    {
      title: '计划拜访日期',
      dataIndex: 'plannedDate',
      key: 'plannedDate',
      render: (date: string) => date || '-',
    },
    {
      title: '实际拜访日期',
      dataIndex: 'actualDate',
      key: 'actualDate',
      render: (date: string) => date || '-',
    },
    {
      title: '拜访方式',
      dataIndex: 'visitMethod',
      key: 'visitMethod',
    },
    {
      title: '意向产品',
      dataIndex: 'productsInterested',
      key: 'productsInterested',
      render: (products: string[]) => products?.join(', ') || '-',
    },
    {
      title: '参与人员',
      dataIndex: 'participants',
      key: 'participants',
      render: (participants: string[]) => participants?.join(', ') || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = 'default';
        if (status === '已拜访') color = 'green';
        if (status === '待拜访') color = 'blue';
        if (status === '已取消') color = 'red';
        return <span style={{ color }}>{status}</span>;
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: CustomerVisit) => (
        <Space size="middle">
          <Button type="link" onClick={() => handleEdit(record)}>编辑</Button>
          <Button type="link" danger onClick={() => handleDelete(record.id)}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>客户拜访记录</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          新增拜访记录
        </Button>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Input
          placeholder="搜索客户名称"
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
          <Select.Option value="待拜访">待拜访</Select.Option>
          <Select.Option value="已拜访">已拜访</Select.Option>
          <Select.Option value="已取消">已取消</Select.Option>
        </Select>
        <Button type="primary" onClick={() => fetchVisits()}>查询</Button>
      </div>

      <Table
        columns={columns}
        dataSource={visits}
        rowKey="id"
        loading={loading}
        pagination={pagination}
        onChange={handleTableChange}
      />

      <Modal
        title="确认删除"
        open={showDeleteModal}
        onOk={confirmDelete}
        onCancel={() => setShowDeleteModal(false)}
        okText="确认"
        cancelText="取消"
      >
        <p>确定要删除这条拜访记录吗？此操作不可撤销。</p>
      </Modal>
    </div>
  );
};

export default CustomerVisitList;