from sqlalchemy import Column, Integer, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class SysRolePermission(Base):
    __tablename__ = "sys_role_permission"
    
    role_id = Column(Integer, ForeignKey("sys_role.id"), primary_key=True, comment="角色ID")
    permission_id = Column(Integer, ForeignKey("sys_permission.id"), primary_key=True, comment="权限ID")
    
    # 关系定义
    role = relationship("SysRole", back_populates="role_permissions")
    permission = relationship("SysPermission", back_populates="role_permissions")
