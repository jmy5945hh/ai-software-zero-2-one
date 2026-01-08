/**
 * 拜访管理 API 服务
 */

import request from '@/utils/request';
import type {
  Visit,
  CreateVisitRequest,
  UpdateVisitRequest,
  VisitQueryParams,
  VisitListResponse,
} from '@/types/visit';

/**
 * 创建拜访记录
 */
export const createVisit = async (data: CreateVisitRequest): Promise<Visit> => {
  return request<Visit>({
    method: 'POST',
    url: '/api/v1/visits',
    data,
  });
};

/**
 * 获取拜访记录列表
 */
export const getVisits = async (params: VisitQueryParams): Promise<VisitListResponse> => {
  return request<VisitListResponse>({
    method: 'GET',
    url: '/api/v1/visits',
    params,
  });
};

/**
 * 获取拜访记录详情
 */
export const getVisitById = async (visitId: string): Promise<Visit> => {
  return request<Visit>({
    method: 'GET',
    url: `/api/v1/visits/${visitId}`,
  });
};

/**
 * 更新拜访记录
 */
export const updateVisit = async (
  visitId: string,
  data: UpdateVisitRequest
): Promise<Visit> => {
  return request<Visit>({
    method: 'PUT',
    url: `/api/v1/visits/${visitId}`,
    data,
  });
};
