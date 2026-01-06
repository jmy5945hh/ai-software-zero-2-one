export interface CustomerVisit {
  id: string;
  customerId: string;
  customerName: string;
  plannedDate: string; // YYYY-MM-DD
  actualDate: string | null; // YYYY-MM-DD
  visitMethod: '电话' | '面访' | '视频';
  productsInterested: string[];
  participants: string[];
  status: '待拜访' | '已拜访' | '已取消';
  visitNotes: string;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerVisitRequest {
  customerId: string;
  customerName: string;
  plannedDate: string;
  visitMethod: '电话' | '面访' | '视频';
  productsInterested: string[];
  participants: string[];
  status: '待拜访';
  visitNotes: string;
}