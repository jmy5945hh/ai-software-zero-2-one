from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, func, Index
from sqlalchemy.orm import relationship
from app.database import Base


class GiftApplication(Base):
    __tablename__ = "gift_application"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True, comment="礼品申请ID")
    customer_name = Column(String(100), nullable=False, comment="客户名称")
    gift_name = Column(String(100), nullable=False, comment="礼品名称")
    quantity = Column(Integer, nullable=False, comment="礼品数量")
    reason = Column(Text, nullable=False, comment="申请理由")
    status = Column(String(20), nullable=False, default="pending", comment="申请状态（pending：待审批，approved：已通过，rejected：已拒绝）")
    applicant_id = Column(Integer, ForeignKey("sys_user.id"), nullable=False, comment="申请人ID")
    approve_id = Column(Integer, ForeignKey("sys_user.id"), nullable=True, comment="审批人ID")
    approve_comment = Column(Text, nullable=True, comment="审批意见")
    approve_time = Column(DateTime, nullable=True, comment="审批时间")
    created_time = Column(DateTime, nullable=False, default=func.now(), comment="创建时间")
    updated_time = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now(), comment="更新时间")
    
    # 关系定义
    applicant = relationship("SysUser", back_populates="gift_applications", foreign_keys=[applicant_id])
    approver = relationship("SysUser", back_populates="approved_gift_applications", foreign_keys=[approve_id])
    
    # 索引定义
    __table_args__ = (
        Index("idx_status_created_time", "status", "created_time"),
        Index("idx_applicant_id_created_time", "applicant_id", "created_time"),
    )
