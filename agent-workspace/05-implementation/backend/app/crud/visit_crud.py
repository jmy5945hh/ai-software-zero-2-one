"""拜访记录 CRUD 操作"""
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from app.models.customer_visit import CustomerVisit
from app.schemas.visit import VisitCreate, VisitUpdate, VisitQueryParams


def generate_visit_id() -> str:
    """生成拜访记录ID（简化版，实际应使用雪花算法或UUID）"""
    import time
    timestamp = int(time.time() * 1000)
    return f"VIS{timestamp}"


def create_visit(db: Session, visit: VisitCreate, creator_id: str) -> CustomerVisit:
    """
    创建拜访记录

    Args:
        db: 数据库会话
        visit: 拜访记录创建数据
        creator_id: 创建人ID

    Returns:
        创建的拜访记录
    """
    visit_id = generate_visit_id()
    db_visit = CustomerVisit(
        visit_id=visit_id,
        customer_id=visit.customer_id,
        company_name=visit.company_name,
        planned_date=visit.planned_date,
        actual_date=visit.actual_date,
        visit_method=visit.visit_method,
        interested_products=visit.interested_products,
        participants=visit.participants,
        status=visit.status,
        notes=visit.notes,
        create_by=creator_id,
    )
    db.add(db_visit)
    db.commit()
    db.refresh(db_visit)
    return db_visit


def get_visit(db: Session, visit_id: str, user_id: str, user_role: str) -> Optional[CustomerVisit]:
    """
    获取单个拜访记录（带权限控制）

    Args:
        db: 数据库会话
        visit_id: 拜访记录ID
        user_id: 当前用户ID
        user_role: 当前用户角色

    Returns:
        拜访记录或None
    """
    visit = db.query(CustomerVisit).filter(CustomerVisit.visit_id == visit_id).first()

    # 数据级权限控制
    if visit:
        # 客户经理只能查看自己创建或参与的记录
        if user_role == "CUSTOMER_MANAGER":
            if visit.create_by != user_id:
                # 检查是否是参与人员
                if visit.participants and user_id not in visit.participants:
                    return None
        # 运营人员和管理者可以查看所有记录
        # 审批人员也可以查看所有记录

    return visit


def update_visit(db: Session, visit_id: str, visit_update: VisitUpdate, user_id: str, user_role: str) -> Optional[CustomerVisit]:
    """
    更新拜访记录（仅创建人可编辑）

    Args:
        db: 数据库会话
        visit_id: 拜访记录ID
        visit_update: 更新数据
        user_id: 当前用户ID
        user_role: 当前用户角色

    Returns:
        更新后的拜访记录或None
    """
    # 获取拜访记录
    visit = db.query(CustomerVisit).filter(CustomerVisit.visit_id == visit_id).first()

    if not visit:
        return None

    # 权限控制：只有创建人可以编辑
    if visit.create_by != user_id:
        return None

    # 更新字段
    update_data = visit_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(visit, field, value)

    db.commit()
    db.refresh(visit)
    return visit


def list_visits(
    db: Session,
    user_id: str,
    user_role: str,
    params: VisitQueryParams,
    page: int = 1,
    page_size: int = 10,
    sort_by: str = "create_time",
    sort_order: str = "desc",
) -> tuple[List[CustomerVisit], int]:
    """
    查询拜访记录列表（带权限控制和分页）

    Args:
        db: 数据库会话
        user_id: 当前用户ID
        user_role: 当前用户角色
        params: 查询参数
        page: 页码
        page_size: 每页记录数
        sort_by: 排序字段
        sort_order: 排序方向

    Returns:
        (拜访记录列表, 总记录数)
    """
    # 构建基础查询
    query = db.query(CustomerVisit)

    # 数据级权限控制
    if user_role == "CUSTOMER_MANAGER":
        # 客户经理只能查看自己创建或参与的记录
        query = query.filter(
            or_(
                CustomerVisit.create_by == user_id,
                CustomerVisit.participants.contains(user_id)
            )
        )
    # 运营人员、管理者、审批人员可以查看所有记录

    # 应用筛选条件
    if params.customer_id:
        query = query.filter(CustomerVisit.customer_id == params.customer_id)

    if params.planned_date_start:
        query = query.filter(CustomerVisit.planned_date >= params.planned_date_start)

    if params.planned_date_end:
        query = query.filter(CustomerVisit.planned_date <= params.planned_date_end)

    if params.actual_date_start:
        query = query.filter(CustomerVisit.actual_date >= params.actual_date_start)

    if params.actual_date_end:
        query = query.filter(CustomerVisit.actual_date <= params.actual_date_end)

    if params.status:
        query = query.filter(CustomerVisit.status == params.status)

    if params.create_by:
        query = query.filter(CustomerVisit.create_by == params.create_by)

    # 计算总记录数
    total = query.count()

    # 排序
    sort_column = getattr(CustomerVisit, sort_by, CustomerVisit.create_time)
    if sort_order.lower() == "asc":
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())

    # 分页
    offset = (page - 1) * page_size
    visits = query.offset(offset).limit(page_size).all()

    return visits, total
