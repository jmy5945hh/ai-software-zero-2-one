import React, { useState } from 'react';
import { Form, Button, Card, Table, Radio, Input, message } from 'antd';

interface GiftApplication {
  id: number;
  customerName: string;
  giftName: string;
  quantity: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  applicantName: string;
  approveName?: string;
  approveComment?: string;
  approveTime?: string;
  createdTime: string;
}

interface GiftApprovalDetailProps {
  application: GiftApplication;
  onClose: () => void;
  onApprovalComplete: () => void;
}

// 礼品项接口
interface GiftItem {
  id: string;
  giftName: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

const GiftApprovalDetail: React.FC<GiftApprovalDetailProps> = ({ 
  application, 
  onClose, 
  onApprovalComplete 
}) => {
  const [form] = Form.useForm();
  const [approvalStatus, setApprovalStatus] = useState<'approved' | 'rejected' | ''>('');
  const [approvalComment, setApprovalComment] = useState('');

  // 模拟礼品列表数据
  const giftItems: GiftItem[] = [
    { id: '1', giftName: application.giftName, quantity: application.quantity, unitPrice: 100, amount: application.quantity * 100 },
  ];

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
  ];

  // 处理审批结果选择
  const handleApprovalStatusChange = (e: any) => {
    setApprovalStatus(e.target.value);
  };

  // 处理审批意见输入
  const handleCommentChange = (e: any) => {
    setApprovalComment(e.target.value);
  };

  // 处理审批提交
  const handleSubmitApproval = async () => {
    if (!approvalStatus) {
      message.error('请选择审批结果');
      return;
    }

    if (approvalStatus === 'rejected' && !approvalComment.trim()) {
      message.error('驳回时请填写审批意见');
      return;
    }

    try {
      // 实际项目中，这里会调用API提交审批结果
      // await apiClient.post(`/gifts/applications/${application.id}/approve`, {
      //   status: approvalStatus,
      //   comment: approvalComment,
      // });
      
      message.success('审批成功');
      onApprovalComplete();
    } catch (error) {
      message.error('审批失败，请稍后重试');
    }
  };

  // 状态文本映射
  const statusTextMap: Record<string, string> = {
    pending: '待审批',
    approved: '已通过',
    rejected: '已驳回',
  };

  return (
    <div className="gift-approval-detail">
      {/* 返回按钮 */}
      <div className="detail-header">
        <Button type="text" onClick={onClose}>返回列表</Button>
      </div>

      {/* 基本信息区 */}
      <Card title="基本信息" className="info-card">
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">申请ID:</span>
            <span className="info-value">{application.id}</span>
          </div>
          <div className="info-item">
            <span className="info-label">申请人:</span>
            <span className="info-value">{application.applicantName}</span>
          </div>
          <div className="info-item">
            <span className="info-label">领用人:</span>
            <span className="info-value">{application.customerName}</span>
          </div>
          <div className="info-item">
            <span className="info-label">总金额:</span>
            <span className="info-value">¥{application.quantity * 100}</span>
          </div>
          <div className="info-item">
            <span className="info-label">计划领用日期:</span>
            <span className="info-value">{new Date(application.createdTime).toLocaleDateString()}</span>
          </div>
          <div className="info-item">
            <span className="info-label">目的类型:</span>
            <span className="info-value">客户拜访</span>
          </div>
          <div className="info-item">
            <span className="info-label">关联拜访记录ID:</span>
            <span className="info-value">{application.id}</span>
          </div>
          <div className="info-item">
            <span className="info-label">状态:</span>
            <span className={`info-value status-${application.status}`}>
              {statusTextMap[application.status]}
            </span>
          </div>
        </div>
      </Card>

      {/* 礼品列表区 */}
      <Card title="礼品列表" className="gift-list-card">
        <Table
          dataSource={giftItems}
          columns={giftColumns}
          rowKey="id"
          pagination={false}
          size="small"
        />
      </Card>

      {/* 审批操作区 */}
      {application.status === 'pending' && (
        <Card title="审批操作" className="approval-card">
          <Form form={form} layout="vertical">
            <Form.Item
              name="approvalStatus"
              label="审批结果"
              rules={[{ required: true, message: '请选择审批结果' }]}
            >
              <Radio.Group onChange={handleApprovalStatusChange} value={approvalStatus}>
                <Radio value="approved">通过</Radio>
                <Radio value="rejected">驳回</Radio>
              </Radio.Group>
            </Form.Item>

            <Form.Item
              name="approvalComment"
              label="审批意见"
              rules={[
                { 
                  required: approvalStatus === 'rejected', 
                  message: '驳回时请填写审批意见' 
                }
              ]}
            >
              <Input.TextArea 
                placeholder="请输入审批意见" 
                rows={4}
                value={approvalComment}
                onChange={handleCommentChange}
              />
              {approvalStatus === 'rejected' && (
                <span className="required-hint">(驳回时必填)</span>
              )}
            </Form.Item>

            <div className="approval-actions">
              <Button onClick={onClose} style={{ marginRight: 8 }}>
                取消
              </Button>
              <Button 
                type="primary" 
                onClick={handleSubmitApproval}
                disabled={!approvalStatus || (approvalStatus === 'rejected' && !approvalComment.trim())}
              >
                提交审批
              </Button>
            </div>
          </Form>
        </Card>
      )}

      {/* 审批记录区（已审批状态显示） */}
      {application.status !== 'pending' && (
        <Card title="审批记录" className="approval-record-card">
          <div className="approval-record">
            <div className="record-item">
              <span className="record-label">审批状态:</span>
              <span className={`record-value status-${application.status}`}>
                {statusTextMap[application.status]}
              </span>
            </div>
            <div className="record-item">
              <span className="record-label">审批人员:</span>
              <span className="record-value">{application.approveName || '-'}</span>
            </div>
            <div className="record-item">
              <span className="record-label">审批时间:</span>
              <span className="record-value">{application.approveTime ? new Date(application.approveTime).toLocaleString() : '-'}</span>
            </div>
            <div className="record-item">
              <span className="record-label">审批意见:</span>
              <span className="record-value">{application.approveComment || '-'}</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default GiftApprovalDetail;
