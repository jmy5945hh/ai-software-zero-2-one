import React, { useState, useEffect } from 'react';
import { Button, Card, Form, Input, Select, DatePicker, Table, Modal, message } from 'antd';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import MainLayout from '../components/Layout/MainLayout';

import CustomerVisitForm from '../components/CustomerVisit/CustomerVisitForm';
import '../styles/CustomerVisitPage.css';

const { RangePicker } = DatePicker;
const { Option } = Select;

// 拜访记录数据接口
interface VisitRecord {
  id: number;
  customerName: string;
  visitDate: string;
  visitContent: string;
  customerContact: string;
  nextVisitPlan: string;
  createdBy: string;
  createdTime: string;
  updatedBy: string;
  updatedTime: string;
  status?: string; // 计划中、已完成、取消
}

const CustomerVisitPage: React.FC = () => {
  const [form] = Form.useForm();
  const [visitRecords, setVisitRecords] = useState<VisitRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<VisitRecord | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  // 模拟数据加载
  const fetchVisitRecords = async (_params?: any) => {
    setLoading(true);
    try {
      // 实际项目中，这里会调用API获取真实数据
      // const response = await apiClient.get('/visits', { params });
      // setVisitRecords(response.data.data);
      // setTotal(response.data.total);

      // 模拟数据
      const mockData: VisitRecord[] = Array.from({ length: 25 }, (_, index) => ({
        id: index + 1,
        customerName: `客户${index + 1}`,
        visitDate: `2026-01-${String(index + 1).padStart(2, '0')}T10:00:00`,
        visitContent: `拜访内容${index + 1}`,
        customerContact: `联系人${index + 1}`,
        nextVisitPlan: `下次拜访计划${index + 1}`,
        createdBy: `用户${(index % 3) + 1}`,
        createdTime: `2026-01-${String(index + 1).padStart(2, '0')}T09:00:00`,
        updatedBy: `用户${(index % 3) + 1}`,
        updatedTime: `2026-01-${String(index + 1).padStart(2, '0')}T11:00:00`,
        status: ['计划中', '已完成', '取消'][index % 3],
      }));

      setVisitRecords(mockData.slice((page - 1) * pageSize, page * pageSize));
      setTotal(mockData.length);
    } catch (error) {
      message.error('获取拜访记录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisitRecords();
  }, [page, pageSize]);

  // 处理搜索
  const handleSearch = (values: any) => {
    const params = {
      ...values,
      page,
      size: pageSize,
    };
    fetchVisitRecords(params);
  };

  // 处理重置
  const handleReset = () => {
    form.resetFields();
    fetchVisitRecords({ page, size: pageSize });
  };

  // 处理新增拜访记录
  const handleAddVisit = () => {
    setCurrentRecord(null);
    setIsModalVisible(true);
  };

  // 处理编辑拜访记录
  const handleEditVisit = (record: VisitRecord) => {
    setCurrentRecord(record);
    setIsModalVisible(true);
  };

  // 处理表单提交
  const handleFormSubmit = async () => {
    try {
      if (currentRecord) {
        // 编辑操作
        // await apiClient.put(`/visits/${currentRecord.id}`, values);
        message.success('拜访记录更新成功');
      } else {
        // 新增操作
        // await apiClient.post('/visits', values);
        message.success('拜访记录新增成功');
      }
      setIsModalVisible(false);
      fetchVisitRecords();
    } catch (error) {
      message.error(currentRecord ? '更新失败，请稍后重试' : '新增失败，请稍后重试');
    }
  };

  // 表格列配置
  const columns = [
    {
      title: '客户ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
    },
    {
      title: '企业名称',
      dataIndex: 'customerName',
      key: 'customerName',
    },
    {
      title: '计划拜访日期',
      dataIndex: 'visitDate',
      key: 'visitDate',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: '实际拜访日期',
      dataIndex: 'visitDate',
      key: 'actualVisitDate',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: '拜访方式',
      dataIndex: 'visitContent',
      key: 'visitContent',
      width: 150,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        let statusClass = '';
        switch (status) {
          case '计划中':
            statusClass = 'status-planned';
            break;
          case '已完成':
            statusClass = 'status-completed';
            break;
          case '取消':
            statusClass = 'status-cancelled';
            break;
          default:
            statusClass = '';
        }
        return <span className={`status-tag ${statusClass}`}>{status}</span>;
      },
    },
    {
      title: '创建人',
      dataIndex: 'createdBy',
      key: 'createdBy',
      width: 120,
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
      render: (_: any, record: VisitRecord) => (
        <Button
          type="text"
          icon={<EditOutlined />}
          onClick={() => handleEditVisit(record)}
          className="edit-button"
        >
          编辑
        </Button>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="customer-visit-page">
        <Card title="客户拜访管理" className="visit-card">
          {/* 操作按钮区 */}
          <div className="action-buttons">
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddVisit}>
              新增拜访记录
            </Button>
          </div>

          {/* 筛选搜索区 */}
          <Card className="filter-card">
            <Form
              form={form}
              layout="inline"
              onFinish={handleSearch}
              initialValues={{ status: 'all' }}
            >
              <Form.Item name="dateRange" label="时间区间">
                <RangePicker />
              </Form.Item>
              <Form.Item name="status" label="状态">
                <Select defaultValue="all">
                  <Option value="all">全部</Option>
                  <Option value="planned">计划中</Option>
                  <Option value="completed">已完成</Option>
                  <Option value="cancelled">取消</Option>
                </Select>
              </Form.Item>
              <Form.Item name="customerId" label="客户ID">
                <Input placeholder="请输入客户ID" />
              </Form.Item>
              <Form.Item name="participants" label="参与人员">
                <Select placeholder="请选择参与人员" mode="multiple">
                  <Option value="1">用户1</Option>
                  <Option value="2">用户2</Option>
                  <Option value="3">用户3</Option>
                </Select>
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
              dataSource={visitRecords}
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
        </Card>

        {/* 新增/编辑拜访记录模态框 */}
        <Modal
          title={currentRecord ? '编辑拜访记录' : '新增拜访记录'}
          open={isModalVisible}
          onCancel={() => setIsModalVisible(false)}
          footer={null}
          width={800}
        >
          <CustomerVisitForm
            initialValues={currentRecord || {}}
            onSubmit={handleFormSubmit}
            onCancel={() => setIsModalVisible(false)}
          />
        </Modal>
      </div>
    </MainLayout>
  );
};

export default CustomerVisitPage;
