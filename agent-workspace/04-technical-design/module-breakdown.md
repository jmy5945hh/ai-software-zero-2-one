# 模块拆解文档

**文档版本**: v1.0
**创建时间**: 2026-01-08
**负责人**: 技术负责人
**关联文档**: system-overview.md, component-diagram.md, user-stories.md

---

## 文档说明

本文档将"招财银行北京分行运营门户系统"拆解为可独立开发和交付的模块,包括前端模块、后端模块、模块依赖关系和开发优先级排序。

---

## 1. 前端模块拆分

### 1.1 认证与权限模块 (Auth)

**模块职责**: 处理用户登录、登出、权限验证和路由守卫

**页面清单**:
- `/login` - 登录页

**核心组件**:
- `LoginForm` - 登录表单
- `AuthGuard` - 路由守卫
- `PermissionGuard` - 权限守卫

**状态管理**:
- `authStore` - 存储JWT Token和用户信息

**依赖**:
- 依赖: 无 (基础模块)
- 被依赖: 所有其他模块

**接口**:
- `POST /api/v1/auth/login` - 登录
- `GET /api/v1/auth/me` - 获取当前用户信息

**优先级**: P0 (核心基础模块)

---

### 1.2 首页模块 (Home)

**模块职责**: 展示首页轮播图、新闻列表和快捷入口

**页面清单**:
- `/home` - 首页

**核心组件**:
- `Carousel` - 轮播图组件
- `NewsList` - 新闻列表组件
- `QuickLinks` - 快捷入口组件

**依赖**:
- 依赖: 认证与权限模块
- 被依赖: 无

**接口**:
- `GET /api/v1/content/carousels` - 获取轮播图列表
- `GET /api/v1/content/news` - 获取新闻列表

**优先级**: P1

---

### 1.3 拜访管理模块 (Visits)

**模块职责**: 客户拜访记录的CRUD和查询

**页面清单**:
- `/visit-records` - 拜访记录列表页
- `/visit-records/:id` - 拜访记录详情页
- `/visit-records/new` - 新增拜访记录页
- `/visit-records/:id/edit` - 编辑拜访记录页

**核心组件**:
- `VisitTable` - 拜访记录表格
- `VisitForm` - 拜访记录表单
- `VisitSearch` - 搜索条件组件
- `ParticipantsSelect` - 参与人员选择组件

**依赖**:
- 依赖: 认证与权限模块
- 被依赖: 礼品管理模块(关联拜访记录)

**接口**:
- `GET /api/v1/visits` - 查询拜访记录列表
- `POST /api/v1/visits` - 新增拜访记录
- `GET /api/v1/visits/:id` - 获取拜访记录详情
- `PUT /api/v1/visits/:id` - 更新拜访记录

**权限**:
- 客户经理: 仅可查看和编辑自己创建的记录
- 运营人员、管理者: 可查看所有记录

**优先级**: P0

---

### 1.4 礼品申请模块 (GiftApplications)

**模块职责**: 客户经理提交和查看礼品申请

**页面清单**:
- `/gift-applications` - 礼品申请列表页
- `/gift-applications/new` - 新增礼品申请页
- `/gift-applications/:id` - 礼品申请详情页

**核心组件**:
- `GiftTable` - 礼品申请表格
- `GiftForm` - 礼品申请表单
- `GiftItemSelector` - 礼品选择组件
- `RelatedVisitSelector` - 关联拜访记录选择组件

**依赖**:
- 依赖: 认证与权限模块、拜访管理模块
- 被依赖: 无

**接口**:
- `GET /api/v1/gifts/applications` - 查询礼品申请列表
- `POST /api/v1/gifts/applications` - 提交礼品申请
- `GET /api/v1/gifts/applications/:id` - 获取礼品申请详情
- `GET /api/v1/gifts` - 获取礼品列表

**权限**:
- 客户经理: 仅可查看自己的申请

**优先级**: P0

---

### 1.5 礼品审批模块 (GiftApprovals)

**模块职责**: 审批人员审批礼品申请

**页面清单**:
- `/gift-approvals` - 待审批列表页
- `/gift-approvals/:id` - 审批详情页
- `/gift-approvals/history` - 审批历史页

**核心组件**:
- `ApprovalTable` - 审批表格
- `ApprovalForm` - 审批表单
- `ApprovalActions` - 审批操作按钮(通过/驳回)

**依赖**:
- 依赖: 认证与权限模块
- 被依赖: 礼品台账模块

**接口**:
- `GET /api/v1/gifts/approvals` - 查询待审批申请列表
- `POST /api/v1/gifts/approvals/:id/approve` - 审批通过
- `POST /api/v1/gifts/approvals/:id/reject` - 审批驳回
- `GET /api/v1/gifts/approvals/history` - 查询审批历史

**权限**:
- 审批人员: 可访问

**优先级**: P0

---

### 1.6 礼品台账模块 (GiftLedger)

**模块职责**: 运营人员和管理者查看礼品使用台账

**页面清单**:
- `/gift-ledger` - 礼品台账页

**核心组件**:
- `LedgerTable` - 台账表格
- `LedgerStats` - 统计卡片
- `LedgerFilters` - 筛选条件组件

**依赖**:
- 依赖: 认证与权限模块、礼品审批模块
- 被依赖: 无

**接口**:
- `GET /api/v1/gifts/ledger` - 查询礼品台账

**权限**:
- 运营人员、管理者: 可访问

**优先级**: P1

---

### 1.7 内容管理模块 (Content)

**模块职责**: 运营人员维护首页轮播图和新闻

**页面清单**:
- `/content/carousels` - 轮播图管理页
- `/content/carousels/:id` - 轮播图新增/编辑页
- `/content/news` - 新闻管理页
- `/content/news/:id` - 新闻新增/编辑页
- `/content/news/:id/detail` - 新闻详情页(首页点击跳转)

**核心组件**:
- `CarouselTable` - 轮播图表格
- `CarouselForm` - 轮播图表单
- `ImageUpload` - 图片上传组件
- `NewsTable` - 新闻表格
- `NewsForm` - 新闻表单
- `RichTextEditor` - 富文本编辑器

**依赖**:
- 依赖: 认证与权限模块
- 被依赖: 首页模块

**接口**:
- `GET /api/v1/content/carousels` - 查询轮播图列表
- `POST /api/v1/content/carousels` - 新增轮播图
- `PUT /api/v1/content/carousels/:id` - 更新轮播图
- `DELETE /api/v1/content/carousels/:id` - 删除轮播图
- `GET /api/v1/content/news` - 查询新闻列表
- `POST /api/v1/content/news` - 新增新闻
- `PUT /api/v1/content/news/:id` - 更新新闻
- `DELETE /api/v1/content/news/:id` - 删除新闻
- `POST /api/v1/content/news/:id/publish` - 发布新闻

**权限**:
- 运营人员: 可访问

**优先级**: P1

---

### 1.8 数据大屏模块 (Dashboard)

**模块职责**: 展示运营数据大屏

**页面清单**:
- `/dashboard` - 运营数据大屏

**核心组件**:
- `MetricCards` - 指标卡片组件
- `LineChart` - 折线图组件
- `BarChart` - 条形图组件
- `PieChart` - 饼图组件
- `TimeRangeSelector` - 时间维度选择器

**依赖**:
- 依赖: 认证与权限模块
- 被依赖: 无

**接口**:
- `GET /api/v1/dashboard/metrics` - 获取关键运营指标
- `GET /api/v1/dashboard/visit_trend` - 获取拜访趋势数据
- `GET /api/v1/dashboard/gift_spending` - 获取礼品支出数据
- `GET /api/v1/dashboard/gift_dist` - 获取礼品分类占比

**权限**:
- 运营人员、管理者: 可访问

**优先级**: P1

---

### 1.9 AI 助理模块 (AIAssistant)

**模块职责**: 提供AI问答能力

**页面清单**:
- 无独立页面,以侧边栏形式全局挂载

**核心组件**:
- `ChatPanel` - 聊天面板
- `MessageList` - 消息列表
- `MessageInput` - 消息输入框
- `FloatingButton` - 浮动按钮

**依赖**:
- 依赖: 认证与权限模块
- 被依赖: 无

**接口**:
- `POST /api/v1/ai/chat` - 发送消息给AI
- `GET /api/v1/ai/history` - 获取对话历史(可选)
- `DELETE /api/v1/ai/history` - 清空对话历史(可选)

**权限**:
- 所有登录用户: 可访问

**优先级**: P2

---

### 1.10 个人中心模块 (Profile)

**模块职责**: 用户个人信息管理和密码修改

**页面清单**:
- `/profile` - 个人信息页
- `/change-password` - 修改密码页

**核心组件**:
- `ProfileForm` - 个人信息表单
- `PasswordForm` - 密码修改表单

**依赖**:
- 依赖: 认证与权限模块
- 被依赖: 无

**接口**:
- `GET /api/v1/auth/me` - 获取当前用户信息
- `PUT /api/v1/auth/me` - 更新当前用户信息
- `PUT /api/v1/auth/me/password` - 修改密码

**权限**:
- 所有登录用户: 可访问

**优先级**: P1

---

## 2. 后端模块拆分

### 2.1 认证模块 (AuthService)

**模块职责**: 处理用户认证、JWT Token颁发和验证

**核心接口**:
- `POST /api/v1/auth/login` - 用户登录
- `GET /api/v1/auth/me` - 获取当前用户信息
- `PUT /api/v1/auth/me` - 更新当前用户信息
- `PUT /api/v1/auth/me/password` - 修改密码

**核心类**:
- `AuthService` - 认证服务
  - `authenticate(username, password)` - 用户认证
  - `create_access_token(user)` - 创建JWT Token
  - `verify_token(token)` - 验证JWT Token
  - `hash_password(password)` - 密码哈希
  - `verify_password(password, hash)` - 密码验证

**依赖**:
- 数据库: `users` 表
- 外部: 无

**被依赖**: 所有其他模块

**优先级**: P0

---

### 2.2 拜访管理模块 (VisitService)

**模块职责**: 处理客户拜访记录的CRUD和查询

**核心接口**:
- `GET /api/v1/visits` - 查询拜访记录列表
- `POST /api/v1/visits` - 新增拜访记录
- `GET /api/v1/visits/:id` - 获取拜访记录详情
- `PUT /api/v1/visits/:id` - 更新拜访记录

**核心类**:
- `VisitService` - 拜访服务
  - `create_visit(visit, user)` - 创建拜访记录
  - `get_visit(visit_id, user)` - 获取拜访记录
  - `update_visit(visit_id, visit, user)` - 更新拜访记录
  - `query_visits(filters, user)` - 查询拜访记录列表
  - `check_permission(visit, user)` - 权限检查

**依赖**:
- 数据库: `users`, `customer_visits` 表
- 模块: 认证模块

**被依赖**: 礼品管理模块

**优先级**: P0

---

### 2.3 礼品管理模块 (GiftRequisitionService)

**模块职责**: 处理礼品申请、审批和台账查询

**核心接口**:
- `GET /api/v1/gifts/applications` - 查询礼品申请列表
- `POST /api/v1/gifts/applications` - 提交礼品申请
- `GET /api/v1/gifts/applications/:id` - 获取礼品申请详情
- `GET /api/v1/gifts/approvals` - 查询待审批申请列表
- `POST /api/v1/gifts/approvals/:id/approve` - 审批通过
- `POST /api/v1/gifts/approvals/:id/reject` - 审批驳回
- `GET /api/v1/gifts/approvals/history` - 查询审批历史
- `GET /api/v1/gifts/ledger` - 查询礼品台账
- `GET /api/v1/gifts` - 查询礼品列表(可选)

**核心类**:
- `GiftRequisitionService` - 礼品申请服务
  - `create_requisition(req, user)` - 创建礼品申请
  - `get_requisition(req_id, user)` - 获取礼品申请
  - `approve_requisition(req_id, user)` - 审批通过
  - `reject_requisition(req_id, reason, user)` - 审批驳回
  - `query_requisitions(filters, user)` - 查询礼品申请列表
  - `get_ledger(filters, user)` - 查询礼品台账
  - `check_permission(req, user)` - 权限检查

**依赖**:
- 数据库: `users`, `gifts`, `gift_requisitions`, `gift_requisition_items`, `customer_visits` 表
- 模块: 认证模块、拜访管理模块

**被依赖**: 无

**优先级**: P0

---

### 2.4 内容管理模块 (ContentService)

**模块职责**: 处理轮播图和新闻的CRUD

**核心接口**:
- `GET /api/v1/content/carousels` - 查询轮播图列表
- `POST /api/v1/content/carousels` - 新增轮播图
- `PUT /api/v1/content/carousels/:id` - 更新轮播图
- `DELETE /api/v1/content/carousels/:id` - 删除轮播图
- `GET /api/v1/content/news` - 查询新闻列表
- `POST /api/v1/content/news` - 新增新闻
- `PUT /api/v1/content/news/:id` - 更新新闻
- `DELETE /api/v1/content/news/:id` - 删除新闻
- `POST /api/v1/content/news/:id/publish` - 发布新闻

**核心类**:
- `ContentService` - 内容服务
  - `create_carousel(carousel, user)` - 创建轮播图
  - `update_carousel(id, carousel, user)` - 更新轮播图
  - `delete_carousel(id, user)` - 删除轮播图
  - `get_active_carousels()` - 获取启用的轮播图
  - `create_news(news, user)` - 创建新闻
  - `update_news(id, news, user)` - 更新新闻
  - `delete_news(id, user)` - 删除新闻
  - `publish_news(id, user)` - 发布新闻
  - `get_published_news()` - 获取已发布的新闻

**依赖**:
- 数据库: `users`, `carousels`, `news` 表
- 模块: 认证模块

**被依赖**: 首页模块

**优先级**: P1

---

### 2.5 数据大屏模块 (DashboardService)

**模块职责**: 处理运营指标统计和数据聚合

**核心接口**:
- `GET /api/v1/dashboard/metrics` - 获取关键运营指标
- `GET /api/v1/dashboard/visit_trend` - 获取拜访趋势数据
- `GET /api/v1/dashboard/gift_spending` - 获取礼品支出数据
- `GET /api/v1/dashboard/gift_dist` - 获取礼品分类占比

**核心类**:
- `DashboardService` - 数据大屏服务
  - `get_metrics(time_range)` - 获取关键运营指标
  - `get_visit_trend(dimension)` - 获取拜访趋势
  - `get_gift_spending(dimension)` - 获取礼品支出
  - `get_gift_distribution()` - 获取礼品分类占比

**依赖**:
- 数据库: `customer_visits`, `gift_requisitions`, `gift_requisition_items` 表
- 模块: 无(仅查询)

**被依赖**: 无

**优先级**: P1

---

### 2.6 AI 助理模块 (AIService)

**模块职责**: 处理AI对话和上下文管理

**核心接口**:
- `POST /api/v1/ai/chat` - 发送消息给AI
- `GET /api/v1/ai/history` - 获取对话历史(可选)
- `DELETE /api/v1/ai/history` - 清空对话历史(可选)

**核心类**:
- `AIService` - AI服务
  - `chat(message, history)` - 发送消息并获取回复
  - `stream_chat(message, history)` - 流式对话(可选)

**依赖**:
- 外部API: 火山引擎LLM API
- 模块: 认证模块

**被依赖**: 无

**优先级**: P2

---

### 2.7 数据库模块 (Database)

**模块职责**: 数据库连接、会话管理和ORM配置

**核心配置**:
- 数据库连接池
- SQLAlchemy ORM配置
- Alembic迁移管理

**核心表**:
- `users` - 用户表
- `customer_visits` - 客户拜访记录表
- `gifts` - 礼品表
- `gift_requisitions` - 礼品申请表
- `gift_requisition_items` - 礼品申请明细表
- `carousels` - 轮播图表
- `news` - 新闻表
- `system_configs` - 系统配置表

**优先级**: P0

---

## 3. 模块依赖关系

### 3.1 前端模块依赖关系图

```
认证与权限模块 (Auth)
  ├── 首页模块 (Home)
  ├── 拜访管理模块 (Visits)
  │     └── 礼品申请模块 (GiftApplications)
  ├── 礼品审批模块 (GiftApprovals)
  │     └── 礼品台账模块 (GiftLedger)
  ├── 内容管理模块 (Content)
  │     └── 首页模块 (Home)
  ├── 数据大屏模块 (Dashboard)
  ├── AI 助理模块 (AIAssistant)
  └── 个人中心模块 (Profile)
```

### 3.2 后端模块依赖关系图

```
数据库模块 (Database)
  └── 认证模块 (AuthService)
        ├── 拜访管理模块 (VisitService)
        │     └── 礼品管理模块 (GiftRequisitionService)
        ├── 内容管理模块 (ContentService)
        ├── 数据大屏模块 (DashboardService)
        ├── AI 助理模块 (AIService)
        └── 个人中心模块 (集成在认证模块中)
```

### 3.3 跨前后端依赖

| 前端模块 | 后端模块 | 依赖关系 |
| --- | --- | --- |
| 认证与权限 | 认证模块 | 一对一 |
| 拜访管理 | 拜访管理模块 | 一对一 |
| 礼品申请 | 礼品管理模块 | 一对一 |
| 礼品审批 | 礼品管理模块 | 一对一 |
| 礼品台账 | 礼品管理模块 | 一对一 |
| 内容管理 | 内容管理模块 | 一对一 |
| 数据大屏 | 数据大屏模块 | 一对一 |
| AI 助理 | AI 助理模块 | 一对一 |
| 个人中心 | 认证模块 | 一对一 |

---

## 4. 开发优先级排序

### 4.1 Phase 1: 核心基础功能 (P0)

**目标**: 完成核心业务流程,实现最小可用产品(MVP)

**前端模块**:
1. 认证与权限模块
2. 拜访管理模块
3. 礼品申请模块
4. 礼品审批模块

**后端模块**:
1. 数据库模块
2. 认证模块
3. 拜访管理模块
4. 礼品管理模块

**验收标准**:
- 用户可登录系统
- 客户经理可创建拜访记录
- 客户经理可提交礼品申请
- 审批人员可审批礼品申请

**预计工作量**: 10-15 个工作日

---

### 4.2 Phase 2: 扩展功能 (P1)

**目标**: 完善系统功能,提升用户体验

**前端模块**:
1. 首页模块
2. 礼品台账模块
3. 内容管理模块
4. 数据大屏模块
5. 个人中心模块

**后端模块**:
1. 内容管理模块
2. 数据大屏模块

**验收标准**:
- 首页可展示轮播图和新闻
- 运营人员可维护首页内容
- 管理者可查看运营数据大屏
- 用户可修改个人信息

**预计工作量**: 8-12 个工作日

---

### 4.3 Phase 3: 增值功能 (P2)

**目标**: 增加增值功能,提升系统智能化

**前端模块**:
1. AI 助理模块

**后端模块**:
1. AI 助理模块

**验收标准**:
- AI 助理可回答系统使用问题
- 支持多轮对话

**预计工作量**: 5-8 个工作日

---

## 5. 模块独立性评估

### 5.1 高独立性模块 (可独立开发测试)

| 模块 | 前端 | 后端 | 独立性评分 |
| --- | --- | --- | --- |
| 认证与权限 | ✓ | ✓ | 5/5 |
| 拜访管理 | ✓ | ✓ | 5/5 |
| 礼品申请 | ✓ | ✓ | 4/5 (依赖拜访管理) |
| 礼品审批 | ✓ | ✓ | 5/5 |
| 内容管理 | ✓ | ✓ | 5/5 |
| 数据大屏 | ✓ | ✓ | 5/5 |
| AI 助理 | ✓ | ✓ | 5/5 |

### 5.2 模块间接口依赖

| 依赖关系 | 类型 | 耦合度 |
| --- | --- | --- |
| 礼品申请 → 拜访管理 | 数据关联 | 低(可选关联) |
| 礼品台账 → 礼品审批 | 数据来源 | 低(只读依赖) |
| 首页 → 内容管理 | 数据读取 | 低 |

---

## 6. 并行开发建议

### 6.1 前后端并行开发

**策略**:
- 基于OpenAPI规范,前后端可并行开发
- 前端使用Mock数据进行开发
- 后端优先实现API接口

**并行开发路径**:
```
Day 1-2: 后端实现认证模块 API
Day 3-4: 前端实现登录页,后端实现拜访管理 API
Day 5-7: 前端实现拜访管理页面,后端实现礼品管理 API
Day 8-10: 前端实现礼品申请和审批页面,前后端联调
```

### 6.2 模块并行开发

**可并行开发的模块组**:
- **组1**: 认证与权限 (前后端必须先完成)
- **组2**: 拜访管理、礼品申请、礼品审批 (可并行开发)
- **组3**: 内容管理、数据大屏 (可并行开发)
- **组4**: AI 助理 (可独立开发)

---

## 7. 接口契约优先级

### 7.1 Phase 1 接口 (必须实现)

**认证接口**:
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`

**拜访接口**:
- `GET /api/v1/visits`
- `POST /api/v1/visits`
- `GET /api/v1/visits/:id`
- `PUT /api/v1/visits/:id`

**礼品接口**:
- `GET /api/v1/gifts/applications`
- `POST /api/v1/gifts/applications`
- `GET /api/v1/gifts/applications/:id`
- `GET /api/v1/gifts/approvals`
- `POST /api/v1/gifts/approvals/:id/approve`
- `POST /api/v1/gifts/approvals/:id/reject`

### 7.2 Phase 2 接口 (应该实现)

**内容接口**:
- `GET /api/v1/content/carousels`
- `POST /api/v1/content/carousels`
- `PUT /api/v1/content/carousels/:id`
- `DELETE /api/v1/content/carousels/:id`
- `GET /api/v1/content/news`
- `POST /api/v1/content/news`
- `PUT /api/v1/content/news/:id`
- `DELETE /api/v1/content/news/:id`

**数据大屏接口**:
- `GET /api/v1/dashboard/metrics`
- `GET /api/v1/dashboard/visit_trend`
- `GET /api/v1/dashboard/gift_spending`
- `GET /api/v1/dashboard/gift_dist`

**个人中心接口**:
- `PUT /api/v1/auth/me`
- `PUT /api/v1/auth/me/password`

### 7.3 Phase 3 接口 (可以实现)

**AI接口**:
- `POST /api/v1/ai/chat`

---

## 8. 待确认事项

1. **礼品基础信息管理**: 是否需要礼品管理模块(礼品CRUD),还是固定礼品列表
2. **AI对话历史**: 是否需要持久化存储对话历史
3. **数据导出**: 是否需要支持数据导出功能(如导出Excel)
4. **批量操作**: 是否需要支持批量删除、批量审批
5. **实时通知**: 是否需要支持系统通知(如审批结果通知)

---

**文档变更记录**:
- v1.0 (2026-01-08): 初始版本,定义模块拆解
