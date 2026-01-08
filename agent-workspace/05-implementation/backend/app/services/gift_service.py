"""礼品管理业务逻辑层"""
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from decimal import Decimal

from app.models.gift import Gift
from app.models.gift_requisition import GiftRequisition
from app.schemas.gift import (
    GiftRequisitionCreate,
    GiftRequisitionQueryParams,
    GiftLedgerQueryParams,
    ApprovalRequest,
    RejectionRequest,
)
from app.crud.gift_crud import (
    create_gift_requisition,
    get_gift_requisition,
    list_gift_requisitions,
    approve_gift_requisition,
    reject_gift_requisition,
    list_gift_ledger,
    list_gifts,
)


class GiftService:
    """礼品管理服务类"""

    @staticmethod
    def create_requisition(
        db: Session,
        requisition_data: GiftRequisitionCreate,
        applicant_id: str
    ) -> GiftRequisition:
        """
        创建礼品申请

        Args:
            db: 数据库会话
            requisition_data: 礼品申请创建数据
            applicant_id: 申请人ID

        Returns:
            创建的礼品申请

        Raises:
            ValueError: 业务规则校验失败
        """
        # 业务规则校验
        # 计划领用日期不能早于今天
        from datetime import date
        if requisition_data.planned_date < date.today():
            raise ValueError("Planned date cannot be in the past")

        # 创建礼品申请
        return create_gift_requisition(db, requisition_data, applicant_id)

    @staticmethod
    def get_requisition(
        db: Session,
        requisition_id: str,
        user_id: str,
        user_role: str
    ) -> Optional[GiftRequisition]:
        """
        获取礼品申请详情

        Args:
            db: 数据库会话
            requisition_id: 申请单ID
            user_id: 当前用户ID
            user_role: 当前用户角色

        Returns:
            礼品申请或None

        Raises:
            PermissionError: 无权限访问
        """
        return get_gift_requisition(db, requisition_id, user_id, user_role)

    @staticmethod
    def list_requisitions(
        db: Session,
        user_id: str,
        user_role: str,
        params: Optional[GiftRequisitionQueryParams] = None,
        page: int = 1,
        page_size: int = 10,
        sort_by: str = "create_time",
        sort_order: str = "desc"
    ) -> Tuple[List[GiftRequisition], int]:
        """
        查询礼品申请列表

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
        if params is None:
            params = GiftRequisitionQueryParams()

        return list_gift_requisitions(db, user_id, user_role, params, page, page_size, sort_by, sort_order)

    @staticmethod
    def approve_requisition(
        db: Session,
        requisition_id: str,
        approval_data: ApprovalRequest,
        approver_id: str,
        approver_role: str
    ) -> GiftRequisition:
        """
        审批通过礼品申请

        Args:
            db: 数据库会话
            requisition_id: 申请单ID
            approval_data: 审批数据
            approver_id: 审批人ID
            approver_role: 审批人角色

        Returns:
            更新后的礼品申请

        Raises:
            PermissionError: 无权限审批
            ValueError: 业务规则校验失败
        """
        # 权限控制：只有审批人员才能审批
        if approver_role != "APPROVER":
            raise PermissionError("Only approvers can approve requisitions")

        # 审批通过
        requisition = approve_gift_requisition(db, requisition_id, approver_id)

        if not requisition:
            raise ValueError("Requisition not found")

        return requisition

    @staticmethod
    def reject_requisition(
        db: Session,
        requisition_id: str,
        rejection_data: RejectionRequest,
        approver_id: str,
        approver_role: str
    ) -> GiftRequisition:
        """
        审批驳回礼品申请

        Args:
            db: 数据库会话
            requisition_id: 申请单ID
            rejection_data: 驳回数据
            approver_id: 审批人ID
            approver_role: 审批人角色

        Returns:
            更新后的礼品申请

        Raises:
            PermissionError: 无权限审批
            ValueError: 业务规则校验失败
        """
        # 权限控制：只有审批人员才能审批
        if approver_role != "APPROVER":
            raise PermissionError("Only approvers can reject requisitions")

        # 业务规则：驳回时必须填写原因
        if not rejection_data.rejection_reason or not rejection_data.rejection_reason.strip():
            raise ValueError("Rejection reason is required")

        # 审批驳回
        requisition = reject_gift_requisition(
            db,
            requisition_id,
            rejection_data.rejection_reason,
            approver_id
        )

        if not requisition:
            raise ValueError("Requisition not found")

        return requisition

    @staticmethod
    def list_ledger(
        db: Session,
        params: Optional[GiftLedgerQueryParams] = None,
        page: int = 1,
        page_size: int = 10,
        sort_by: str = "create_time",
        sort_order: str = "desc"
    ) -> Tuple[List[GiftRequisition], int]:
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
        if params is None:
            params = GiftLedgerQueryParams()

        return list_gift_ledger(db, params, page, page_size, sort_by, sort_order)

    @staticmethod
    def list_available_gifts(
        db: Session,
        page: int = 1,
        page_size: int = 10,
        status: Optional[str] = None
    ) -> Tuple[List[Gift], int]:
        """
        查询可用礼品列表

        Args:
            db: 数据库会话
            page: 页码
            page_size: 每页记录数
            status: 礼品状态（可选，默认只返回启用的礼品）

        Returns:
            (礼品列表, 总记录数)
        """
        return list_gifts(db, page, page_size, status)
