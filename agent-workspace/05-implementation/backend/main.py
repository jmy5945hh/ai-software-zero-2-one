from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging

from app.config import settings
from app.database import engine, Base
from app.routes import auth, visits, gifts, content, stats, ai

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 创建数据库表
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时创建数据库表
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables created")
    yield
    # 关闭时的清理工作
    await engine.dispose()
    logger.info("Database connection closed")

# 创建FastAPI应用
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 在生产环境中应该设置为具体的前端域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 全局异常处理
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"code": "500", "message": "服务器内部错误", "details": str(exc)}
    )

# 健康检查端点
@app.get("/health")
async def health_check():
    return {"status": "ok", "app_name": settings.APP_NAME, "version": settings.APP_VERSION}

# 注册路由
app.include_router(auth.router, prefix="/auth", tags=["认证授权"])
app.include_router(visits.router, prefix="/visits", tags=["客户拜访管理"])
app.include_router(gifts.router, prefix="/gifts", tags=["礼品管理"])
app.include_router(content.router, prefix="/content", tags=["内容管理"])
app.include_router(stats.router, prefix="/stats", tags=["数据统计"])
app.include_router(ai.router, prefix="/ai", tags=["AI问答"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)