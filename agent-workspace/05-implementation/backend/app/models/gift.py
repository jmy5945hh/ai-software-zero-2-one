"""礼品模型"""
from sqlalchemy import Column, String, Numeric, Integer, Text, Enum as SQLEnum
from sqlalchemy.dialects.mysql import ENUM
from app.db.base import Base, TimestampMixin


class Gift(Base, TimestampMixin):
    """礼品表"""

    __tablename__ = "gifts"

    gift_id = Column(String(32), primary_key=True, comment="礼品ID")
    gift_name = Column(String(200), nullable=False, comment="礼品名称")
    gift_category = Column(String(50), nullable=False, comment="礼品分类")
    unit_price = Column(Numeric(10, 2), nullable=False, comment="单价(元)")
    stock_quantity = Column(Integer, default=0, comment="库存数量")
    description = Column(Text, comment="礼品描述")
    status = Column(
        ENUM("ACTIVE", "INACTIVE", name="gift_status"),
        default="ACTIVE",
        comment="状态",
    )
