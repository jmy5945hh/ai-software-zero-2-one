"""FastAPI 应用入口"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.api.v1 import auth, visits, gifts

settings = get_settings()

# 创建 FastAPI 应用
app = FastAPI(
    title="招财银行北京分行运营门户系统 API",
    description="招财银行北京分行运营门户系统 RESTful API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS 中间件配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(auth.router, prefix="/api/v1/auth", tags=["认证授权"])
app.include_router(visits.router, prefix="/api/v1/auth/visits", tags=["拜访管理"])
app.include_router(gifts.router, prefix="/api/v1/auth/gifts", tags=["礼品管理"])


@app.get("/", tags=["根路径"])
async def root():
    """根路径"""
    return {
        "message": "招财银行北京分行运营门户系统 API",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health", tags=["健康检查"])
async def health_check():
    """健康检查"""
    return {"status": "healthy", "service": "backend-api"}
