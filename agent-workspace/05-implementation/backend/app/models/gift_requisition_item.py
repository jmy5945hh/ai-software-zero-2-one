"""礼品申请明细模型"""
from sqlalchemy import Column, String, Integer, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base, TimestampMixin


class GiftRequisitionItem(Base, TimestampMixin):
    """礼品申请明细表"""

    __tablename__ = "gift_requisition_items"

    item_id = Column(String(32), primary_key=True, comment="明细项ID")
    requisition_id = Column(
        String(32),
        ForeignKey("gift_requisitions.requisition_id", ondelete="CASCADE"),
        nullable=False,
        comment="申请单ID",
    )
    gift_id = Column(
        String(32), ForeignKey("gifts.gift_id", ondelete="RESTRICT"), nullable=False, comment="礼品ID"
    )
    quantity = Column(Integer, nullable=False, comment="数量")
    unit_price = Column(Numeric(10, 2), nullable=False, comment="单价(元)")
    subtotal = Column(Numeric(10, 2), nullable=False, comment="小计(元)")

    # 关系
    requisition = relationship("GiftRequisition", back_populates="items")
    gift = relationship("Gift")
