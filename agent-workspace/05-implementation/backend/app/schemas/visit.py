"""拜访管理相关的 Pydantic 模型"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import date, datetime


class VisitMethod:
    """拜访方式枚举"""
    ON_SITE = "ON_SITE"
    PHONE = "PHONE"
    VIDEO = "VIDEO"
    EMAIL = "EMAIL"
    OTHER = "OTHER"


class VisitStatus:
    """拜访状态枚举"""
    NEW = "NEW"
    IN_PROGRESS = "IN_PROGRESS"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class VisitCreate(BaseModel):
    """创建拜访记录请求"""
    customer_id: str = Field(..., min_length=1, max_length=50, description="客户ID")
    company_name: str = Field(..., min_length=1, max_length=200, description="企业名称")
    planned_date: date = Field(..., description="计划拜访日期")
    actual_date: Optional[date] = Field(None, description="实际拜访日期")
    visit_method: str = Field(..., description="拜访方式")
    interested_products: Optional[List[str]] = Field(None, max_length=10, description="意向理财产品列表")
    participants: Optional[List[str]] = Field(None, max_length=10, description="参与人员列表(用户ID数组)")
    status: str = Field(..., description="拜访状态")
    notes: Optional[str] = Field(None, max_length=1000, description="备注信息")

    @field_validator("visit_method")
    @classmethod
    def validate_visit_method(cls, v):
        """验证拜访方式"""
        valid_methods = [VisitMethod.ON_SITE, VisitMethod.PHONE, VisitMethod.VIDEO, VisitMethod.EMAIL, VisitMethod.OTHER]
        if v not in valid_methods:
            raise ValueError(f"Invalid visit method. Must be one of {valid_methods}")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        """验证拜访状态"""
        valid_statuses = [VisitStatus.NEW, VisitStatus.IN_PROGRESS, VisitStatus.SUCCESS, VisitStatus.FAILED, VisitStatus.CANCELLED]
        if v not in valid_statuses:
            raise ValueError(f"Invalid status. Must be one of {valid_statuses}")
        return v

    @field_validator("actual_date")
    @classmethod
    def validate_dates(cls, v, info):
        """验证日期逻辑"""
        if v is not None and "planned_date" in info.data:
            planned_date = info.data["planned_date"]
            if v < planned_date:
                raise ValueError("Actual date cannot be earlier than planned date")
        return v


class VisitUpdate(BaseModel):
    """更新拜访记录请求"""
    customer_id: Optional[str] = Field(None, min_length=1, max_length=50, description="客户ID")
    company_name: Optional[str] = Field(None, min_length=1, max_length=200, description="企业名称")
    planned_date: Optional[date] = Field(None, description="计划拜访日期")
    actual_date: Optional[date] = Field(None, description="实际拜访日期")
    visit_method: Optional[str] = Field(None, description="拜访方式")
    interested_products: Optional[List[str]] = Field(None, max_length=10, description="意向理财产品列表")
    participants: Optional[List[str]] = Field(None, max_length=10, description="参与人员列表(用户ID数组)")
    status: Optional[str] = Field(None, description="拜访状态")
    notes: Optional[str] = Field(None, max_length=1000, description="备注信息")

    @field_validator("visit_method")
    @classmethod
    def validate_visit_method(cls, v):
        """验证拜访方式"""
        if v is not None:
            valid_methods = [VisitMethod.ON_SITE, VisitMethod.PHONE, VisitMethod.VIDEO, VisitMethod.EMAIL, VisitMethod.OTHER]
            if v not in valid_methods:
                raise ValueError(f"Invalid visit method. Must be one of {valid_methods}")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        """验证拜访状态"""
        if v is not None:
            valid_statuses = [VisitStatus.NEW, VisitStatus.IN_PROGRESS, VisitStatus.SUCCESS, VisitStatus.FAILED, VisitStatus.CANCELLED]
            if v not in valid_statuses:
                raise ValueError(f"Invalid status. Must be one of {valid_statuses}")
        return v


class VisitResponse(BaseModel):
    """拜访记录响应"""
    visit_id: str
    customer_id: str
    company_name: str
    planned_date: date
    actual_date: Optional[date]
    visit_method: str
    interested_products: Optional[List[str]]
    participants: Optional[List[str]]
    status: str
    notes: Optional[str]
    create_by: str
    create_time: datetime
    update_time: datetime

    class Config:
        from_attributes = True


class VisitQueryParams(BaseModel):
    """拜访记录查询参数"""
    customer_id: Optional[str] = Field(None, description="客户ID")
    planned_date_start: Optional[date] = Field(None, description="计划拜访日期(起始)")
    planned_date_end: Optional[date] = Field(None, description="计划拜访日期(结束)")
    actual_date_start: Optional[date] = Field(None, description="实际拜访日期(起始)")
    actual_date_end: Optional[date] = Field(None, description="实际拜访日期(结束)")
    status: Optional[str] = Field(None, description="拜访状态")
    create_by: Optional[str] = Field(None, description="创建人ID")

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        """验证拜访状态"""
        if v is not None:
            valid_statuses = [VisitStatus.NEW, VisitStatus.IN_PROGRESS, VisitStatus.SUCCESS, VisitStatus.FAILED, VisitStatus.CANCELLED]
            if v not in valid_statuses:
                raise ValueError(f"Invalid status. Must be one of {valid_statuses}")
        return v
