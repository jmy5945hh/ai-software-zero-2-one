from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class GiftApplicationRequest(BaseModel):
    customerName: str = Field(..., description="客户名称")
    giftName: str = Field(..., description="礼品名称")
    quantity: int = Field(..., description="礼品数量")
    reason: str = Field(..., description="申请理由")


class GiftApplicationResponse(BaseModel):
    id: int = Field(..., description="礼品申请ID")
    customerName: str = Field(..., description="客户名称")
    giftName: str = Field(..., description="礼品名称")
    quantity: int = Field(..., description="礼品数量")
    reason: str = Field(..., description="申请理由")
    status: str = Field(..., description="申请状态", enum=["pending", "approved", "rejected"])
    applicantName: str = Field(..., description="申请人姓名")
    approveName: Optional[str] = Field(None, description="审批人姓名")
    approveComment: Optional[str] = Field(None, description="审批意见")
    approveTime: Optional[datetime] = Field(None, description="审批时间")
    createdTime: datetime = Field(..., description="创建时间")

    class Config:
        from_attributes = True


class GiftApplicationListResponse(BaseModel):
    total: int = Field(..., description="总记录数")
    page: int = Field(..., description="当前页码")
    size: int = Field(..., description="每页大小")
    data: List[GiftApplicationResponse] = Field(..., description="礼品申请列表")


class GiftApprovalRequest(BaseModel):
    status: str = Field(..., description="审批结果", enum=["approved", "rejected"])
    comment: Optional[str] = Field(None, description="审批意见")
