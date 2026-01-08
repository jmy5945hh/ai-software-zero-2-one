# API 契约总览

**文档版本**: v1.0
**创建时间**: 2026-01-08
**负责人**: 系统架构师
**关联文档**: system-overview.md, architecture-decisions.md, user-stories.md

---

## 文档说明

本文档定义"招财银行北京分行运营门户系统"的 API 契约，包括 API 设计原则、分组、通用响应格式、错误码定义、分页排序规范和 API 版本策略。

---

## 1. API 设计原则

### 1.1 RESTful 风格

系统采用 RESTful API 风格，遵循以下原则：

1. **资源导向**: 使用名词表示资源（如 `/api/v1/visits`）
2. **HTTP 动词**: 使用标准 HTTP 动词表示操作
3. **状态码**: 使用 HTTP 状态码表示请求结果
4. **无状态**: 每个请求包含所有必要信息（JWT Token）

### 1.2 HTTP 动词映射

| HTTP 动词 | 操作 | 示例 | 是否幂等 |
| --- | --- | --- | --- |
| GET | 查询 | `GET /api/v1/visits` | 是 |
| POST | 创建 | `POST /api/v1/visits` | 否 |
| PUT | 完整更新 | `PUT /api/v1/visits/{id}` | 是 |
| PATCH | 部分更新 | `PATCH /api/v1/visits/{id}` | 否 |
| DELETE | 删除 | `DELETE /api/v1/visits/{id}` | 是 |

### 1.3 URL 设计规范

```
{base_url}/api/{version}/{resource}/{id}
```

**示例**:
- `/api/v1/visits`: 查询拜访记录列表
- `/api/v1/visits/VISIT001`: 获取 ID 为 VISIT001 的拜访记录
- `/api/v1/gifts/applications`: 礼品申请列表
- `/api/v1/gifts/applications/GIFT001/approve`: 审批礼品申请

**规范**:
- 使用小写字母和连字符（kebab-case）
- 资源名使用复数形式（如 `visits`, `users`）
- 嵌套资源不超过 2 层

---

## 2. API 分组

### 2.1 认证模块 (Auth)

```
/api/v1/auth/login                    # 用户登录
/api/v1/auth/logout                   # 用户登出（可选）
/api/v1/auth/me                       # 获取当前用户信息
/api/v1/auth/me                       # 更新当前用户信息 (PUT)
/api/v1/auth/me/password              # 修改密码
```

### 2.2 拜访管理模块 (Visits)

```
/api/v1/visits                        # 查询拜访记录列表
/api/v1/visits                        # 新增拜访记录 (POST)
/api/v1/visits/{id}                   # 获取拜访记录详情
/api/v1/visits/{id}                   # 更新拜访记录 (PUT)
```

### 2.3 礼品管理模块 (Gifts)

#### 礼品申请
```
/api/v1/gifts/applications            # 查询礼品申请列表
/api/v1/gifts/applications            # 提交礼品申请 (POST)
/api/v1/gifts/applications/{id}       # 获取礼品申请详情

/api/v1/gifts/approvals               # 查询待审批申请列表
/api/v1/gifts/approvals/{id}/approve  # 审批通过 (POST)
/api/v1/gifts/approvals/{id}/reject   # 审批驳回 (POST)
/api/v1/gifts/approvals/history       # 查询审批历史

/api/v1/gifts/ledger                  # 查询礼品台账
```

#### 礼品基础信息（可选）
```
/api/v1/gifts                         # 查询礼品列表
/api/v1/gifts                         # 新增礼品 (POST)
/api/v1/gifts/{id}                    # 获取礼品详情
/api/v1/gifts/{id}                    # 更新礼品 (PUT)
/api/v1/gifts/{id}                    # 删除礼品 (DELETE)
```

### 2.4 内容管理模块 (Content)

#### 轮播图
```
/api/v1/content/carousels             # 查询轮播图列表
/api/v1/content/carousels             # 新增轮播图 (POST)
/api/v1/content/carousels/{id}        # 更新轮播图 (PUT)
/api/v1/content/carousels/{id}        # 删除轮播图 (DELETE)
```

#### 新闻
```
/api/v1/content/news                  # 查询新闻列表
/api/v1/content/news                  # 新增新闻 (POST)
/api/v1/content/news/{id}             # 更新新闻 (PUT)
/api/v1/content/news/{id}             # 删除新闻 (DELETE)
/api/v1/content/news/{id}/publish     # 发布新闻 (POST)
```

### 2.5 数据大屏模块 (Dashboard)

```
/api/v1/dashboard/metrics             # 获取关键运营指标
/api/v1/dashboard/visit_trend         # 获取拜访趋势数据
/api/v1/dashboard/gift_spending       # 获取礼品支出数据
/api/v1/dashboard/gift_dist           # 获取礼品分类占比
```

### 2.6 AI 助理模块 (AI)

```
/api/v1/ai/chat                       # 发送消息给 AI
/api/v1/ai/history                    # 获取对话历史（可选）
/api/v1/ai/history                    # 清空对话历史 (DELETE, 可选)
```

---

## 3. 通用响应格式

### 3.1 成功响应

```json
{
  "code": 200,
  "message": "success",
  "data": { ... }
}
```

**字段说明**:
- `code`: HTTP 状态码（与 HTTP 响应头一致）
- `message`: 响应消息（英文小写）
- `data`: 响应数据（可以是对象、数组或 null）

**示例**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "visit_id": "VISIT001",
    "customer_id": "CUST001",
    "company_name": "某某科技有限公司",
    "create_time": "2026-01-08T10:00:00"
  }
}
```

### 3.2 分页响应

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

**字段说明**:
- `items`: 数据列表
- `total`: 总记录数
- `page`: 当前页码（从 1 开始）
- `page_size`: 每页记录数
- `total_pages`: 总页数

### 3.3 错误响应

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

**字段说明**:
- `code`: HTTP 错误状态码
- `message`: 错误消息（英文小写）
- `errors`: 错误详情数组（可选）

---

## 4. 错误码定义

### 4.1 HTTP 状态码

| 状态码 | 说明 | 使用场景 |
| --- | --- | --- |
| 200 | OK | 请求成功 |
| 201 | Created | 创建成功 |
| 204 | No Content | 删除成功 |
| 400 | Bad Request | 请求参数错误 |
| 401 | Unauthorized | 未认证（Token 无效或过期） |
| 403 | Forbidden | 无权限访问 |
| 404 | Not Found | 资源不存在 |
| 409 | Conflict | 资源冲突（如重复创建） |
| 422 | Unprocessable Entity | 业务逻辑错误（如审批状态不正确） |
| 500 | Internal Server Error | 服务器内部错误 |

### 4.2 业务错误码

在 HTTP 状态码基础上，使用 `message` 字段区分具体错误：

| HTTP 状态码 | message | 说明 |
| --- | --- | --- |
| 400 | validation error | 参数校验失败 |
| 400 | invalid date format | 日期格式错误 |
| 401 | invalid or expired token | Token 无效或过期 |
| 403 | permission denied | 无权限访问 |
| 403 | only creator can edit | 仅创建人可编辑 |
| 404 | visit not found | 拜访记录不存在 |
| 409 | username already exists | 用户名已存在 |
| 422 | cannot edit approved requisition | 已审批的申请不可修改 |
| 422 | rejection reason is required | 驳回原因必填 |
| 500 | internal server error | 服务器内部错误 |
| 500 | database error | 数据库错误 |
| 500 | external api error | 外部 API 错误（如 LLM API） |

---

## 5. 分页、排序、过滤规范

### 5.1 分页参数

**Query 参数**:
```
?page=1&page_size=10
```

**参数说明**:
- `page`: 页码，从 1 开始，默认 1
- `page_size`: 每页记录数，默认 10，最大 100

**响应**:
见 3.2 节分页响应格式。

### 5.2 排序参数

**Query 参数**:
```
?sort=create_time&order=desc
```

**参数说明**:
- `sort`: 排序字段，默认 `create_time`
- `order`: 排序方向，`asc`（升序）或 `desc`（降序），默认 `desc`

**示例**:
```
# 按创建时间降序
GET /api/v1/visits?sort=create_time&order=desc

# 按计划拜访日期升序
GET /api/v1/visits?sort=planned_date&order=asc
```

### 5.3 过滤参数

**Query 参数**:
```
?status=SUCCESS&create_by=USER001
```

**参数说明**:
- 支持多字段组合过滤，条件之间为 AND 关系
- 枚举字段支持精确匹配
- 日期字段支持范围查询

**示例**:
```
# 按状态筛选
GET /api/v1/visits?status=SUCCESS

# 按创建人筛选
GET /api/v1/visits?create_by=USER001

# 日期范围查询
GET /api/v1/visits?planned_date_start=2026-01-01&planned_date_end=2026-01-31

# 组合筛选
GET /api/v1/visits?status=SUCCESS&create_by=USER001&planned_date_start=2026-01-01
```

### 5.4 搜索参数

**Query 参数**:
```
?keyword=某某公司
```

**参数说明**:
- `keyword`: 关键词搜索，支持模糊匹配
- 搜索范围由各 API 自定义

**示例**:
```
# 搜索企业名称
GET /api/v1/visits?keyword=某某公司
```

---

## 6. API 版本策略

### 6.1 版本定义

当前版本: **v1**

URL 格式: `/api/v1/{resource}`

### 6.2 版本升级策略

1. **向后兼容的变更**: 不升级版本号（如添加可选字段）
2. **不兼容的变更**: 升级版本号（如删除字段、修改字段类型）

**版本升级示例**:
```
/api/v1/visits    # 当前版本
/api/v2/visits    # 新版本（不兼容变更）
```

### 6.3 版本废弃策略

- 新版本发布后，旧版本至少维护 6 个月
- 旧版本废弃前，在响应头中添加警告：
  ```
  Warning: 299 - "API version v1 is deprecated, please upgrade to v2"
  ```

---

## 7. 认证与授权

### 7.1 JWT Token 认证

**请求头**:
```
Authorization: Bearer <token>
```

**示例**:
```http
GET /api/v1/visits HTTP/1.1
Host: localhost:8000
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 7.2 无需认证的 API

以下 API 无需 JWT Token：
- `POST /api/v1/auth/login`: 用户登录

### 7.3 基于角色的权限控制

| API 路径 | 客户经理 | 运营人员 | 审批人员 | 管理者 |
| --- | --- | --- | --- | --- |
| `/api/v1/auth/*` | ✓ | ✓ | ✓ | ✓ |
| `/api/v1/visits` | ✓（仅自己） | ✓（全部） | ✗ | ✓（全部） |
| `/api/v1/gifts/applications` | ✓（仅自己） | ✗ | ✗ | ✗ |
| `/api/v1/gifts/approvals` | ✗ | ✗ | ✓ | ✗ |
| `/api/v1/gifts/ledger` | ✗ | ✓ | ✗ | ✓ |
| `/api/v1/content/carousels` | ✗ | ✓ | ✗ | ✗ |
| `/api/v1/content/news` | ✗ | ✓ | ✗ | ✗ |
| `/api/v1/dashboard/*` | ✗ | ✓ | ✗ | ✓ |

**权限检查失败响应**:
```json
{
  "code": 403,
  "message": "permission denied",
  "errors": [
    {
      "field": null,
      "message": "you do not have permission to access this resource"
    }
  ]
}
```

---

## 8. API 安全规范

### 8.1 HTTPS

生产环境必须使用 HTTPS。

### 8.2 输入校验

- **类型校验**: 使用 Pydantic 进行类型校验
- **长度校验**: 字符串字段限制最大长度
- **格式校验**: 日期、邮箱等格式校验
- **业务校验**: 业务规则校验（如日期逻辑）

### 8.3 输出脱敏

敏感字段脱敏处理：
- `password_hash`: 永不返回
- `password`: 仅用于输入，不返回

### 8.4 Rate Limiting（可选）

防止 API 滥用：
- 同一 IP 每分钟最多 60 次请求
- 超过限制返回 429 状态码

**响应头**:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1641620400
```

---

## 9. API 文档

### 9.1 OpenAPI/Swagger 文档

FastAPI 自动生成 OpenAPI 文档：

- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

### 9.2 文档内容

每个 API 包含：
- 请求方法（GET/POST/PUT/DELETE）
- 请求路径
- 请求参数（Query/Path/Body）
- 请求头（Authorization）
- 响应格式（成功/失败）
- 示例代码

---

## 10. 示例 API

### 10.1 用户登录

**请求**:
```http
POST /api/v1/auth/login HTTP/1.1
Host: localhost:8000
Content-Type: application/json

{
  "username": "user001",
  "password": "password123"
}
```

**响应**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "user": {
      "user_id": "USER001",
      "username": "user001",
      "name": "张三",
      "role": "CUSTOMER_MANAGER"
    }
  }
}
```

### 10.2 查询拜访记录列表

**请求**:
```http
GET /api/v1/visits?page=1&page_size=10&status=SUCCESS&sort=create_time&order=desc HTTP/1.1
Host: localhost:8000
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**响应**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "items": [
      {
        "visit_id": "VISIT001",
        "customer_id": "CUST001",
        "company_name": "某某科技有限公司",
        "planned_date": "2026-01-08",
        "actual_date": "2026-01-08",
        "status": "SUCCESS",
        "create_time": "2026-01-08T10:00:00"
      }
    ],
    "total": 100,
    "page": 1,
    "page_size": 10,
    "total_pages": 10
  }
}
```

### 10.3 新增拜访记录

**请求**:
```http
POST /api/v1/visits HTTP/1.1
Host: localhost:8000
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "customer_id": "CUST001",
  "company_name": "某某科技有限公司",
  "planned_date": "2026-01-10",
  "actual_date": "2026-01-10",
  "visit_method": "ON_SITE",
  "status": "NEW"
}
```

**响应**:
```json
{
  "code": 201,
  "message": "success",
  "data": {
    "visit_id": "VISIT002",
    "customer_id": "CUST001",
    "company_name": "某某科技有限公司",
    "planned_date": "2026-01-10",
    "actual_date": "2026-01-10",
    "visit_method": "ON_SITE",
    "status": "NEW",
    "create_by": "USER001",
    "create_time": "2026-01-08T11:00:00"
  }
}
```

### 10.4 审批礼品申请

**请求**:
```http
POST /api/v1/gifts/approvals/GIFT001/approve HTTP/1.1
Host: localhost:8000
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "comment": "审批通过"
}
```

**响应**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "requisition_id": "GIFT001",
    "approval_status": "APPROVED",
    "approver": "APPROVER001",
    "approval_time": "2026-01-08T12:00:00"
  }
}
```

### 10.5 AI 对话

**请求**:
```http
POST /api/v1/ai/chat HTTP/1.1
Host: localhost:8000
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "message": "如何登录系统？"
}
```

**响应**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "reply": "您可以使用账号和密码登录系统...",
    "timestamp": "2026-01-08T12:00:00"
  }
}
```

---

## 11. 待确认事项

1. **是否需要支持批量操作**: 如批量删除、批量审批
2. **是否需要支持导出功能**: 如导出拜访记录、礼品台账为 Excel
3. **是否需要支持文件上传**: 如轮播图图片上传
4. **API 版本策略**: 是否需要多版本共存
5. **Rate Limiting**: 是否需要限流机制
6. **Webhook 支持**: 是否需要 Webhook 通知功能

---

**文档变更记录**:
- v1.0 (2026-01-08): 初始版本，定义 API 契约总览
