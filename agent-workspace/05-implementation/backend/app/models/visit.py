from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, func, Index
from sqlalchemy.orm import relationship
from app.database import Base


class VisitRecord(Base):
    __tablename__ = "visit_record"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True, comment="拜访记录ID")
    customer_name = Column(String(100), nullable=False, comment="客户名称")
    customer_contact = Column(String(50), nullable=True, comment="客户联系方式")
    visit_date = Column(DateTime, nullable=False, comment="拜访日期时间")
    visit_content = Column(Text, nullable=False, comment="拜访内容")
    next_visit_plan = Column(Text, nullable=True, comment="下次拜访计划")
    created_by = Column(Integer, ForeignKey("sys_user.id"), nullable=False, comment="创建人ID")
    created_time = Column(DateTime, nullable=False, default=func.now(), comment="创建时间")
    updated_by = Column(Integer, ForeignKey("sys_user.id"), nullable=True, comment="更新人ID")
    updated_time = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now(), comment="更新时间")
    
    # 关系定义
    creator = relationship("SysUser", back_populates="visit_records", foreign_keys=[created_by])
    updater = relationship("SysUser", back_populates="updated_visit_records", foreign_keys=[updated_by])
    
    # 索引定义
    __table_args__ = (
        Index("idx_customer_visit_date", "customer_name", "visit_date"),
        Index("idx_created_by_visit_date", "created_by", "visit_date"),
    )
