# 招财银行北京分行运营门户 - 后端服务

## 项目概述

招财银行北京分行运营门户系统后端服务，采用 FastAPI 框架开发，提供统一的运营信息入口，规范客户拜访、营销活动记录，提供营销礼品审批管理，并为管理层提供运营数据可视化展示。

## 技术栈

- **核心框架**: FastAPI 0.110+
- **开发语言**: Python 3.11+
- **Web服务器**: Uvicorn
- **数据校验**: Pydantic v2
- **ORM**: SQLAlchemy 2.x
- **权限认证**: JWT
- **数据库**: MySQL 8.0+

## 项目结构

```
backend/
├── main.py                 # 应用入口
├── core/                   # 核心模块
│   ├── config.py           # 配置管理
│   └── security.py         # 安全认证
├── api/                    # API路由
│   └── v1/
│       ├── api.py          # API路由器
│       └── endpoints/      # API端点
├── models/                 # 数据模型
├── schemas/                # Pydantic模型
├── services/               # 业务逻辑服务
├── db/                     # 数据库相关
│   ├── session.py          # 数据库会话
│   └── init_db.py         # 数据库初始化
├── utils/                  # 工具函数
│   ├── logging.py          # 日志配置
│   └── exceptions.py       # 异常处理
└── requirements.txt        # 依赖包
```

## 快速开始

### 环境准备

1. 安装 Python 3.11+
2. 安装 MySQL 8.0+
3. 创建数据库并配置连接信息

### 安装依赖

```bash
pip install -r requirements.txt
```

### 环境配置

创建 `.env` 文件并配置以下环境变量：

```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=zero_one
DB_USER=root
DB_PASSWORD=your_password
JWT_SECRET_KEY=your_secret_key
```

### 启动服务

```bash
# 开发模式
uvicorn main:app --reload

# 生产模式
uvicorn main:app --host 0.0.0.0 --port 8000
```

### 使用 Docker

```bash
# 构建镜像
docker build -t zhaocai-portal-backend .

# 运行容器
docker run -p 8000:8000 zhaocai-portal-backend
```

## API 文档

启动服务后，访问以下地址查看 API 文档：

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 主要功能模块

1. **认证授权**: JWT Token 认证
2. **用户管理**: 用户信息管理、角色权限控制
3. **客户拜访**: 客户拜访记录的创建、查询、编辑、删除
4. **礼品管理**: 礼品申请、审批、台账管理
5. **运营数据**: 运营数据可视化展示、统计分析
6. **AI问答**: AI问答功能，提供系统使用帮助
7. **内容管理**: 首页内容、新闻管理

## 安全特性

- JWT Token 认证
- 基于角色的访问控制(RBAC)
- 密码加密存储
- SQL注入防护
- 输入验证和清理

## 部署说明

1. 配置生产环境的数据库连接
2. 设置安全的 JWT 密钥
3. 配置反向代理(如 Nginx)
4. 使用进程管理工具(如 Supervisor)管理服务