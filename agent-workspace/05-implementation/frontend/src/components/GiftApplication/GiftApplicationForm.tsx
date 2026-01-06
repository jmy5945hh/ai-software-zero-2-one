import React, { useState } from 'react';
import { Form, Input, DatePicker, Select, Button, Row, Col, Table, InputNumber, Card } from 'antd';

const { Option } = Select;
const { TextArea } = Input;

interface GiftApplicationFormProps {
  onSubmit: (values: any) => void;
  onCancel: () => void;
}

// 礼品项接口
interface GiftItem {
  id: string;
  giftName: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

const GiftApplicationForm: React.FC<GiftApplicationFormProps> = ({ onSubmit, onCancel }) => {
  const [form] = Form.useForm();
  const [giftItems, setGiftItems] = useState<GiftItem[]>([]);
  const [giftName, setGiftName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  
  // 处理数量变化
  const handleQuantityChange = (value: number | null) => {
    if (value !== null) {
      setQuantity(value);
    }
  };
  
  // 处理单价变化
  const handleUnitPriceChange = (value: number | null) => {
    if (value !== null) {
      setUnitPrice(value);
    }
  };

  // 礼品列表数据
  const giftOptions = [
    { name: '礼品1', price: 100 },
    { name: '礼品2', price: 200 },
    { name: '礼品3', price: 300 },
  ];

  // 处理礼品名称选择
  const handleGiftNameChange = (value: string) => {
    setGiftName(value);
    const selectedGift = giftOptions.find(gift => gift.name === value);
    if (selectedGift) {
      setUnitPrice(selectedGift.price);
    } else {
      setUnitPrice(0);
    }
  };

  // 添加礼品到列表
  const handleAddGift = () => {
    if (!giftName || quantity <= 0 || unitPrice <= 0) {
      return;
    }

    const newGift: GiftItem = {
      id: Date.now().toString(),
      giftName,
      quantity,
      unitPrice,
      amount: quantity * unitPrice,
    };

    setGiftItems([...giftItems, newGift]);
    // 重置礼品输入
    setGiftName('');
    setQuantity(1);
    setUnitPrice(0);
  };

  // 删除礼品
  const handleDeleteGift = (id: string) => {
    setGiftItems(giftItems.filter(item => item.id !== id));
  };

  // 计算总金额
  const calculateTotalAmount = () => {
    return giftItems.reduce((total, item) => total + item.amount, 0);
  };

  // 处理表单提交
  const handleSubmit = () => {
    if (giftItems.length === 0) {
      alert('请至少添加一件礼品');
      return;
    }

    form.validateFields().then((values) => {
      const formData = {
        ...values,
        giftItems,
        totalAmount: calculateTotalAmount(),
      };
      onSubmit(formData);
    });
  };

  // 礼品列表列配置
  const giftColumns = [
    {
      title: '礼品名称',
      dataIndex: 'giftName',
      key: 'giftName',
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (quantity: number) => `${quantity}份`,
    },
    {
      title: '单价',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      render: (price: number) => `¥${price}`,
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number) => `¥${amount}`,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: GiftItem) => (
        <Button type="text" danger onClick={() => handleDeleteGift(record.id)}>
          删除
        </Button>
      ),
    },
  ];

  return (
    <Form form={form} layout="vertical" className="gift-application-form">
      <Row gutter={[16, 16]}>
        {/* 基本信息区 */}
        <Col xs={24} sm={12}>
          <Form.Item
            name="applicantName"
            label="申请人"
            initialValue="当前用户"
          >
            <Input disabled />
          </Form.Item>

          <Form.Item
            name="customerName"
            label="领用人"
            rules={[{ required: true, message: '请输入领用人' }]}
          >
            <Input placeholder="请输入领用人" />
          </Form.Item>

          <Form.Item
            name="plannedDate"
            label="计划领用日期"
            rules={[{ required: true, message: '请选择计划领用日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="purposeType"
            label="目的类型"
            rules={[{ required: true, message: '请选择目的类型' }]}
          >
            <Select placeholder="请选择目的类型">
              <Option value="客户拜访">客户拜访</Option>
              <Option value="节日礼品">节日礼品</Option>
              <Option value="其他">其他</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="visitId"
            label="关联拜访记录ID"
          >
            <Input placeholder="请输入关联拜访记录ID" />
          </Form.Item>

          <Form.Item
            name="reason"
            label="申请理由"
            rules={[{ required: true, message: '请输入申请理由' }]}
          >
            <TextArea rows={4} placeholder="请输入申请理由" />
          </Form.Item>
        </Col>

        {/* 礼品列表区 */}
        <Col xs={24} sm={12}>
          <Card title="礼品列表" className="gift-list-card">
            <div className="add-gift-section">
              <Row gutter={[8, 8]}>
                <Col xs={24} sm={12}>
                  <Select
                    placeholder="请选择礼品名称"
                    value={giftName}
                    onChange={handleGiftNameChange}
                    style={{ width: '100%' }}
                  >
                    {giftOptions.map(gift => (
                      <Option key={gift.name} value={gift.name}>
                        {gift.name}
                      </Option>
                    ))}
                  </Select>
                </Col>
                <Col xs={24} sm={4}>
                  <InputNumber
                    placeholder="数量"
                    value={quantity}
                    onChange={handleQuantityChange}
                    min={1}
                    style={{ width: '100%' }}
                  />
                </Col>
                <Col xs={24} sm={4}>
                  <InputNumber
                    placeholder="单价"
                    value={unitPrice}
                    onChange={handleUnitPriceChange}
                    min={0}
                    style={{ width: '100%' }}
                    disabled
                  />
                </Col>
                <Col xs={24} sm={4}>
                  <Button type="primary" onClick={handleAddGift} block>
                    添加礼品
                  </Button>
                </Col>
              </Row>
            </div>

            <div className="gift-items-section">
              <h5>已添加礼品列表</h5>
              {giftItems.length > 0 ? (
                <Table
                  dataSource={giftItems}
                  columns={giftColumns}
                  rowKey="id"
                  pagination={false}
                  size="small"
                />
              ) : (
                <div className="no-gifts">暂无添加礼品</div>
              )}
            </div>

            <div className="total-amount-section">
              <h5>总金额: <span className="total-amount">¥{calculateTotalAmount()}</span></h5>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 操作按钮区 */}
      <Row gutter={[16, 0]} justify="end" style={{ marginTop: 16 }}>
        <Col>
          <Button onClick={onCancel} style={{ marginRight: 8 }}>
            取消
          </Button>
          <Button type="primary" onClick={handleSubmit}>
            提交审批
          </Button>
        </Col>
      </Row>
    </Form>
  );
};

export default GiftApplicationForm;
