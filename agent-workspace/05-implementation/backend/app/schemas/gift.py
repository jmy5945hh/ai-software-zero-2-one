"""礼品管理相关的 Pydantic 模型"""
from pydantic import BaseModel, Field, field_validator, computed_field
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal


class ApprovalStatus:
    """审批状态枚举"""
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class PurposeType:
    """目的类型枚举"""
    CUSTOMER_VISIT = "CUSTOMER_VISIT"
    HOLIDAY = "HOLIDAY"
    MARKETING = "MARKETING"
    OTHER = "OTHER"


class GiftItem(BaseModel):
    """礼品明细项"""
    gift_id: str = Field(..., description="礼品ID")
    quantity: int = Field(..., ge=1, description="数量")


class GiftRequisitionCreate(BaseModel):
    """创建礼品申请请求"""
    recipient: str = Field(..., min_length=1, max_length=32, description="领用人ID")
    gift_items: List[GiftItem] = Field(..., min_length=1, description="礼品列表")
    planned_date: date = Field(..., description="计划领用日期")
    purpose_type: str = Field(..., description="目的类型")
    related_visit_id: Optional[str] = Field(None, description="关联客户拜访记录ID(可选)")

    @field_validator("purpose_type")
    @classmethod
    def validate_purpose_type(cls, v):
        """验证目的类型"""
        valid_types = [PurposeType.CUSTOMER_VISIT, PurposeType.HOLIDAY, PurposeType.MARKETING, PurposeType.OTHER]
        if v not in valid_types:
            raise ValueError(f"Invalid purpose type. Must be one of {valid_types}")
        return v


class ApprovalRequest(BaseModel):
    """审批请求"""
    comment: str = Field(..., min_length=1, max_length=500, description="审批意见")


class RejectionRequest(BaseModel):
    """驳回请求"""
    rejection_reason: str = Field(..., min_length=1, max_length=500, description="驳回原因(必填)")


class GiftItemResponse(BaseModel):
    """礼品明细响应"""
    gift_id: str
    quantity: int
    unit_price: Decimal
    subtotal: Decimal
    gift: Optional['GiftResponse'] = None

    @computed_field
    @property
    def gift_name(self) -> str:
        """获取礼品名称"""
        return self.gift.gift_name if self.gift else ""

    class Config:
        from_attributes = True


class GiftRequisitionResponse(BaseModel):
    """礼品申请响应"""
    requisition_id: str
    applicant: str
    recipient: str
    total_amount: Decimal
    planned_date: date
    purpose_type: str
    related_visit_id: Optional[str]
    approval_status: str
    rejection_reason: Optional[str]
    approver: Optional[str]
    approval_time: Optional[str]
    create_time: datetime
    update_time: datetime
    gift_items: List[GiftItemResponse] = Field(alias="items")

    class Config:
        from_attributes = True
        populate_by_name = True


class GiftRequisitionQueryParams(BaseModel):
    """礼品申请查询参数"""
    approval_status: Optional[str] = Field(None, description="审批状态")
    planned_date_start: Optional[date] = Field(None, description="计划领用日期(起始)")
    planned_date_end: Optional[date] = Field(None, description="计划领用日期(结束)")

    @field_validator("approval_status")
    @classmethod
    def validate_approval_status(cls, v):
        """验证审批状态"""
        if v is not None:
            valid_statuses = [ApprovalStatus.PENDING, ApprovalStatus.APPROVED, ApprovalStatus.REJECTED]
            if v not in valid_statuses:
                raise ValueError(f"Invalid approval status. Must be one of {valid_statuses}")
        return v


class GiftResponse(BaseModel):
    """礼品响应"""
    gift_id: str
    gift_name: str
    gift_category: str
    unit_price: Decimal
    stock_quantity: int
    description: Optional[str]
    status: str
    create_time: datetime
    update_time: datetime

    class Config:
        from_attributes = True


class GiftLedgerQueryParams(BaseModel):
    """礼品台账查询参数"""
    gift_category: Optional[str] = Field(None, description="礼品分类")
    planned_date_start: Optional[date] = Field(None, description="计划领用日期(起始)")
    planned_date_end: Optional[date] = Field(None, description="计划领用日期(结束)")
