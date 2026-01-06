from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.database import Base


class SysPermission(Base):
    __tablename__ = "sys_permission"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True, comment="权限ID")
    permission_name = Column(String(50), unique=True, nullable=False, comment="权限名称")
    permission_code = Column(String(50), unique=True, nullable=False, comment="权限编码")
    resource_type = Column(String(20), nullable=False, comment="资源类型（menu, button, api）")
    resource_path = Column(String(255), nullable=False, comment="资源路径")
    parent_id = Column(Integer, ForeignKey("sys_permission.id"), nullable=True, comment="父权限ID")
    create_time = Column(DateTime, nullable=False, default=func.now(), comment="创建时间")
    update_time = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now(), comment="更新时间")
    
    # 关系定义
    role_permissions = relationship("SysRolePermission", back_populates="permission")
    children = relationship("SysPermission", backref="parent", remote_side=[id])
