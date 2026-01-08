"""系统配置模型"""
from sqlalchemy import Column, String, Text
from app.db.base import Base, TimestampMixin


class SystemConfig(Base, TimestampMixin):
    """系统配置表"""

    __tablename__ = "system_configs"

    config_key = Column(String(100), primary_key=True, comment="配置项键名")
    config_value = Column(Text, nullable=False, comment="配置项值(JSON字符串)")
    description = Column(String(500), comment="配置项描述")
