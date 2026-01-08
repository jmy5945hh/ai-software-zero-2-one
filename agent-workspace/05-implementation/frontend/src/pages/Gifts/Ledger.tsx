/**
 * 礼品台账页组件
 */

import React, { useState, useCallback } from 'react';
import { Card, Table, Button, Space, Input, Select, DatePicker, message } from 'antd';
import { SearchOutlined, DownloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { GiftLedger } from '@/types/gift';
import { getGiftLedger } from '@/services/giftService';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

/**
 * 礼品台账页组件
 */
const GiftLedgerPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState<GiftLedger[]>([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [filters, setFilters] = useState<{
    start_date?: string;
    end_date?: string;
    customer_company?: string;
    gift_category?: string;
  }>({});

  /**
   * 获取礼品台账
   */
  const fetchLedger = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getGiftLedger({
        page: pagination.current,
        page_size: pagination.pageSize,
        ...filters,
      });
      setDataSource(response.items);
      setPagination((prev) => ({
        ...prev,
        total: response.total,
      }));
    } catch (error) {
      message.error('获取礼品台账失败');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, filters]);

  /**
   * 表格列定义
   */
  const columns: ColumnsType<GiftLedger> = [
    {
      title: '礼品名称',
      dataIndex: 'gift_name',
      key: 'gift_name',
      width: 150,
    },
    {
      title: '礼品分类',
      dataIndex: 'category',
      key: 'category',
      width: 120,
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 80,
    },
    {
      title: '单价',
      dataIndex: 'unit_price',
      key: 'unit_price',
      width: 100,
      render: (price: number) => `¥${price.toFixed(2)}`,
    },
    {
      title: '总金额',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 120,
      render: (amount: number) => `¥${amount.toFixed(2)}`,
    },
    {
      title: '接收人',
      dataIndex: 'recipient',
      key: 'recipient',
      width: 120,
    },
    {
      title: '客户公司',
      dataIndex: 'customer_company',
      key: 'customer_company',
      width: 200,
    },
    {
      title: '发放日期',
      dataIndex: 'issued_date',
      key: 'issued_date',
      width: 120,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
    },
    {
      title: '申请人',
      dataIndex: 'applicant_name',
      key: 'applicant_name',
      width: 120,
    },
    {
      title: '审批人',
      dataIndex: 'approver_name',
      key: 'approver_name',
      width: 120,
    },
  ];

  /**
   * 处理表格分页变化
   */
  const handleTableChange = (newPagination: any) => {
    setPagination((prev) => ({
      ...prev,
      current: newPagination.current,
      pageSize: newPagination.pageSize,
    }));
  };

  /**
   * 处理筛选变化
   */
  const handleFilterChange = (key: string, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
    setPagination((prev) => ({ ...prev, current: 1 }));
  };

  /**
   * 处理日期范围变化
   */
  const handleDateRangeChange = (dates: any) => {
    if (dates && dates.length === 2) {
      setFilters((prev) => ({
        ...prev,
        start_date: dates[0].format('YYYY-MM-DD'),
        end_date: dates[1].format('YYYY-MM-DD'),
      }));
    } else {
      setFilters((prev) => ({
        ...prev,
        start_date: undefined,
        end_date: undefined,
      }));
    }
    setPagination((prev) => ({ ...prev, current: 1 }));
  };

  /**
   * 处理搜索
   */
  const handleSearch = () => {
    fetchLedger();
  };

  /**
   * 处理重置
   */
  const handleReset = () => {
    setFilters({});
    setPagination((prev) => ({ ...prev, current: 1 }));
  };

  /**
   * 处理导出（预留功能）
   */
  const handleExport = () => {
    message.info('导出功能待实现');
  };

  React.useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* 筛选区域 */}
          <Space wrap>
            <Input
              placeholder="请输入客户公司"
              value={filters.customer_company}
              onChange={(e) => handleFilterChange('customer_company', e.target.value)}
              style={{ width: 200 }}
              allowClear
            />
            <Select
              placeholder="请选择礼品分类"
              value={filters.gift_category}
              onChange={(value) => handleFilterChange('gift_category', value)}
              style={{ width: 150 }}
              allowClear
            >
              <Select.Option value="食品类">食品类</Select.Option>
              <Select.Option value="日用品">日用品</Select.Option>
              <Select.Option value="电子产品">电子产品</Select.Option>
              <Select.Option value="其他">其他</Select.Option>
            </Select>
            <RangePicker
              placeholder={['开始日期', '结束日期']}
              onChange={handleDateRangeChange}
            />
            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
              搜索
            </Button>
            <Button onClick={handleReset}>重置</Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              导出
            </Button>
          </Space>

          {/* 表格 */}
          <Table
            columns={columns}
            dataSource={dataSource}
            rowKey="id"
            loading={loading}
            pagination={pagination}
            onChange={handleTableChange}
            scroll={{ x: 1600 }}
          />
        </Space>
      </Card>
    </div>
  );
};

export default GiftLedgerPage;
