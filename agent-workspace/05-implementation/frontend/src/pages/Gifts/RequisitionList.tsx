/**
 * 礼品申请单列表页
 */

import React, { useState, useCallback } from 'react';
import { Card, Table, Button, Space, Input, Select, DatePicker, Tag, message } from 'antd';
import { PlusOutlined, SearchOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import type { GiftRequisition, GiftRequisitionStatus } from '@/types/gift';
import { getGiftRequisitions } from '@/services/giftService';
import {
  GiftRequisitionStatusLabel,
  GiftRequisitionStatusColor,
  GiftRequisitionStatus as GiftRequisitionStatusEnum,
} from '@/types/gift';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

/**
 * 礼品申请单列表页组件
 */
const GiftRequisitionList: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState<GiftRequisition[]>([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [filters, setFilters] = useState<{
    status?: GiftRequisitionStatus;
    customer_company?: string;
    start_date?: string;
    end_date?: string;
  }>({});

  /**
   * 获取礼品申请单列表
   */
  const fetchRequisitions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getGiftRequisitions({
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
      message.error('获取礼品申请单列表失败');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, filters]);

  /**
   * 表格列定义
   */
  const columns: ColumnsType<GiftRequisition> = [
    {
      title: '申请单号',
      dataIndex: 'id',
      key: 'id',
      width: 200,
    },
    {
      title: '客户姓名',
      dataIndex: 'customer_name',
      key: 'customer_name',
      width: 120,
    },
    {
      title: '客户公司',
      dataIndex: 'customer_company',
      key: 'customer_company',
      width: 200,
    },
    {
      title: '申请部门',
      dataIndex: 'department',
      key: 'department',
      width: 150,
    },
    {
      title: '总金额',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 120,
      render: (amount: number) => `¥${amount.toLocaleString()}`,
    },
    {
      title: '申请日期',
      dataIndex: 'request_date',
      key: 'request_date',
      width: 120,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: GiftRequisitionStatus) => (
        <Tag color={GiftRequisitionStatusColor[status]}>
          {GiftRequisitionStatusLabel[status]}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/gifts/requisitions/${record.id}`)}
          >
            查看
          </Button>
          {record.status === GiftRequisitionStatusEnum.PENDING && (
            <Button
              type="link"
              onClick={() => navigate(`/gifts/requisitions/${record.id}/approve`)}
            >
              审批
            </Button>
          )}
        </Space>
      ),
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
    fetchRequisitions();
  };

  /**
   * 处理重置
   */
  const handleReset = () => {
    setFilters({});
    setPagination((prev) => ({ ...prev, current: 1 }));
  };

  React.useEffect(() => {
    fetchRequisitions();
  }, [fetchRequisitions]);

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
              placeholder="请选择状态"
              value={filters.status}
              onChange={(value) => handleFilterChange('status', value)}
              style={{ width: 150 }}
              allowClear
            >
              {Object.entries(GiftRequisitionStatusLabel).map(([key, label]) => (
                <Select.Option key={key} value={key}>
                  {label}
                </Select.Option>
              ))}
            </Select>
            <RangePicker
              placeholder={['开始日期', '结束日期']}
              onChange={handleDateRangeChange}
            />
            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
              搜索
            </Button>
            <Button onClick={handleReset}>重置</Button>
          </Space>

          {/* 操作按钮 */}
          <div style={{ textAlign: 'right' }}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/gifts/requisitions/create')}
            >
              新建礼品申请
            </Button>
          </div>

          {/* 表格 */}
          <Table
            columns={columns}
            dataSource={dataSource}
            rowKey="id"
            loading={loading}
            pagination={pagination}
            onChange={handleTableChange}
            scroll={{ x: 1400 }}
          />
        </Space>
      </Card>
    </div>
  );
};

export default GiftRequisitionList;
