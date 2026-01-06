import React, { useState } from 'react';
import { 
  Form, 
  Input, 
  DatePicker, 
  Select, 
  Button, 
  Card, 
  Space, 
  InputNumber,
  Table,
  message,
  Tag
} from 'antd';
import { 
  MinusCircleOutlined, 
  PlusOutlined, 
  SaveOutlined, 
  ArrowLeftOutlined,
  ShoppingCartOutlined 
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { giftAPI } from '../../api/giftAPI';
import { GiftItem, CreateGiftApplicationRequest } from '../../types/gift';
import { useAuthStore } from '../../stores/authStore';

const { Option } = Select;

const GiftApplicationCreate: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [giftItems, setGiftItems] = useState<GiftItem[]>([
    { id: 'new-1', name: '', quantity: 1, unitPrice: 0, subtotal: 0 }
  ]);
  const [totalAmount, setTotalAmount] = useState(0);

  // Gift options based on PRD
  const giftOptions = [
    { id: 'G001', name: '精美笔记本', price: 25.00 },
    { id: 'G002', name: '定制雨伞', price: 45.00 },
    { id: 'G003', name: '品牌保温杯', price: 80.00 },
    { id: 'G004', name: '商务笔筒', price: 35.00 },
    { id: 'G005', name: '高档茶叶', price: 120.00 },
    { id: 'G006', name: '精美台历', price: 15.00 }
  ];

  // Recipient options (in a real app, this would come from an API)
  const recipientOptions = [
    '张三',
    '李四',
    '王五',
    '赵六'
  ];

  // Update subtotal and total when gift items change
  useEffect(() => {
    let newTotal = 0;
    const updatedItems = giftItems.map(item => {
      const selectedGift = giftOptions.find(g => g.name === item.name);
      const unitPrice = selectedGift ? selectedGift.price : 0;
      const subtotal = item.quantity * unitPrice;
      newTotal += subtotal;
      return {
        ...item,
        unitPrice,
        subtotal
      };
    });
    setGiftItems(updatedItems);
    setTotalAmount(newTotal);
  }, [giftItems]);

  const addGiftItem = () => {
    const newId = `new-${Date.now()}`;
    setGiftItems([...giftItems, { id: newId, name: '', quantity: 1, unitPrice: 0, subtotal: 0 }]);
  };

  const removeGiftItem = (index: number) => {
    if (giftItems.length === 1) {
      message.warning('至少需要一个礼品项目');
      return;
    }
    const newItems = [...giftItems];
    newItems.splice(index, 1);
    setGiftItems(newItems);
  };

  const handleGiftChange = (index: number, name: string) => {
    const newItems = [...giftItems];
    newItems[index].name = name;
    setGiftItems(newItems);
  };

  const handleQuantityChange = (index: number, quantity: number) => {
    const newItems = [...giftItems];
    newItems[index].quantity = quantity || 1; // Ensure quantity is at least 1
    setGiftItems(newItems);
  };

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      // Prepare the data
      const applicationData: CreateGiftApplicationRequest = {
        recipientId: values.recipientId,
        giftItems: giftItems.map(item => ({
          ...item,
          id: giftOptions.find(g => g.name === item.name)?.id || item.id
        })),
        totalAmount,
        plannedPickupDate: values.plannedPickupDate.format('YYYY-MM-DD'),
        purposeType: values.purposeType,
        relatedVisitId: values.relatedVisitId || null,
      };

      // In a real app: await giftAPI.createApplication(applicationData);
      message.success('礼品申请创建成功');
      
      navigate('/gift-application');
    } catch (error) {
      message.error('创建礼品申请失败');
    } finally {
      setLoading(false);
    }
  };

  const onCancel = () => {
    navigate('/gift-application');
  };

  const columns = [
    {
      title: '礼品名称',
      dataIndex: 'name',
      key: 'name',
      render: (_: any, record: GiftItem, index: number) => (
        <Form.Item
          name={['giftItems', index, 'name']}
          rules={[{ required: true, message: '请选择礼品!' }]}
        >
          <Select
            placeholder="选择礼品"
            onChange={(value) => handleGiftChange(index, value)}
            style={{ width: '100%' }}
          >
            {giftOptions.map(option => (
              <Option key={option.id} value={option.name}>
                {option.name} (¥{option.price})
              </Option>
            ))}
          </Select>
        </Form.Item>
      ),
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (_: any, record: GiftItem, index: number) => (
        <Form.Item
          name={['giftItems', index, 'quantity']}
          rules={[{ required: true, message: '请输入数量!' }]}
        >
          <InputNumber 
            min={1} 
            defaultValue={1} 
            onChange={(value) => handleQuantityChange(index, value as number)}
            style={{ width: '100%' }}
          />
        </Form.Item>
      ),
    },
    {
      title: '单价',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      render: (price: number) => `¥${price.toFixed(2)}`,
    },
    {
      title: '小计',
      dataIndex: 'subtotal',
      key: 'subtotal',
      render: (subtotal: number) => `¥${subtotal.toFixed(2)}`,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: GiftItem, index: number) => (
        <Button
          type="link"
          danger
          icon={<MinusCircleOutlined />}
          onClick={() => removeGiftItem(index)}
          disabled={giftItems.length === 1}
        />
      ),
    },
  ];

  return (
    <div>
      <Card 
        title="新增礼品申请" 
        extra={
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={onCancel}
          >
            返回列表
          </Button>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
        >
          <Form.Item
            name="recipientId"
            label="领用人"
            rules={[{ required: true, message: '请选择领用人!' }]}
          >
            <Select placeholder="请选择领用人">
              {recipientOptions.map(option => (
                <Option key={option} value={option}>{option}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="purposeType"
            label="目的类型"
            rules={[{ required: true, message: '请选择目的类型!' }]}
          >
            <Select placeholder="请选择目的类型">
              <Option value="客户维护">客户维护</Option>
              <Option value="营销活动">营销活动</Option>
              <Option value="其他">其他</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="relatedVisitId"
            label="关联客户拜访记录ID"
          >
            <Input placeholder="请输入关联的客户拜访记录ID（可选）" />
          </Form.Item>

          <Form.Item
            name="plannedPickupDate"
            label="计划领用日期"
            rules={[{ required: true, message: '请选择计划领用日期!' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Card 
            title="礼品清单" 
            extra={
              <Button 
                type="dashed" 
                onClick={addGiftItem} 
                icon={<PlusOutlined />}
              >
                添加礼品
              </Button>
            }
          >
            <Table
              columns={columns}
              dataSource={giftItems}
              rowKey="id"
              pagination={false}
              footer={() => (
                <div style={{ textAlign: 'right', fontWeight: 'bold' }}>
                  总计: <Tag color="blue" style={{ fontSize: '16px' }}>¥{totalAmount.toFixed(2)}</Tag>
                </div>
              )}
            />
          </Card>

          <Form.Item style={{ marginTop: 24 }}>
            <Space>
              <Button 
                type="primary" 
                htmlType="submit" 
                icon={<SaveOutlined />} 
                loading={loading}
                disabled={totalAmount <= 0}
              >
                提交申请
              </Button>
              <Button onClick={onCancel}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default GiftApplicationCreate;