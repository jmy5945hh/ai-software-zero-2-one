"""通用响应模型"""
from typing import Generic, TypeVar, Optional, List
from pydantic import BaseModel, Field

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    """通用 API 响应"""
    code: int = Field(200, description="HTTP 状态码")
    message: str = Field("success", description="响应消息")
    data: Optional[T] = Field(None, description="响应数据")


class ErrorResponse(BaseModel):
    """错误响应"""
    code: int = Field(..., description="错误状态码")
    message: str = Field(..., description="错误消息")
    errors: Optional[List[dict]] = Field(None, description="错误详情数组")


class PaginationParams(BaseModel):
    """分页参数"""
    page: int = Field(1, ge=1, description="页码(从1开始)")
    page_size: int = Field(10, ge=1, le=100, description="每页记录数")


class PaginatedResponse(BaseModel, Generic[T]):
    """分页响应"""
    items: List[T]
    total: int = Field(..., description="总记录数")
    page: int = Field(..., description="当前页码")
    page_size: int = Field(..., description="每页记录数")
    total_pages: int = Field(..., description="总页数")
