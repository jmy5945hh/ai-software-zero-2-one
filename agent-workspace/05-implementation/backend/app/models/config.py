from sqlalchemy import Column, Integer, String, DateTime, Text, func
from app.database import Base


class SysConfig(Base):
    __tablename__ = "sys_config"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True, comment="配置ID")
    config_key = Column(String(100), unique=True, nullable=False, comment="配置键")
    config_value = Column(Text, nullable=False, comment="配置值")
    description = Column(String(255), nullable=True, comment="配置描述")
    create_time = Column(DateTime, nullable=False, default=func.now(), comment="创建时间")
    update_time = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now(), comment="更新时间")
