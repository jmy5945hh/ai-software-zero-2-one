from sqlalchemy import Column, Integer, String, DateTime, Boolean, func
from sqlalchemy.orm import relationship
from app.database import Base


class SysUser(Base):
    __tablename__ = "sys_user"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True, comment="用户ID")
    username = Column(String(50), unique=True, nullable=False, comment="用户名")
    password = Column(String(255), nullable=False, comment="密码（加密存储）")
    real_name = Column(String(50), nullable=False, comment="真实姓名")
    role = Column(String(20), nullable=False, comment="用户角色（admin, manager, staff）")
    department = Column(String(100), nullable=False, comment="所属部门")
    email = Column(String(100), unique=True, nullable=True, comment="邮箱")
    phone = Column(String(20), unique=True, nullable=True, comment="手机号")
    status = Column(Boolean, nullable=False, default=True, comment="状态（0：禁用，1：启用）")
    create_time = Column(DateTime, nullable=False, default=func.now(), comment="创建时间")
    update_time = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now(), comment="更新时间")
    
    # 关系定义
    visit_records = relationship("VisitRecord", back_populates="creator", foreign_keys="VisitRecord.created_by")
    updated_visit_records = relationship("VisitRecord", back_populates="updater", foreign_keys="VisitRecord.updated_by")
    gift_applications = relationship("GiftApplication", back_populates="applicant", foreign_keys="GiftApplication.applicant_id")
    approved_gift_applications = relationship("GiftApplication", back_populates="approver", foreign_keys="GiftApplication.approve_id")
    user_roles = relationship("SysUserRole", back_populates="user")
