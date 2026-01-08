# 安全架构设计

**文档版本**: v1.0
**创建时间**: 2026-01-08
**负责人**: 系统架构师
**关联文档**: architecture-decisions.md, data-architecture.md, api-contract-overview.md

---

## 文档说明

本文档定义"招财银行北京分行运营门户系统"的安全架构设计，包括认证机制、授权机制、数据加密策略、常见攻击防护和 API 安全。

---

## 1. 安全架构总览

### 1.1 纵深防御策略

系统采用多层安全防护：

```
┌─────────────────────────────────────────────────────┐
│  第一层：网络安全 (HTTPS / 防火墙 / IP 白名单)       │
├─────────────────────────────────────────────────────┤
│  第二层：认证授权 (JWT / RBAC)                       │
├─────────────────────────────────────────────────────┤
│  第三层：数据加密 (密码哈希 / 敏感数据脱敏)           │
├─────────────────────────────────────────────────────┤
│  第四层：输入校验 (参数校验 / SQL 注入防护)          │
├─────────────────────────────────────────────────────┤
│  第五层：输出防护 (XSS 防护 / CSRF 防护)            │
├─────────────────────────────────────────────────────┤
│  第六层：审计日志 (操作日志 / 异常监控)              │
└─────────────────────────────────────────────────────┘
```

### 1.2 安全威胁模型

| 威胁类型 | 风险等级 | 防护措施 |
| --- | --- | --- |
| 未授权访问 | 高 | JWT 认证 + RBAC 授权 |
| 密码泄露 | 高 | 密码哈希 + 强密码策略 |
| SQL 注入 | 高 | ORM + 参数化查询 |
| XSS 攻击 | 中 | 输出转义 + CSP |
| CSRF 攻击 | 中 | CSRF Token + SameSite Cookie |
| 数据泄露 | 高 | 数据加密 + 敏感数据脱敏 |
| API 滥用 | 中 | Rate Limiting |
| 中间人攻击 | 中 | HTTPS |

---

## 2. 认证机制

### 2.1 JWT 认证流程

```
用户登录
  ↓
后端验证账号密码
  ↓
生成 JWT Token (包含 user_id, role, exp)
  ↓
返回 Token 给前端
  ↓
前端存储 Token (localStorage)
  ↓
前端每次请求携带 Token (Authorization: Bearer <token>)
  ↓
后端验证 Token 签名和过期时间
  ↓
验证通过，处理请求
```

### 2.2 JWT Token 结构

```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "user_id": "USER001",
    "username": "user001",
    "name": "张三",
    "role": "CUSTOMER_MANAGER",
    "exp": 1641693600,
    "iat": 1641686400
  },
  "signature": "..."
}
```

**字段说明**:
- `user_id`: 用户ID
- `username`: 用户名
- `name`: 用户姓名
- `role`: 用户角色
- `exp`: 过期时间（Unix 时间戳）
- `iat`: 签发时间（Unix 时间戳）

### 2.3 JWT 配置

```python
# config.py
JWT_CONFIG = {
    "secret_key": "zero-one-test",  # 生产环境使用强随机密钥
    "algorithm": "HS256",           # 待确认: SM2/SM3（国密）
    "access_token_expire_minutes": 120,  # 2 小时
}
```

### 2.4 密码哈希策略

**算法**: bcrypt 或 PBKDF2

**示例**:
```python
import bcrypt

# 密码哈希
password = "password123".encode('utf-8')
password_hash = bcrypt.hashpw(password, bcrypt.gensalt(rounds=12))

# 密码验证
is_valid = bcrypt.checkpw(password, password_hash)
```

**安全参数**:
- `rounds`: 12（计算成本，值越大越安全但越慢）
- 盐值: 自动生成，无需手动管理

### 2.5 密码策略（待确认）

| 策略 | 要求 | 示例 |
| --- | --- | --- |
| 最小长度 | 8 位 | password123 |
| 复杂度 | 包含大小写字母、数字 | Pass123 |
| 过期策略 | 90 天（待确认） | - |
| 账号锁定 | 连续 5 次失败后锁定（待确认） | - |

---

## 3. 授权机制

### 3.1 RBAC 权限模型

系统采用基于角色的访问控制（RBAC）：

```
用户 (User)
  ↓ 拥有
角色 (Role)
  ↓ 拥有
权限 (Permission)
  ↓ 控制
资源 (Resource)
```

### 3.2 角色定义

| 角色 | 代码 | 权限范围 |
| --- | --- | --- |
| 客户经理 | CUSTOMER_MANAGER | 登记拜访记录、提交礼品申请、查看个人数据 |
| 运营人员 | OPERATIONS | 维护首页内容、查看运营数据、查看礼品台账 |
| 审批人员 | APPROVER | 审批礼品申请、查看审批历史 |
| 分行管理者 | MANAGER | 查看运营数据大屏、查看所有统计数据 |

### 3.3 权限检查实现

**后端依赖注入**:
```python
from fastapi import Depends, HTTPException
from dependencies import get_current_user

def require_role(roles: List[str]):
    def decorator(func):
        @wraps(func)
        async def wrapper(
            user: User = Depends(get_current_user)
        ):
            if user.role not in roles:
                raise HTTPException(403, "permission denied")
            return await func(user)
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
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/403" />;
  }
  return children;
};
```

### 3.4 数据级权限

除了角色权限，还需要检查数据所有权：

**示例**:
```python
def check_visit_permission(visit: CustomerVisit, user: User) -> bool:
    # 客户经理只能查看自己创建或参与的拜访记录
    if user.role == "CUSTOMER_MANAGER":
        return visit.create_by == user.user_id or user.user_id in visit.participants
    # 运营人员和管理者可查看所有记录
    elif user.role in ["OPERATIONS", "MANAGER"]:
        return True
    return False
```

---

## 4. 数据加密策略

### 4.1 传输加密

**HTTPS**: 生产环境必须使用 HTTPS

**配置**:
```nginx
server {
    listen 443 ssl http2;
    server_name api.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
}
```

### 4.2 存储加密

| 数据类型 | 加密方式 | 说明 |
| --- | --- | --- |
| 密码 | bcrypt 哈希 | 不可逆，加盐 |
| JWT Secret | 环境变量 | 生产环境使用强随机密钥 |
| 数据库密码 | 环境变量 | 存储在 .env 文件，不提交到 Git |
| 敏感字段 | 待确认 | 如需加密，使用 AES-256 |

### 4.3 敏感数据脱敏

**响应脱敏规则**:

| 字段 | 脱敏规则 | 示例 |
| --- | --- | --- |
| password_hash | 永不返回 | - |
| password | 仅用于输入，不返回 | - |
| 手机号 | 部分隐藏 | 138****1234 |
| 身份证 | 部分隐藏 | 110101********1234 |

**示例**:
```python
def mask_phone(phone: str) -> str:
    return phone[:3] + "****" + phone[-4:]
```

---

## 5. 输入校验与防护

### 5.1 参数校验

**使用 Pydantic 进行类型校验**:
```python
from pydantic import BaseModel, Field, validator

class VisitCreate(BaseModel):
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

### 5.2 SQL 注入防护

**使用 ORM 防止 SQL 注入**:
```python
# 安全: 使用 SQLAlchemy ORM
visit = session.query(CustomerVisit).filter_by(visit_id=visit_id).first()

# 危险: 拼接 SQL（禁止）
# query = f"SELECT * FROM customer_visits WHERE visit_id = '{visit_id}'"
```

### 5.3 XSS 防护

**前端输出转义**:
- React 默认转义输出，防止 XSS
- 避免使用 `dangerouslySetInnerHTML`

**Content Security Policy (CSP)**:
```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';">
```

### 5.4 CSRF 防护

**前后端分离架构的 CSRF 防护**:
- 使用 JWT Token 存储在 localStorage（不使用 Cookie）
- SameSite Cookie 属性（如果使用 Cookie）

**示例**:
```python
# 后端设置 SameSite Cookie
response.set_cookie(
    key="session",
    value=token,
    samesite="lax",  # 或 "strict"
    secure=True,     # HTTPS only
    httponly=True
)
```

### 5.5 文件上传安全（如轮播图图片）

**安全检查**:
1. 文件类型白名单（仅允许 jpg, png, gif）
2. 文件大小限制（如最大 5MB）
3. 文件名随机化（防止路径遍历）
4. 病毒扫描（可选）

**示例**:
```python
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "gif"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

def validate_upload_file(file: UploadFile):
    # 检查文件扩展名
    ext = file.filename.split(".")[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, "invalid file type")

    # 检查文件大小
    content = file.file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(400, "file too large")

    # 生成随机文件名
    filename = f"{uuid.uuid4()}.{ext}"
    return filename, content
```

---

## 6. API 安全

### 6.1 Rate Limiting（限流）

**防止 API 滥用**:
- 同一 IP 每分钟最多 60 次请求
- 超过限制返回 429 状态码

**实现方式**（使用 Redis）:
```python
from fastapi import Request, HTTPException
import redis

redis_client = redis.Redis(host='localhost', port=6379, db=0)

async def rate_limit(request: Request):
    client_ip = request.client.host
    key = f"rate_limit:{client_ip}"

    count = redis_client.incr(key)
    if count == 1:
        redis_client.expire(key, 60)  # 60 秒过期

    if count > 60:
        raise HTTPException(429, "rate limit exceeded")
```

**响应头**:
```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1641620400
```

### 6.2 请求日志

**记录敏感操作**:
- 登录/登出
- 新增/修改/删除操作
- 审批操作
- 数据导出（如支持）

**日志格式**:
```json
{
  "timestamp": "2026-01-08T10:00:00",
  "user_id": "USER001",
  "username": "user001",
  "action": "CREATE_VISIT",
  "resource": "visit_id:VISIT001",
  "ip": "192.168.1.100",
  "user_agent": "Mozilla/5.0...",
  "result": "success"
}
```

### 6.3 错误信息脱敏

**避免暴露敏感信息**:
```python
# 错误示例
# raise HTTPException(500, f"Database error: {str(e)}")

# 正确示例
logger.error(f"Database error: {str(e)}")
raise HTTPException(500, "internal server error")
```

---

## 7. 网络安全

### 7.1 HTTPS

**生产环境必须使用 HTTPS**:
- 使用 Let's Encrypt 免费证书
- 强制 HTTPS，禁用 HTTP

**Nginx 配置**:
```nginx
server {
    listen 80;
    server_name api.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.example.com;

    ssl_certificate /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;
}
```

### 7.2 防火墙

**仅开放必要端口**:
```bash
# SSH
sudo ufw allow 22/tcp

# HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 拒绝其他所有连接
sudo ufw default deny incoming
sudo ufw enable
```

### 7.3 IP 白名单（可选）

**限制管理后台访问**:
```nginx
location /admin {
    allow 192.168.1.0/24;
    deny all;
}
```

---

## 8. 安全配置清单

### 8.1 后端配置

```python
# config.py

# JWT 配置
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")  # 强随机密钥
JWT_ALGORITHM = "HS256"
JWT_ACCESS_TOKEN_EXPIRE_MINUTES = 120

# CORS 配置（生产环境限制域名）
CORS_ORIGINS = [
    "http://localhost:5173",  # 开发环境
    "https://app.example.com",  # 生产环境
]

# 数据库配置
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")  # 强密码

# 密码策略
PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_ATTEMPTS = 5  # 账号锁定（待确认）
```

### 8.2 前端配置

```typescript
// .env.development
VITE_API_BASE_URL=http://localhost:8000

// .env.production
VITE_API_BASE_URL=https://api.example.com
```

### 8.3 环境变量管理

**.env 文件（不提交到 Git）**:
```bash
# .env
JWT_SECRET_KEY=your-secret-key
DB_PASSWORD=your-db-password
LLM_API_KEY=your-llm-api-key
```

**.env.example（提交到 Git）**:
```bash
# .env.example
JWT_SECRET_KEY=your-secret-key
DB_PASSWORD=your-db-password
LLM_API_KEY=your-llm-api-key
```

---

## 9. 安全审计与监控

### 9.1 审计日志

**记录内容**:
- 用户登录/登出
- 数据增删改操作
- 审批操作
- 异常访问（如 403/404）

**日志存储**:
- 文件日志（按天轮转）
- 数据库日志（可选）
- 日志保留时间：90 天

### 9.2 异常监控

**监控指标**:
- 500 错误率
- 401/403 错误率
- API 响应时间
- 数据库连接数

**告警方式**（可选）:
- 邮件告警
- 钉钉/企业微信告警

---

## 10. 安全检查清单

### 10.1 开发阶段

- [ ] 所有 API 都有 JWT 认证（除登录接口）
- [ ] 密码使用 bcrypt 哈希
- [ ] 参数校验使用 Pydantic
- [ ] SQL 查询使用 ORM
- [ ] 敏感数据不记录到日志
- [ ] .env 文件不提交到 Git

### 10.2 部署阶段

- [ ] 使用 HTTPS
- [ ] JWT_SECRET_KEY 使用强随机密钥
- [ ] 数据库密码强度足够
- [ ] 防火墙仅开放必要端口
- [ ] 配置 CORS 白名单
- [ ] 关闭调试模式（DEBUG=False）

### 10.3 运维阶段

- [ ] 定期更新依赖包
- [ ] 定期备份数据库
- [ ] 监控异常访问
- [ ] 定期安全扫描
- [ ] 定期渗透测试

---

## 11. 待确认事项

1. **JWT 算法**: 使用 HS256 还是国密 SM2/SM3
2. **密码策略**:
   - 密码复杂度要求
   - 密码过期策略（如 90 天）
   - 账号锁定策略（如连续 5 次失败后锁定）
3. **会话管理**:
   - 会话超时时间（当前 2 小时）
   - 是否支持"记住我"功能
4. **Rate Limiting**: 是否需要限流机制
5. **IP 白名单**: 是否需要限制管理后台访问 IP
6. **审计日志**: 是否需要持久化存储审计日志
7. **文件上传**: 是否需要病毒扫描

---

**文档变更记录**:
- v1.0 (2026-01-08): 初始版本，定义安全架构设计
