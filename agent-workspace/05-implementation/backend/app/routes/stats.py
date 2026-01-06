from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import date, datetime
from typing import List, Dict, Any

from app.database import get_db
from app.schemas.stats import VisitStatsResponse, GiftStatsResponse
from app.schemas.common import ErrorResponse
from app.models.visit import VisitRecord
from app.models.gift import GiftApplication
from app.models.user import SysUser
from app.utils.auth import get_current_user

router = APIRouter()


@router.get("/visit", response_model=VisitStatsResponse, responses={400: {"model": ErrorResponse}})
async def get_visit_stats(
    timeDimension: str = Query(..., description="时间维度", enum=["day", "week", "month", "quarter", "year"]),
    startDate: date = Query(..., description="开始日期"),
    endDate: date = Query(..., description="结束日期"),
    current_user: SysUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取客户拜访统计数据"""
    # 验证日期范围
    if startDate > endDate:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Start date must be earlier than end date"
        )
    
    # 根据时间维度格式化日期
    start_datetime = datetime.combine(startDate, datetime.min.time())
    end_datetime = datetime.combine(endDate, datetime.max.time())
    
    # 查询拜访记录
    query = select(VisitRecord).where(
        VisitRecord.visit_date >= start_datetime,
        VisitRecord.visit_date <= end_datetime
    )
    result = await db.execute(query)
    visit_records = result.scalars().all()
    
    # 按时间维度分组统计
    stats_data = {}  
    for record in visit_records:
        # 获取时间维度的键
        if timeDimension == "day":
            time_key = record.visit_date.strftime("%Y-%m-%d")
        elif timeDimension == "week":
            # 获取年份和周数
            year, week, _ = record.visit_date.isocalendar()
            time_key = f"{year}-W{week:02d}"
        elif timeDimension == "month":
            time_key = record.visit_date.strftime("%Y-%m")
        elif timeDimension == "quarter":
            # 获取年份和季度
            quarter = (record.visit_date.month - 1) // 3 + 1
            time_key = f"{record.visit_date.year}-Q{quarter}"
        elif timeDimension == "year":
            time_key = str(record.visit_date.year)
        
        # 统计数量
        if time_key not in stats_data:
            stats_data[time_key] = 0
        stats_data[time_key] += 1
    
    # 转换为响应格式
    data = [{
        "time": time,
        "count": count
    } for time, count in sorted(stats_data.items())]
    
    return VisitStatsResponse(
        timeDimension=timeDimension,
        startDate=startDate.isoformat(),
        endDate=endDate.isoformat(),
        data=data
    )


@router.get("/gift", response_model=GiftStatsResponse, responses={400: {"model": ErrorResponse}})
async def get_gift_stats(
    timeDimension: str = Query(..., description="时间维度", enum=["day", "week", "month", "quarter", "year"]),
    startDate: date = Query(..., description="开始日期"),
    endDate: date = Query(..., description="结束日期"),
    current_user: SysUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取礼品申请统计数据"""
    # 验证日期范围
    if startDate > endDate:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Start date must be earlier than end date"
        )
    
    # 根据时间维度格式化日期
    start_datetime = datetime.combine(startDate, datetime.min.time())
    end_datetime = datetime.combine(endDate, datetime.max.time())
    
    # 查询礼品申请记录
    query = select(GiftApplication).where(
        GiftApplication.created_time >= start_datetime,
        GiftApplication.created_time <= end_datetime
    )
    result = await db.execute(query)
    gift_applications = result.scalars().all()
    
    # 按时间维度分组统计
    stats_data = {}  
    for application in gift_applications:
        # 获取时间维度的键
        if timeDimension == "day":
            time_key = application.created_time.strftime("%Y-%m-%d")
        elif timeDimension == "week":
            # 获取年份和周数
            year, week, _ = application.created_time.isocalendar()
            time_key = f"{year}-W{week:02d}"
        elif timeDimension == "month":
            time_key = application.created_time.strftime("%Y-%m")
        elif timeDimension == "quarter":
            # 获取年份和季度
            quarter = (application.created_time.month - 1) // 3 + 1
            time_key = f"{application.created_time.year}-Q{quarter}"
        elif timeDimension == "year":
            time_key = str(application.created_time.year)
        
        # 初始化统计数据
        if time_key not in stats_data:
            stats_data[time_key] = {
                "total": 0,
                "approved": 0,
                "rejected": 0
            }
        
        # 统计数量
        stats_data[time_key]["total"] += 1
        if application.status == "approved":
            stats_data[time_key]["approved"] += 1
        elif application.status == "rejected":
            stats_data[time_key]["rejected"] += 1
    
    # 转换为响应格式
    data = [{
        "time": time,
        "total": stats["total"],
        "approved": stats["approved"],
        "rejected": stats["rejected"]
    } for time, stats in sorted(stats_data.items())]
    
    return GiftStatsResponse(
        timeDimension=timeDimension,
        startDate=startDate.isoformat(),
        endDate=endDate.isoformat(),
        data=data
    )
