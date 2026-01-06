from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

# 创建异步引擎
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,  # 在调试模式下打印SQL语句
    future=True,  # 使用SQLAlchemy 2.0 API
    pool_pre_ping=True,  # 连接池预检查
    pool_recycle=3600,  # 连接回收时间
)

# 创建异步会话工厂
AsyncSessionLocal = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,  # 提交后不使对象过期
    autoflush=False,  # 关闭自动刷新
    autocommit=False,  # 关闭自动提交
)

# 创建基类
Base = declarative_base()


# 依赖注入函数，用于获取数据库会话
async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
