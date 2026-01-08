"""礼品管理 API 路由"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.db.session import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.gift import (
    GiftRequisitionCreate,
    GiftRequisitionResponse,
    GiftItemResponse,
    ApprovalRequest,
    RejectionRequest,
    GiftRequisitionQueryParams,
    GiftLedgerQueryParams,
    GiftResponse,
)
from app.schemas.common import ApiResponse, PaginatedResponse
from app.services.gift_service import GiftService

router = APIRouter()


# ========== 礼品申请管理 ==========


@router.post("/applications", response_model=ApiResponse[GiftRequisitionResponse], summary="提交礼品申请")
async def create_gift_application(
    requisition_data: GiftRequisitionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    客户经理提交新的礼品领用申请

    - **recipient**: 领用人ID（必填）
    - **gift_items**: 礼品列表（必填，至少包含一个礼品）
    - **planned_date**: 计划领用日期（必填）
    - **purpose_type**: 目的类型（必填）
    - **related_visit_id**: 关联客户拜访记录ID（可选）
    """
    try:
        requisition = GiftService.create_requisition(db, requisition_data, current_user.user_id)
        return ApiResponse(data=requisition)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/applications", response_model=ApiResponse[PaginatedResponse[GiftRequisitionResponse]], summary="查询礼品申请列表")
async def list_gift_applications(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(10, ge=1, le=100, description="每页记录数"),
    sort_by: str = Query("create_time", description="排序字段"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$", description="排序方向"),
    approval_status: Optional[str] = Query(None, description="审批状态"),
    planned_date_start: Optional[str] = Query(None, description="计划领用日期(起始)"),
    planned_date_end: Optional[str] = Query(None, description="计划领用日期(结束)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    查询礼品申请列表，支持分页和筛选

    权限说明：
    - 客户经理：只能查看自己的申请
    - 运营人员、管理者、审批人员：可以查看所有申请
    """
    # 构建查询参数
    params = GiftRequisitionQueryParams(
        approval_status=approval_status,
        planned_date_start=planned_date_start,
        planned_date_end=planned_date_end,
    )

    try:
        requisitions, total = GiftService.list_requisitions(
            db,
            current_user.user_id,
            current_user.role,
            params,
            page,
            page_size,
            sort_by,
            sort_order,
        )

        total_pages = (total + page_size - 1) // page_size

        paginated_data = PaginatedResponse(
            items=requisitions,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

        return ApiResponse(data=paginated_data)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/applications/{requisition_id}", response_model=ApiResponse[GiftRequisitionResponse], summary="获取礼品申请详情")
async def get_gift_application(
    requisition_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    根据礼品申请ID获取详细信息

    权限说明：
    - 客户经理：只能查看自己的申请
    - 运营人员、管理者、审批人员：可以查看所有申请
    """
    requisition = GiftService.get_requisition(db, requisition_id, current_user.user_id, current_user.role)

    if not requisition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gift requisition not found",
        )

    return ApiResponse(data=requisition)


# ========== 礼品审批管理 ==========


@router.get("/approvals", response_model=ApiResponse[PaginatedResponse[GiftRequisitionResponse]], summary="查询待审批申请列表")
async def list_pending_approvals(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(10, ge=1, le=100, description="每页记录数"),
    sort_by: str = Query("create_time", description="排序字段"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$", description="排序方向"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    审批人员查询所有待审批的礼品申请

    权限说明：
    - 只有审批人员可以访问
    """
    # 权限检查
    if current_user.role != "APPROVER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only approvers can access this endpoint",
        )

    # 只查询待审批的申请
    params = GiftRequisitionQueryParams(approval_status="PENDING")

    try:
        requisitions, total = GiftService.list_requisitions(
            db,
            current_user.user_id,
            current_user.role,
            params,
            page,
            page_size,
            sort_by,
            sort_order,
        )

        total_pages = (total + page_size - 1) // page_size

        paginated_data = PaginatedResponse(
            items=requisitions,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

        return ApiResponse(data=paginated_data)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/approvals/{requisition_id}/approve", response_model=ApiResponse[GiftRequisitionResponse], summary="审批通过")
async def approve_gift_application(
    requisition_id: str,
    approval_data: ApprovalRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    审批人员通过礼品申请

    权限说明：
    - 只有审批人员可以审批
    """
    try:
        requisition = GiftService.approve_requisition(
            db,
            requisition_id,
            approval_data,
            current_user.user_id,
            current_user.role,
        )
        return ApiResponse(data=requisition)
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/approvals/{requisition_id}/reject", response_model=ApiResponse[GiftRequisitionResponse], summary="审批驳回")
async def reject_gift_application(
    requisition_id: str,
    rejection_data: RejectionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    审批人员驳回礼品申请（必须填写驳回原因）

    权限说明：
    - 只有审批人员可以审批
    - 驳回时必须填写原因
    """
    try:
        requisition = GiftService.reject_requisition(
            db,
            requisition_id,
            rejection_data,
            current_user.user_id,
            current_user.role,
        )
        return ApiResponse(data=requisition)
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/approvals/history", response_model=ApiResponse[PaginatedResponse[GiftRequisitionResponse]], summary="查询审批历史")
async def list_approval_history(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(10, ge=1, le=100, description="每页记录数"),
    sort_by: str = Query("create_time", description="排序字段"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$", description="排序方向"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    审批人员查看已审批的申请记录

    权限说明：
    - 只有审批人员可以访问
    """
    # 权限检查
    if current_user.role != "APPROVER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only approvers can access this endpoint",
        )

    try:
        # 查询所有非待审批的申请（已通过 + 已驳回）
        requisitions, total = GiftService.list_requisitions(
            db,
            current_user.user_id,
            current_user.role,
            None,  # 不传筛选参数
            page,
            page_size,
            sort_by,
            sort_order,
        )

        # 手动过滤出已审批的记录（非待审批状态）
        filtered_requisitions = [r for r in requisitions if r.approval_status in ["APPROVED", "REJECTED"]]
        total = len(filtered_requisitions)

        total_pages = (total + page_size - 1) // page_size

        paginated_data = PaginatedResponse(
            items=filtered_requisitions,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

        return ApiResponse(data=paginated_data)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


# ========== 礼品台账管理 ==========


@router.get("/ledger", response_model=ApiResponse[PaginatedResponse[GiftRequisitionResponse]], summary="查询礼品台账")
async def list_gift_ledger(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(10, ge=1, le=100, description="每页记录数"),
    sort_by: str = Query("create_time", description="排序字段"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$", description="排序方向"),
    gift_category: Optional[str] = Query(None, description="礼品分类"),
    planned_date_start: Optional[str] = Query(None, description="计划领用日期(起始)"),
    planned_date_end: Optional[str] = Query(None, description="计划领用日期(结束)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    运营人员和管理者查询所有已审批通过的礼品记录

    权限说明：
    - 运营人员和管理者可以访问
    - 客户经理和审批人员无权访问
    """
    # 权限检查
    if current_user.role not in ["OPERATIONS", "MANAGER"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only operations staff and managers can access this endpoint",
        )

    # 构建查询参数
    params = GiftLedgerQueryParams(
        gift_category=gift_category,
        planned_date_start=planned_date_start,
        planned_date_end=planned_date_end,
    )

    try:
        requisitions, total = GiftService.list_ledger(
            db,
            params,
            page,
            page_size,
            sort_by,
            sort_order,
        )

        total_pages = (total + page_size - 1) // page_size

        paginated_data = PaginatedResponse(
            items=requisitions,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

        return ApiResponse(data=paginated_data)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


# ========== 礼品列表管理 ==========


@router.get("", response_model=ApiResponse[PaginatedResponse[GiftResponse]], summary="查询可用礼品列表")
async def list_gifts(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(10, ge=1, le=100, description="每页记录数"),
    status: Optional[str] = Query(None, description="礼品状态"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    查询可用礼品列表（默认只返回启用的礼品）

    所有认证用户都可以访问
    """
    try:
        gifts, total = GiftService.list_available_gifts(db, page, page_size, status)

        total_pages = (total + page_size - 1) // page_size

        paginated_data = PaginatedResponse(
            items=gifts,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

        return ApiResponse(data=paginated_data)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
