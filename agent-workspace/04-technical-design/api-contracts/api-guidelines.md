# 招财银行北京分行运营门户 - API设计规范

## 1. 概述

本文档定义了招财银行北京分行运营门户系统的API设计规范，包括API版本控制、认证授权、错误处理、请求响应格式等标准。

## 2. API基础规范

### 2.1 基础URL
- **开发环境**: `http://localhost:8000/api`
- **测试环境**: `https://test.zhaocai-bank.com/api`
- **生产环境**: `https://portal.zhaocai-bank.com/api`

### 2.2 API版本控制
- 版本号在URL路径中体现: `/api/v1/`
- 当前版本: `v1`
- 向后兼容性: 保持向后兼容，重大变更时引入新版本

### 2.3 内容类型
- **请求**: `application/json`
- **响应**: `application/json`

### 2.4 字符编码
- 所有请求和响应使用 `UTF-8` 编码

## 3. 认证与授权

### 3.1 认证方式
- 使用JWT (JSON Web Token) 进行认证
- 认证信息通过HTTP Header传递: `Authorization: Bearer <token>`

### 3.2 认证端点
- 登录: `POST /api/auth/login`
- 刷新令牌: `POST /api/auth/refresh`
- 登出: `POST /api/auth/logout`

### 3.3 权限控制
- 基于角色的访问控制 (RBAC)
- 不同用户角色具有不同权限:
  - `customer_manager`: 客户拜访、礼品申请
  - `operations_staff`: 首页内容、运营数据、礼品台账
  - `approver`: 礼品审批、礼品台账
  - `branch_manager`: 运营数据大屏、礼品台账

## 4. 通用响应格式

### 4.1 成功响应
```json
{
  "success": true,
  "data": {},
  "message": "操作成功",
  "code": 200
}
```

### 4.2 错误响应
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "验证失败",
    "details": [
      {
        "field": "username",
        "message": "用户名不能为空"
      }
    ]
  },
  "code": 400
}
```

### 4.3 分页响应
```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "size": 10,
      "total": 100,
      "total_pages": 10
    }
  },
  "message": "获取成功",
  "code": 200
}
```

## 5. 通用错误码

| 错误码 | HTTP状态码 | 描述 |
|--------|------------|------|
| 1000 | 200 | 成功 |
| 4000 | 400 | 请求参数错误 |
| 4001 | 400 | 数据验证失败 |
| 4002 | 400 | 业务逻辑错误 |
| 4003 | 401 | 未认证 |
| 4004 | 403 | 无权限访问 |
| 4005 | 404 | 资源不存在 |
| 4006 | 422 | 数据完整性错误 |
| 5000 | 500 | 服务器内部错误 |
| 5001 | 500 | 外部服务错误 |

## 6. API端点规范

### 6.1 用户管理API

#### 6.1.1 用户登录
- **端点**: `POST /api/auth/login`
- **描述**: 用户登录认证
- **请求体**:
```json
{
  "username": "string (required)",
  "password": "string (required, min 6 chars)"
}
```
- **成功响应**:
```json
{
  "success": true,
  "data": {
    "access_token": "jwt_token",
    "token_type": "bearer",
    "user": {
      "user_id": "uuid",
      "username": "string",
      "real_name": "string",
      "role": "string",
      "email": "string",
      "department": "string"
    }
  },
  "message": "登录成功",
  "code": 200
}
```

#### 6.1.2 获取当前用户信息
- **端点**: `GET /api/users/me`
- **描述**: 获取当前登录用户信息
- **认证**: JWT Bearer Token
- **成功响应**:
```json
{
  "success": true,
  "data": {
    "user_id": "uuid",
    "username": "string",
    "real_name": "string",
    "role": "string",
    "email": "string",
    "department": "string",
    "phone": "string",
    "status": "string"
  },
  "message": "获取成功",
  "code": 200
}
```

#### 6.1.3 获取用户列表
- **端点**: `GET /api/users`
- **描述**: 获取用户列表（仅运营人员和管理者可访问）
- **查询参数**:
  - `page`: 页码 (default: 1)
  - `size`: 每页数量 (default: 10, max: 100)
  - `role`: 角色过滤 (optional)
  - `status`: 状态过滤 (optional)
  - `search`: 搜索关键词 (optional)
- **认证**: JWT Bearer Token
- **成功响应**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "user_id": "uuid",
        "username": "string",
        "real_name": "string",
        "role": "string",
        "email": "string",
        "department": "string",
        "status": "string",
        "created_at": "datetime"
      }
    ],
    "pagination": {
      "page": 1,
      "size": 10,
      "total": 100,
      "total_pages": 10
    }
  },
  "message": "获取成功",
  "code": 200
}
```

### 6.2 客户拜访API

#### 6.2.1 获取拜访记录列表
- **端点**: `GET /api/customer-visits`
- **描述**: 获取客户拜访记录列表
- **查询参数**:
  - `page`: 页码 (default: 1)
  - `size`: 每页数量 (default: 10, max: 100)
  - `status`: 状态过滤 (optional)
  - `start_date`: 开始日期 (optional)
  - `end_date`: 结束日期 (optional)
  - `customer_id`: 客户ID过滤 (optional)
  - `creator_id`: 创建人ID过滤 (optional)
- **认证**: JWT Bearer Token
- **成功响应**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "visit_id": "uuid",
        "customer_id": "string",
        "customer_name": "string",
        "planned_date": "date",
        "actual_date": "date",
        "visit_method": "string",
        "products_interested": [],
        "participants": [],
        "status": "string",
        "visit_notes": "string",
        "creator_id": "uuid",
        "creator_name": "string",
        "created_at": "datetime",
        "updated_at": "datetime"
      }
    ],
    "pagination": {
      "page": 1,
      "size": 10,
      "total": 100,
      "total_pages": 10
    }
  },
  "message": "获取成功",
  "code": 200
}
```

#### 6.2.2 创建拜访记录
- **端点**: `POST /api/customer-visits`
- **描述**: 创建客户拜访记录
- **认证**: JWT Bearer Token
- **请求体**:
```json
{
  "customer_id": "string (required)",
  "customer_name": "string (required)",
  "planned_date": "date (required, future date)",
  "visit_method": "string (required, enum: phone, face_to_face, video)",
  "products_interested": "array (optional)",
  "participants": "array (optional)",
  "status": "string (default: pending)",
  "visit_notes": "string (optional)"
}
```
- **成功响应**:
```json
{
  "success": true,
  "data": {
    "visit_id": "uuid",
    "customer_id": "string",
    "customer_name": "string",
    "planned_date": "date",
    "actual_date": "date",
    "visit_method": "string",
    "products_interested": [],
    "participants": [],
    "status": "string",
    "visit_notes": "string",
    "creator_id": "uuid",
    "created_at": "datetime",
    "updated_at": "datetime"
  },
  "message": "拜访记录创建成功",
  "code": 201
}
```

#### 6.2.3 更新拜访记录
- **端点**: `PUT /api/customer-visits/{visit_id}`
- **描述**: 更新客户拜访记录
- **认证**: JWT Bearer Token
- **权限**: 仅创建者可编辑
- **请求体**:
```json
{
  "customer_name": "string (optional)",
  "planned_date": "date (optional)",
  "actual_date": "date (optional)",
  "visit_method": "string (optional)",
  "products_interested": "array (optional)",
  "participants": "array (optional)",
  "status": "string (optional)",
  "visit_notes": "string (optional)"
}
```

### 6.3 礼品管理API

#### 6.3.1 获取礼品申请列表
- **端点**: `GET /api/gift-applications`
- **描述**: 获取礼品申请列表
- **查询参数**:
  - `page`: 页码 (default: 1)
  - `size`: 每页数量 (default: 10, max: 100)
  - `status`: 状态过滤 (optional)
  - `applicant_id`: 申请人ID过滤 (optional)
  - `start_date`: 开始日期 (optional)
  - `end_date`: 结束日期 (optional)
- **认证**: JWT Bearer Token
- **成功响应**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "application_id": "uuid",
        "applicant_id": "uuid",
        "applicant_name": "string",
        "recipient_id": "uuid",
        "recipient_name": "string",
        "gift_items": [
          {
            "gift_id": "string",
            "name": "string",
            "quantity": "integer",
            "unit_price": "decimal",
            "subtotal": "decimal"
          }
        ],
        "total_amount": "decimal",
        "planned_pickup_date": "date",
        "purpose_type": "string",
        "related_visit_id": "uuid",
        "application_status": "string",
        "application_date": "date",
        "approver_id": "uuid",
        "approver_name": "string",
        "approval_date": "datetime",
        "rejection_reason": "string",
        "created_at": "datetime",
        "updated_at": "datetime"
      }
    ],
    "pagination": {
      "page": 1,
      "size": 10,
      "total": 100,
      "total_pages": 10
    }
  },
  "message": "获取成功",
  "code": 200
}
```

#### 6.3.2 创建礼品申请
- **端点**: `POST /api/gift-applications`
- **描述**: 创建礼品申请
- **认证**: JWT Bearer Token
- **请求体**:
```json
{
  "recipient_id": "uuid (optional)",
  "gift_items": [
    {
      "gift_id": "string (required)",
      "name": "string (required)",
      "quantity": "integer (required, > 0)",
      "unit_price": "decimal (required, >= 0)"
    }
  ],
  "planned_pickup_date": "date (required, future date)",
  "purpose_type": "string (required, enum: customer_maintenance, marketing_activity, other)",
  "related_visit_id": "uuid (optional)"
}
```

#### 6.3.3 审批礼品申请
- **端点**: `POST /api/gift-applications/{application_id}/approve`
- **描述**: 审批礼品申请（通过）
- **认证**: JWT Bearer Token
- **权限**: 审批人员
- **请求体**:
```json
{
  "approval_notes": "string (optional)"
}
```

#### 6.3.4 驳回礼品申请
- **端点**: `POST /api/gift-applications/{application_id}/reject`
- **描述**: 驳回礼品申请
- **认证**: JWT Bearer Token
- **权限**: 审批人员
- **请求体**:
```json
{
  "rejection_reason": "string (required, min 10 chars)"
}
```

### 6.4 运营数据API

#### 6.4.1 获取运营概览数据
- **端点**: `GET /api/dashboard/overview`
- **描述**: 获取运营概览数据
- **认证**: JWT Bearer Token
- **权限**: 运营人员、管理者
- **成功响应**:
```json
{
  "success": true,
  "data": {
    "total_visits": "integer",
    "completed_visits": "integer",
    "pending_visits": "integer",
    "total_gift_applications": "integer",
    "approved_gift_applications": "integer",
    "total_gift_expense": "decimal",
    "recent_news_count": "integer"
  },
  "message": "获取成功",
  "code": 200
}
```

#### 6.4.2 获取拜访趋势数据
- **端点**: `GET /api/dashboard/visit-trends`
- **描述**: 获取拜访趋势数据
- **查询参数**:
  - `time_range`: 时间范围 (default: "30d", options: "7d", "30d", "90d")
  - `group_by`: 分组方式 (default: "day", options: "day", "week", "month")
- **认证**: JWT Bearer Token
- **权限**: 运营人员、管理者
- **成功响应**:
```json
{
  "success": true,
  "data": {
    "labels": ["string"],
    "datasets": [
      {
        "label": "新增拜访",
        "data": ["integer"]
      },
      {
        "label": "完成拜访",
        "data": ["integer"]
      }
    ]
  },
  "message": "获取成功",
  "code": 200
}
```

### 6.5 AI问答API

#### 6.5.1 AI问答接口
- **端点**: `POST /api/ai/chat`
- **描述**: AI问答接口
- **认证**: JWT Bearer Token
- **请求体**:
```json
{
  "message": "string (required)",
  "session_id": "string (optional, auto-generated if not provided)"
}
```
- **成功响应**:
```json
{
  "success": true,
  "data": {
    "response": "string",
    "session_id": "string",
    "timestamp": "datetime"
  },
  "message": "问答成功",
  "code": 200
}
```

## 7. 安全规范

### 7.1 输入验证
- 所有输入参数必须进行验证
- 使用白名单验证，拒绝未知参数
- 对特殊字符进行转义或过滤

### 7.2 访问控制
- 所有API端点必须进行身份验证
- 实施基于角色的访问控制
- 敏感操作需要额外验证

### 7.3 数据保护
- 敏感数据在传输过程中使用HTTPS加密
- 密码等敏感信息在存储时进行加密
- 实施适当的速率限制防止滥用

## 8. 性能规范

### 8.1 响应时间
- 简单查询: < 500ms
- 复杂查询: < 2s
- 文件上传/下载: < 30s (10MB以内)

### 8.2 并发处理
- 支持至少100个并发用户
- 实施适当的缓存策略
- 数据库查询优化

### 8.3 分页规范
- 默认每页10条记录
- 最大每页100条记录
- 提供总数和总页数信息