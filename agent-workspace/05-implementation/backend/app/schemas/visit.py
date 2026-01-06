from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class VisitRequest(BaseModel):
    customerName: str = Field(..., description="客户名称")
    visitDate: datetime = Field(..., description="拜访日期时间")
    visitContent: str = Field(..., description="拜访内容")
    customerContact: Optional[str] = Field(None, description="客户联系方式")
    nextVisitPlan: Optional[str] = Field(None, description="下次拜访计划")


class VisitResponse(BaseModel):
    id: int = Field(..., description="拜访记录ID")
    customerName: str = Field(..., description="客户名称")
    visitDate: datetime = Field(..., description="拜访日期时间")
    visitContent: str = Field(..., description="拜访内容")
    customerContact: Optional[str] = Field(None, description="客户联系方式")
    nextVisitPlan: Optional[str] = Field(None, description="下次拜访计划")
    createdBy: str = Field(..., description="创建人")
    createdTime: datetime = Field(..., description="创建时间")
    updatedBy: Optional[str] = Field(None, description="更新人")
    updatedTime: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True


class VisitListResponse(BaseModel):
    total: int = Field(..., description="总记录数")
    page: int = Field(..., description="当前页码")
    size: int = Field(..., description="每页大小")
    data: List[VisitResponse] = Field(..., description="拜访记录列表")
