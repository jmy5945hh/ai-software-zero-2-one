# 招财银行北京分行运营门户 - 模块分解

## 1. 概述

本文档详细描述了招财银行北京分行运营门户系统的模块分解，包括前端和后端的模块划分、职责定义和依赖关系。

## 2. 前端模块分解

### 2.1 核心框架模块
- **React Core**: 应用的基础框架，负责组件生命周期管理
- **TypeScript**: 提供类型安全，增强代码可维护性
- **Vite**: 构建工具，提供快速开发服务器和打包功能
- **React Router**: 路由管理，实现单页应用导航

### 2.2 UI组件模块
- **Ant Design**: 基础UI组件库，提供企业级UI解决方案
- **ProComponents**: 高级业务组件，简化表单和表格开发
- **ECharts**: 数据可视化组件，用于运营数据大屏展示
- **AntV X6**: 流程图设计组件，用于审批流程可视化

### 2.3 状态管理模块
- **Zustand**: 全局状态管理，管理用户认证、权限、UI状态等
- **Context**: 用于组件间数据传递和共享

### 2.4 网络请求模块
- **Axios**: HTTP请求库，处理API调用
- **useRequest**: React Hooks工具库，简化异步逻辑处理

### 2.5 功能模块

#### 2.5.1 认证模块 (Auth)
- **职责**: 用户登录、登出、权限验证、JWT令牌管理
- **组件**:
  - LoginPage: 登录页面
  - AuthProvider: 认证上下文提供者
  - ProtectedRoute: 受保护路由组件
- **依赖**: Zustand状态管理、Axios网络请求

#### 2.5.2 首页模块 (Home)
- **职责**: 首页内容展示、轮播图管理、新闻展示
- **组件**:
  - HomePage: 首页主页面
  - Carousel: 轮播图组件
  - NewsList: 新闻列表组件
  - QuickAccess: 快捷入口组件
- **依赖**: Ant Design、API服务

#### 2.5.3 用户管理模块 (User)
- **职责**: 用户信息管理、角色权限控制
- **组件**:
  - UserProfile: 用户个人信息页面
  - UserSettings: 用户设置页面
- **依赖**: Zustand状态管理、API服务

#### 2.5.4 客户拜访模块 (Customer Visit)
- **职责**: 客户拜访记录的创建、查询、编辑、删除
- **组件**:
  - CustomerVisitList: 拜访记录列表页面
  - CustomerVisitCreate: 拜访记录创建页面
  - CustomerVisitEdit: 拜访记录编辑页面
  - CustomerVisitDetail: 拜访记录详情页面
  - VisitForm: 拜访记录表单组件
- **依赖**: ProComponents、API服务

#### 2.5.5 礼品管理模块 (Gift Management)
- **职责**: 礼品申请、审批、台账管理
- **组件**:
  - GiftApplicationList: 礼品申请列表页面
  - GiftApplicationCreate: 礼品申请创建页面
  - GiftApplicationDetail: 礼品申请详情页面
  - GiftApproval: 礼品审批页面
  - GiftLedgerList: 礼品台账列表页面
  - GiftForm: 礼品申请表单组件
- **依赖**: ProComponents、API服务

#### 2.5.6 运营数据模块 (Operations Dashboard)
- **职责**: 运营数据可视化展示、统计分析
- **组件**:
  - OperationsDashboard: 运营数据大屏页面
  - ChartComponents: 图表组件集合
  - FilterPanel: 数据筛选面板
- **依赖**: ECharts、API服务

#### 2.5.7 AI问答模块 (AI Assistant)
- **职责**: AI问答功能，提供系统使用帮助
- **组件**:
  - AIAssistant: AI问答侧边栏组件
  - ChatWindow: 聊天窗口组件
  - MessageList: 消息列表组件
- **依赖**: API服务、WebSocket连接

## 3. 后端模块分解

### 3.1 核心框架模块
- **FastAPI**: Web框架，提供路由、依赖注入、自动文档生成
- **Pydantic**: 数据校验和序列化
- **SQLAlchemy**: ORM，数据库操作
- **Uvicorn**: ASGI服务器

### 3.2 认证授权模块
- **JWT**: JSON Web Token实现认证
- **Security**: 安全相关工具和中间件
- **Password Hashing**: 密码加密处理

### 3.3 业务逻辑模块

#### 3.3.1 用户服务模块 (User Service)
- **职责**: 用户管理、角色权限、认证授权
- **API端点**:
  - POST /api/auth/login: 用户登录
  - POST /api/auth/logout: 用户登出
  - GET /api/users/me: 获取当前用户信息
  - GET /api/users: 获取用户列表
  - POST /api/users: 创建用户
  - PUT /api/users/{user_id}: 更新用户信息
- **依赖**: 数据库模型、JWT认证

#### 3.3.2 客户拜访服务模块 (Customer Visit Service)
- **职责**: 客户拜访记录的创建、查询、更新、删除
- **API端点**:
  - GET /api/customer-visits: 获取拜访记录列表
  - POST /api/customer-visits: 创建拜访记录
  - GET /api/customer-visits/{visit_id}: 获取拜访记录详情
  - PUT /api/customer-visits/{visit_id}: 更新拜访记录
  - DELETE /api/customer-visits/{visit_id}: 删除拜访记录
- **依赖**: 数据库模型、权限验证

#### 3.3.3 礼品管理服务模块 (Gift Management Service)
- **职责**: 礼品申请、审批、台账管理
- **API端点**:
  - GET /api/gift-applications: 获取礼品申请列表
  - POST /api/gift-applications: 创建礼品申请
  - GET /api/gift-applications/{application_id}: 获取申请详情
  - PUT /api/gift-applications/{application_id}: 更新申请
  - POST /api/gift-applications/{application_id}/approve: 审批申请
  - POST /api/gift-applications/{application_id}/reject: 驳回申请
  - GET /api/gift-ledger: 获取礼品台账列表
- **依赖**: 数据库模型、权限验证

#### 3.3.4 内容管理服务模块 (Content Management Service)
- **职责**: 首页内容、新闻管理
- **API端点**:
  - GET /api/homepage/carousel: 获取轮播图列表
  - POST /api/homepage/carousel: 创建轮播图
  - PUT /api/homepage/carousel/{carousel_id}: 更新轮播图
  - DELETE /api/homepage/carousel/{carousel_id}: 删除轮播图
  - GET /api/news: 获取新闻列表
  - POST /api/news: 创建新闻
  - GET /api/news/{news_id}: 获取新闻详情
  - PUT /api/news/{news_id}: 更新新闻
- **依赖**: 数据库模型、权限验证

#### 3.3.5 运营数据服务模块 (Operations Dashboard Service)
- **职责**: 运营数据统计、图表数据生成
- **API端点**:
  - GET /api/dashboard/overview: 获取运营概览数据
  - GET /api/dashboard/visit-trends: 获取拜访趋势数据
  - GET /api/dashboard/gift-expenses: 获取礼品支出数据
  - GET /api/dashboard/gift-expenses-by-type: 按类型获取礼品支出数据
- **依赖**: 数据库模型、统计计算

#### 3.3.6 AI集成服务模块 (AI Integration Service)
- **职责**: AI问答功能、对话管理
- **API端点**:
  - POST /api/ai/chat: AI问答接口
  - GET /api/ai/chat-history: 获取对话历史
  - POST /api/ai/chat/{session_id}/clear: 清空对话历史
- **依赖**: 外部AI服务、数据库模型

### 3.4 数据访问模块
- **Database Models**: SQLAlchemy数据模型定义
- **Database Repository**: 数据访问接口实现
- **Database Connection**: 数据库连接管理

### 3.5 工具模块
- **Configuration**: 配置管理
- **Logging**: 日志记录
- **Validation**: 数据验证工具
- **Utils**: 通用工具函数

## 4. 模块依赖关系

### 4.1 前端依赖关系
```
App (Root)
├── Auth Module
│   ├── Zustand (State Management)
│   └── Axios (HTTP Requests)
├── Home Module
│   ├── Auth Module (Authentication)
│   └── API Services
├── Customer Visit Module
│   ├── Auth Module (Authentication)
│   ├── ProComponents
│   └── API Services
├── Gift Management Module
│   ├── Auth Module (Authentication)
│   ├── ProComponents
│   └── API Services
├── Operations Dashboard Module
│   ├── Auth Module (Authentication)
│   ├── ECharts
│   └── API Services
└── AI Assistant Module
    ├── Auth Module (Authentication)
    └── API Services
```

### 4.2 后端依赖关系
```
API Server (FastAPI)
├── Authentication Module
│   ├── JWT
│   └── Database Models
├── User Service
│   ├── Authentication Module
│   └── Database Models
├── Customer Visit Service
│   ├── Authentication Module
│   └── Database Models
├── Gift Management Service
│   ├── Authentication Module
│   └── Database Models
├── Content Management Service
│   ├── Authentication Module
│   └── Database Models
├── Operations Dashboard Service
│   ├── Authentication Module
│   └── Database Models
├── AI Integration Service
│   ├── Authentication Module
│   └── External AI Service
└── Database Layer
    ├── SQLAlchemy
    └── MySQL
```

## 5. 开发顺序建议

### 5.1 第一阶段：基础架构
1. 数据库模型设计与实现
2. 认证授权模块开发
3. 用户管理模块开发
4. 基础API框架搭建

### 5.2 第二阶段：核心功能
1. 客户拜访模块开发
2. 礼品管理模块开发
3. 前端基础页面开发
4. 前后端集成测试

### 5.3 第三阶段：高级功能
1. 运营数据大屏开发
2. AI问答模块集成
3. 首页内容管理
4. 性能优化

### 5.4 第四阶段：完善与部署
1. 用户界面优化
2. 安全性增强
3. 部署配置
4. 系统测试