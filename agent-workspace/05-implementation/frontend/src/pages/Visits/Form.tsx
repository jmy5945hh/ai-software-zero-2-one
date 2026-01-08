/**
 * 拜访记录表单组件（新建/编辑）
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card,
  Form,
  Input,
  Select,
  DatePicker,
  Button,
  Space,
  message,
  Row,
  Col,
  Divider,
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import {
  createVisit,
  updateVisit,
  getVisitById,
} from '@/services/visitService';
import { VisitMethod as MethodOptions, VisitStatus as StatusOptions } from '@/types/visit';
import dayjs from 'dayjs';

const { TextArea } = Input;

/**
 * 拜访记录表单组件
 */
const VisitForm: React.FC = () => {
  const navigate = useNavigate();
  const { visitId } = useParams<{ visitId: string }>();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isEdit, setIsEdit] = useState(false);

  /**
   * 加载拜访记录详情（编辑模式）
   */
  const loadVisitDetail = async () => {
    if (!visitId) return;

    setLoading(true);
    try {
      const visit = await getVisitById(visitId);
      setIsEdit(true);

      // 设置表单值
      form.setFieldsValue({
        customer_id: visit.customer_id,
        company_name: visit.company_name,
        planned_date: dayjs(visit.planned_date),
        actual_date: visit.actual_date ? dayjs(visit.actual_date) : undefined,
        visit_method: visit.visit_method,
        status: visit.status,
        notes: visit.notes,
      });
    } catch (error) {
      message.error('获取拜访记录详情失败');
      navigate('/visits');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visitId) {
      loadVisitDetail();
    }
  }, [visitId]);

  /**
   * 处理表单提交
   */
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const submitData = {
        ...values,
        planned_date: values.planned_date.format('YYYY-MM-DD'),
        actual_date: values.actual_date ? values.actual_date.format('YYYY-MM-DD') : undefined,
      };

      if (isEdit && visitId) {
        await updateVisit(visitId, submitData);
        message.success('更新拜访记录成功');
      } else {
        await createVisit(submitData);
        message.success('创建拜访记录成功');
      }

      navigate('/visits');
    } catch (error) {
      if (error instanceof Error) {
        message.error(isEdit ? '更新拜访记录失败' : '创建拜访记录失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '24px', textAlign: 'center' }}>加载中...</div>;
  }

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* 操作按钮 */}
          <div>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/visits')}>
              返回列表
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSubmit}
              loading={submitting}
              style={{ marginLeft: '16px' }}
            >
              {isEdit ? '更新' : '保存'}
            </Button>
          </div>

          {/* 表单 */}
          <Form
            form={form}
            layout="vertical"
            autoComplete="off"
            initialValues={{
              visit_method: 'ON_SITE',
              status: 'NEW',
            }}
          >
            <Divider orientation="left">基本信息</Divider>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="客户ID"
                  name="customer_id"
                  rules={[{ required: true, message: '请输入客户ID' }]}
                >
                  <Input placeholder="请输入客户ID" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="公司名称"
                  name="company_name"
                  rules={[{ required: true, message: '请输入公司名称' }]}
                >
                  <Input placeholder="请输入公司名称" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="计划日期"
                  name="planned_date"
                  rules={[{ required: true, message: '请选择计划日期' }]}
                >
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="实际日期" name="actual_date">
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="拜访方式"
                  name="visit_method"
                  rules={[{ required: true, message: '请选择拜访方式' }]}
                >
                  <Select placeholder="请选择拜访方式">
                    {Object.entries(MethodOptions).map(([key, value]) => (
                      <Select.Option key={key} value={value}>
                        {
                          {
                            ON_SITE: '现场拜访',
                            PHONE: '电话拜访',
                            VIDEO: '视频会议',
                            EMAIL: '邮件沟通',
                            OTHER: '其他方式',
                          }[value]
                        }
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="状态"
                  name="status"
                  rules={[{ required: true, message: '请选择状态' }]}
                >
                  <Select placeholder="请选择状态">
                    {Object.entries(StatusOptions).map(([key, value]) => (
                      <Select.Option key={key} value={value}>
                        {
                          {
                            NEW: '新建',
                            IN_PROGRESS: '进行中',
                            SUCCESS: '成功',
                            FAILED: '失败',
                            CANCELLED: '已取消',
                          }[value]
                        }
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Form.Item label="备注" name="notes">
              <TextArea rows={4} placeholder="请输入备注" />
            </Form.Item>
          </Form>
        </Space>
      </Card>
    </div>
  );
};

export default VisitForm;
