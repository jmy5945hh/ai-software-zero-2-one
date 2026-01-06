import apiClient from './axios';
import { CustomerVisit } from '../types/customerVisit';

export const customerVisitAPI = {
  getVisits: (params?: {
    page?: number;
    pageSize?: number;
    startDate?: string;
    endDate?: string;
    status?: string;
    customerId?: string;
    participant?: string;
    search?: string;
  }) => {
    // Mock implementation - in real app this would call the backend
    return Promise.resolve({
      data: {
        items: [
          {
            id: '1',
            customerId: 'CUST001',
            customerName: '北京科技有限公司',
            plannedDate: '2024-01-15',
            actualDate: '2024-01-15',
            visitMethod: '面访',
            productsInterested: ['理财产品A', '基金B'],
            participants: ['张三', '李四'],
            status: '已拜访',
            visitNotes: '客户对理财产品A表现出浓厚兴趣',
            creatorId: '1',
            createdAt: '2024-01-10',
            updatedAt: '2024-01-15'
          },
          {
            id: '2',
            customerId: 'CUST002',
            customerName: '创新软件有限公司',
            plannedDate: '2024-01-20',
            actualDate: null,
            visitMethod: '电话',
            productsInterested: ['保险产品C'],
            participants: ['王五'],
            status: '待拜访',
            visitNotes: '预约下周进行电话拜访',
            creatorId: '1',
            createdAt: '2024-01-12',
            updatedAt: '2024-01-12'
          }
        ] as CustomerVisit[],
        total: 2,
        page: 1,
        pageSize: 10
      }
    });
  },

  getVisit: (id: string) => {
    return apiClient.get(`/customer-visits/${id}`);
  },

  createVisit: (visitData: Partial<CustomerVisit>) => {
    return apiClient.post('/customer-visits', visitData);
  },

  updateVisit: (id: string, visitData: Partial<CustomerVisit>) => {
    return apiClient.put(`/customer-visits/${id}`, visitData);
  },

  deleteVisit: (id: string) => {
    return apiClient.delete(`/customer-visits/${id}`);
  }
};