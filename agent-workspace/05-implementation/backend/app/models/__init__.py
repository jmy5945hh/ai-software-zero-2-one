"""数据模型模块"""
from app.models.user import User
from app.models.customer_visit import CustomerVisit
from app.models.gift import Gift
from app.models.gift_requisition import GiftRequisition
from app.models.gift_requisition_item import GiftRequisitionItem
from app.models.carousel import Carousel
from app.models.news import News
from app.models.system_config import SystemConfig

__all__ = [
    "User",
    "CustomerVisit",
    "Gift",
    "GiftRequisition",
    "GiftRequisitionItem",
    "Carousel",
    "News",
    "SystemConfig",
]
