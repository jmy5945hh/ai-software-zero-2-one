# 组件设计文档

**文档版本**: v1.0
**创建时间**: 2026-01-08
**负责人**: 系统架构师
**关联文档**: system-overview.md, information-architecture.md, user-stories.md

---

## 文档说明

本文档定义"招财银行北京分行运营门户系统"的前后端组件划分、组件依赖关系和数据流向。

---

## 1. 前端组件划分

### 1.1 整体组件结构

```
src/
├── main.tsx                    # 应用入口
├── App.tsx                     # 根组件
├── router/                     # 路由配置
│   ├── index.tsx               # 路由定义
│   └── guards.tsx              # 路由守卫
├── layouts/                    # 布局组件
│   ├── MainLayout.tsx          # 主布局（侧边栏 + 顶部栏 + 内容区）
│   └── BlankLayout.tsx         # 空白布局（登录页）
├── pages/                      # 页面组件
│   ├── Login/                  # 登录页
│   ├── Home/                   # 首页
│   ├── VisitRecords/           # 拜访记录管理
│   ├── GiftApplications/       # 礼品申请
│   ├── GiftApprovals/          # 礼品审批
│   ├── GiftLedger/             # 礼品台账
│   ├── Content/                # 内容管理
│   │   ├── Carousels/          # 轮播图管理
│   │   └── News/               # 新闻管理
│   ├── Dashboard/              # 数据大屏
│   └── Profile/                # 个人中心
├── components/                 # 公共组件
│   ├── common/                 # 通用组件
│   │   ├── Button.tsx
│   │   ├── Table.tsx
│   │   └── Form.tsx
│   ├── business/               # 业务组件
│   │   ├── VisitForm.tsx       # 拜访记录表单
│   │   ├── GiftForm.tsx        # 礼品申请表单
│   │   └── ChartCard.tsx       # 图表卡片
│   └── layout/                 # 布局组件
│       ├── Sidebar.tsx         # 侧边栏
│       ├── Header.tsx          # 顶部栏
│       └── Breadcrumb.tsx      # 面包屑
├── stores/                     # 状态管理
│   ├── auth.ts                 # 认证状态
│   ├── user.ts                 # 用户状态
│   └── ai.ts                   # AI 对话状态
├── services/                   # API 服务
│   ├── api.ts                  # Axios 实例
│   ├── auth.ts                 # 认证 API
│   ├── visits.ts               # 拜访 API
│   ├── gifts.ts                # 礼品 API
│   ├── content.ts              # 内容 API
│   ├── dashboard.ts            # 数据大屏 API
│   └── ai.ts                   # AI API
├── hooks/                      # 自定义 Hooks
│   ├── useAuth.ts              # 认证 Hook
│   ├── usePermission.ts        # 权限 Hook
│   └── useRequest.ts           # 请求 Hook
├── utils/                      # 工具函数
│   ├── request.ts              # 请求工具
│   ├── format.ts               # 格式化工具
│   └── validate.ts             # 校验工具
└── types/                      # TypeScript 类型定义
    ├── api.ts                  # API 类型
    ├── models.ts               # 数据模型类型
    └── views.ts                # 视图类型
```

---

### 1.2 页面组件划分

#### 登录页模块 (Login)

```
Login/
├── index.tsx                   # 登录页主组件
└── components/
    └── LoginForm.tsx           # 登录表单组件
```

**组件职责**:
- 提供账号密码登录表单
- 调用登录 API
- 存储 JWT Token
- 跳转到首页

**依赖**:
- `stores/auth.ts`: 认证状态
- `services/auth.ts`: 登录 API

---

#### 首页模块 (Home)

```
Home/
├── index.tsx                   # 首页主组件
└── components/
    ├── Carousel.tsx            # 轮播图组件
    ├── NewsList.tsx            # 新闻列表组件
    └── QuickLinks.tsx          # 快捷入口组件
```

**组件职责**:
- 展示轮播图
- 展示新闻列表
- 根据用户角色显示快捷入口

**依赖**:
- `services/content.ts`: 内容 API
- `stores/user.ts`: 用户信息

---

#### 拜访记录管理模块 (VisitRecords)

```
VisitRecords/
├── index.tsx                   # 拜访记录列表页
├── Detail.tsx                  # 拜访记录详情页
├── Create.tsx                  # 新增拜访记录页
├── Edit.tsx                    # 编辑拜访记录页
└── components/
    ├── VisitTable.tsx          # 拜访记录表格
    ├── VisitForm.tsx           # 拜访记录表单
    ├── VisitSearch.tsx         # 搜索条件组件
    └── ParticipantsSelect.tsx  # 参与人员选择组件
```

**组件职责**:
- 展示拜访记录列表（分页、筛选）
- 查看拜访记录详情
- 新增/编辑拜访记录
- 权限控制（客户经理只能看自己的）

**依赖**:
- `services/visits.ts`: 拜访 API
- `stores/user.ts`: 用户信息

---

#### 礼品申请模块 (GiftApplications)

```
GiftApplications/
├── index.tsx                   # 礼品申请列表页
├── Create.tsx                  # 新增礼品申请页
├── Detail.tsx                  # 礼品申请详情页
└── components/
    ├── GiftTable.tsx           # 礼品申请表格
    ├── GiftForm.tsx            # 礼品申请表单
    ├── GiftItemSelector.tsx    # 礼品选择组件
    └── RelatedVisitSelector.tsx # 关联拜访记录选择
```

**组件职责**:
- 展示礼品申请列表
- 新增礼品申请
- 查看礼品申请详情（只读）
- 计算总金额

**依赖**:
- `services/gifts.ts`: 礼品 API
- `stores/user.ts`: 用户信息

---

#### 礼品审批模块 (GiftApprovals)

```
GiftApprovals/
├── index.tsx                   # 待审批列表页
├── Detail.tsx                  # 审批详情页
├── History.tsx                 # 审批历史页
└── components/
    ├── ApprovalTable.tsx       # 审批表格
    ├── ApprovalForm.tsx        # 审批表单
    └── ApprovalActions.tsx     # 审批操作按钮（通过/驳回）
```

**组件职责**:
- 展示待审批申请列表
- 审批礼品申请（通过/驳回）
- 驳回时必填原因
- 查看审批历史

**依赖**:
- `services/gifts.ts`: 礼品 API
- `stores/user.ts`: 用户信息

---

#### 礼品台账模块 (GiftLedger)

```
GiftLedger/
├── index.tsx                   # 礼品台账页
└── components/
    ├── LedgerTable.tsx         # 台账表格
    ├── LedgerStats.tsx         # 统计卡片
    └── LedgerFilters.tsx       # 筛选条件组件
```

**组件职责**:
- 展示所有已审批通过的礼品记录
- 按礼品类型、时间区间统计
- 导出台账（待确认是否需要）

**依赖**:
- `services/gifts.ts`: 礼品 API

---

#### 内容管理模块 (Content)

##### 轮播图管理 (Carousels)

```
Content/Carousels/
├── index.tsx                   # 轮播图列表页
├── Edit.tsx                    # 新增/编辑轮播图页
└── components/
    ├── CarouselTable.tsx       # 轮播图表格
    ├── CarouselForm.tsx        # 轮播图表单
    └── ImageUpload.tsx         # 图片上传组件
```

**组件职责**:
- 展示轮播图列表
- 新增/编辑/删除轮播图
- 图片上传

**依赖**:
- `services/content.ts`: 内容 API
- 权限: 仅运营人员可访问

##### 新闻管理 (News)

```
Content/News/
├── index.tsx                   # 新闻列表页
├── Edit.tsx                    # 新增/编辑新闻页
└── components/
    ├── NewsTable.tsx           # 新闻表格
    ├── NewsForm.tsx            # 新闻表单（富文本）
    └── RichTextEditor.tsx      # 富文本编辑器
```

**组件职责**:
- 展示新闻列表
- 新增/编辑/发布/删除新闻
- 富文本编辑

**依赖**:
- `services/content.ts`: 内容 API
- 权限: 仅运营人员可访问

---

#### 数据大屏模块 (Dashboard)

```
Dashboard/
├── index.tsx                   # 数据大屏主页面
└── components/
    ├── MetricCards.tsx         # 指标卡片组件
    ├── LineChart.tsx           # 折线图组件
    ├── BarChart.tsx            # 条形图组件
    ├── PieChart.tsx            # 饼图组件
    └── TimeRangeSelector.tsx   # 时间维度选择器
```

**组件职责**:
- 展示关键运营指标
- 展示各类图表（折线图、条形图、饼图）
- 支持时间维度切换（天/周/月）

**依赖**:
- `services/dashboard.ts`: 数据大屏 API
- `echarts`: 数据可视化库
- 权限: 仅运营人员和管理者可访问

---

#### AI 助理模块 (AIAssistant)

```
components/AIAssistant/
├── index.tsx                   # AI 助理容器组件
├── ChatPanel.tsx               # 聊天面板
├── MessageList.tsx             # 消息列表
├── MessageInput.tsx            # 消息输入框
└── FloatingButton.tsx          # 浮动按钮
```

**组件职责**:
- 展示 AI 对话界面
- 发送消息并接收 AI 回复
- 保存对话历史
- 支持多轮对话

**依赖**:
- `services/ai.ts`: AI API
- `stores/ai.ts`: 对话状态

**全局挂载**: AI 助理挂载在全局布局中，所有页面都可访问

---

### 1.3 公共组件

#### 布局组件 (Layout)

```
layouts/
├── MainLayout.tsx              # 主布局
│   ├── Sidebar                 # 侧边栏（动态菜单）
│   ├── Header                  # 顶部栏（用户信息、面包屑）
│   └── Content                 # 内容区（路由出口）
└── BlankLayout.tsx             # 空白布局（登录页）
```

**组件职责**:
- 提供统一的页面布局
- 根据用户角色动态渲染菜单
- 全局错误处理

---

#### 通用组件 (Common)

```
components/common/
├── ProTable.tsx                # 高级表格（基于 ProComponents）
├── ProForm.tsx                 # 高级表单（基于 ProComponents）
├── Modal.tsx                   # 模态框
├── Drawer.tsx                  # 抽屉
├── Upload.tsx                  # 文件上传
└── DatePicker.tsx              # 日期选择器
```

---

#### 业务组件 (Business)

```
components/business/
├── VisitForm.tsx               # 拜访记录表单
├── GiftForm.tsx                # 礼品申请表单
├── ApprovalFlow.tsx            # 审批流程图
├── StatusBadge.tsx             # 状态标签
└── UserAvatar.tsx              # 用户头像
```

---

## 2. 后端组件划分

### 2.1 整体模块结构

```
backend/
├── main.py                     # 应用入口
├── config.py                   # 配置管理
├── dependencies.py             # 依赖注入
├── api/                        # API 路由层
│   ├── __init__.py
│   ├── deps.py                 # 依赖注入
│   └── v1/                     # API v1 版本
│       ├── __init__.py
│       ├── auth.py             # 认证路由
│       ├── visits.py           # 拜访路由
│       ├── gifts.py            # 礼品路由
│       ├── content.py          # 内容路由
│       ├── dashboard.py        # 数据大屏路由
│       └── ai.py               # AI 路由
├── services/                   # 业务逻辑层
│   ├── auth_service.py         # 认证服务
│   ├── visit_service.py        # 拜访服务
│   ├── gift_service.py         # 礼品服务
│   ├── content_service.py      # 内容服务
│   ├── dashboard_service.py    # 数据大屏服务
│   └── ai_service.py           # AI 服务
├── models/                     # 数据模型层（ORM）
│   ├── __init__.py
│   ├── user.py                 # 用户模型
│   ├── customer_visit.py       # 拜访记录模型
│   ├── gift_requisition.py     # 礼品申请模型
│   ├── gift.py                 # 礼品模型
│   ├── carousel.py             # 轮播图模型
│   └── news.py                 # 新闻模型
├── schemas/                    # Pydantic 数据模型
│   ├── auth.py                 # 认证数据模型
│   ├── visit.py                # 拜访数据模型
│   ├── gift.py                 # 礼品数据模型
│   ├── content.py              # 内容数据模型
│   ├── dashboard.py            # 数据大屏数据模型
│   └── ai.py                   # AI 数据模型
├── repositories/               # 数据访问层（可选）
│   ├── base.py                 # 基础 Repository
│   ├── user_repository.py      # 用户 Repository
│   └── ...                     # 其他 Repository
├── core/                       # 核心模块
│   ├── security.py             # 安全模块（JWT、密码）
│   ├── permissions.py          # 权限模块
│   └── exceptions.py           # 自定义异常
├── utils/                      # 工具函数
│   ├── datetime.py             # 日期工具
│   └── validators.py           # 校验工具
└── db/                         # 数据库模块
    ├── base.py                 # 数据库会话
    └── init_db.py              # 数据库初始化
```

---

### 2.2 API 路由层 (Routers)

#### 认证路由 (auth.py)

```python
# /api/v1/auth/
POST   /login                    # 用户登录
POST   /logout                   # 用户登出（可选）
GET    /me                       # 获取当前用户信息
PUT    /me                       # 更新当前用户信息
PUT    /me/password              # 修改密码
```

**组件职责**:
- 处理登录请求
- 验证 JWT Token
- 获取和更新用户信息

**依赖**:
- `services/auth_service.py`: 认证服务

---

#### 拜访路由 (visits.py)

```python
# /api/v1/visits/
GET    /visits                   # 查询拜访记录列表（支持分页、筛选）
POST   /visits                   # 新增拜访记录
GET    /visits/{id}              # 获取拜访记录详情
PUT    /visits/{id}              # 更新拜访记录
```

**组件职责**:
- 处理拜访记录 CRUD 请求
- 参数校验（时间区间、状态筛选）
- 权限控制（客户经理只能看自己的）

**依赖**:
- `services/visit_service.py`: 拜访服务
- `api/deps.py`: 权限依赖注入

---

#### 礼品路由 (gifts.py)

```python
# /api/v1/gifts/applications
GET    /gifts/applications       # 查询礼品申请列表（仅自己的）
POST   /gifts/applications       # 提交礼品申请
GET    /gifts/applications/{id}  # 获取礼品申请详情

# /api/v1/gifts/approvals
GET    /gifts/approvals          # 查询待审批申请列表
POST   /gifts/approvals/{id}/approve   # 审批通过
POST   /gifts/approvals/{id}/reject    # 审批驳回
GET    /gifts/approvals/history   # 查询审批历史

# /api/v1/gifts/ledger
GET    /gifts/ledger             # 查询礼品台账
```

**组件职责**:
- 处理礼品申请 CRUD 请求
- 处理礼品审批请求
- 处理礼品台账查询
- 权限控制（申请人、审批人、运营人员）

**依赖**:
- `services/gift_service.py`: 礼品服务
- `api/deps.py`: 权限依赖注入

---

#### 内容路由 (content.py)

```python
# /api/v1/content/carousels
GET    /content/carousels        # 查询轮播图列表
POST   /content/carousels        # 新增轮播图
PUT    /content/carousels/{id}   # 更新轮播图
DELETE /content/carousels/{id}   # 删除轮播图

# /api/v1/content/news
GET    /content/news             # 查询新闻列表
POST   /content/news             # 新增新闻
PUT    /content/news/{id}        # 更新新闻
DELETE /content/news/{id}        # 删除新闻
```

**组件职责**:
- 处理轮播图 CRUD 请求
- 处理新闻 CRUD 请求
- 权限控制（仅运营人员可增删改）

**依赖**:
- `services/content_service.py`: 内容服务
- `api/deps.py`: 权限依赖注入

---

#### 数据大屏路由 (dashboard.py)

```python
# /api/v1/dashboard/metrics
GET    /dashboard/metrics        # 获取关键运营指标
GET    /dashboard/visit_trend    # 获取拜访趋势数据
GET    /dashboard/gift_spending  # 获取礼品支出数据
GET    /dashboard/gift_dist      # 获取礼品分类占比
```

**组件职责**:
- 处理数据大屏数据查询请求
- 聚合统计数据
- 权限控制（仅运营人员和管理者）

**依赖**:
- `services/dashboard_service.py`: 数据大屏服务
- `api/deps.py`: 权限依赖注入

---

#### AI 路由 (ai.py)

```python
# /api/v1/ai/chat
POST   /ai/chat                  # 发送消息给 AI
GET    /ai/history               # 获取对话历史（可选）
DELETE /ai/history               # 清空对话历史（可选）
```

**组件职责**:
- 处理 AI 对话请求
- 调用外部 LLM API
- 管理对话历史（可选）

**依赖**:
- `services/ai_service.py`: AI 服务

---

### 2.3 业务逻辑层 (Services)

#### AuthService (认证服务)

```python
class AuthService:
    def authenticate(self, username: str, password: str) -> User
    def create_access_token(self, user: User) -> str
    def verify_token(self, token: str) -> User
    def hash_password(self, password: str) -> str
    def verify_password(self, password: str, hashed: str) -> bool
```

**组件职责**:
- 用户认证逻辑
- JWT Token 颁发和验证
- 密码加密和验证

---

#### VisitService (拜访服务)

```python
class VisitService:
    def create_visit(self, visit: VisitCreate, user: User) -> CustomerVisit
    def get_visit(self, visit_id: str, user: User) -> CustomerVisit
    def update_visit(self, visit_id: str, visit: VisitUpdate, user: User) -> CustomerVisit
    def query_visits(self, filters: VisitFilters, user: User) -> Page[CustomerVisit]
    def check_permission(self, visit: CustomerVisit, user: User) -> bool
```

**组件职责**:
- 拜访记录 CRUD 逻辑
- 权限检查（客户经理只能操作自己的）
- 拜访记录查询和筛选

---

#### GiftRequisitionService (礼品服务)

```python
class GiftRequisitionService:
    def create_requisition(self, req: GiftCreate, user: User) -> GiftRequisition
    def get_requisition(self, req_id: str, user: User) -> GiftRequisition
    def approve_requisition(self, req_id: str, user: User) -> GiftRequisition
    def reject_requisition(self, req_id: str, reason: str, user: User) -> GiftRequisition
    def query_requisitions(self, filters: GiftFilters, user: User) -> Page[GiftRequisition]
    def get_ledger(self, filters: LedgerFilters, user: User) -> Page[GiftLedger]
    def check_permission(self, req: GiftRequisition, user: User) -> bool
```

**组件职责**:
- 礼品申请 CRUD 逻辑
- 礼品审批逻辑（状态流转）
- 权限检查
- 礼品台账查询

---

#### ContentService (内容服务)

```python
class ContentService:
    # 轮播图
    def create_carousel(self, carousel: CarouselCreate, user: User) -> Carousel
    def update_carousel(self, id: str, carousel: CarouselUpdate, user: User) -> Carousel
    def delete_carousel(self, id: str, user: User) -> None
    def get_active_carousels(self) -> List[Carousel]

    # 新闻
    def create_news(self, news: NewsCreate, user: User) -> News
    def update_news(self, id: str, news: NewsUpdate, user: User) -> News
    def delete_news(self, id: str, user: User) -> None
    def publish_news(self, id: str, user: User) -> News
    def get_published_news(self) -> List[News]
```

**组件职责**:
- 轮播图 CRUD 逻辑
- 新闻 CRUD 逻辑
- 新闻发布逻辑
- 权限检查（仅运营人员可操作）

---

#### DashboardService (数据大屏服务)

```python
class DashboardService:
    def get_metrics(self, time_range: TimeRange) -> Metrics
    def get_visit_trend(self, dimension: TimeDimension) -> List[TrendData]
    def get_gift_spending(self, dimension: TimeDimension) -> List[SpendingData]
    def get_gift_distribution(self) -> List[DistData]
```

**组件职责**:
- 统计关键运营指标
- 聚合拜访趋势数据
- 聚合礼品支出数据
- 聚合礼品分类占比

---

#### AIService (AI 服务)

```python
class AIService:
    def chat(self, message: str, history: List[Message]) -> str
    def stream_chat(self, message: str, history: List[Message]) -> AsyncGenerator[str, None]
```

**组件职责**:
- 调用外部 LLM API
- 管理对话历史（可选）
- 处理 API 超时和错误

---

### 2.4 数据模型层 (Models / Schemas)

#### ORM 模型 (models/)

```python
# models/user.py
class User(Base):
    __tablename__ = "users"
    user_id: str
    username: str
    password_hash: str
    name: str
    role: Role
    status: UserStatus
    create_time: datetime
    update_time: datetime

# models/customer_visit.py
class CustomerVisit(Base):
    __tablename__ = "customer_visits"
    visit_id: str
    customer_id: str
    company_name: str
    planned_date: date
    actual_date: date
    visit_method: VisitMethod
    interested_products: JSON
    participants: JSON
    status: VisitStatus
    notes: str
    create_by: str
    create_time: datetime
    update_time: datetime

# ... 其他模型
```

#### Pydantic 数据模型 (schemas/)

```python
# schemas/auth.py
class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# schemas/visit.py
class VisitCreate(BaseModel):
    customer_id: str
    company_name: str
    planned_date: date
    actual_date: date
    visit_method: VisitMethod
    interested_products: List[str] = []
    participants: List[str] = []
    status: VisitStatus
    notes: str = ""

# ... 其他数据模型
```

---

## 3. 组件依赖关系

### 3.1 前端组件依赖关系

```
App.tsx
  ├── Router
  │     ├── MainLayout
  │     │     ├── Sidebar
  │     │     ├── Header
  │     │     ├── Breadcrumb
  │     │     └── Content (路由出口)
  │     │             ├── VisitRecords 页面
  │     │             │     ├── VisitTable
  │     │             │     ├── VisitForm
  │     │             │     └── VisitSearch
  │     │             ├── GiftApplications 页面
  │     │             ├── GiftApprovals 页面
  │     │             ├── Content 页面
  │     │             ├── Dashboard 页面
  │     │             └── Profile 页面
  │     └── BlankLayout
  │           └── Login 页面
  ├── AIAssistant (全局挂载)
  │     ├── ChatPanel
  │     ├── MessageList
  │     └── MessageInput
  └── Stores (全局状态)
        ├── authStore
        ├── userStore
        └── aiStore
```

### 3.2 后端组件依赖关系

```
main.py
  └── FastAPI App
        ├── API Routers (api/v1/)
        │     ├── auth_router
        │     │     └── AuthService
        │     ├── visits_router
        │     │     └── VisitService
        │     ├── gifts_router
        │     │     └── GiftRequisitionService
        │     ├── content_router
        │     │     └── ContentService
        │     ├── dashboard_router
        │     │     └── DashboardService
        │     └── ai_router
        │           └── AIService
        ├── Services (业务逻辑层)
        │     ├── Models (ORM)
        │     └── Repositories (可选)
        ├── Dependencies (依赖注入)
        │     ├── get_current_user
        │     └── require_role
        └── Core (核心模块)
              ├── Security (JWT)
              ├── Permissions (权限)
              └── Exceptions (异常)
```

---

## 4. 数据流向

### 4.1 用户登录流程

```
前端 (Login.tsx)
  ↓ 用户输入账号密码
  ↓ POST /api/v1/auth/login
  ↓
后端 (auth_router)
  ↓ 调用 AuthService.authenticate()
  ↓ 验证密码
  ↓ 颁发 JWT Token
  ↓ 返回 LoginResponse (token + user)
  ↓
前端 (authStore)
  ↓ 存储 token 到 localStorage
  ↓ 存储 user 信息到 state
  ↓ 跳转到首页
```

---

### 4.2 拜访记录创建流程

```
前端 (VisitRecords/Create.tsx)
  ↓ 填写表单
  ↓ POST /api/v1/visits
  ↓ Header: Authorization: Bearer <token>
  ↓
后端 (visits_router)
  ↓ 依赖注入 get_current_user (验证 JWT)
  ↓ 调用 VisitService.create_visit()
  ↓ 参数校验 (Pydantic)
  ↓ 权限检查 (客户经理角色)
  ↓ 创建 CustomerVisit 记录
  ↓ 返回 visit_id
  ↓
前端
  ↓ 显示成功提示
  ↓ 跳转到拜访记录列表
```

---

### 4.3 礼品审批流程

```
前端 (GiftApprovals/Detail.tsx)
  ↓ 点击"通过"或"驳回"
  ↓ POST /api/v1/gifts/approvals/{id}/approve
  ↓ 或 POST /api/v1/gifts/approvals/{id}/reject
  ↓ Header: Authorization: Bearer <token>
  ↓
后端 (gifts_router)
  ↓ 依赖注入 get_current_user (验证 JWT)
  ↓ 依赖注入 require_role([APPROVER])
  ↓ 调用 GiftRequisitionService.approve_requisition()
  ↓ 状态流转检查 (待审批 → 已通过/已驳回)
  ↓ 更新 GiftRequisition 状态
  ↓ 返回更新后的记录
  ↓
前端
  ↓ 显示成功提示
  ↓ 刷新审批列表
```

---

### 4.4 数据大屏查询流程

```
前端 (Dashboard/index.tsx)
  ↓ GET /api/v1/dashboard/metrics?dimension=month
  ↓ GET /api/v1/dashboard/visit_trend?dimension=month
  ↓ GET /api/v1/dashboard/gift_spending?dimension=month
  ↓ GET /api/v1/dashboard/gift_dist
  ↓ Header: Authorization: Bearer <token>
  ↓
后端 (dashboard_router)
  ↓ 依赖注入 get_current_user (验证 JWT)
  ↓ 依赖注入 require_role([OPERATIONS, MANAGER])
  ↓ 调用 DashboardService.get_metrics()
  ↓ 聚合查询数据库
  ↓ 返回统计数据
  ↓
前端
  ↓ 渲染指标卡片
  ↓ 渲染图表 (ECharts)
```

---

### 4.5 AI 对话流程

```
前端 (AIAssistant/ChatPanel.tsx)
  ↓ 用户输入消息
  ↓ POST /api/v1/ai/chat
  ↓ Header: Authorization: Bearer <token>
  ↓ Body: { message: "...", history: [...] }
  ↓
后端 (ai_router)
  ↓ 依赖注入 get_current_user (验证 JWT)
  ↓ 调用 AIService.chat()
  ↓ 调用火山引擎 LLM API
  ↓ 返回 AI 回复
  ↓
前端 (aiStore)
  ↓ 更新对话历史
  ↓ 显示 AI 回复
```

---

## 5. 组件通信机制

### 5.1 前端组件通信

| 通信方式 | 使用场景 | 示例 |
| --- | --- | --- |
| **Props 传递** | 父子组件通信 | `<VisitTable data={visits} />` |
| **Zustand Store** | 跨组件全局状态 | `authStore.user`, `aiStore.history` |
| **React Context** | 主题、语言等全局配置 | `<ConfigContext.Provider>` |
| **事件回调** | 子组件通知父组件 | `onSuccess={() => navigate('/list')}` |
| **路由参数** | 页面间数据传递 | `navigate(`/visits/${id}`)` |

---

### 5.2 后端组件通信

| 通信方式 | 使用场景 | 示例 |
| --- | --- | --- |
| **函数调用** | Service 调用 Repository | `VisitService.create_visit()` → `session.add()` |
| **依赖注入** | Router 调用 Service | `def create_visit(service: VisitService = Depends())` |
| **数据库事务** | 跨表操作保证一致性 | `with session.begin(): ...` |
| **外部 API 调用** | AI 调用 LLM API | `AIService.chat()` → `httpx.post()` |

---

## 6. 组件可测试性设计

### 6.1 前端组件测试

- **单元测试**: 测试业务组件逻辑（如表单校验）
- **集成测试**: 测试页面组件与 API 交互
- **E2E 测试**: 测试完整用户流程（如登录 → 新增拜访记录）

**测试工具**: Vitest + Testing Library + Playwright

---

### 6.2 后端组件测试

- **单元测试**: 测试 Service 业务逻辑
- **集成测试**: 测试 API 路由与数据库交互
- **E2E 测试**: 测试完整业务流程

**测试工具**: pytest + pytest-asyncio + httpx

---

**文档变更记录**:
- v1.0 (2026-01-08): 初始版本，定义前后端组件划分和数据流向
