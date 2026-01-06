from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, func, Index
from app.database import Base


class News(Base):
    __tablename__ = "news"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True, comment="新闻ID")
    title = Column(String(200), nullable=False, comment="新闻标题")
    content = Column(Text, nullable=False, comment="新闻内容")
    author = Column(String(50), nullable=False, comment="作者")
    publish_time = Column(DateTime, nullable=False, default=func.now(), comment="发布时间")
    is_published = Column(Boolean, nullable=False, default=True, comment="是否发布（0：草稿，1：已发布）")
    view_count = Column(Integer, nullable=False, default=0, comment="浏览次数")
    create_time = Column(DateTime, nullable=False, default=func.now(), comment="创建时间")
    update_time = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now(), comment="更新时间")
    
    # 索引定义
    __table_args__ = (
        Index("idx_is_published_publish_time", "is_published", "publish_time"),
        # 全文索引在MySQL中需要特殊处理，这里只定义常规索引
        Index("idx_title", "title"),
    )
