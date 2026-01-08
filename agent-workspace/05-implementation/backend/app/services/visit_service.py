"""拜访管理业务逻辑层"""
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from app.models.customer_visit import CustomerVisit
from app.schemas.visit import VisitCreate, VisitUpdate, VisitQueryParams
from app.crud.visit_crud import create_visit, get_visit, update_visit, list_visits


class VisitService:
    """拜访管理服务类"""

    @staticmethod
    def create_visit_record(db: Session, visit_data: VisitCreate, creator_id: str) -> CustomerVisit:
        """
        创建拜访记录

        Args:
            db: 数据库会话
            visit_data: 拜访记录创建数据
            creator_id: 创建人ID

        Returns:
            创建的拜访记录

        Raises:
            ValueError: 业务规则校验失败
        """
        # 业务规则校验
        # 实际拜访日期不能早于计划拜访日期
        if visit_data.actual_date and visit_data.actual_date < visit_data.planned_date:
            raise ValueError("Actual date cannot be earlier than planned date")

        # 参与人员默认包含创建人（如果没有设置）
        if visit_data.participants is None:
            visit_data.participants = [creator_id]
        elif creator_id not in visit_data.participants:
            visit_data.participants.append(creator_id)

        # 创建拜访记录
        return create_visit(db, visit_data, creator_id)

    @staticmethod
    def get_visit_record(db: Session, visit_id: str, user_id: str, user_role: str) -> Optional[CustomerVisit]:
        """
        获取拜访记录详情

        Args:
            db: 数据库会话
            visit_id: 拜访记录ID
            user_id: 当前用户ID
            user_role: 当前用户角色

        Returns:
            拜访记录或None

        Raises:
            PermissionError: 无权限访问
        """
        visit = get_visit(db, visit_id, user_id, user_role)

        if not visit:
            return None

        return visit

    @staticmethod
    def update_visit_record(
        db: Session,
        visit_id: str,
        visit_data: VisitUpdate,
        user_id: str,
        user_role: str
    ) -> Optional[CustomerVisit]:
        """
        更新拜访记录

        Args:
            db: 数据库会话
            visit_id: 拜访记录ID
            visit_data: 更新数据
            user_id: 当前用户ID
            user_role: 当前用户角色

        Returns:
            更新后的拜访记录或None

        Raises:
            PermissionError: 无权限编辑
            ValueError: 业务规则校验失败
        """
        # 先获取记录检查权限
        existing_visit = get_visit(db, visit_id, user_id, user_role)

        if not existing_visit:
            return None

        # 权限控制：只有创建人可以编辑
        if existing_visit.create_by != user_id:
            raise PermissionError("Only the creator can edit this visit record")

        # 业务规则校验
        # 如果同时更新了计划和实际日期，检查逻辑
        if visit_data.planned_date and visit_data.actual_date:
            if visit_data.actual_date < visit_data.planned_date:
                raise ValueError("Actual date cannot be earlier than planned date")

        # 更新拜访记录
        return update_visit(db, visit_id, visit_data, user_id, user_role)

    @staticmethod
    def list_visit_records(
        db: Session,
        user_id: str,
        user_role: str,
        params: Optional[VisitQueryParams] = None,
        page: int = 1,
        page_size: int = 10,
        sort_by: str = "create_time",
        sort_order: str = "desc"
    ) -> Tuple[List[CustomerVisit], int]:
        """
        查询拜访记录列表

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
        if params is None:
            params = VisitQueryParams()

        return list_visits(db, user_id, user_role, params, page, page_size, sort_by, sort_order)
