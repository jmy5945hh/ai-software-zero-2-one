import apiClient from './axios';

export const dashboardAPI = {
  getOverview: () => {
    // Mock implementation
    return Promise.resolve({
      data: {
        totalVisits: 125,
        successfulVisits: 89,
        totalGifts: 42,
        totalGiftAmount: 15600.00
      }
    });
  },

  getVisitTrends: (params: { timeRange: 'day' | 'week' | 'month' }) => {
    // Mock implementation
    return Promise.resolve({
      data: {
        dates: ['2024-01-01', '2024-01-02', '2024-01-03', '2024-01-04', '2024-01-05'],
        visitCounts: [12, 18, 15, 22, 19]
      }
    });
  },

  getGiftExpenses: (params: { timeRange: 'day' | 'week' | 'month' }) => {
    // Mock implementation
    return Promise.resolve({
      data: {
        months: ['2024-01', '2024-02', '2024-03'],
        expenses: [5200.00, 7800.00, 2600.00]
      }
    });
  },

  getGiftExpensesByType: () => {
    // Mock implementation
    return Promise.resolve({
      data: [
        { type: '办公用品', amount: 8500.00, percentage: 55 },
        { type: '电子产品', amount: 4500.00, percentage: 29 },
        { type: '生活用品', amount: 2600.00, percentage: 16 }
      ]
    });
  }
};