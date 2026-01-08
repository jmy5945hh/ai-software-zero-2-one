/**
 * 拜访记录详情页
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
} from 'antd';
import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons';
import type { Visit } from '@/types/visit';
import { getVisitById } from '@/services/visitService';
import { VisitStatusLabel, VisitStatusColor, VisitMethodLabel } from '@/types/visit';
import dayjs from 'dayjs';

/**
 * 拜访记录详情页组件
 */
const VisitDetail: React.FC = () => {
  const { visitId } = useParams<{ visitId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [visit, setVisit] = useState<Visit | null>(null);

  /**
   * 获取拜访记录详情
   */
  const fetchVisitDetail = async () => {
    if (!visitId) return;

    setLoading(true);
    try {
      const data = await getVisitById(visitId);
      setVisit(data);
    } catch (error) {
      message.error('获取拜访记录详情失败');
      navigate('/visits');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisitDetail();
  }, [visitId]);

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!visit) {
    return null;
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
              icon={<EditOutlined />}
              onClick={() => navigate(`/visits/edit/${visit.visit_id}`)}
              style={{ marginLeft: '16px' }}
            >
              编辑
            </Button>
          </div>

          {/* 基本信息 */}
          <Card title="基本信息" size="small">
            <Descriptions column={2} bordered>
              <Descriptions.Item label="公司名称">{visit.company_name}</Descriptions.Item>
              <Descriptions.Item label="客户ID">{visit.customer_id}</Descriptions.Item>
              <Descriptions.Item label="计划日期">
                {dayjs(visit.planned_date).format('YYYY-MM-DD')}
              </Descriptions.Item>
              <Descriptions.Item label="实际日期">
                {visit.actual_date ? dayjs(visit.actual_date).format('YYYY-MM-DD') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="拜访方式">
                {VisitMethodLabel[visit.visit_method]}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={VisitStatusColor[visit.status]}>{VisitStatusLabel[visit.status]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="创建人" span={2}>
                {visit.created_by}
              </Descriptions.Item>
              <Descriptions.Item label="备注" span={2}>
                {visit.notes || '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* 感兴趣的产品 */}
          {visit.interested_products && visit.interested_products.length > 0 && (
            <>
              <Divider />
              <Card title="感兴趣的产品" size="small">
                <List
                  dataSource={visit.interested_products}
                  renderItem={(item) => (
                    <List.Item>
                      <List.Item.Meta
                        title={item.product_name}
                        description={
                          <Space>
                            {item.product_category && (
                              <span>分类: {item.product_category}</span>
                            )}
                            {item.investment_amount && (
                              <span>
                                投资金额: ¥{item.investment_amount.toLocaleString()}
                              </span>
                            )}
                          </Space>
                        }
                      />
                      {item.notes && <div>备注: {item.notes}</div>}
                    </List.Item>
                  )}
                />
              </Card>
            </>
          )}

          {/* 参与人员 */}
          {visit.participants && visit.participants.length > 0 && (
            <>
              <Divider />
              <Card title="参与人员" size="small">
                <List
                  dataSource={visit.participants}
                  renderItem={(item) => (
                    <List.Item>
                      <List.Item.Meta title={item.user_name} description={`ID: ${item.user_id}`} />
                    </List.Item>
                  )}
                />
              </Card>
            </>
          )}

          {/* 时间戳信息 */}
          <Card title="时间戳信息" size="small">
            <Descriptions column={2} bordered>
              <Descriptions.Item label="创建时间">
                {dayjs(visit.created_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {dayjs(visit.updated_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Space>
      </Card>
    </div>
  );
};

export default VisitDetail;
