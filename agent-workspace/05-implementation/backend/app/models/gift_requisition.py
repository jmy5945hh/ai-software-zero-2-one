"""礼品领用申请模型"""
from sqlalchemy import Column, String, Date, Numeric, Enum as SQLEnum, Text, ForeignKey
from sqlalchemy.dialects.mysql import ENUM
from sqlalchemy.orm import relationship
from app.db.base import Base, TimestampMixin


class GiftRequisition(Base, TimestampMixin):
    """礼品领用申请表"""

    __tablename__ = "gift_requisitions"

    requisition_id = Column(String(32), primary_key=True, comment="申请单ID")
    applicant = Column(
        String(32), ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False, comment="申请人(用户ID)"
    )
    recipient = Column(
        String(32), ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False, comment="领用人(用户ID)"
    )
    total_amount = Column(Numeric(10, 2), nullable=False, comment="总金额(元)")
    planned_date = Column(Date, nullable=False, comment="计划领用日期")
    purpose_type = Column(
        ENUM("CUSTOMER_VISIT", "HOLIDAY", "MARKETING", "OTHER", name="purpose_type"),
        nullable=False,
        comment="目的类型",
    )
    related_visit_id = Column(String(32), comment="关联客户拜访记录ID")
    approval_status = Column(
        ENUM("PENDING", "APPROVED", "REJECTED", name="approval_status"),
        nullable=False,
        default="PENDING",
        comment="审批状态",
    )
    rejection_reason = Column(Text, comment="驳回原因")
    approver = Column(String(32), ForeignKey("users.user_id", ondelete="SET NULL"), comment="审批人(用户ID)")
    approval_time = Column(String(50), comment="审批时间")

    # 关系
    items = relationship("GiftRequisitionItem", back_populates="requisition", cascade="all, delete-orphan")
