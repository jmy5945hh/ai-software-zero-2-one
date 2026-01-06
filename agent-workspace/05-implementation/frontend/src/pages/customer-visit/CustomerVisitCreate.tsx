import React, { useState, useEffect } from 'react';
import { 
  ProForm,
  ProFormText,
  ProFormDatePicker,
  ProFormSelect,
  ProFormTextArea,
  ProFormCheckbox,
  ProFormDigit
} from '@ant-design/pro-components';
import { Button, Card, Space, message } from 'antd';
import { SaveOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { customerVisitAPI } from '../../api/customerVisitAPI';
import { CustomerVisit, CreateCustomerVisitRequest } from '../../types/customerVisit';
import { useAuthStore } from '../../stores/authStore';

const CustomerVisitCreate: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(false);
  const [visitData, setVisitData] = useState<CustomerVisit | null>(null);
  const { user } = useAuthStore();

  // Product options based on PRD
  const productOptions = [
    { label: '理财产品A', value: '理财产品A' },
    { label: '理财产品B', value: '理财产品B' }, 
    { label: '基金A', value: '基金A' },
    { label: '基金B', value: '基金B' },
    { label: '保险产品C', value: '保险产品C' },
    { label: '信托产品D', value: '信托产品D' }
  ];

  // Participant options (in a real app, this would come from an API)
  const participantOptions = [
    { label: '张三', value: '张三' },
    { label: '李四', value: '李四' },
    { label: '王五', value: '王五' },
    { label: '赵六', value: '赵六' }
  ];

  // Fetch visit data if editing
  useEffect(() => {
    if (id) {
      loadVisitData();
    }
  }, [id]);

  const loadVisitData = async () => {
    setLoading(true);
    try {
      // In a real app, we would fetch the visit data from the API
      // For now, using mock data
      const mockVisit: CustomerVisit = {
        id: '1',
        customerId: 'CUST001',
        customerName: '北京科技有限公司',
        plannedDate: '2024-01-20',
        actualDate: null,
        visitMethod: '面访',
        productsInterested: ['理财产品A', '基金B'],
        participants: ['张三', user?.realName || ''],
        status: '待拜访',
        visitNotes: '客户对理财产品A表现出浓厚兴趣',
        creatorId: '1',
        createdAt: '2024-01-15',
        updatedAt: '2024-01-15'
      };
      setVisitData(mockVisit);
    } catch (error) {
      message.error('获取拜访记录失败');
    } finally {
      setLoading(false);
    }
  };

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      // Prepare the data
      const visitData: CreateCustomerVisitRequest = {
        customerId: values.customerId,
        customerName: values.customerName,
        plannedDate: values.plannedDate.format('YYYY-MM-DD'),
        visitMethod: values.visitMethod,
        productsInterested: values.productsInterested || [],
        participants: values.participants || [],
        status: '待拜访', // Default status for new visits
        visitNotes: values.visitNotes || '',
      };

      if (id) {
        // Update existing visit
        // In a real app: await customerVisitAPI.updateVisit(id, visitData);
        message.success('拜访记录更新成功');
      } else {
        // Create new visit
        // In a real app: await customerVisitAPI.createVisit(visitData);
        message.success('拜访记录创建成功');
      }
      
      navigate('/customer-visit');
    } catch (error) {
      message.error(id ? '更新拜访记录失败' : '创建拜访记录失败');
    } finally {
      setLoading(false);
    }
  };

  const onCancel = () => {
    navigate('/customer-visit');
  };

  return (
    <div>
      <Card 
        title={id ? "编辑拜访记录" : "新增拜访记录"} 
        extra={
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={onCancel}
          >
            返回列表
          </Button>
        }
      >
        <ProForm
          onFinish={onFinish}
          initialValues={{
            visitMethod: '面访',
            status: '待拜访',
            participants: [user?.realName || ''] // Default to current user
          }}
          submitter={{
            render: (_, dom) => (
              <Space>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  icon={<SaveOutlined />} 
                  loading={loading}
                >
                  {id ? '更新记录' : '创建记录'}
                </Button>
                <Button onClick={onCancel}>取消</Button>
              </Space>
            ),
          }}
        >
          <ProFormText
            name="customerId"
            label="客户ID"
            rules={[{ required: true, message: '请输入客户ID!' }]}
            placeholder="请输入客户ID"
          />

          <ProFormText
            name="customerName"
            label="企业名称"
            rules={[{ required: true, message: '请输入企业名称!' }]}
            placeholder="请输入企业名称"
          />

          <ProFormDatePicker
            name="plannedDate"
            label="计划拜访日期"
            rules={[{ required: true, message: '请选择计划拜访日期!' }]}
            width="md"
          />

          <ProFormDatePicker
            name="actualDate"
            label="实际拜访日期"
            width="md"
          />

          <ProFormSelect
            name="visitMethod"
            label="拜访方式"
            rules={[{ required: true, message: '请选择拜访方式!' }]}
            options={[
              { label: '电话', value: '电话' },
              { label: '面访', value: '面访' },
              { label: '视频', value: '视频' }
            ]}
            placeholder="请选择拜访方式"
          />

          <ProFormCheckbox.Group
            name="productsInterested"
            label="意向理财产品"
            options={productOptions}
          />

          <ProFormCheckbox.Group
            name="participants"
            label="参与人员"
            options={participantOptions}
          />

          <ProFormTextArea
            name="visitNotes"
            label="拜访备注"
            placeholder="请输入拜访备注"
            fieldProps={{
              rows: 4
            }}
          />
        </ProForm>
      </Card>
    </div>
  );
};

export default CustomerVisitCreate;