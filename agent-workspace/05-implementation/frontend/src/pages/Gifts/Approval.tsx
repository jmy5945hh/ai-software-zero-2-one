/**
 * 礼品审批页组件
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Button,
  Space,
  Tag,
  Spin,
  message,
  List,
  Divider,
  Modal,
  Input,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import type { GiftRequisition } from '@/types/gift';
import {
  getGiftRequisitionById,
  approveGiftRequisition,
  rejectGiftRequisition,
} from '@/services/giftService';
import {
  GiftRequisitionStatusLabel,
  GiftRequisitionStatusColor,
} from '@/types/gift';
import dayjs from 'dayjs';
import { useUserRole } from '@/stores/authStore';
import { Role } from '@/types/auth';

/**
 * 礼品审批页组件
 */
const GiftApproval: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const userRole = useUserRole();
  const [loading, setLoading] = useState(true);
  const [requisition, setRequisition] = useState<GiftRequisition | null>(null);
  const [approvalModalVisible, setApprovalModalVisible] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  /**
   * 判断是否有审批权限
   */
  const hasApprovalPermission = userRole === Role.APPROVER || userRole === Role.MANAGER;

  /**
   * 获取礼品申请详情
   */
  const fetchRequisitionDetail = async () => {
    if (!id) return;

    setLoading(true);
    try {
      const data = await getGiftRequisitionById(id);
      setRequisition(data);
    } catch (error) {
      message.error('获取礼品申请详情失败');
      navigate('/gifts/requisitions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequisitionDetail();
  }, [id]);

  /**
   * 打开审批弹窗
   */
  const handleOpenApprovalModal = (action: 'approve' | 'reject') => {
    if (!hasApprovalPermission) {
      message.error('您没有审批权限');
      return;
    }
    setApprovalAction(action);
    setApprovalModalVisible(true);
  };

  /**
   * 处理审批
   */
  const handleApproval = async () => {
    if (!id) return;

    setSubmitting(true);
    try {
      if (approvalAction === 'approve') {
        await approveGiftRequisition(id, { approval_notes: approvalNotes });
        message.success('审批通过');
      } else {
        await rejectGiftRequisition(id, { approval_notes: approvalNotes });
        message.success('已驳回申请');
      }
      setApprovalModalVisible(false);
      fetchRequisitionDetail();
    } catch (error) {
      message.error('审批操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!requisition) {
    return null;
  }

  const isPending = requisition.status === 'PENDING';

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
            {isPending && hasApprovalPermission && (
              <Space style={{ marginLeft: '16px' }}>
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  onClick={() => handleOpenApprovalModal('approve')}
                >
                  审批通过
                </Button>
                <Button
                  danger
                  icon={<CloseOutlined />}
                  onClick={() => handleOpenApprovalModal('reject')}
                >
                  驳回
                </Button>
              </Space>
            )}
          </div>

          {/* 基本信息 */}
          <Card title="基本信息" size="small">
            <Descriptions column={2} bordered>
              <Descriptions.Item label="申请单号">{requisition.id}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={GiftRequisitionStatusColor[requisition.status]}>
                  {GiftRequisitionStatusLabel[requisition.status]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="客户姓名">{requisition.customer_name}</Descriptions.Item>
              <Descriptions.Item label="客户公司">{requisition.customer_company}</Descriptions.Item>
              <Descriptions.Item label="申请部门">{requisition.department}</Descriptions.Item>
              <Descriptions.Item label="拜访日期">
                {requisition.visit_date ? dayjs(requisition.visit_date).format('YYYY-MM-DD') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="申请日期">
                {dayjs(requisition.request_date).format('YYYY-MM-DD')}
              </Descriptions.Item>
              <Descriptions.Item label="总金额">
                ¥{requisition.total_amount.toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="申请人">{requisition.applicant_name}</Descriptions.Item>
              <Descriptions.Item label="申请理由" span={2}>
                {requisition.reason}
              </Descriptions.Item>
              {requisition.approver_name && (
                <>
                  <Descriptions.Item label="审批人">{requisition.approver_name}</Descriptions.Item>
                  <Descriptions.Item label="审批日期">
                    {requisition.approval_date
                      ? dayjs(requisition.approval_date).format('YYYY-MM-DD')
                      : '-'}
                  </Descriptions.Item>
                </>
              )}
              {requisition.approval_notes && (
                <Descriptions.Item label="审批意见" span={2}>
                  {requisition.approval_notes}
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>

          {/* 礼品明细 */}
          <Divider />
          <Card title="礼品明细" size="small">
            <List
              dataSource={requisition.items}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={item.gift_name}
                    description={`数量: ${item.quantity} | 单价: ¥${item.unit_price.toFixed(2)}`}
                  />
                  <div style={{ fontWeight: 'bold' }}>
                    小计: ¥{item.total_price.toFixed(2)}
                  </div>
                </List.Item>
              )}
            />
            <Divider />
            <div style={{ textAlign: 'right', fontSize: '16px', fontWeight: 'bold' }}>
              总金额: ¥{requisition.total_amount.toFixed(2)}
            </div>
          </Card>

          {/* 时间戳信息 */}
          <Card title="时间戳信息" size="small">
            <Descriptions column={2} bordered>
              <Descriptions.Item label="创建时间">
                {dayjs(requisition.created_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {dayjs(requisition.updated_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Space>
      </Card>

      {/* 审批弹窗 */}
      <Modal
        title={approvalAction === 'approve' ? '审批通过' : '驳回申请'}
        open={approvalModalVisible}
        onOk={handleApproval}
        onCancel={() => setApprovalModalVisible(false)}
        confirmLoading={submitting}
        okText={approvalAction === 'approve' ? '通过' : '驳回'}
        okButtonProps={{
          danger: approvalAction === 'reject',
        }}
      >
        <Input.TextArea
          rows={4}
          placeholder="请输入审批意见（可选）"
          value={approvalNotes}
          onChange={(e) => setApprovalNotes(e.target.value)}
        />
      </Modal>
    </div>
  );
};

export default GiftApproval;
