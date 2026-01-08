/**
 * 礼品管理 API 服务
 */

import request from '@/utils/request';
import type {
  GiftRequisition,
  CreateGiftRequisitionRequest,
  ApprovalGiftRequisitionRequest,
  GiftRequisitionQueryParams,
  GiftRequisitionListResponse,
  AvailableGift,
  GiftLedgerQueryParams,
  GiftLedgerListResponse,
} from '@/types/gift';

/**
 * 创建礼品申请
 */
export const createGiftRequisition = async (
  data: CreateGiftRequisitionRequest
): Promise<GiftRequisition> => {
  return request<GiftRequisition>({
    method: 'POST',
    url: '/api/v1/gifts/requisitions',
    data,
  });
};

/**
 * 获取礼品申请列表
 */
export const getGiftRequisitions = async (
  params: GiftRequisitionQueryParams
): Promise<GiftRequisitionListResponse> => {
  return request<GiftRequisitionListResponse>({
    method: 'GET',
    url: '/api/v1/gifts/requisitions',
    params,
  });
};

/**
 * 获取礼品申请详情
 */
export const getGiftRequisitionById = async (id: string): Promise<GiftRequisition> => {
  return request<GiftRequisition>({
    method: 'GET',
    url: `/api/v1/gifts/requisitions/${id}`,
  });
};

/**
 * 审批礼品申请（通过）
 */
export const approveGiftRequisition = async (
  id: string,
  data: ApprovalGiftRequisitionRequest
): Promise<GiftRequisition> => {
  return request<GiftRequisition>({
    method: 'PUT',
    url: `/api/v1/gifts/requisitions/${id}/approve`,
    data,
  });
};

/**
 * 审批礼品申请（驳回）
 */
export const rejectGiftRequisition = async (
  id: string,
  data: ApprovalGiftRequisitionRequest
): Promise<GiftRequisition> => {
  return request<GiftRequisition>({
    method: 'PUT',
    url: `/api/v1/gifts/requisitions/${id}/reject`,
    data,
  });
};

/**
 * 获取礼品台账
 */
export const getGiftLedger = async (
  params: GiftLedgerQueryParams
): Promise<GiftLedgerListResponse> => {
  return request<GiftLedgerListResponse>({
    method: 'GET',
    url: '/api/v1/gifts/ledger',
    params,
  });
};

/**
 * 获取可用礼品列表
 */
export const getAvailableGifts = async (): Promise<AvailableGift[]> => {
  return request<AvailableGift[]>({
    method: 'GET',
    url: '/api/v1/gifts',
  });
};
