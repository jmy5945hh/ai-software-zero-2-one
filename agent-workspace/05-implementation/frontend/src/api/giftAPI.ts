import apiClient from './axios';
import { GiftApplication, GiftLedger } from '../types/gift';

export const giftAPI = {
  getApplications: (params?: {
    page?: number;
    pageSize?: number;
    status?: string;
    applicant?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    // Mock implementation
    return Promise.resolve({
      data: {
        items: [
          {
            id: '1',
            applicantId: '1',
            recipientId: '2',
            giftItems: [
              { id: 'G001', name: '精美笔记本', quantity: 5, unitPrice: 25.00, subtotal: 125.00 },
              { id: 'G002', name: '定制雨伞', quantity: 3, unitPrice: 45.00, subtotal: 135.00 }
            ],
            totalAmount: 260.00,
            plannedPickupDate: '2024-02-01',
            purposeType: '客户维护',
            relatedVisitId: '1',
            applicationStatus: '待审批',
            applicationDate: '2024-01-15',
            approverId: '2',
            approvalDate: null,
            rejectionReason: null,
            creatorId: '1',
            createdAt: '2024-01-15',
            updatedAt: '2024-01-15'
          },
          {
            id: '2',
            applicantId: '1',
            recipientId: '1',
            giftItems: [
              { id: 'G003', name: '品牌保温杯', quantity: 10, unitPrice: 80.00, subtotal: 800.00 }
            ],
            totalAmount: 800.00,
            plannedPickupDate: '2024-02-05',
            purposeType: '营销活动',
            relatedVisitId: null,
            applicationStatus: '已通过',
            applicationDate: '2024-01-10',
            approverId: '2',
            approvalDate: '2024-01-12',
            rejectionReason: null,
            creatorId: '1',
            createdAt: '2024-01-10',
            updatedAt: '2024-01-12'
          }
        ] as GiftApplication[],
        total: 2,
        page: 1,
        pageSize: 10
      }
    });
  },

  getApplication: (id: string) => {
    return apiClient.get(`/gift-applications/${id}`);
  },

  createApplication: (applicationData: Partial<GiftApplication>) => {
    return apiClient.post('/gift-applications', applicationData);
  },

  updateApplication: (id: string, applicationData: Partial<GiftApplication>) => {
    return apiClient.put(`/gift-applications/${id}`, applicationData);
  },

  approveApplication: (id: string, approvalData: { approvalNotes?: string }) => {
    return apiClient.post(`/gift-applications/${id}/approve`, approvalData);
  },

  rejectApplication: (id: string, rejectionData: { rejectionReason: string }) => {
    return apiClient.post(`/gift-applications/${id}/reject`, rejectionData);
  },

  getLedger: (params?: {
    page?: number;
    pageSize?: number;
    giftType?: string;
    startDate?: string;
    endDate?: string;
    pickupPerson?: string;
  }) => {
    // Mock implementation
    return Promise.resolve({
      data: {
        items: [
          {
            id: '1',
            giftApplicationId: '1',
            giftType: '办公用品',
            giftName: '精美笔记本',
            quantity: 5,
            unitPrice: 25.00,
            totalPrice: 125.00,
            pickupDate: '2024-02-01',
            pickupPerson: '李四',
            purpose: '客户维护',
            status: '已领用',
            createdAt: '2024-02-01',
            updatedAt: '2024-02-01'
          }
        ] as GiftLedger[],
        total: 1,
        page: 1,
        pageSize: 10
      }
    });
  }
};