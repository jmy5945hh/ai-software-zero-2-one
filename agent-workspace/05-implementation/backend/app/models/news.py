"""新闻模型"""
from sqlalchemy import Column, String, Text, Enum as SQLEnum, ForeignKey
from sqlalchemy.dialects.mysql import ENUM
from app.db.base import Base, TimestampMixin


class News(Base, TimestampMixin):
    """新闻表"""

    __tablename__ = "news"

    news_id = Column(String(32), primary_key=True, comment="新闻ID")
    title = Column(String(200), nullable=False, comment="新闻标题")
    summary = Column(String(500), nullable=False, comment="新闻摘要")
    content = Column(Text, nullable=False, comment="新闻正文内容")
    publish_time = Column(String(50), comment="发布时间")
    status = Column(
        ENUM("DRAFT", "PUBLISHED", "WITHDRAWN", name="news_status"),
        default="DRAFT",
        comment="状态",
    )
    create_by = Column(
        String(32), ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False, comment="创建人(用户ID)"
    )
