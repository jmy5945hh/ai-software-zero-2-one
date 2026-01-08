"""轮播图模型"""
from sqlalchemy import Column, String, Integer, Text, Enum as SQLEnum, ForeignKey
from sqlalchemy.dialects.mysql import ENUM
from app.db.base import Base, TimestampMixin


class Carousel(Base, TimestampMixin):
    """轮播图表"""

    __tablename__ = "carousels"

    carousel_id = Column(String(32), primary_key=True, comment="轮播图ID")
    title = Column(String(200), nullable=False, comment="标题")
    description = Column(Text, comment="描述")
    image_url = Column(String(500), nullable=False, comment="图片URL")
    link_url = Column(String(500), comment="跳转链接")
    sort_order = Column(Integer, default=0, comment="排序序号(数字越小越靠前)")
    status = Column(
        ENUM("ACTIVE", "INACTIVE", name="carousel_status"),
        default="ACTIVE",
        comment="状态",
    )
    create_by = Column(
        String(32), ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False, comment="创建人(用户ID)"
    )
