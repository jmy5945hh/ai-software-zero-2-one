/**
 * 拜访管理模块类型定义
 */

/**
 * 拜访方式类型
 */
export type VisitMethod = 'ON_SITE' | 'PHONE' | 'VIDEO' | 'EMAIL' | 'OTHER';

/**
 * 拜访方式常量
 */
export const VisitMethod = {
  ON_SITE: 'ON_SITE' as const,
  PHONE: 'PHONE' as const,
  VIDEO: 'VIDEO' as const,
  EMAIL: 'EMAIL' as const,
  OTHER: 'OTHER' as const,
};

/**
 * 拜访方式映射
 */
export const VisitMethodLabel: Record<VisitMethod, string> = {
  ON_SITE: '现场拜访',
  PHONE: '电话拜访',
  VIDEO: '视频会议',
  EMAIL: '邮件沟通',
  OTHER: '其他方式',
};

/**
 * 拜访状态类型
 */
export type VisitStatus = 'NEW' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

/**
 * 拜访状态常量
 */
export const VisitStatus = {
  NEW: 'NEW' as const,
  IN_PROGRESS: 'IN_PROGRESS' as const,
  SUCCESS: 'SUCCESS' as const,
  FAILED: 'FAILED' as const,
  CANCELLED: 'CANCELLED' as const,
};

/**
 * 拜访状态映射
 */
export const VisitStatusLabel: Record<VisitStatus, string> = {
  NEW: '新建',
  IN_PROGRESS: '进行中',
  SUCCESS: '成功',
  FAILED: '失败',
  CANCELLED: '已取消',
};

/**
 * 拜访状态颜色映射
 */
export const VisitStatusColor: Record<VisitStatus, string> = {
  NEW: 'default',
  IN_PROGRESS: 'processing',
  SUCCESS: 'success',
  FAILED: 'error',
  CANCELLED: 'warning',
};

/**
 * 感兴趣的产品接口
 */
export interface InterestedProduct {
  product_name: string;
  product_category?: string;
  investment_amount?: number;
  notes?: string;
}

/**
 * 参与者接口
 */
export interface Participant {
  user_id: string;
  user_name: string;
}

/**
 * 拜访记录接口
 */
export interface Visit {
  visit_id: string;
  customer_id: string;
  company_name: string;
  planned_date: string;
  actual_date?: string;
  visit_method: VisitMethod;
  interested_products?: InterestedProduct[];
  participants?: Participant[];
  status: VisitStatus;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * 创建拜访记录请求接口
 */
export interface CreateVisitRequest {
  customer_id: string;
  company_name: string;
  planned_date: string;
  actual_date?: string;
  visit_method: VisitMethod;
  interested_products?: InterestedProduct[];
  participants?: string[];
  status: VisitStatus;
  notes?: string;
}

/**
 * 更新拜访记录请求接口
 */
export interface UpdateVisitRequest {
  customer_id?: string;
  company_name?: string;
  planned_date?: string;
  actual_date?: string;
  visit_method?: VisitMethod;
  interested_products?: InterestedProduct[];
  participants?: string[];
  status?: VisitStatus;
  notes?: string;
}

/**
 * 拜访记录查询参数接口
 */
export interface VisitQueryParams {
  status?: VisitStatus;
  start_date?: string;
  end_date?: string;
  company_name?: string;
  page?: number;
  page_size?: number;
}

/**
 * 拜访记录列表响应接口
 */
export interface VisitListResponse {
  items: Visit[];
  total: number;
  page: number;
  page_size: number;
}
