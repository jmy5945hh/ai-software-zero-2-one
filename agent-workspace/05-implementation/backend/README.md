# 招财银行北京分行运营门户系统 - 后端 API

基于 FastAPI + SQLAlchemy + MySQL 的 RESTful API 服务

## 项目简介

本项目是"招财银行北京分行运营门户系统"的后端服务,提供客户拜访管理、礼品申请与审批、内容管理、数据大屏等功能的 API 接口。

## 技术栈

- **Python 3.10+**
- **FastAPI 0.110.0** - 现代、快速的 Web 框架
- **SQLAlchemy 2.0** - Python SQL 工具包和 ORM
- **PyMySQL 1.1.0** - MySQL 数据库驱动
- **Alembic 1.13.0** - 数据库迁移工具
- **python-jose** - JWT Token 处理
- **passlib[bcrypt]** - 密码哈希
- **Pydantic 2.5** - 数据验证和设置管理

## 项目结构

```
backend/
├── app/                         # 应用代码
│   ├── __init__.py
│   ├── main.py                  # FastAPI 应用入口
│   ├── api/                     # API 路由层
│   │   ├── __init__.py
│   │   └── v1/                 # API v1 版本
│   │       ├── __init__.py
│   │       └── auth.py         # 认证路由
│   ├── core/                    # 核心模块
│   │   ├── __init__.py
│   │   ├── config.py           # 配置管理
│   │   ├── security.py         # JWT 和密码哈希
│   │   └── deps.py             # 依赖注入
│   ├── models/                  # ORM 模型
│   │   ├── __init__.py
│   │   ├── user.py             # 用户模型
│   │   ├── customer_visit.py   # 拜访记录模型
│   │   ├── gift.py             # 礼品模型
│   │   ├── gift_requisition.py # 礼品申请模型
│   │   ├── gift_requisition_item.py
│   │   ├── carousel.py         # 轮播图模型
│   │   ├── news.py             # 新闻模型
│   │   └── system_config.py    # 系统配置模型
│   ├── schemas/                 # Pydantic 数据模型
│   │   ├── __init__.py
│   │   ├── auth.py             # 认证相关 Schema
│   │   └── common.py           # 通用 Schema
│   ├── crud/                    # 数据访问层
│   │   ├── __init__.py
│   │   └── user.py             # 用户 CRUD
│   ├── services/                # 业务逻辑层
│   │   └── auth_service.py     # 认证服务
│   └── db/                      # 数据库模块
│       ├── __init__.py
│       ├── base.py             # 基类
│       └── session.py          # 会话管理
├── alembic/                     # 数据库迁移
│   ├── versions/               # 迁移脚本
│   ├── env.py                  # Alembic 环境配置
│   └── script.py.mako          # 迁移脚本模板
├── tests/                       # 测试代码
├── alembic.ini                  # Alembic 配置文件
├── requirements.txt             # 项目依赖
├── .env.example                 # 环境变量示例
├── init_test_data.py           # 初始化测试数据脚本
└── README.md                    # 本文件
```

## 快速开始

### 1. 环境准备

确保已安装以下环境:

- Python 3.10 或更高版本
- MySQL 8.0 或更高版本

### 2. 安装依赖

```bash
cd /Users/jingmengyuan/code/for-cc-and-glm/ai-software-zero-2-one/agent-workspace/05-implementation/backend
pip install -r requirements.txt
```

### 3. 配置环境变量

复制 `.env.example` 为 `.env` 并修改配置:

```bash
cp .env.example .env
```

编辑 `.env` 文件,修改数据库连接信息:

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
```

### 4. 创建数据库

在 MySQL 中创建数据库:

```sql
CREATE DATABASE zero_one CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 5. 运行数据库迁移

```bash
# 生成迁移脚本
alembic revision --autogenerate -m "初始化数据库表"

# 执行迁移
alembic upgrade head
```

### 6. 初始化测试数据(可选)

```bash
python init_test_data.py
```

这将创建以下测试账号:

| 角色       | 账号            | 密码           |
| ---------- | --------------- | -------------- |
| 管理者     | manager001      | password123    |
| 运营人员   | operations001   | password123    |
| 审批人员   | approver001     | password123    |
| 客户经理   | cm001           | password123    |
| 客户经理   | cm002           | password123    |

### 7. 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

服务将在 http://localhost:8000 启动

### 8. 访问 API 文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API 接口

### 认证授权

- `POST /api/v1/auth/login` - 用户登录
- `GET /api/v1/auth/me` - 获取当前用户信息
- `PUT /api/v1/auth/me` - 更新当前用户信息
- `PUT /api/v1/auth/me/password` - 修改密码

### 拜访管理(待实现)

- `GET /api/v1/visits` - 查询拜访记录列表
- `POST /api/v1/visits` - 新增拜访记录
- `GET /api/v1/visits/{visit_id}` - 获取拜访记录详情
- `PUT /api/v1/visits/{visit_id}` - 更新拜访记录

### 礼品管理(待实现)

- `GET /api/v1/gifts/applications` - 查询礼品申请列表
- `POST /api/v1/gifts/applications` - 提交礼品申请
- `GET /api/v1/gifts/applications/{requisition_id}` - 获取礼品申请详情
- `GET /api/v1/gifts/approvals` - 查询待审批申请列表
- `POST /api/v1/gifts/approvals/{requisition_id}/approve` - 审批通过
- `POST /api/v1/gifts/approvals/{requisition_id}/reject` - 审批驳回
- `GET /api/v1/gifts/ledger` - 查询礼品台账

### 内容管理(待实现)

- `GET /api/v1/content/carousels` - 查询轮播图列表
- `POST /api/v1/content/carousels` - 新增轮播图
- `PUT /api/v1/content/carousels/{carousel_id}` - 更新轮播图
- `DELETE /api/v1/content/carousels/{carousel_id}` - 删除轮播图
- `GET /api/v1/content/news` - 查询新闻列表
- `POST /api/v1/content/news` - 新增新闻
- `PUT /api/v1/content/news/{news_id}` - 更新新闻
- `POST /api/v1/content/news/{news_id}/publish` - 发布新闻

### 数据大屏(待实现)

- `GET /api/v1/dashboard/metrics` - 获取关键运营指标
- `GET /api/v1/dashboard/visit_trend` - 获取拜访趋势数据
- `GET /api/v1/dashboard/gift_spending` - 获取礼品支出数据
- `GET /api/v1/dashboard/gift_dist` - 获取礼品分类占比

## 数据库表结构

### 1. users(用户表)
- 存储系统用户信息
- 包含用户名、密码哈希、角色、状态等字段

### 2. customer_visits(客户拜访记录表)
- 存储客户拜访记录
- 包含客户ID、企业名称、拜访日期、拜访方式、状态等字段

### 3. gifts(礼品表)
- 存储礼品信息
- 包含礼品名称、分类、单价、库存等字段

### 4. gift_requisitions(礼品领用申请表)
- 存储礼品申请信息
- 包含申请人、领用人、总金额、审批状态等字段

### 5. gift_requisition_items(礼品申请明细表)
- 存储礼品申请明细
- 包含礼品ID、数量、单价、小计等字段

### 6. carousels(轮播图表)
- 存储轮播图信息
- 包含标题、图片URL、排序等字段

### 7. news(新闻表)
- 存储新闻信息
- 包含标题、摘要、内容、发布状态等字段

### 8. system_configs(系统配置表)
- 存储系统配置项
- 包含配置键、配置值、描述等字段

## 安全机制

### JWT 认证

- 所有需要认证的接口都需要在请求头中携带 JWT Token:
  ```
  Authorization: Bearer <token>
  ```
- Token 默认有效期为 2 小时
- Token 包含用户ID、用户名、角色等信息

### RBAC 授权

系统采用基于角色的访问控制(RBAC):

- **CUSTOMER_MANAGER(客户经理)**: 登记拜访记录、提交礼品申请、查看个人数据
- **OPERATIONS(运营人员)**: 维护首页内容、查看运营数据、查看礼品台账
- **APPROVER(审批人员)**: 审批礼品申请、查看审批历史
- **MANAGER(分行管理者)**: 查看运营数据大屏、查看所有统计数据

### 密码安全

- 密码使用 bcrypt 哈希存储
- 最小长度 8 位
- 修改密码需要验证旧密码

## 开发指南

### 代码规范

- 使用类型注解(Type Hints)
- 遵循 PEP 8 代码风格
- 函数和类需要文档字符串
- 关键业务逻辑需要注释

### 测试

```bash
# 运行所有测试
pytest

# 运行特定测试文件
pytest tests/test_auth.py

# 生成覆盖率报告
pytest --cov=app tests/
```

### 数据库迁移

```bash
# 生成新的迁移脚本
alembic revision --autogenerate -m "描述信息"

# 执行迁移
alembic upgrade head

# 回滚迁移
alembic downgrade -1

# 查看迁移历史
alembic history
```

## 常见问题

### 1. 数据库连接失败

检查 `.env` 文件中的数据库配置是否正确:

```bash
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=zero_one
DB_USER=root
DB_PASSWORD=your-password
```

### 2. JWT Token 无效

- 检查 `JWT_SECRET_KEY` 是否配置
- 检查 Token 是否过期(默认 2 小时)

### 3. Alembic 迁移失败

- 确保数据库已创建
- 检查数据库连接配置
- 查看迁移日志了解详细错误信息

## 部署

### 生产环境配置

1. 修改 `.env` 文件:

```bash
# 使用强密钥
JWT_SECRET_KEY=<strong-random-key>

# 配置 CORS 白名单
CORS_ORIGINS=https://your-frontend-domain.com

# 关闭调试模式
```

2. 使用生产级 WSGI 服务器:

```bash
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
```

3. 配置 Nginx 反向代理

4. 启用 HTTPS

## 版本历史

- v1.0.0 (2026-01-08) - 初始版本
  - 实现数据库初始化
  - 实现认证模块
  - 实现 JWT 和 RBAC

## 贡献指南

欢迎提交 Issue 和 Pull Request!

## 许可证

Copyright © 2026 招财银行北京分行

## 联系方式

- 项目负责人: 技术团队
- Email: support@example.com
