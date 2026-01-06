import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Space, 
  Input, 
  DatePicker, 
  Select, 
  message 
} from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { giftAPI } from '../../api/giftAPI';
import { GiftLedger } from '../../types/gift';

const { RangePicker } = DatePicker;

const GiftLedgerList: React.FC = () => {
  const [ledgers, setLedgers] = useState<GiftLedger[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [filters, setFilters] = useState({
    search: '',
    dateRange: [] as any[],
    giftType: '',
    pickupPerson: '',
  });

  // Fetch ledger records
  const fetchLedgers = async (params?: any) => {
    setLoading(true);
    try {
      // Using mock data for now
      const response = await giftAPI.getLedger({
        ...params,
        search: filters.search,
        startDate: filters.dateRange[0]?.format('YYYY-MM-DD') || undefined,
        endDate: filters.dateRange[1]?.format('YYYY-MM-DD') || undefined,
        giftType: filters.giftType || undefined,
        pickupPerson: filters.pickupPerson || undefined,
      });
      
      setLedgers(response.data.items || []);
      setPagination({
        current: params?.page || 1,
        pageSize: params?.pageSize || 10,
        total: response.data.total || 0,
      });
    } catch (error) {
      message.error('获取礼品台账失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedgers();
  }, [filters]);

  const handleTableChange = (pagination: any) => {
    fetchLedgers({
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

  const handleGiftTypeChange = (value: string) => {
    setFilters({ ...filters, giftType: value });
  };

  const handlePickupPersonChange = (value: string) => {
    setFilters({ ...filters, pickupPerson: value });
  };

  const columns = [
    {
      title: '礼品类型',
      dataIndex: 'giftType',
      key: 'giftType',
    },
    {
      title: '礼品名称',
      dataIndex: 'giftName',
      key: 'giftName',
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
    },
    {
      title: '单价',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      render: (price: number) => `¥${price.toFixed(2)}`,
    },
    {
      title: '总价',
      dataIndex: 'totalPrice',
      key: 'totalPrice',
      render: (price: number) => `¥${price.toFixed(2)}`,
    },
    {
      title: '领用日期',
      dataIndex: 'pickupDate',
      key: 'pickupDate',
    },
    {
      title: '领用人员',
      dataIndex: 'pickupPerson',
      key: 'pickupPerson',
    },
    {
      title: '用途',
      dataIndex: 'purpose',
      key: 'purpose',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = 'default';
        if (status === '已领用') color = 'green';
        if (status === '已作废') color = 'red';
        return <span style={{ color }}>{status}</span>;
      },
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2>礼品台账</h2>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Input
          placeholder="搜索礼品名称"
          prefix={<SearchOutlined />}
          style={{ width: 200 }}
          onPressEnter={(e) => handleSearch(e.currentTarget.value)}
          allowClear
        />
        <RangePicker onChange={handleDateRangeChange} style={{ width: 240 }} />
        <Select
          placeholder="选择礼品类型"
          style={{ width: 150 }}
          onChange={handleGiftTypeChange}
          allowClear
        >
          <Select.Option value="办公用品">办公用品</Select.Option>
          <Select.Option value="电子产品">电子产品</Select.Option>
          <Select.Option value="生活用品">生活用品</Select.Option>
        </Select>
        <Select
          placeholder="选择领用人员"
          style={{ width: 150 }}
          onChange={handlePickupPersonChange}
          allowClear
        >
          <Select.Option value="张三">张三</Select.Option>
          <Select.Option value="李四">李四</Select.Option>
          <Select.Option value="王五">王五</Select.Option>
        </Select>
        <Button type="primary" onClick={() => fetchLedgers()}>查询</Button>
      </div>

      <Table
        columns={columns}
        dataSource={ledgers}
        rowKey="id"
        loading={loading}
        pagination={pagination}
        onChange={handleTableChange}
      />
    </div>
  );
};

export default GiftLedgerList;