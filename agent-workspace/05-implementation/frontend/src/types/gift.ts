/**
 * 礼品管理模块类型定义
 */

/**
 * 礼品申请状态类型
 */
export type GiftRequisitionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ISSUED';

/**
 * 礼品申请状态常量
 */
export const GiftRequisitionStatus = {
  PENDING: 'PENDING' as const,
  APPROVED: 'APPROVED' as const,
  REJECTED: 'REJECTED' as const,
  ISSUED: 'ISSUED' as const,
};

/**
 * 礼品申请状态映射
 */
export const GiftRequisitionStatusLabel: Record<GiftRequisitionStatus, string> = {
  PENDING: '待审批',
  APPROVED: '已通过',
  REJECTED: '已驳回',
  ISSUED: '已发放',
};

/**
 * 礼品申请状态颜色映射
 */
export const GiftRequisitionStatusColor: Record<GiftRequisitionStatus, string> = {
  PENDING: 'processing',
  APPROVED: 'success',
  REJECTED: 'error',
  ISSUED: 'default',
};

/**
 * 礼品明细项接口
 */
export interface GiftItem {
  gift_id: string;
  gift_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

/**
 * 礼品申请单接口
 */
export interface GiftRequisition {
  id: string;
  applicant_id: string;
  applicant_name: string;
  department: string;
  customer_name: string;
  customer_company: string;
  visit_date?: string;
  request_date: string;
  total_amount: number;
  items: GiftItem[];
  status: GiftRequisitionStatus;
  reason: string;
  approver_id?: string;
  approver_name?: string;
  approval_date?: string;
  approval_notes?: string;
  issued_date?: string;
  recipient?: string;
  created_at: string;
  updated_at: string;
}

/**
 * 创建礼品申请请求接口
 */
export interface CreateGiftRequisitionRequest {
  customer_name: string;
  customer_company: string;
  visit_date?: string;
  items: Omit<GiftItem, 'total_price'>[];
  reason: string;
}

/**
 * 审批礼品申请请求接口
 */
export interface ApprovalGiftRequisitionRequest {
  approval_notes?: string;
}

/**
 * 礼品申请查询参数接口
 */
export interface GiftRequisitionQueryParams {
  status?: GiftRequisitionStatus;
  applicant_id?: string;
  start_date?: string;
  end_date?: string;
  customer_company?: string;
  page?: number;
  page_size?: number;
}

/**
 * 礼品申请列表响应接口
 */
export interface GiftRequisitionListResponse {
  items: GiftRequisition[];
  total: number;
  page: number;
  page_size: number;
}

/**
 * 可用礼品接口
 */
export interface AvailableGift {
  gift_id: string;
  gift_name: string;
  gift_category: string;
  unit_price: number;
  stock_quantity: number;
  description?: string;
}

/**
 * 礼品台账记录接口
 */
export interface GiftLedger {
  id: string;
  gift_name: string;
  category: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  recipient: string;
  customer_company: string;
  issued_date: string;
  applicant_name: string;
  approver_name: string;
}

/**
 * 礼品台账查询参数接口
 */
export interface GiftLedgerQueryParams {
  start_date?: string;
  end_date?: string;
  customer_company?: string;
  gift_category?: string;
  page?: number;
  page_size?: number;
}

/**
 * 礼品台账列表响应接口
 */
export interface GiftLedgerListResponse {
  items: GiftLedger[];
  total: number;
  page: number;
  page_size: number;
}
