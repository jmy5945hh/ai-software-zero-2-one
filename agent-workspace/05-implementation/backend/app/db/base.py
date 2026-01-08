"""数据库基类模块"""
from datetime import datetime
from sqlalchemy import Column, DateTime
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()


class TimestampMixin:
    """时间戳混入类"""

    create_time = Column(DateTime, default=datetime.now, nullable=False, comment="创建时间")
    update_time = Column(
        DateTime, default=datetime.now, onupdate=datetime.now, nullable=False, comment="更新时间"
    )
