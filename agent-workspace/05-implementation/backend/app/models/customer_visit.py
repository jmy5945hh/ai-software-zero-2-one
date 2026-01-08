"""客户拜访记录模型"""
from sqlalchemy import Column, String, Date, Enum as SQLEnum, Text, JSON, ForeignKey
from sqlalchemy.dialects.mysql import ENUM
from sqlalchemy.orm import relationship
from app.db.base import Base, TimestampMixin


class CustomerVisit(Base, TimestampMixin):
    """客户拜访记录表"""

    __tablename__ = "customer_visits"

    visit_id = Column(String(32), primary_key=True, comment="拜访记录ID")
    customer_id = Column(String(50), nullable=False, comment="客户ID")
    company_name = Column(String(200), nullable=False, comment="企业名称")
    planned_date = Column(Date, nullable=False, comment="计划拜访日期")
    actual_date = Column(Date, comment="实际拜访日期")
    visit_method = Column(
        ENUM("ON_SITE", "PHONE", "VIDEO", "EMAIL", "OTHER", name="visit_method"),
        nullable=False,
        comment="拜访方式",
    )
    interested_products = Column(JSON, comment="意向理财产品列表(JSON数组)")
    participants = Column(JSON, comment="参与人员列表(JSON数组,存储用户ID)")
    status = Column(
        ENUM("NEW", "IN_PROGRESS", "SUCCESS", "FAILED", "CANCELLED", name="visit_status"),
        nullable=False,
        default="NEW",
        comment="拜访状态",
    )
    notes = Column(Text, comment="备注信息")
    create_by = Column(String(32), ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False, comment="创建人(用户ID)")

    # 关系
    creator = relationship("User", back_populates="visits_created")
