from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import Optional
from datetime import date, datetime

from app.database import get_db
from app.schemas.gift import (
    GiftApplicationRequest, 
    GiftApplicationResponse, 
    GiftApplicationListResponse, 
    GiftApprovalRequest
)
from app.schemas.common import ErrorResponse
from app.models.gift import GiftApplication
from app.models.user import SysUser
from app.utils.auth import get_current_user

router = APIRouter()


@router.get("/applications", response_model=GiftApplicationListResponse, responses={500: {"model": ErrorResponse}})
async def get_gift_applications(
    status: Optional[str] = Query(None, description="申请状态", enum=["pending", "approved", "rejected"]),
    applicantName: Optional[str] = Query(None, description="申请人姓名"),
    startDate: Optional[date] = Query(None, description="开始日期"),
    endDate: Optional[date] = Query(None, description="结束日期"),
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(10, ge=1, le=100, description="每页大小"),
    current_user: SysUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取礼品申请列表"""
    # 构建查询条件
    conditions = []
    if status:
        conditions.append(GiftApplication.status == status)
    if startDate:
        conditions.append(GiftApplication.created_time >= datetime.combine(startDate, datetime.min.time()))
    if endDate:
        conditions.append(GiftApplication.created_time <= datetime.combine(endDate, datetime.max.time()))
    
    # 查询总记录数
    total_query = select(GiftApplication).where(and_(*conditions))
    total_result = await db.execute(total_query)
    total = len(total_result.scalars().all())
    
    # 查询分页数据
    offset = (page - 1) * size
    query = select(GiftApplication).where(and_(*conditions)).order_by(GiftApplication.created_time.desc()).offset(offset).limit(size)
    result = await db.execute(query)
    gift_applications = result.scalars().all()
    
    # 转换为响应模型
    gift_responses = []
    for application in gift_applications:
        # 加载关联的用户信息
        await db.refresh(application, attribute_names=["applicant", "approver"])
        
        gift_responses.append(GiftApplicationResponse(
            id=application.id,
            customerName=application.customer_name,
            giftName=application.gift_name,
            quantity=application.quantity,
            reason=application.reason,
            status=application.status,
            applicantName=application.applicant.real_name if application.applicant else "",
            approveName=application.approver.real_name if application.approver else None,
            approveComment=application.approve_comment,
            approveTime=application.approve_time,
            createdTime=application.created_time
        ))
    
    return GiftApplicationListResponse(
        total=total,
        page=page,
        size=size,
        data=gift_responses
    )


@router.post("/applications", response_model=GiftApplicationResponse, status_code=status.HTTP_201_CREATED, responses={400: {"model": ErrorResponse}})
async def create_gift_application(
    gift_request: GiftApplicationRequest,
    current_user: SysUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """创建礼品申请"""
    # 创建礼品申请
    gift_application = GiftApplication(
        customer_name=gift_request.customerName,
        gift_name=gift_request.giftName,
        quantity=gift_request.quantity,
        reason=gift_request.reason,
        applicant_id=current_user.id
    )
    
    db.add(gift_application)
    await db.commit()
    await db.refresh(gift_application)
    
    # 加载关联的用户信息
    await db.refresh(gift_application, attribute_names=["applicant"])
    
    return GiftApplicationResponse(
        id=gift_application.id,
        customerName=gift_application.customer_name,
        giftName=gift_application.gift_name,
        quantity=gift_application.quantity,
        reason=gift_application.reason,
        status=gift_application.status,
        applicantName=gift_application.applicant.real_name,
        approveName=None,
        approveComment=None,
        approveTime=None,
        createdTime=gift_application.created_time
    )


@router.get("/applications/{id}", response_model=GiftApplicationResponse, responses={404: {"model": ErrorResponse}})
async def get_gift_application(
    id: int,
    current_user: SysUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取礼品申请详情"""
    query = select(GiftApplication).where(GiftApplication.id == id)
    result = await db.execute(query)
    gift_application = result.scalar_one_or_none()
    
    if not gift_application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gift application not found"
        )
    
    # 加载关联的用户信息
    await db.refresh(gift_application, attribute_names=["applicant", "approver"])
    
    return GiftApplicationResponse(
        id=gift_application.id,
        customerName=gift_application.customer_name,
        giftName=gift_application.gift_name,
        quantity=gift_application.quantity,
        reason=gift_application.reason,
        status=gift_application.status,
        applicantName=gift_application.applicant.real_name,
        approveName=gift_application.approver.real_name if gift_application.approver else None,
        approveComment=gift_application.approve_comment,
        approveTime=gift_application.approve_time,
        createdTime=gift_application.created_time
    )


@router.put("/applications/{id}", response_model=GiftApplicationResponse, responses={400: {"model": ErrorResponse}, 404: {"model": ErrorResponse}})
async def update_gift_application(
    id: int,
    gift_request: GiftApplicationRequest,
    current_user: SysUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """更新礼品申请"""
    query = select(GiftApplication).where(GiftApplication.id == id)
    result = await db.execute(query)
    gift_application = result.scalar_one_or_none()
    
    if not gift_application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gift application not found"
        )
    
    # 只有待审批的申请才能更新
    if gift_application.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending applications can be updated"
        )
    
    # 更新礼品申请
    gift_application.customer_name = gift_request.customerName
    gift_application.gift_name = gift_request.giftName
    gift_application.quantity = gift_request.quantity
    gift_application.reason = gift_request.reason
    
    await db.commit()
    await db.refresh(gift_application, attribute_names=["applicant"])
    
    return GiftApplicationResponse(
        id=gift_application.id,
        customerName=gift_application.customer_name,
        giftName=gift_application.gift_name,
        quantity=gift_application.quantity,
        reason=gift_application.reason,
        status=gift_application.status,
        applicantName=gift_application.applicant.real_name,
        approveName=None,
        approveComment=None,
        approveTime=None,
        createdTime=gift_application.created_time
    )


@router.post("/applications/{id}/approve", response_model=GiftApplicationResponse, responses={400: {"model": ErrorResponse}, 404: {"model": ErrorResponse}})
async def approve_gift_application(
    id: int,
    approval_request: GiftApprovalRequest,
    current_user: SysUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """审批礼品申请"""
    # 只有管理员或经理可以审批
    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to approve gift applications"
        )
    
    query = select(GiftApplication).where(GiftApplication.id == id)
    result = await db.execute(query)
    gift_application = result.scalar_one_or_none()
    
    if not gift_application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gift application not found"
        )
    
    # 只有待审批的申请才能审批
    if gift_application.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending applications can be approved"
        )
    
    # 更新礼品申请状态
    gift_application.status = approval_request.status
    gift_application.approve_id = current_user.id
    gift_application.approve_comment = approval_request.comment
    gift_application.approve_time = datetime.now()
    
    await db.commit()
    await db.refresh(gift_application, attribute_names=["applicant", "approver"])
    
    return GiftApplicationResponse(
        id=gift_application.id,
        customerName=gift_application.customer_name,
        giftName=gift_application.gift_name,
        quantity=gift_application.quantity,
        reason=gift_application.reason,
        status=gift_application.status,
        applicantName=gift_application.applicant.real_name,
        approveName=gift_application.approver.real_name,
        approveComment=gift_application.approve_comment,
        approveTime=gift_application.approve_time,
        createdTime=gift_application.created_time
    )
