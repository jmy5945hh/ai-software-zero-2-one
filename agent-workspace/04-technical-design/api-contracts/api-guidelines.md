# API 开发指南

**文档版本**: v1.0
**创建时间**: 2026-01-08
**负责人**: 技术负责人
**关联文档**: openapi.yaml, api-contract-overview.md

---

## 文档说明

本文档定义"招财银行北京分行运营门户系统"的API开发规范和最佳实践,确保API的一致性、可维护性和AI友好性。

---

## 1. API 命名规范

### 1.1 URL 命名规范

**基本原则**:
- 使用小写字母和连字符(kebab-case)
- 资源名使用复数形式
- 嵌套资源不超过2层

**格式**:
```
{base_url}/api/{version}/{resource}/{id}
```

**示例**:
```bash
# 好的命名
GET /api/v1/visits
GET /api/v1/visits/{visit_id}
GET /api/v1/gifts/applications

# 不好的命名
GET /api/v1/visit
GET /api/v1/getVisits
GET /api/v1/Visits
```

### 1.2 动词命名规范

**操作与HTTP动词映射**:

| 操作 | HTTP方法 | URL示例 |
| --- | --- | --- |
| 查询列表 | GET | GET /api/v1/visits |
| 查询详情 | GET | GET /api/v1/visits/{id} |
| 创建 | POST | POST /api/v1/visits |
| 完整更新 | PUT | PUT /api/v1/visits/{id} |
| 部分更新 | PATCH | PATCH /api/v1/visits/{id} |
| 删除 | DELETE | DELETE /api/v1/visits/{id} |

**特殊操作**:
```bash
# 审批操作使用子资源
POST /api/v1/gifts/approvals/{id}/approve
POST /api/v1/gifts/approvals/{id}/reject

# 发布操作使用子资源
POST /api/v1/content/news/{id}/publish
```

### 1.3 函数命名规范

**后端路由函数**:
```python
# 好的命名
@router.get("/visits")
async def query_visits() ...

@router.post("/visits")
async def create_visit() ...

@router.get("/visits/{visit_id}")
async def get_visit(visit_id: str) ...

@router.put("/visits/{visit_id}")
async def update_visit(visit_id: str) ...

# 不好的命名
@router.get("/visits")
async def visits() ...  # 动词不明确

@router.get("/visits/{visit_id}")
async def visitById() ...  # 驼峰命名
```

---

## 2. 请求/响应格式规范

### 2.1 统一响应格式

**成功响应**:
```json
{
  "code": 200,
  "message": "success",
  "data": { ... }
}
```

**分页响应**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "items": [ ... ],
    "total": 100,
    "page": 1,
    "page_size": 10,
    "total_pages": 10
  }
}
```

**错误响应**:
```json
{
  "code": 400,
  "message": "validation error",
  "errors": [
    {
      "field": "customer_id",
      "message": "customer_id is required"
    }
  ]
}
```

### 2.2 请求格式规范

**Query 参数**:
```bash
# 分页
?pages=1&page_size=10

# 排序
?sort=create_time&order=desc

# 筛选
?status=SUCCESS&create_by=USER001

# 日期范围
?planned_date_start=2026-01-01&planned_date_end=2026-01-31
```

**请求体**:
```json
{
  "customer_id": "CUST001",
  "company_name": "某某科技有限公司",
  "planned_date": "2026-01-10",
  "visit_method": "ON_SITE",
  "status": "NEW"
}
```

---

## 3. 错误处理规范

### 3.1 HTTP 状态码使用

| 状态码 | 说明 | 使用场景 |
| --- | --- | --- |
| 200 | OK | 请求成功 |
| 201 | Created | 创建成功 |
| 204 | No Content | 删除成功 |
| 400 | Bad Request | 请求参数错误 |
| 401 | Unauthorized | 未认证(Token无效或过期) |
| 403 | Forbidden | 无权限访问 |
| 404 | Not Found | 资源不存在 |
| 409 | Conflict | 资源冲突(如重复创建) |
| 422 | Unprocessable Entity | 业务逻辑错误 |
| 500 | Internal Server Error | 服务器内部错误 |

### 3.2 错误消息规范

**后端错误处理示例**:
```python
from fastapi import HTTPException

# 参数校验错误
raise HTTPException(
    status_code=400,
    detail={
        "code": 400,
        "message": "validation error",
        "errors": [
            {
                "field": "customer_id",
                "message": "customer_id is required"
            }
        ]
    }
)

# 认证错误
raise HTTPException(
    status_code=401,
    detail={
        "code": 401,
        "message": "invalid or expired token"
    }
)

# 权限错误
raise HTTPException(
    status_code=403,
    detail={
        "code": 403,
        "message": "permission denied"
    }
)

# 资源不存在
raise HTTPException(
    status_code=404,
    detail={
        "code": 404,
        "message": "visit not found"
    }
)

# 业务逻辑错误
raise HTTPException(
    status_code=422,
    detail={
        "code": 422,
        "message": "cannot edit approved requisition"
    }
)
```

### 3.3 异常捕获中间件

**全局异常处理器**:
```python
from fastapi import Request
from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # 记录日志
    logger.error(f"Unexpected error: {str(exc)}")

    # 返回友好错误信息
    return JSONResponse(
        status_code=500,
        content={
            "code": 500,
            "message": "internal server error"
        }
    )
```

---

## 4. 认证授权实现指南

### 4.1 JWT Token 认证

**后端实现**:
```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> User:
    token = credentials.credentials

    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")

        if user_id is None:
            raise HTTPException(status_code=401, detail="invalid token")

        user = db.query(User).filter_by(user_id=user_id).first()
        if user is None:
            raise HTTPException(status_code=401, detail="user not found")

        return user

    except JWTError:
        raise HTTPException(status_code=401, detail="invalid token")
```

**前端实现**:
```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

// 请求拦截器
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token过期,跳转到登录页
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### 4.2 基于角色的权限控制

**后端依赖注入**:
```python
from functools import wraps

def require_role(roles: List[str]):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, user: User = Depends(get_current_user), **kwargs):
            if user.role not in roles:
                raise HTTPException(
                    status_code=403,
                    detail="permission denied"
                )
            return await func(*args, user=user, **kwargs)
        return wrapper
    return decorator

# 使用示例
@router.get("/gifts/ledger")
@require_role(["OPERATIONS", "MANAGER"])
async def get_gift_ledger(user: User = Depends(get_current_user)):
    ...
```

**前端路由守卫**:
```typescript
const ProtectedRoute = ({ roles, children }) => {
  const { user } = useAuthStore();

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/403" />;
  }

  return children;
};

// 使用示例
<Route
  path="/gift-ledger"
  element={
    <ProtectedRoute roles={["OPERATIONS", "MANAGER"]}>
      <GiftLedger />
    </ProtectedRoute>
  }
/>
```

### 4.3 数据级权限控制

**后端实现**:
```python
def check_visit_permission(visit: CustomerVisit, user: User) -> bool:
    """检查用户是否有权限访问拜访记录"""
    if user.role == "CUSTOMER_MANAGER":
        # 客户经理只能查看自己创建或参与的记录
        return (
            visit.create_by == user.user_id or
            user.user_id in visit.participants
        )
    elif user.role in ["OPERATIONS", "MANAGER"]:
        # 运营人员和管理者可查看所有记录
        return True
    else:
        return False

@router.get("/visits/{visit_id}")
async def get_visit(
    visit_id: str,
    user: User = Depends(get_current_user)
):
    visit = db.query(CustomerVisit).filter_by(visit_id=visit_id).first()

    if not visit:
        raise HTTPException(status_code=404, detail="visit not found")

    if not check_visit_permission(visit, user):
        raise HTTPException(status_code=403, detail="permission denied")

    return visit
```

---

## 5. 分页、排序、过滤实现指南

### 5.1 分页实现

**后端实现**:
```python
from pydantic import BaseModel

class PaginationParams(BaseModel):
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=10, ge=1, le=100)

class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    page_size: int
    total_pages: int

@router.get("/visits")
async def query_visits(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    user: User = Depends(get_current_user)
):
    # 计算偏移量
    offset = (page - 1) * page_size

    # 查询数据
    total = db.query(CustomerVisit).filter(...).count()
    items = db.query(CustomerVisit).filter(...).offset(offset).limit(page_size).all()

    # 计算总页数
    total_pages = (total + page_size - 1) // page_size

    return {
        "code": 200,
        "message": "success",
        "data": {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages
        }
    }
```

**前端实现**:
```typescript
import { useRequest } from 'ahooks';

const VisitsTable = () => {
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
  });

  const { data, loading } = useRequest(
    () => api.get('/api/v1/visits', { params: pagination }),
    {
      refreshDeps: [pagination],
    }
  );

  return (
    <Table
      dataSource={data?.data?.items}
      pagination={{
        current: pagination.page,
        pageSize: pagination.pageSize,
        total: data?.data?.total,
        onChange: (page, pageSize) => {
          setPagination({ page, pageSize });
        },
      }}
    />
  );
};
```

### 5.2 排序实现

**后端实现**:
```python
@router.get("/visits")
async def query_visits(
    sort: str = Query("create_time"),
    order: str = Query("desc", regex="^(asc|desc)$"),
    user: User = Depends(get_current_user)
):
    # 构建排序
    order_by = getattr(CustomerVisit, sort)
    if order == "desc":
        order_by = order_by.desc()

    # 查询数据
    items = db.query(CustomerVisit).order_by(order_by).all()

    return items
```

**前端实现**:
```typescript
const [sorter, setSorter] = useState({
    field: 'create_time',
    order: 'desc',
  });

const { data } = useRequest(
  () => api.get('/api/v1/visits', {
    params: {
      sort: sorter.field,
      order: sorter.order,
    },
  }),
  { refreshDeps: [sorter] }
);

return (
  <Table
    onChange={(pagination, filters, sorter) => {
      setSorter({
        field: sorter.field,
        order: sorter.order === 'ascend' ? 'asc' : 'desc',
      });
    }}
  />
);
```

### 5.3 过滤实现

**后端实现**:
```python
from sqlalchemy import or_, and_

@router.get("/visits")
async def query_visits(
    status: Optional[VisitStatus] = Query(None),
    create_by: Optional[str] = Query(None),
    planned_date_start: Optional[date] = Query(None),
    planned_date_end: Optional[date] = Query(None),
    user: User = Depends(get_current_user)
):
    # 构建查询条件
    conditions = []

    if status:
        conditions.append(CustomerVisit.status == status)

    if create_by:
        conditions.append(CustomerVisit.create_by == create_by)

    if planned_date_start and planned_date_end:
        conditions.append(
            and_(
                CustomerVisit.planned_date >= planned_date_start,
                CustomerVisit.planned_date <= planned_date_end
            )
        )

    # 应用查询条件
    query = db.query(CustomerVisit)
    if conditions:
        query = query.filter(and_(*conditions))

    items = query.all()
    return items
```

---

## 6. 版本管理策略

### 6.1 API 版本定义

**当前版本**: v1

**URL 格式**:
```bash
/api/v1/visits
/api/v2/visits  # 未来版本
```

### 6.2 版本升级规则

**向后兼容的变更** (不升级版本号):
- 添加可选字段
- 添加新的API端点
- 添加新的查询参数

**不兼容的变更** (升级版本号):
- 删除字段
- 修改字段类型
- 修改必填字段
- 删除API端点

### 6.3 版本废弃策略

**废弃通知**:
```python
from fastapi import Response

@router.get("/api/v1/visits", deprecated=True)
async def query_visits_v1():
    ...
```

**响应头警告**:
```python
response.headers["Warning"] = '299 - "API version v1 is deprecated, please upgrade to v2"'
```

---

## 7. 测试指南

### 7.1 单元测试

**Pytest 示例**:
```python
import pytest
from fastapi.testclient import TestClient

def test_create_visit(client: TestClient, auth_headers: dict):
    response = client.post(
        "/api/v1/visits",
        headers=auth_headers,
        json={
            "customer_id": "CUST001",
            "company_name": "测试公司",
            "planned_date": "2026-01-10",
            "actual_date": "2026-01-10",
            "visit_method": "ON_SITE",
            "status": "NEW"
        }
    )

    assert response.status_code == 201
    data = response.json()
    assert data["code"] == 201
    assert data["data"]["visit_id"]
    assert data["data"]["company_name"] == "测试公司"

def test_create_visit_validation_error(client: TestClient, auth_headers: dict):
    response = client.post(
        "/api/v1/visits",
        headers=auth_headers,
        json={
            "customer_id": "",  # 无效数据
            "company_name": "测试公司",
        }
    )

    assert response.status_code == 400
    data = response.json()
    assert data["code"] == 400
    assert "errors" in data["data"]
```

### 7.2 集成测试

**测试数据库操作**:
```python
import pytest
from sqlalchemy.orm import Session

@pytest.fixture
def db_session():
    # 创建测试数据库会话
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        # 清理测试数据
        TestingSessionLocal.rollback()

def test_visit_crud(db_session: Session):
    # 创建
    visit = CustomerVisit(...)
    db_session.add(visit)
    db_session.commit()

    # 读取
    fetched = db_session.query(CustomerVisit).filter_by(visit_id=visit.visit_id).first()
    assert fetched is not None

    # 更新
    fetched.company_name = "新公司名称"
    db_session.commit()

    # 验证
    assert fetched.company_name == "新公司名称"
```

### 7.3 API 测试

**契约测试**:
```python
def test_api_contract():
    """验证API响应符合OpenAPI规范"""
    response = client.get("/api/v1/visits")

    # 验证响应结构
    assert "code" in response.json()
    assert "message" in response.json()
    assert "data" in response.json()

    # 验证分页结构
    data = response.json()["data"]
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "page_size" in data
```

---

## 8. 文档生成

### 8.1 自动生成 OpenAPI 文档

**FastAPI 自动生成**:
```python
from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi

app = FastAPI(
    title="招财银行运营门户系统 API",
    description="系统API文档",
    version="1.0.0"
)

# 访问文档
# Swagger UI: http://localhost:8000/docs
# ReDoc: http://localhost:8000/redoc
# OpenAPI JSON: http://localhost:8000/openapi.json
```

### 8.2 文档注释规范

**使用 docstring**:
```python
@router.post("/visits", summary="新增拜访记录", description="创建新的客户拜访记录")
async def create_visit(
    visit: VisitCreateRequest,
    user: User = Depends(get_current_user)
):
    """
    创建新的客户拜访记录

    - **visit**: 拜访记录数据
    - **user**: 当前登录用户

    返回创建的拜访记录
    """
    ...
```

---

## 9. 性能优化建议

### 9.1 数据库查询优化

**使用索引**:
```python
# 确保查询字段有索引
# customer_visits 表索引:
# - idx_customer_id (customer_id)
# - idx_create_by (create_by)
# - idx_status (status)
```

**避免 N+1 查询**:
```python
# 不好的实现( N+1 查询)
visits = db.query(CustomerVisit).all()
for visit in visits:
    user = db.query(User).filter_by(user_id=visit.create_by).first()  # N+1

# 好的实现(使用 join)
visits = db.query(CustomerVisit).join(User).all()
```

### 9.2 响应缓存

**使用 Redis 缓存** (可选):
```python
import redis
import json

redis_client = redis.Redis(host='localhost', port=6379, db=0)

@router.get("/dashboard/metrics")
async def get_dashboard_metrics():
    # 尝试从缓存读取
    cached = redis_client.get("dashboard:metrics")
    if cached:
        return json.loads(cached)

    # 计算指标
    metrics = calculate_metrics()

    # 写入缓存(5分钟过期)
    redis_client.setex("dashboard:metrics", 300, json.dumps(metrics))

    return metrics
```

---

## 10. 安全最佳实践

### 10.1 输入校验

**使用 Pydantic 进行类型校验**:
```python
from pydantic import BaseModel, Field, validator

class VisitCreateRequest(BaseModel):
    customer_id: str = Field(..., min_length=1, max_length=50)
    company_name: str = Field(..., min_length=1, max_length=200)
    planned_date: date
    actual_date: date

    @validator('actual_date')
    def validate_date(cls, v, values):
        if 'planned_date' in values and v < values['planned_date']:
            raise ValueError('actual_date must be >= planned_date')
        return v
```

### 10.2 SQL 注入防护

**使用 ORM 防止 SQL 注入**:
```python
# 安全: 使用 SQLAlchemy ORM
visit = session.query(CustomerVisit).filter_by(visit_id=visit_id).first()

# 危险: 拼接 SQL(禁止)
# query = f"SELECT * FROM customer_visits WHERE visit_id = '{visit_id}'"
```

### 10.3 敏感数据脱敏

**不返回敏感字段**:
```python
def user_response(user: User) -> dict:
    return {
        "user_id": user.user_id,
        "username": user.username,
        "name": user.name,
        "role": user.role,
        # 不返回 password_hash
    }
```

---

## 11. 待确认事项

1. **是否需要支持批量操作**: 如批量删除、批量审批
2. **是否需要支持导出功能**: 如导出 Excel
3. **是否需要 Rate Limiting**: 限流机制
4. **是否需要支持异步任务**: 如使用 Celery

---

**文档变更记录**:
- v1.0 (2026-01-08): 初始版本,定义API开发指南
