from sqlalchemy import Column, Integer, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class SysUserRole(Base):
    __tablename__ = "sys_user_role"
    
    user_id = Column(Integer, ForeignKey("sys_user.id"), primary_key=True, comment="用户ID")
    role_id = Column(Integer, ForeignKey("sys_role.id"), primary_key=True, comment="角色ID")
    
    # 关系定义
    user = relationship("SysUser", back_populates="user_roles")
    role = relationship("SysRole", back_populates="user_roles")
