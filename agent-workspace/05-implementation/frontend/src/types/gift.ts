export interface GiftItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface GiftApplication {
  id: string;
  applicantId: string;
  recipientId: string | null;
  giftItems: GiftItem[];
  totalAmount: number;
  plannedPickupDate: string; // YYYY-MM-DD
  purposeType: '客户维护' | '营销活动' | '其他';
  relatedVisitId: string | null;
  applicationStatus: '待审批' | '已通过' | '已驳回' | '已取消';
  applicationDate: string;
  approverId: string | null;
  approvalDate: string | null;
  rejectionReason: string | null;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface GiftLedger {
  id: string;
  giftApplicationId: string;
  giftType: string;
  giftName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  pickupDate: string; // YYYY-MM-DD
  pickupPerson: string;
  purpose: string;
  status: '已领用' | '已作废';
  createdAt: string;
  updatedAt: string;
}

export interface CreateGiftApplicationRequest {
  recipientId: string;
  giftItems: GiftItem[];
  totalAmount: number;
  plannedPickupDate: string;
  purposeType: '客户维护' | '营销活动' | '其他';
  relatedVisitId: string | null;
}