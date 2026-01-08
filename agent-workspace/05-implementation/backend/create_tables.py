"""直接创建所有数据库表"""
from app.db.session import engine
from app.models import user, customer_visit, gift, gift_requisition, gift_requisition_item, carousel, news, system_config

def create_all_tables():
    """创建所有表"""
    print("开始创建数据库表...")
    
    # 导入所有模型
    from app.models.user import User
    from app.models.customer_visit import CustomerVisit
    from app.models.gift import Gift
    from app.models.gift_requisition import GiftRequisition
    from app.models.gift_requisition_item import GiftRequisitionItem
    from app.models.carousel import Carousel
    from app.models.news import News
    from app.models.system_config import SystemConfig
    
    # 创建所有表
    from app.db.base import Base
    Base.metadata.create_all(bind=engine)
    
    print("✅ 所有表创建成功！")

if __name__ == "__main__":
    create_all_tables()
