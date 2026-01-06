from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import Optional
from datetime import date, datetime

from app.database import get_db
from app.schemas.visit import VisitRequest, VisitResponse, VisitListResponse
from app.schemas.common import ErrorResponse
from app.models.visit import VisitRecord
from app.models.user import SysUser
from app.utils.auth import get_current_user

router = APIRouter()


@router.get("/", response_model=VisitListResponse, responses={500: {"model": ErrorResponse}})
async def get_visit_records(
    customerName: Optional[str] = Query(None, description="客户名称"),
    startDate: Optional[date] = Query(None, description="开始日期"),
    endDate: Optional[date] = Query(None, description="结束日期"),
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(10, ge=1, le=100, description="每页大小"),
    current_user: SysUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取拜访记录列表"""
    # 构建查询条件
    conditions = []
    if customerName:
        conditions.append(VisitRecord.customer_name.contains(customerName))
    if startDate:
        conditions.append(VisitRecord.visit_date >= datetime.combine(startDate, datetime.min.time()))
    if endDate:
        conditions.append(VisitRecord.visit_date <= datetime.combine(endDate, datetime.max.time()))
    
    # 查询总记录数
    total_query = select(VisitRecord).where(and_(*conditions))
    total_result = await db.execute(total_query)
    total = len(total_result.scalars().all())
    
    # 查询分页数据
    offset = (page - 1) * size
    query = select(VisitRecord).where(and_(*conditions)).order_by(VisitRecord.visit_date.desc()).offset(offset).limit(size)
    result = await db.execute(query)
    visit_records = result.scalars().all()
    
    # 转换为响应模型
    visit_responses = []
    for record in visit_records:
        visit_responses.append(VisitResponse(
            id=record.id,
            customerName=record.customer_name,
            visitDate=record.visit_date,
            visitContent=record.visit_content,
            customerContact=record.customer_contact,
            nextVisitPlan=record.next_visit_plan,
            createdBy=record.creator.real_name if record.creator else "",
            createdTime=record.create_time,
            updatedBy=record.updater.real_name if record.updater else None,
            updatedTime=record.update_time
        ))
    
    return VisitListResponse(
        total=total,
        page=page,
        size=size,
        data=visit_responses
    )


@router.post("/", response_model=VisitResponse, status_code=status.HTTP_201_CREATED, responses={400: {"model": ErrorResponse}})
async def create_visit_record(
    visit_request: VisitRequest,
    current_user: SysUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """创建拜访记录"""
    # 创建拜访记录
    visit_record = VisitRecord(
        customer_name=visit_request.customerName,
        customer_contact=visit_request.customerContact,
        visit_date=visit_request.visitDate,
        visit_content=visit_request.visitContent,
        next_visit_plan=visit_request.nextVisitPlan,
        created_by=current_user.id
    )
    
    db.add(visit_record)
    await db.commit()
    await db.refresh(visit_record)
    
    # 加载关联的用户信息
    await db.refresh(visit_record, attribute_names=["creator"])
    
    return VisitResponse(
        id=visit_record.id,
        customerName=visit_record.customer_name,
        visitDate=visit_record.visit_date,
        visitContent=visit_record.visit_content,
        customerContact=visit_record.customer_contact,
        nextVisitPlan=visit_record.next_visit_plan,
        createdBy=visit_record.creator.real_name,
        createdTime=visit_record.create_time,
        updatedBy=None,
        updatedTime=visit_record.update_time
    )


@router.get("/{id}", response_model=VisitResponse, responses={404: {"model": ErrorResponse}})
async def get_visit_record(
    id: int,
    current_user: SysUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取拜访记录详情"""
    query = select(VisitRecord).where(VisitRecord.id == id)
    result = await db.execute(query)
    visit_record = result.scalar_one_or_none()
    
    if not visit_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Visit record not found"
        )
    
    # 加载关联的用户信息
    await db.refresh(visit_record, attribute_names=["creator", "updater"])
    
    return VisitResponse(
        id=visit_record.id,
        customerName=visit_record.customer_name,
        visitDate=visit_record.visit_date,
        visitContent=visit_record.visit_content,
        customerContact=visit_record.customer_contact,
        nextVisitPlan=visit_record.next_visit_plan,
        createdBy=visit_record.creator.real_name,
        createdTime=visit_record.create_time,
        updatedBy=visit_record.updater.real_name if visit_record.updater else None,
        updatedTime=visit_record.update_time
    )


@router.put("/{id}", response_model=VisitResponse, responses={400: {"model": ErrorResponse}, 404: {"model": ErrorResponse}})
async def update_visit_record(
    id: int,
    visit_request: VisitRequest,
    current_user: SysUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """更新拜访记录"""
    query = select(VisitRecord).where(VisitRecord.id == id)
    result = await db.execute(query)
    visit_record = result.scalar_one_or_none()
    
    if not visit_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Visit record not found"
        )
    
    # 更新拜访记录
    visit_record.customer_name = visit_request.customerName
    visit_record.customer_contact = visit_request.customerContact
    visit_record.visit_date = visit_request.visitDate
    visit_record.visit_content = visit_request.visitContent
    visit_record.next_visit_plan = visit_request.nextVisitPlan
    visit_record.updated_by = current_user.id
    
    await db.commit()
    await db.refresh(visit_record, attribute_names=["creator", "updater"])
    
    return VisitResponse(
        id=visit_record.id,
        customerName=visit_record.customer_name,
        visitDate=visit_record.visit_date,
        visitContent=visit_record.visit_content,
        customerContact=visit_record.customer_contact,
        nextVisitPlan=visit_record.next_visit_plan,
        createdBy=visit_record.creator.real_name,
        createdTime=visit_record.create_time,
        updatedBy=visit_record.updater.real_name,
        updatedTime=visit_record.update_time
    )


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT, responses={404: {"model": ErrorResponse}})
async def delete_visit_record(
    id: int,
    current_user: SysUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """删除拜访记录"""
    query = select(VisitRecord).where(VisitRecord.id == id)
    result = await db.execute(query)
    visit_record = result.scalar_one_or_none()
    
    if not visit_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Visit record not found"
        )
    
    await db.delete(visit_record)
    await db.commit()
    
    return None
