"""初始化测试数据脚本"""
import uuid
from datetime import datetime
from sqlalchemy.orm import Session
from app.db.session import engine, SessionLocal
from app.models import (
    User,
    Gift,
    SystemConfig,
    Carousel,
    News,
)
from app.core.security import get_password_hash


def generate_id(prefix: str) -> str:
    """生成唯一ID"""
    return f"{prefix}{uuid.uuid4().hex[:24].upper()}"


def init_test_data():
    """初始化测试数据"""
    # 创建数据库会话
    db = SessionLocal()

    try:
        print("开始初始化测试数据...")

        # 1. 创建测试用户
        print("创建测试用户...")
        test_users = [
            User(
                user_id=generate_id("USER"),
                username="manager001",
                password_hash=get_password_hash("password123"),
                name="张三(管理者)",
                role="MANAGER",
                department="管理部",
                status="ACTIVE",
            ),
            User(
                user_id=generate_id("USER"),
                username="operations001",
                password_hash=get_password_hash("password123"),
                name="李四(运营)",
                role="OPERATIONS",
                department="运营部",
                status="ACTIVE",
            ),
            User(
                user_id=generate_id("USER"),
                username="approver001",
                password_hash=get_password_hash("password123"),
                name="王五(审批)",
                role="APPROVER",
                department="审批部",
                status="ACTIVE",
            ),
            User(
                user_id=generate_id("USER"),
                username="cm001",
                password_hash=get_password_hash("password123"),
                name="赵六(客户经理)",
                role="CUSTOMER_MANAGER",
                department="零售业务部",
                status="ACTIVE",
            ),
            User(
                user_id=generate_id("USER"),
                username="cm002",
                password_hash=get_password_hash("password123"),
                name="孙七(客户经理)",
                role="CUSTOMER_MANAGER",
                department="零售业务部",
                status="ACTIVE",
            ),
        ]

        for user in test_users:
            db.add(user)
        db.commit()
        print(f"✓ 创建了 {len(test_users)} 个测试用户")

        # 2. 创建礼品数据
        print("创建礼品数据...")
        test_gifts = [
            Gift(
                gift_id=generate_id("GIFT"),
                gift_name="茶叶礼盒",
                gift_category="食品",
                unit_price=100.00,
                stock_quantity=50,
                description="高档茶叶礼盒,适合节日慰问",
                status="ACTIVE",
            ),
            Gift(
                gift_id=generate_id("GIFT"),
                gift_name="办公用品套装",
                gift_category="办公用品",
                unit_price=150.00,
                stock_quantity=30,
                description="笔记本、钢笔、文件夹等办公用品套装",
                status="ACTIVE",
            ),
            Gift(
                gift_id=generate_id("GIFT"),
                gift_name="保温杯",
                gift_category="日用品",
                unit_price=80.00,
                stock_quantity=100,
                description="不锈钢保温杯",
                status="ACTIVE",
            ),
            Gift(
                gift_id=generate_id("GIFT"),
                gift_name="电子秤",
                gift_category="电子产品",
                unit_price=200.00,
                stock_quantity=20,
                description="高精度电子秤",
                status="ACTIVE",
            ),
            Gift(
                gift_id=generate_id("GIFT"),
                gift_name="礼品卡",
                gift_category="虚拟",
                unit_price=500.00,
                stock_quantity=200,
                description="超市购物卡",
                status="ACTIVE",
            ),
        ]

        for gift in test_gifts:
            db.add(gift)
        db.commit()
        print(f"✓ 创建了 {len(test_gifts)} 个礼品")

        # 3. 创建系统配置
        print("创建系统配置...")
        test_configs = [
            SystemConfig(
                config_key="session.timeout",
                config_value="7200",
                description="会话超时时间(秒)",
            ),
            SystemConfig(
                config_key="password.min_length",
                config_value="8",
                description="密码最小长度",
            ),
            SystemConfig(
                config_key="password.max_attempts",
                config_value="5",
                description="密码最大尝试次数",
            ),
            SystemConfig(
                config_key="ai.max_history",
                config_value="10",
                description="AI对话历史最大条数",
            ),
        ]

        for config in test_configs:
            db.add(config)
        db.commit()
        print(f"✓ 创建了 {len(test_configs)} 个系统配置")

        # 4. 创建轮播图
        print("创建轮播图...")
        test_carousels = [
            Carousel(
                carousel_id=generate_id("CAROUSEL"),
                title="春节营销活动",
                description="2026年春节客户关怀活动",
                image_url="/images/carousel1.jpg",
                link_url="/news/1",
                sort_order=1,
                status="ACTIVE",
                create_by=test_users[1].user_id,  # 运营人员
            ),
            Carousel(
                carousel_id=generate_id("CAROUSEL"),
                title="理财产品推荐",
                description="最新理财产品推荐",
                image_url="/images/carousel2.jpg",
                link_url="/products",
                sort_order=2,
                status="ACTIVE",
                create_by=test_users[1].user_id,
            ),
        ]

        for carousel in test_carousels:
            db.add(carousel)
        db.commit()
        print(f"✓ 创建了 {len(test_carousels)} 个轮播图")

        # 5. 创建新闻
        print("创建新闻...")
        test_news = [
            News(
                news_id=generate_id("NEWS"),
                title="关于开展2026年第一季度营销活动的通知",
                summary="为推动第一季度业务发展,现将相关活动安排通知如下",
                content="<p>为推动第一季度业务发展,现将相关活动安排通知如下...</p>",
                publish_time=datetime.now().isoformat(),
                status="PUBLISHED",
                create_by=test_users[1].user_id,
            ),
            News(
                news_id=generate_id("NEWS"),
                title="关于系统升级的公告",
                summary="系统将于1月15日凌晨进行升级维护",
                content="<p>系统将于1月15日凌晨2:00-4:00进行升级维护,届时将暂停服务...</p>",
                publish_time=datetime.now().isoformat(),
                status="PUBLISHED",
                create_by=test_users[1].user_id,
            ),
        ]

        for news in test_news:
            db.add(news)
        db.commit()
        print(f"✓ 创建了 {len(test_news)} 个新闻")

        print("\n" + "=" * 50)
        print("测试数据初始化完成!")
        print("=" * 50)
        print("\n测试账号:")
        print("  管理者: manager001 / password123")
        print("  运营人员: operations001 / password123")
        print("  审批人员: approver001 / password123")
        print("  客户经理: cm001 / password123")
        print("  客户经理: cm002 / password123")

    except Exception as e:
        print(f"初始化失败: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("=" * 50)
    print("初始化测试数据脚本")
    print("=" * 50)
    print()

    init_test_data()
