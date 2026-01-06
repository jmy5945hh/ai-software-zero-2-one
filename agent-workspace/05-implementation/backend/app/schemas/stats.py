from pydantic import BaseModel, Field
from typing import List


class VisitStatsItem(BaseModel):
    time: str = Field(..., description="时间点")
    count: int = Field(..., description="拜访次数")


class VisitStatsResponse(BaseModel):
    timeDimension: str = Field(..., description="时间维度")
    startDate: str = Field(..., description="开始日期")
    endDate: str = Field(..., description="结束日期")
    data: List[VisitStatsItem] = Field(..., description="统计数据")


class GiftStatsItem(BaseModel):
    time: str = Field(..., description="时间点")
    total: int = Field(..., description="申请总数")
    approved: int = Field(..., description="审批通过数")
    rejected: int = Field(..., description="审批拒绝数")


class GiftStatsResponse(BaseModel):
    timeDimension: str = Field(..., description="时间维度")
    startDate: str = Field(..., description="开始日期")
    endDate: str = Field(..., description="结束日期")
    data: List[GiftStatsItem] = Field(..., description="统计数据")
