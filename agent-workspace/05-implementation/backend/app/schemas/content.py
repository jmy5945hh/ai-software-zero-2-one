from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class BannerResponse(BaseModel):
    id: int = Field(..., description="轮播图ID")
    title: str = Field(..., description="轮播图标题")
    imageUrl: str = Field(..., description="图片URL")
    linkUrl: Optional[str] = Field(None, description="链接URL")
    orderNum: int = Field(..., description="排序号")
    isActive: bool = Field(..., description="是否激活")

    class Config:
        from_attributes = True


class NewsResponse(BaseModel):
    id: int = Field(..., description="新闻ID")
    title: str = Field(..., description="新闻标题")
    content: str = Field(..., description="新闻内容")
    author: str = Field(..., description="作者")
    publishTime: datetime = Field(..., description="发布时间")

    class Config:
        from_attributes = True


class NewsListResponse(BaseModel):
    total: int = Field(..., description="总记录数")
    page: int = Field(..., description="当前页码")
    size: int = Field(..., description="每页大小")
    data: List[NewsResponse] = Field(..., description="新闻列表")
