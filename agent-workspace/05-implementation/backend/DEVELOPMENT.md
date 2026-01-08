# 后端开发文档

## 开发任务完成情况

### Task B-001: 数据库初始化 ✅

**完成项目**:

1. ✅ 创建完整的 FastAPI 项目骨架
2. ✅ 配置 SQLAlchemy 2.x ORM
3. ✅ 创建所有数据表模型(8 张表)
   - users (用户表)
   - customer_visits (拜访记录表)
   - gifts (礼品表)
   - gift_requisitions (礼品申请表)
   - gift_requisition_items (礼品申请明细表)
   - carousels (轮播图表)
   - news (新闻表)
   - system_configs (系统配置表)
4. ✅ 配置 Alembic 迁移脚本
5. ✅ 创建初始测试数据脚本

**验收标准**:

- ✅ 所有表创建成功,字段类型正确
- ✅ 外键关系建立正确
- ✅ 索引创建正确
- ✅ 迁移脚本可重复执行(idempotent)
- ✅ 测试数据插入成功
- ✅ 项目可启动(`uvicorn app.main:app --reload`)

**文件清单**:

- `/app/models/user.py` - 用户模型
- `/app/models/customer_visit.py` - 拜访记录模型
- `/app/models/gift.py` - 礼品模型
- `/app/models/gift_requisition.py` - 礼品申请模型
- `/app/models/gift_requisition_item.py` - 礼品申请明细模型
- `/app/models/carousel.py` - 轮播图模型
- `/app/models/news.py` - 新闻模型
- `/app/models/system_config.py` - 系统配置模型
- `/app/db/base.py` - 数据库基类
- `/app/db/session.py` - 数据库会话管理
- `/alembic/env.py` - Alembic 环境配置
- `/alembic.ini` - Alembic 配置文件
- `/init_test_data.py` - 初始测试数据脚本

---

### Task B-002: 认证模块 ✅

**完成项目**:

1. ✅ 实现登录 API (`POST /api/v1/auth/login`)
   - 接收账号密码
   - 验证用户身份
   - 颁发 JWT Token
   - 返回用户信息和 Token

2. ✅ 实现 JWT Token 验证中间件
   - 从请求头提取 Token
   - 验证 Token 有效性
   - 解析用户信息

3. ✅ 实现权限检查装饰器(RBAC)
   - 基于角色的访问控制
   - 支持多角色验证
   - 返回 403 如果无权访问

4. ✅ 实现当前用户信息获取 API (`GET /api/v1/auth/me`)
   - 返回当前登录用户信息
   - 包含角色信息

5. ✅ 实现密码哈希和验证(使用 bcrypt)

**额外实现**:

- ✅ 更新用户信息 API (`PUT /api/v1/auth/me`)
- ✅ 修改密码 API (`PUT /api/v1/auth/me/password`)

**验收标准**:

- ✅ 登录 API 返回 JWT Token
- ✅ Token 验证正确识别用户身份和角色
- ✅ 权限检查正确拦截无权访问
- ✅ API 符合 OpenAPI 规范
- ✅ FastAPI 自动生成 Swagger 文档

**文件清单**:

- `/app/core/security.py` - JWT 工具函数和密码哈希
- `/app/core/deps.py` - 依赖注入函数(get_current_user, require_role)
- `/app/schemas/auth.py` - 认证相关 Pydantic 模型
- `/app/services/auth_service.py` - 认证业务逻辑
- `/app/crud/user.py` - 用户数据访问层
- `/app/api/v1/auth.py` - 认证路由

---

## 代码架构说明

### 分层架构

```
API 路由层 (app/api/)
    ↓
业务逻辑层 (app/services/)
    ↓
数据访问层 (app/crud/)
    ↓
ORM 模型层 (app/models/)
    ↓
数据库 (MySQL)
```

### 依赖注入

使用 FastAPI 的依赖注入系统:

1. **数据库会话**: `get_db()`
2. **当前用户**: `get_current_user()`
3. **角色权限**: `require_role(*roles)`

### 安全机制

1. **JWT 认证**:
   - Token 包含: user_id, username, name, role
   - Token 有效期: 2 小时
   - 加密算法: HS256

2. **密码安全**:
   - 哈希算法: bcrypt
   - 盐值: 自动生成
   - 最小长度: 8 位

3. **RBAC 授权**:
   - 4 种角色: CUSTOMER_MANAGER, OPERATIONS, APPROVER, MANAGER
   - 基于装饰器的权限检查
   - 支持多角色验证

---

## 数据库设计

### ER 关系

```
users (用户表)
    ↓ 1:N
customer_visits (拜访记录表)

users (用户表)
    ↓ 1:N (applicant)
gift_requisitions (礼品申请表)
    ↓ 1:N
gift_requisition_items (礼品申请明细表)
    ↓ N:1
gifts (礼品表)

users (用户表)
    ↓ 1:N
carousels (轮播图表)

users (用户表)
    ↓ 1:N
news (新闻表)
```

### 外键约束

| 表 | 字段 | 关联表 | 关联字段 | 级联规则 |
|---|---|---|---|---|
| customer_visits | create_by | users | user_id | RESTRICT |
| gift_requisitions | applicant | users | user_id | RESTRICT |
| gift_requisitions | recipient | users | user_id | RESTRICT |
| gift_requisitions | approver | users | user_id | SET NULL |
| gift_requisition_items | requisition_id | gift_requisitions | requisition_id | CASCADE |
| gift_requisition_items | gift_id | gifts | gift_id | RESTRICT |
| carousels | create_by | users | user_id | RESTRICT |
| news | create_by | users | user_id | RESTRICT |

---

## API 文档

### 自动生成的文档

启动服务后访问:

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 测试脚本

运行认证功能测试:

```bash
# 确保服务已启动
python test_auth.py
```

测试内容:

1. 用户登录
2. 获取当前用户信息
3. 无效 Token 拦截
4. 错误密码拒绝

---

## 开发规范

### 命名规范

- 文件名: 小写,下划线分隔 (user_model.py)
- 类名: 大驼峰 (UserService)
- 函数名: 小写,下划线分隔 (get_user_by_id)
- 变量名: 小写,下划线分隔 (user_id)
- 常量名: 大写,下划线分隔 (MAX_LOGIN_ATTEMPTS)

### 类型注解

所有函数必须使用类型注解:

```python
def get_user_by_id(db: Session, user_id: str) -> Optional[User]:
    """根据用户ID获取用户"""
    return db.query(User).filter(User.user_id == user_id).first()
```

### 文档字符串

所有模块、类、函数需要文档字符串:

```python
def authenticate(db: Session, form: LoginRequest) -> Optional[User]:
    """
    用户认证

    Args:
        db: 数据库会话
        form: 登录表单

    Returns:
        Optional[User]: 认证成功返回用户对象,失败返回 None
    """
    ...
```

---

## 待实现功能

### Task B-003: 拜访管理模块 (下一步)

- 拜访记录 CRUD API
- 数据级权限控制
- 多条件筛选

### Task B-004: 礼品管理模块

- 礼品申请 CRUD API
- 礼品审批 API
- 状态流转控制

### Task B-005: 首页内容模块

- 轮播图查询/管理 API
- 新闻查询/管理 API

### Task B-006: 数据统计模块

- 拜访统计 API
- 礼品统计 API
- 关键指标汇总 API

---

## 常用命令

### 数据库迁移

```bash
# 生成迁移脚本
alembic revision --autogenerate -m "描述信息"

# 执行迁移
alembic upgrade head

# 回滚迁移
alembic downgrade -1

# 查看迁移历史
alembic history
```

### 服务启动

```bash
# 开发环境(支持热重载)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 生产环境
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
```

### 测试

```bash
# 运行所有测试
pytest

# 运行特定测试
pytest tests/test_auth.py

# 生成覆盖率报告
pytest --cov=app tests/
```

---

## 注意事项

1. **环境配置**:
   - 复制 `.env.example` 为 `.env`
   - 修改数据库连接信息
   - 修改 JWT_SECRET_KEY 为强随机密钥

2. **数据库**:
   - 确保数据库已创建
   - 字符集设置为 utf8mb4
   - 运行迁移脚本创建表

3. **测试数据**:
   - 运行 `python init_test_data.py` 初始化测试数据
   - 默认密码: password123
   - 测试账号见 README.md

4. **安全性**:
   - 生产环境使用 HTTPS
   - JWT_SECRET_KEY 使用强随机密钥
   - 数据库密码使用强密码

---

## 项目亮点

1. **完整的分层架构**: API → Service → CRUD → Model → Database
2. **严格的类型检查**: 所有函数都有类型注解
3. **完善的错误处理**: 统一的错误响应格式
4. **安全的认证机制**: JWT + bcrypt + RBAC
5. **自动化文档**: FastAPI 自动生成 Swagger/ReDoc
6. **数据库迁移**: Alembic 版本管理
7. **测试数据脚本**: 便于快速开始开发
8. **开发友好**: 热重载、详细日志、测试脚本

---

**开发完成时间**: 2026-01-08
**开发者**: AI Backend Developer (Claude)
**项目状态**: Task B-001 ✅, Task B-002 ✅
