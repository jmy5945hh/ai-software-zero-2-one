/**
 * 礼品申请表单组件
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Form,
  Input,
  DatePicker,
  Button,
  Space,
  message,
  Row,
  Col,
  Divider,
  Table,
  Select,
  InputNumber,
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { AvailableGift } from '@/types/gift';
import { createGiftRequisition, getAvailableGifts } from '@/services/giftService';

/**
 * 礼品明细项接口
 */
interface GiftFormItem {
  key: string;
  gift_id: string;
  gift_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

/**
 * 礼品申请表单组件
 */
const GiftRequisitionForm: React.FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [availableGifts, setAvailableGifts] = useState<AvailableGift[]>([]);
  const [giftItems, setGiftItems] = useState<GiftFormItem[]>([]);

  /**
   * 获取可用礼品列表
   */
  const fetchAvailableGifts = async () => {
    try {
      const data = await getAvailableGifts();
      setAvailableGifts(data);
    } catch (error) {
      message.error('获取可用礼品列表失败');
    }
  };

  useEffect(() => {
    fetchAvailableGifts();
  }, []);

  /**
   * 计算总金额
   */
  const calculateTotal = () => {
    return giftItems.reduce((sum, item) => sum + item.total_price, 0);
  };

  /**
   * 添加礼品明细项
   */
  const handleAddGiftItem = () => {
    const newItem: GiftFormItem = {
      key: Date.now().toString(),
      gift_id: '',
      gift_name: '',
      quantity: 1,
      unit_price: 0,
      total_price: 0,
    };
    setGiftItems([...giftItems, newItem]);
  };

  /**
   * 删除礼品明细项
   */
  const handleDeleteGiftItem = (key: string) => {
    setGiftItems(giftItems.filter((item) => item.key !== key));
  };

  /**
   * 更新礼品明细项
   */
  const handleUpdateGiftItem = (key: string, field: keyof GiftFormItem, value: any) => {
    const updatedItems = giftItems.map((item) => {
      if (item.key === key) {
        const updated = { ...item, [field]: value };

        // 如果修改了礼品ID，自动填充礼品名称和单价
        if (field === 'gift_id') {
          const gift = availableGifts.find((g) => g.gift_id === value);
          if (gift) {
            updated.gift_name = gift.gift_name;
            updated.unit_price = gift.unit_price;
            updated.total_price = updated.quantity * gift.unit_price;
          }
        }

        // 如果修改了数量，重新计算总价
        if (field === 'quantity') {
          updated.total_price = value * updated.unit_price;
        }

        return updated;
      }
      return item;
    });
    setGiftItems(updatedItems);
  };

  /**
   * 处理表单提交
   */
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // 验证至少有一个礼品明细项
      if (giftItems.length === 0) {
        message.error('请至少添加一个礼品明细项');
        return;
      }

      // 验证所有礼品明细项是否完整
      const invalidItem = giftItems.find(
        (item) => !item.gift_id || item.quantity <= 0
      );
      if (invalidItem) {
        message.error('请完善所有礼品明细项信息');
        return;
      }

      setSubmitting(true);

      const submitData = {
        ...values,
        visit_date: values.visit_date ? values.visit_date.format('YYYY-MM-DD') : undefined,
        items: giftItems.map((item) => ({
          gift_id: item.gift_id,
          gift_name: item.gift_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
        })),
      };

      await createGiftRequisition(submitData);
      message.success('创建礼品申请成功');
      navigate('/gifts/requisitions');
    } catch (error) {
      if (error instanceof Error) {
        message.error('创建礼品申请失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * 礼品明细项表格列定义
   */
  const itemColumns: ColumnsType<GiftFormItem> = [
    {
      title: '礼品名称',
      dataIndex: 'gift_id',
      key: 'gift_id',
      width: 250,
      render: (giftId: string, record: GiftFormItem) => (
        <Select
          style={{ width: '100%' }}
          value={giftId}
          onChange={(value) => handleUpdateGiftItem(record.key, 'gift_id', value)}
          placeholder="请选择礼品"
          showSearch
          optionFilterProp="children"
        >
          {availableGifts.map((gift) => (
            <Select.Option key={gift.gift_id} value={gift.gift_id}>
              {gift.gift_name} (库存: {gift.stock_quantity})
            </Select.Option>
          ))}
        </Select>
      ),
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 120,
      render: (quantity: number, record: GiftFormItem) => (
        <InputNumber
          min={1}
          value={quantity}
          onChange={(value) => handleUpdateGiftItem(record.key, 'quantity', value || 1)}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '单价',
      dataIndex: 'unit_price',
      key: 'unit_price',
      width: 120,
      render: (price: number) => `¥${price.toFixed(2)}`,
    },
    {
      title: '小计',
      dataIndex: 'total_price',
      key: 'total_price',
      width: 120,
      render: (price: number) => `¥${price.toFixed(2)}`,
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, record: GiftFormItem) => (
        <Button
          type="link"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleDeleteGiftItem(record.key)}
        >
          删除
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* 操作按钮 */}
          <div>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/gifts/requisitions')}
            >
              返回列表
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSubmit}
              loading={submitting}
              style={{ marginLeft: '16px' }}
            >
              保存
            </Button>
          </div>

          {/* 表单 */}
          <Form form={form} layout="vertical" autoComplete="off">
            <Divider orientation="left">基本信息</Divider>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="客户姓名"
                  name="customer_name"
                  rules={[{ required: true, message: '请输入客户姓名' }]}
                >
                  <Input placeholder="请输入客户姓名" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="客户公司"
                  name="customer_company"
                  rules={[{ required: true, message: '请输入客户公司' }]}
                >
                  <Input placeholder="请输入客户公司" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="拜访日期" name="visit_date">
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              label="申请理由"
              name="reason"
              rules={[{ required: true, message: '请输入申请理由' }]}
            >
              <Input.TextArea rows={3} placeholder="请输入申请理由" />
            </Form.Item>
          </Form>

          <Divider orientation="left">
            <Space>
              礼品明细
              <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleAddGiftItem}>
                添加礼品
              </Button>
            </Space>
          </Divider>

          <Table
            columns={itemColumns}
            dataSource={giftItems}
            rowKey="key"
            pagination={false}
            size="small"
          />

          <div style={{ textAlign: 'right' }}>
            <Space>
              <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
                总金额: ¥{calculateTotal().toFixed(2)}
              </span>
            </Space>
          </div>
        </Space>
      </Card>
    </div>
  );
};

export default GiftRequisitionForm;
