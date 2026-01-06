from sqlalchemy import Column, Integer, String, DateTime, Boolean, func, Index
from app.database import Base


class Banner(Base):
    __tablename__ = "banner"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True, comment="轮播图ID")
    title = Column(String(100), nullable=False, comment="轮播图标题")
    image_url = Column(String(255), nullable=False, comment="图片URL")
    link_url = Column(String(255), nullable=True, comment="链接URL")
    order_num = Column(Integer, nullable=False, default=0, comment="排序号")
    is_active = Column(Boolean, nullable=False, default=True, comment="是否激活（0：禁用，1：启用）")
    create_time = Column(DateTime, nullable=False, default=func.now(), comment="创建时间")
    update_time = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now(), comment="更新时间")
    
    # 索引定义
    __table_args__ = (
        Index("idx_is_active_order_num", "is_active", "order_num"),
    )
