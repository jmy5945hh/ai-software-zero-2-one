import React from 'react';
import { Form, Input, DatePicker, Radio, Button, Row, Col } from 'antd';


const { TextArea } = Input;

interface CustomerVisitFormProps {
  initialValues?: any;
  onSubmit: (values: any) => void;
  onCancel: () => void;
}

const CustomerVisitForm: React.FC<CustomerVisitFormProps> = ({
  initialValues = {},
  onSubmit,
  onCancel,
}) => {
  const [form] = Form.useForm();

  React.useEffect(() => {
    form.setFieldsValue(initialValues);
  }, [initialValues, form]);

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      onSubmit(values);
    });
  };

  return (
    <Form form={form} layout="vertical" className="customer-visit-form">
      <Row gutter={[16, 16]}>
        {/* 基本信息区 */}
        <Col xs={24} sm={12}>
          <Form.Item
            name="id"
            label="客户ID"
            rules={[{ required: true, message: '请输入客户ID' }]}
          >
            <Input placeholder="请输入客户ID" />
          </Form.Item>

          <Form.Item
            name="customerName"
            label="企业名称"
            rules={[{ required: true, message: '请输入企业名称' }]}
          >
            <Input placeholder="请输入企业名称" />
          </Form.Item>

          <Form.Item
            name="visitDate"
            label="计划拜访日期"
            rules={[{ required: true, message: '请选择计划拜访日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="actualVisitDate"
            label="实际拜访日期"
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Col>

        {/* 拜访详情区 */}
        <Col xs={24} sm={12}>
          <Form.Item
            name="visitContent"
            label="拜访内容"
            rules={[{ required: true, message: '请输入拜访内容' }]}
          >
            <TextArea rows={4} placeholder="请输入拜访内容" />
          </Form.Item>

          <Form.Item
            name="customerContact"
            label="客户联系方式"
            rules={[{ required: true, message: '请输入客户联系方式' }]}
          >
            <Input placeholder="请输入客户联系方式" />
          </Form.Item>

          <Form.Item
            name="nextVisitPlan"
            label="下次拜访计划"
          >
            <TextArea rows={2} placeholder="请输入下次拜访计划" />
          </Form.Item>

          <Form.Item
            name="status"
            label="状态"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Radio.Group>
              <Radio value="计划中">计划中</Radio>
              <Radio value="已完成">已完成</Radio>
              <Radio value="取消">取消</Radio>
            </Radio.Group>
          </Form.Item>
        </Col>
      </Row>

      {/* 操作按钮区 */}
      <Row gutter={[16, 0]} justify="end" style={{ marginTop: 16 }}>
        <Col>
          <Button onClick={onCancel} style={{ marginRight: 8 }}>
            取消
          </Button>
          <Button type="primary" onClick={handleSubmit}>
            保存
          </Button>
        </Col>
      </Row>
    </Form>
  );
};

export default CustomerVisitForm;
