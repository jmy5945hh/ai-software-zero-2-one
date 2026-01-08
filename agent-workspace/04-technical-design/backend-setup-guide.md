# 后端项目搭建指南

**文档版本**: v1.0
**创建时间**: 2026-01-08
**负责人**: 技术负责人
**关联文档**: 技术/技术栈.md, module-breakdown.md

---

## 文档说明

本文档提供后端项目的完整搭建指南,包括项目初始化、目录结构、配置文件、依赖安装、数据库连接、JWT认证配置和开发工具配置。

---

## 1. 项目初始化

### 1.1 创建项目目录

```bash
mkdir backend
cd backend
```

### 1.2 创建虚拟环境

```bash
# Python 3.10+
python -m venv venv

# 激活虚拟环境
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows
```

### 1.3 创建 requirements.txt

```bash
touch requirements.txt
```

### 1.4 安装依赖

```bash
pip install -r requirements.txt
```

---

## 2. 目录结构设计

### 2.1 推荐目录结构

```
backend/
├── main.py                     # 应用入口
├── config.py                   # 配置管理
├── dependencies.py             # 依赖注入
├── requirements.txt            # 依赖列表
├── .env                        # 环境变量(不提交到Git)
├── .env.example                # 环境变量示例
├── api/                        # API 路由层
│   ├── __init__.py
│   ├── deps.py                 # 依赖注入
│   └── v1/                    # API v1 版本
│       ├── __init__.py
│       ├── auth.py             # 认证路由
│       ├── visits.py           # 拜访路由
│       ├── gifts.py            # 礼品路由
│       ├── content.py          # 内容路由
│       ├── dashboard.py        # 数据大屏路由
│       └── ai.py               # AI 路由
├── services/                   # 业务逻辑层
│   ├── __init__.py
│   ├── auth_service.py         # 认证服务
│   ├── visit_service.py        # 拜访服务
│   ├── gift_service.py         # 礼品服务
│   ├── content_service.py      # 内容服务
│   ├── dashboard_service.py    # 数据大屏服务
│   └── ai_service.py           # AI 服务
├── models/                     # 数据模型层(ORM)
│   ├── __init__.py
│   ├── base.py                 # 基础模型类
│   ├── user.py                 # 用户模型
│   ├── customer_visit.py       # 拜访记录模型
│   ├── gift_requisition.py     # 礼品申请模型
│   ├── gift_requisition_item.py # 礼品申请明细模型
│   ├── gift.py                 # 礼品模型
│   ├── carousel.py             # 轮播图模型
│   └── news.py                 # 新闻模型
├── schemas/                    # Pydantic 数据模型
│   ├── __init__.py
│   ├── auth.py                 # 认证数据模型
│   ├── visit.py                # 拜访数据模型
│   ├── gift.py                 # 礼品数据模型
│   ├── content.py              # 内容数据模型
│   ├── dashboard.py            # 数据大屏数据模型
│   └── ai.py                   # AI 数据模型
├── core/                       # 核心模块
│   ├── __init__.py
│   ├── security.py             # 安全模块(JWT、密码)
│   ├── permissions.py          # 权限模块
│   └── exceptions.py           # 自定义异常
├── utils/                      # 工具函数
│   ├── __init__.py
│   ├── datetime.py             # 日期工具
│   └── validators.py           # 校验工具
└── db/                         # 数据库模块
    ├── __init__.py
    ├── base.py                 # 数据库会话
    ├── init_db.py              # 数据库初始化
    └── session.py              # 数据库会话管理
```

---

## 3. 配置文件说明

### 3.1 requirements.txt

```txt
fastapi==0.110.0
uvicorn[standard]==0.25.0
sqlalchemy==2.0.23
pymysql==1.1.0
cryptography==41.0.7
pydantic==2.5.0
pydantic-settings==2.1.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6
alembic==1.13.0
python-dotenv==1.0.0
httpx==0.25.2
```

### 3.2 config.py

```python
from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    # 数据库配置
    DB_HOST: str = "127.0.0.1"
    DB_PORT: int = 3306
    DB_USER: str = "root"
    DB_PASSWORD: str = "99912345"
    DB_NAME: str = "zero_one"
    DB_CHARSET: str = "utf8mb4"

    # JWT 配置
    JWT_SECRET_KEY: str = "zero-one-test"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 120

    # LLM 配置
    LLM_API_BASE: str = "https://ark.cn-beijing.volces.com/api/v3"
    LLM_API_KEY: str = ""
    LLM_MODEL_NAME: str = ""
    LLM_TEMPERATURE: float = 0.5
    LLM_MAX_TOKENS: int = 65535
    LLM_STREAM: bool = True
    LLM_API_TIMEOUT: int = 60

    # CORS 配置
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    class Config:
        env_file = ".env"
        case_sensitive = True

@lru_cache()
def get_settings() -> Settings:
    return Settings()
```

### 3.3 .env.example

```bash
# 数据库
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=zero_one
DB_CHARSET=utf8mb4
DB_USER=root
DB_PASSWORD=your-password

# JWT
JWT_SECRET_KEY=your-secret-key
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=120

# LLM
LLM_API_BASE=https://ark.cn-beijing.volces.com/api/v3
LLM_API_KEY=your-api-key
LLM_MODEL_NAME=your-model-name
```

---

## 4. 数据库连接配置

### 4.1 数据库会话管理 (db/session.py)

```python
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from config import get_settings

settings = get_settings()

# 创建数据库引擎
DATABASE_URL = f"mysql+pymysql://{settings.DB_USER}:{settings.DB_PASSWORD}@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}?charset={settings.DB_CHARSET}"

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    pool_recycle=3600,
    echo=False,  # 生产环境设为 False
)

# 创建会话工厂
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 创建基类
Base = declarative_base()

# 数据库依赖
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

### 4.2 数据库初始化 (db/init_db.py)

```python
from models.base import Base
from models.user import User
from models.customer_visit import CustomerVisit
from models.gift_requisition import GiftRequisition
from models.gift_requisition_item import GiftRequisitionItem
from models.gift import Gift
from models.carousel import Carousel
from models.news import News

def init_db():
    """创建所有表"""
    Base.metadata.create_all(bind=engine)
    print("数据库表创建成功")

if __name__ == "__main__":
    init_db()
```

---

## 5. JWT 认证配置

### 5.1 安全模块 (core/security.py)

```python
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from config import get_settings

settings = get_settings()

# 密码哈希
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """生成密码哈希"""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """创建 JWT Token"""
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

    return encoded_jwt

def verify_token(token: str) -> Optional[dict]:
    """验证 JWT Token"""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError:
        return None
```

### 5.2 依赖注入 (api/deps.py)

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from db.session import get_db
from core.security import verify_token
from models.user import User

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """获取当前登录用户"""
    token = credentials.credentials

    payload = verify_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid or expired token",
        )

    user_id: str = payload.get("user_id")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid token",
        )

    user = db.query(User).filter_by(user_id=user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="user not found",
        )

    return user

def require_role(roles: list[str]):
    """角色权限检查装饰器"""
    def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="permission denied"
            )
        return current_user
    return role_checker
```

---

## 6. 应用入口 (main.py)

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import get_settings
from api.v1 import auth, visits, gifts, content, dashboard, ai

settings = get_settings()

app = FastAPI(
    title="招财银行北京分行运营门户系统 API",
    description="系统 API 文档",
    version="1.0.0",
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(visits.router, prefix="/api/v1/visits", tags=["Visits"])
app.include_router(gifts.router, prefix="/api/v1/gifts", tags=["Gifts"])
app.include_router(content.router, prefix="/api/v1/content", tags=["Content"])
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["Dashboard"])
app.include_router(ai.router, prefix="/api/v1/ai", tags=["AI"])

@app.get("/")
async def root():
    return {"message": "招财银行北京分行运营门户系统 API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
```

---

## 7. Alembic 迁移配置

### 7.1 初始化 Alembic

```bash
# 初始化 Alembic
alembic init alembic

# 生成迁移脚本
alembic revision --autogenerate -m "初始化数据库表"

# 执行迁移
alembic upgrade head

# 回滚迁移
alembic downgrade -1
```

### 7.2 alembic/env.py

```python
from logging.config import fileConfig
from sqlalchemy import engine_from_config
from sqlalchemy import pool
from alembic import context

import sys
import os

# 添加项目根目录到 Python 路径
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from config import get_settings
from db.base import Base

# this is the Alembic Config object
config = context.config

# Interpret the config file for Python logging.
fileConfig(config.config_file_name)
target_metadata = Base.metadata

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url, target_metadata=target_metadata, literal_binds=True
    )

    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    settings = get_settings()
    sqlalchemy_url = f"mysql+pymysql://{settings.DB_USER}:{settings.DB_PASSWORD}@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}?charset={settings.DB_CHARSET}"

    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()

if __name__ == "__main__":
    run_migrations_online()
```

---

## 8. 开发工具配置

### 8.1 代码格式化 (Black + isort)

```bash
# 安装
pip install black isort

# 配置 .black
cat > .black << EOF
[tool.black]
line-length = 100
target-version = ['py310']
EOF

# 配置 .isort
cat > .isort.cfg << EOF
[settings]
profile = black
line_length = 100
EOF

# 格式化代码
black .
isort .
```

### 8.2 代码检查 (Flake8)

```bash
# 安装
pip install flake8

# 配置 .flake8
cat > .flake8 << EOF
[flake8]
max-line-length = 100
extend-ignore = E203, W503
EOF

# 检查代码
flake8 .
```

### 8.3 类型检查 (mypy)

```bash
# 安装
pip install mypy

# 配置 mypy.ini
cat > mypy.ini << EOF
[mypy]
python_version = 3.10
warn_return_any = True
warn_unused_configs = True
disallow_untyped_defs = True
EOF

# 类型检查
mypy .
```

---

## 9. 启动开发服务器

### 9.1 使用 Uvicorn

```bash
# 启动开发服务器(支持热重载)
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 访问文档
# Swagger UI: http://localhost:8000/docs
# ReDoc: http://localhost:8000/redoc
```

### 9.2 使用 Docker 运行 MySQL

```bash
# docker-compose.yml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    container_name: zero_one_mysql
    environment:
      MYSQL_ROOT_PASSWORD: 99912345
      MYSQL_DATABASE: zero_one
      MYSQL_CHARSET: utf8mb4
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql

volumes:
  mysql_data:
```

```bash
# 启动 MySQL
docker-compose up -d

# 查看日志
docker-compose logs -f mysql
```

---

## 10. 核心代码模板

### 10.1 ORM 模型示例 (models/user.py)

```python
from sqlalchemy import Column, String, Enum as SQLEnum, DateTime
from sqlalchemy.dialects.mysql import ENUM
from sqlalchemy.orm import relationship
from models.base import Base

class User(Base):
    __tablename__ = "users"

    user_id = Column(String(32), primary_key=True, comment="用户ID")
    username = Column(String(50), unique=True, nullable=False, comment="登录账号")
    password_hash = Column(String(255), nullable=False, comment="密码哈希")
    name = Column(String(50), nullable=False, comment="用户姓名")
    role = Column(ENUM("CUSTOMER_MANAGER", "OPERATIONS", "APPROVER", "MANAGER", name="user_role"), nullable=False, comment="角色")
    department = Column(String(100), comment="所属部门")
    status = Column(ENUM("ACTIVE", "INACTIVE", "LOCKED", name="user_status"), default="ACTIVE", nullable=False, comment="用户状态")
    last_login_time = Column(DateTime, comment="最后登录时间")
    create_time = Column(DateTime, nullable=False, comment="创建时间")
    update_time = Column(DateTime, nullable=False, comment="更新时间")

    # 关系
    visits_created = relationship("CustomerVisit", back_populates="creator")
```

### 10.2 Pydantic Schema 示例 (schemas/auth.py)

```python
from pydantic import BaseModel, Field, validator

class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    password: str = Field(..., min_length=1, max_length=100)

class UserResponse(BaseModel):
    user_id: str
    username: str
    name: str
    role: str
    department: str | None = None
    status: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
```

### 10.3 Service 层示例 (services/auth_service.py)

```python
from sqlalchemy.orm import Session
from models.user import User
from core.security import verify_password, get_password_hash, create_access_token
from schemas.auth import LoginRequest

class AuthService:
    def authenticate(self, db: Session, form: LoginRequest) -> User | None:
        """用户认证"""
        user = db.query(User).filter_by(username=form.username).first()
        if not user:
            return None
        if not verify_password(form.password, user.password_hash):
            return None
        return user

    def create_token(self, user: User) -> str:
        """创建 JWT Token"""
        data = {
            "user_id": user.user_id,
            "username": user.username,
            "name": user.name,
            "role": user.role,
        }
        return create_access_token(data)
```

---

## 11. 测试配置

### 11.1 安装测试依赖

```bash
pip install pytest pytest-asyncio httpx
```

### 11.2 测试示例 (tests/test_auth.py)

```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from main import app
from models.base import Base
from models.user import User
from core.security import get_password_hash

# 测试数据库
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture
def db_session():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            db_session.close()

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)

def test_login_success(client, db_session):
    # 创建测试用户
    user = User(
        user_id="TEST001",
        username="testuser",
        password_hash=get_password_hash("password123"),
        name="测试用户",
        role="CUSTOMER_MANAGER"
    )
    db_session.add(user)
    db_session.commit()

    # 测试登录
    response = client.post("/api/v1/auth/login", json={
        "username": "testuser",
        "password": "password123"
    })

    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data["data"]
```

---

## 12. 日志配置

### 12.1 日志配置 (utils/logger.py)

```python
import logging
import sys
from pathlib import Path

def setup_logger():
    """配置日志"""
    # 创建 logs 目录
    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)

    # 配置日志格式
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_dir / "app.log"),
            logging.StreamHandler(sys.stdout)
        ]
    )

setup_logger()
```

---

**文档变更记录**:
- v1.0 (2026-01-08): 初始版本,定义后端项目搭建指南
