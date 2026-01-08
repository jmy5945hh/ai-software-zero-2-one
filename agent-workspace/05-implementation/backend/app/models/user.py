"""用户模型"""
from sqlalchemy import Column, String, Enum as SQLEnum
from sqlalchemy.dialects.mysql import ENUM
from sqlalchemy.orm import relationship
from app.db.base import Base, TimestampMixin


class User(Base, TimestampMixin):
    """用户表"""

    __tablename__ = "users"

    user_id = Column(String(32), primary_key=True, comment="用户ID")
    username = Column(String(50), unique=True, nullable=False, comment="登录账号")
    password_hash = Column(String(255), nullable=False, comment="密码哈希")
    name = Column(String(50), nullable=False, comment="用户姓名")
    role = Column(
        ENUM("CUSTOMER_MANAGER", "OPERATIONS", "APPROVER", "MANAGER", name="user_role"),
        nullable=False,
        comment="角色",
    )
    department = Column(String(100), comment="所属部门")
    status = Column(
        ENUM("ACTIVE", "INACTIVE", "LOCKED", name="user_status"),
        default="ACTIVE",
        nullable=False,
        comment="用户状态",
    )
    last_login_time = Column(String(50), comment="最后登录时间")

    # 关系
    visits_created = relationship("CustomerVisit", back_populates="creator")
