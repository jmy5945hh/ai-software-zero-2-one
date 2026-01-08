"""礼品管理 CRUD 操作"""
from typing import Optional, List
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_
from decimal import Decimal
from datetime import datetime

from app.models.gift import Gift
from app.models.gift_requisition import GiftRequisition
from app.models.gift_requisition_item import GiftRequisitionItem
from app.schemas.gift import (
    GiftRequisitionCreate,
    GiftRequisitionQueryParams,
    GiftLedgerQueryParams,
)


def generate_requisition_id() -> str:
    """生成申请单ID（简化版，实际应使用雪花算法或UUID）"""
    import time
    timestamp = int(time.time() * 1000)
    return f"GIFT{timestamp}"


def generate_item_id() -> str:
    """生成明细项ID（简化版，实际应使用雪花算法或UUID）"""
    import time
    timestamp = int(time.time() * 1000)
    import random
    return f"ITEM{timestamp}{random.randint(1000, 9999)}"


def create_gift_requisition(
    db: Session,
    requisition: GiftRequisitionCreate,
    applicant_id: str
) -> GiftRequisition:
    """
    创建礼品申请

    Args:
        db: 数据库会话
        requisition: 礼品申请创建数据
        applicant_id: 申请人ID

    Returns:
        创建的礼品申请
    """
    requisition_id = generate_requisition_id()

    # 计算总金额
    total_amount = Decimal("0.00")

    # 创建申请单
    db_requisition = GiftRequisition(
        requisition_id=requisition_id,
        applicant=applicant_id,
        recipient=requisition.recipient,
        total_amount=total_amount,  # 先设置为0，后面会更新
        planned_date=requisition.planned_date,
        purpose_type=requisition.purpose_type,
        related_visit_id=requisition.related_visit_id,
        approval_status="PENDING",
    )
    db.add(db_requisition)

    # 创建明细项并累加总金额
    for item_data in requisition.gift_items:
        # 查询礼品获取单价
        gift = db.query(Gift).filter(Gift.gift_id == item_data.gift_id).first()
        if not gift:
            raise ValueError(f"Gift {item_data.gift_id} not found")

        unit_price = gift.unit_price
        subtotal = unit_price * item_data.quantity
        total_amount += subtotal

        item_id = generate_item_id()
        db_item = GiftRequisitionItem(
            item_id=item_id,
            requisition_id=requisition_id,
            gift_id=item_data.gift_id,
            quantity=item_data.quantity,
            unit_price=unit_price,
            subtotal=subtotal,
        )
        db.add(db_item)

    # 更新总金额
    db_requisition.total_amount = total_amount

    db.commit()

    # 重新查询以加载所有关系
    from sqlalchemy.orm import joinedload
    db.refresh(db_requisition)
    requisition = (
        db.query(GiftRequisition)
        .options(joinedload(GiftRequisition.items).joinedload(GiftRequisitionItem.gift))
        .filter(GiftRequisition.requisition_id == requisition_id)
        .first()
    )
    return requisition


def get_gift_requisition(
    db: Session,
    requisition_id: str,
    user_id: str,
    user_role: str
) -> Optional[GiftRequisition]:
    """
    获取单个礼品申请（带权限控制）

    Args:
        db: 数据库会话
        requisition_id: 申请单ID
        user_id: 当前用户ID
        user_role: 当前用户角色

    Returns:
        礼品申请或None
    """
    # 使用 joinedload 预加载 items 和 gift 关系
    from sqlalchemy.orm import joinedload
    requisition = (
        db.query(GiftRequisition)
        .options(joinedload(GiftRequisition.items).joinedload(GiftRequisitionItem.gift))
        .filter(GiftRequisition.requisition_id == requisition_id)
        .first()
    )

    # 数据级权限控制
    if requisition:
        # 客户经理只能查看自己的申请
        if user_role == "CUSTOMER_MANAGER":
            if requisition.applicant != user_id:
                return None
        # 运营人员、管理者、审批人员可以查看所有申请

    return requisition


def list_gift_requisitions(
    db: Session,
    user_id: str,
    user_role: str,
    params: Optional[GiftRequisitionQueryParams] = None,
    page: int = 1,
    page_size: int = 10,
    sort_by: str = "create_time",
    sort_order: str = "desc",
) -> tuple[List[GiftRequisition], int]:
    """
    查询礼品申请列表（带权限控制和分页）

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
        (礼品申请列表, 总记录数)
    """
    # 构建基础查询
    query = db.query(GiftRequisition)

    # 数据级权限控制
    if user_role == "CUSTOMER_MANAGER":
        # 客户经理只能查看自己的申请
        query = query.filter(GiftRequisition.applicant == user_id)
    # 运营人员、管理者、审批人员可以查看所有申请

    # 应用筛选条件
    if params:
        if params.approval_status:
            query = query.filter(GiftRequisition.approval_status == params.approval_status)

        if params.planned_date_start:
            query = query.filter(GiftRequisition.planned_date >= params.planned_date_start)

        if params.planned_date_end:
            query = query.filter(GiftRequisition.planned_date <= params.planned_date_end)

    # 计算总记录数
    total = query.count()

    # 排序
    sort_column = getattr(GiftRequisition, sort_by, GiftRequisition.create_time)
    if sort_order.lower() == "asc":
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())

    # 分页
    offset = (page - 1) * page_size
    requisitions = query.offset(offset).limit(page_size).all()

    return requisitions, total


def approve_gift_requisition(
    db: Session,
    requisition_id: str,
    approver_id: str
) -> Optional[GiftRequisition]:
    """
    审批通过礼品申请

    Args:
        db: 数据库会话
        requisition_id: 申请单ID
        approver_id: 审批人ID

    Returns:
        更新后的礼品申请或None
    """
    from sqlalchemy.orm import joinedload
    requisition = (
        db.query(GiftRequisition)
        .options(joinedload(GiftRequisition.items).joinedload(GiftRequisitionItem.gift))
        .filter(GiftRequisition.requisition_id == requisition_id)
        .first()
    )

    if not requisition:
        return None

    # 检查状态
    if requisition.approval_status != "PENDING":
        raise ValueError("Only pending requisitions can be approved")

    # 更新状态
    requisition.approval_status = "APPROVED"
    requisition.approver = approver_id
    requisition.approval_time = datetime.now().isoformat()

    db.commit()
    db.refresh(requisition)
    return requisition


def reject_gift_requisition(
    db: Session,
    requisition_id: str,
    rejection_reason: str,
    approver_id: str
) -> Optional[GiftRequisition]:
    """
    审批驳回礼品申请

    Args:
        db: 数据库会话
        requisition_id: 申请单ID
        rejection_reason: 驳回原因
        approver_id: 审批人ID

    Returns:
        更新后的礼品申请或None
    """
    from sqlalchemy.orm import joinedload
    requisition = (
        db.query(GiftRequisition)
        .options(joinedload(GiftRequisition.items).joinedload(GiftRequisitionItem.gift))
        .filter(GiftRequisition.requisition_id == requisition_id)
        .first()
    )

    if not requisition:
        return None

    # 检查状态
    if requisition.approval_status != "PENDING":
        raise ValueError("Only pending requisitions can be rejected")

    # 更新状态
    requisition.approval_status = "REJECTED"
    requisition.rejection_reason = rejection_reason
    requisition.approver = approver_id
    requisition.approval_time = datetime.now().isoformat()

    db.commit()
    db.refresh(requisition)
    return requisition


def list_gift_ledger(
    db: Session,
    params: Optional[GiftLedgerQueryParams] = None,
    page: int = 1,
    page_size: int = 10,
    sort_by: str = "create_time",
    sort_order: str = "desc",
) -> tuple[List[GiftRequisition], int]:
    """
    查询礼品台账（仅包含已审批通过的记录）

    Args:
        db: 数据库会话
        params: 查询参数
        page: 页码
        page_size: 每页记录数
        sort_by: 排序字段
        sort_order: 排序方向

    Returns:
        (礼品申请列表, 总记录数)
    """
    # 构建基础查询（只查询已审批通过的）
    query = db.query(GiftRequisition).filter(GiftRequisition.approval_status == "APPROVED")

    # 应用筛选条件
    if params:
        # 这里需要通过 gift_category 来筛选，需要 join items
        if params.gift_category:
            query = (
                query.join(GiftRequisitionItem)
                .join(Gift)
                .filter(Gift.gift_category == params.gift_category)
            )

        if params.planned_date_start:
            query = query.filter(GiftRequisition.planned_date >= params.planned_date_start)

        if params.planned_date_end:
            query = query.filter(GiftRequisition.planned_date <= params.planned_date_end)

    # 计算总记录数
    total = query.count()

    # 排序
    sort_column = getattr(GiftRequisition, sort_by, GiftRequisition.create_time)
    if sort_order.lower() == "asc":
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())

    # 分页
    offset = (page - 1) * page_size
    requisitions = query.offset(offset).limit(page_size).all()

    return requisitions, total


def list_gifts(
    db: Session,
    page: int = 1,
    page_size: int = 10,
    status: Optional[str] = None,
) -> tuple[List[Gift], int]:
    """
    查询可用礼品列表

    Args:
        db: 数据库会话
        page: 页码
        page_size: 每页记录数
        status: 礼品状态（可选）

    Returns:
        (礼品列表, 总记录数)
    """
    query = db.query(Gift)

    # 应用筛选条件
    if status:
        query = query.filter(Gift.status == status)
    else:
        # 默认只返回启用的礼品
        query = query.filter(Gift.status == "ACTIVE")

    # 计算总记录数
    total = query.count()

    # 分页
    offset = (page - 1) * page_size
    gifts = query.offset(offset).limit(page_size).all()

    return gifts, total
