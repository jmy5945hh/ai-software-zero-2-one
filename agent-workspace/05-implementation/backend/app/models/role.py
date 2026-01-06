from sqlalchemy import Column, Integer, String, DateTime, func
from sqlalchemy.orm import relationship
from app.database import Base


class SysRole(Base):
    __tablename__ = "sys_role"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True, comment="角色ID")
    role_name = Column(String(50), unique=True, nullable=False, comment="角色名称")
    role_code = Column(String(20), unique=True, nullable=False, comment="角色编码")
    description = Column(String(255), nullable=True, comment="角色描述")
    create_time = Column(DateTime, nullable=False, default=func.now(), comment="创建时间")
    update_time = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now(), comment="更新时间")
    
    # 关系定义
    user_roles = relationship("SysUserRole", back_populates="role")
    role_permissions = relationship("SysRolePermission", back_populates="role")
