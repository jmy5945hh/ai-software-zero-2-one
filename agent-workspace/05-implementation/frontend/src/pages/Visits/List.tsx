/**
 * 拜访记录列表页
 */

import React, { useState, useCallback } from 'react';
import { Card, Table, Button, Space, Input, Select, DatePicker, Tag, message } from 'antd';
import { PlusOutlined, SearchOutlined, EyeOutlined, EditOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import type { Visit, VisitStatus, VisitMethod } from '@/types/visit';
import { getVisits } from '@/services/visitService';
import { VisitStatusLabel, VisitStatusColor, VisitMethodLabel } from '@/types/visit';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

/**
 * 拜访记录列表页组件
 */
const VisitList: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState<Visit[]>([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [filters, setFilters] = useState<{
    status?: VisitStatus;
    company_name?: string;
    start_date?: string;
    end_date?: string;
  }>({});

  /**
   * 获取拜访记录列表
   */
  const fetchVisits = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getVisits({
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
      message.error('获取拜访记录列表失败');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, filters]);

  /**
   * 表格列定义
   */
  const columns: ColumnsType<Visit> = [
    {
      title: '公司名称',
      dataIndex: 'company_name',
      key: 'company_name',
      width: 200,
    },
    {
      title: '计划日期',
      dataIndex: 'planned_date',
      key: 'planned_date',
      width: 120,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
    },
    {
      title: '实际日期',
      dataIndex: 'actual_date',
      key: 'actual_date',
      width: 120,
      render: (date: string) => (date ? dayjs(date).format('YYYY-MM-DD') : '-'),
    },
    {
      title: '拜访方式',
      dataIndex: 'visit_method',
      key: 'visit_method',
      width: 120,
      render: (method: VisitMethod) => VisitMethodLabel[method],
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: VisitStatus) => (
        <Tag color={VisitStatusColor[status]}>{VisitStatusLabel[status]}</Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
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
            onClick={() => navigate(`/visits/${record.visit_id}`)}
          >
            查看
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => navigate(`/visits/edit/${record.visit_id}`)}
          >
            编辑
          </Button>
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
    fetchVisits();
  };

  /**
   * 处理重置
   */
  const handleReset = () => {
    setFilters({});
    setPagination((prev) => ({ ...prev, current: 1 }));
  };

  React.useEffect(() => {
    fetchVisits();
  }, [fetchVisits]);

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* 筛选区域 */}
          <Space wrap>
            <Input
              placeholder="请输入公司名称"
              value={filters.company_name}
              onChange={(e) => handleFilterChange('company_name', e.target.value)}
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
              {Object.entries(VisitStatusLabel).map(([key, label]) => (
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
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/visits/create')}>
              新建拜访记录
            </Button>
          </div>

          {/* 表格 */}
          <Table
            columns={columns}
            dataSource={dataSource}
            rowKey="visit_id"
            loading={loading}
            pagination={pagination}
            onChange={handleTableChange}
            scroll={{ x: 1200 }}
          />
        </Space>
      </Card>
    </div>
  );
};

export default VisitList;
