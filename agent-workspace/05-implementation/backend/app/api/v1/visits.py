"""拜访管理 API 路由"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.db.session import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.visit import VisitCreate, VisitUpdate, VisitResponse, VisitQueryParams
from app.schemas.common import ApiResponse, PaginatedResponse
from app.services.visit_service import VisitService

router = APIRouter()


@router.post("", response_model=ApiResponse[VisitResponse], summary="新增拜访记录")
async def create_visit(
    visit_data: VisitCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    创建新的客户拜访记录

    - **customer_id**: 客户ID（必填）
    - **company_name**: 企业名称（必填）
    - **planned_date**: 计划拜访日期（必填）
    - **actual_date**: 实际拜访日期（可选）
    - **visit_method**: 拜访方式（必填）
    - **interested_products**: 意向理财产品列表（可选）
    - **participants**: 参与人员列表（可选，默认包含当前用户）
    - **status**: 拜访状态（必填）
    - **notes**: 备注信息（可选）
    """
    try:
        visit = VisitService.create_visit_record(db, visit_data, current_user.user_id)
        return ApiResponse(data=visit)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("", response_model=ApiResponse[PaginatedResponse[VisitResponse]], summary="查询拜访记录列表")
async def list_visits(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(10, ge=1, le=100, description="每页记录数"),
    sort_by: str = Query("create_time", description="排序字段"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$", description="排序方向"),
    customer_id: Optional[str] = Query(None, description="客户ID"),
    planned_date_start: Optional[str] = Query(None, description="计划拜访日期(起始)"),
    planned_date_end: Optional[str] = Query(None, description="计划拜访日期(结束)"),
    actual_date_start: Optional[str] = Query(None, description="实际拜访日期(起始)"),
    actual_date_end: Optional[str] = Query(None, description="实际拜访日期(结束)"),
    status: Optional[str] = Query(None, description="拜访状态"),
    create_by: Optional[str] = Query(None, description="创建人ID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    查询客户拜访记录列表，支持分页、筛选和排序

    权限说明：
    - 客户经理：只能查看自己创建或参与的记录
    - 运营人员、管理者、审批人员：可以查看所有记录
    """
    # 构建查询参数
    params = VisitQueryParams(
        customer_id=customer_id,
        planned_date_start=planned_date_start,
        planned_date_end=planned_date_end,
        actual_date_start=actual_date_start,
        actual_date_end=actual_date_end,
        status=status,
        create_by=create_by,
    )

    try:
        visits, total = VisitService.list_visit_records(
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
            items=visits,
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


@router.get("/{visit_id}", response_model=ApiResponse[VisitResponse], summary="获取拜访记录详情")
async def get_visit(
    visit_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    根据拜访记录ID获取详细信息

    权限说明：
    - 客户经理：只能查看自己创建或参与的记录
    - 运营人员、管理者、审批人员：可以查看所有记录
    """
    visit = VisitService.get_visit_record(db, visit_id, current_user.user_id, current_user.role)

    if not visit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Visit record not found",
        )

    return ApiResponse(data=visit)


@router.put("/{visit_id}", response_model=ApiResponse[VisitResponse], summary="更新拜访记录")
async def update_visit(
    visit_id: str,
    visit_data: VisitUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    更新拜访记录信息（仅创建人可编辑）

    权限说明：
    - 只有记录的创建人可以编辑
    - 参与人员不可编辑记录
    """
    try:
        visit = VisitService.update_visit_record(
            db,
            visit_id,
            visit_data,
            current_user.user_id,
            current_user.role,
        )

        if not visit:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Visit record not found",
            )

        return ApiResponse(data=visit)
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
