# AI 开发任务清单

**文档版本**: v2.0 (AI 优化版)
**创建时间**: 2026-01-08
**更新时间**: 2026-01-08
**负责人**: 技术负责人
**关联文档**: module-breakdown.md, user-stories.md, openapi.yaml

---

## 文档说明

本文档定义"招财银行北京分行运营门户系统"的 AI 开发任务清单。按照优先级和依赖关系组织任务，明确每个任务的输入、输出和验收标准。

**面向对象**: AI Subagent (React Frontend Dev / Python Backend Dev)

**任务拆分原则**:
- 按功能模块拆分，每个模块可独立交付
- 明确依赖关系，避免循环依赖
- 每个任务有清晰的输入文件和输出产物
- 每个任务有明确的验收标准

---

## 1. 任务总览

### 1.1 优先级定义

- **P0**: 核心业务流程，必须实现
- **P1**: 重要功能，显著提升用户体验
- **P2**: 增值功能，锦上添花

### 1.2 任务依赖关系

```
数据库初始化 → 认证模块 → 业务模块 → 内容管理 → 数据大屏 → AI 助理
                 ↓
              前端路由框架
                 ↓
            各功能页面 (可并行)
```

---

## 2. 后端开发任务清单

### 2.1 P0 任务：核心基础功能

#### Task B-001: 数据库初始化
**优先级**: P0
**依赖**: 无

**输入**:
- `data-models.md` - 数据表设计
- `环境&配置.md` - 数据库连接信息

**任务描述**:
- 创建所有数据库表（8 张表）
- 配置 Alembic 迁移脚本
- 插入初始测试数据（测试用户、角色、礼品数据等）

**输出**:
- Alembic 迁移脚本文件
- 数据库初始化 SQL 脚本
- 测试数据 SQL 脚本

**验收标准**:
- 所有表创建成功，字段类型正确
- 外键关系建立正确
- 索引创建正确
- 迁移脚本可重复执行（idempotent）
- 测试数据插入成功

---

#### Task B-002: 认证模块
**优先级**: P0
**依赖**: B-001

**输入**:
- `data-models.md` - users/roles 表结构
- `security-architecture.md` - JWT 认证机制
- `openapi.yaml` - 认证 API 定义

**任务描述**:
- 实现登录 API (`POST /api/auth/login`)
- 实现 JWT Token 颁发逻辑
- 实现 JWT Token 验证中间件
- 实现权限检查装饰器（RBAC）
- 实现当前用户信息获取 API (`GET /api/auth/me`)

**输出**:
- `app/api/v1/auth.py` - 认证路由
- `app/core/security.py` - JWT 工具函数
- `app/middleware/auth.py` - 认证中间件
- `app/schemas/auth.py` - 认证相关 Pydantic 模型

**验收标准**:
- 登录 API 返回 JWT Token
- Token 验证正确识别用户身份和角色
- 权限检查正确拦截无权访问
- API 符合 OpenAPI 规范
- 有对应的单元测试

---

#### Task B-003: 拜访管理模块
**优先级**: P0
**依赖**: B-002

**输入**:
- `openapi.yaml` - 拜访管理 API 定义
- `business-rules.md` - 拜访记录业务规则
- `data-models.md` - customer_visits 表结构

**任务描述**:
- 实现拜访记录 CRUD API
  - `POST /api/visits` - 创建拜访记录
  - `GET /api/visits` - 查询拜访记录（分页、筛选）
  - `GET /api/visits/{id}` - 获取拜访记录详情
  - `PUT /api/visits/{id}` - 更新拜访记录
- 实现数据级权限控制（用户只能看自己的记录）
- 实现多条件筛选（时间区间、状态、参与人员）

**输出**:
- `app/api/v1/visits.py` - 拜访管理路由
- `app/schemas/visit.py` - 拜访记录 Pydantic 模型
- `app/services/visit_service.py` - 拜访业务逻辑层
- `app/crud/visit_crud.py` - 拜访数据访问层

**验收标准**:
- 所有 API 端点功能正确
- 权限控制正确（数据级隔离）
- 分页、筛选功能正常
- API 符合 OpenAPI 规范
- 有对应的单元测试

---

#### Task B-004: 礼品管理模块
**优先级**: P0
**依赖**: B-002

**输入**:
- `openapi.yaml` - 礼品管理 API 定义
- `business-rules.md` - 礼品审批业务规则
- `data-models.md` - gifts/gift_requisitions/gift_requisition_items 表结构

**任务描述**:
- 实现礼品申请 CRUD API
  - `POST /api/gift-requisitions` - 创建礼品申请
  - `GET /api/gift-requisitions` - 查询礼品申请
  - `GET /api/gift-requisitions/{id}` - 获取详情
- 实现礼品审批 API
  - `POST /api/gift-requisitions/{id}/approve` - 审批通过
  - `POST /api/gift-requisitions/{id}/reject` - 审批驳回
- 实现状态流转控制（待审批 → 已通过/已驳回）
- 实现礼品台账查询 API (`GET /api/gift-ledger`)
- 实现礼品列表查询 API (`GET /api/gifts`)

**输出**:
- `app/api/v1/gifts.py` - 礼品管理路由
- `app/schemas/gift.py` - 礼品相关 Pydantic 模型
- `app/services/gift_service.py` - 礼品业务逻辑层
- `app/crud/gift_crud.py` - 礼品数据访问层

**验收标准**:
- 所有 API 端点功能正确
- 状态流转逻辑正确
- 权限控制正确（审批人员才能审批）
- 驳回时必须填写原因
- API 符合 OpenAPI 规范
- 有对应的单元测试

---

### 2.2 P1 任务：扩展功能

#### Task B-005: 首页内容模块
**优先级**: P1
**依赖**: B-002

**输入**:
- `openapi.yaml` - 内容管理 API 定义
- `data-models.md` - carousels/news 表结构

**任务描述**:
- 实现轮播图查询 API (`GET /api/carousels`)
- 实现新闻列表查询 API (`GET /api/news`)
- 实现新闻详情 API (`GET /api/news/{id}`)
- 实现轮播图管理 API (CRUD)
- 实现新闻管理 API (CRUD，含发布/下架)

**输出**:
- `app/api/v1/content.py` - 内容管理路由
- `app/schemas/content.py` - 内容相关 Pydantic 模型
- `app/services/content_service.py` - 内容业务逻辑层

**验收标准**:
- 所有 API 端点功能正确
- 权限控制正确（仅运营人员可管理）
- API 符合 OpenAPI 规范

---

#### Task B-006: 运营数据统计模块
**优先级**: P1
**依赖**: B-003, B-004

**输入**:
- `openapi.yaml` - 数据统计 API 定义
- `user-stories.md` - 数据大屏需求

**任务描述**:
- 实现拜访统计 API (`GET /api/dashboard/visit-stats`)
  - 按时间维度统计（天/周/月）
  - 返回新增和总量数据
- 实现礼品统计 API (`GET /api/dashboard/gift-stats`)
  - 按时间维度统计礼品支出
  - 按分类统计礼品占比
- 实现关键指标汇总 API (`GET /api/dashboard/summary`)

**输出**:
- `app/api/v1/dashboard.py` - 数据统计路由
- `app/schemas/dashboard.py` - 统计数据 Pydantic 模型
- `app/services/dashboard_service.py` - 统计业务逻辑层

**验收标准**:
- 所有 API 端点功能正确
- 统计数据准确
- 支持灵活的时间维度切换
- API 符合 OpenAPI 规范

---

### 2.3 P2 任务：AI 助理

#### Task B-007: AI 助理模块
**优先级**: P2
**依赖**: B-002

**输入**:
- `openapi.yaml` - AI 助理 API 定义
- `环境&配置.md` - LLM API 配置
- `user-stories.md` - AI 助理需求

**任务描述**:
- 实现对话 API (`POST /api/ai/chat`)
- 接入火山引擎 LLM API
- 实现流式响应（Server-Sent Events）
- 实现对话历史存储（可选）
- 实现错误处理和降级方案

**输出**:
- `app/api/v1/ai.py` - AI 助理路由
- `app/schemas/ai.py` - AI 相关 Pydantic 模型
- `app/services/llm_service.py` - LLM 调用服务
- `app/core/llm_client.py` - LLM API 客户端

**验收标准**:
- 对话 API 功能正确
- 流式响应正常工作
- LLM API 调用成功
- 错误处理完善（超时、限流等）
- API 符合 OpenAPI 规范

---

## 3. 前端开发任务清单

### 3.1 P0 任务：核心基础功能

#### Task F-001: 项目初始化
**优先级**: P0
**依赖**: 无

**输入**:
- `frontend-setup-guide.md` - 前端项目搭建指南

**任务描述**:
- 初始化 Vite + React + TypeScript 项目
- 安装依赖（Ant Design、Zustand、React Router、Axios 等）
- 配置 Vite（路径别名、代理等）
- 配置 TypeScript（严格模式）
- 配置 ESLint 和 Prettier
- 创建目录结构
- 配置环境变量

**输出**:
- 完整的前端项目骨架
- `package.json` - 依赖清单
- `vite.config.ts` - Vite 配置
- `tsconfig.json` - TypeScript 配置
- `.env.example` - 环境变量示例
- 目录结构：`src/{components,pages,services,stores,types,utils}`

**验收标准**:
- 项目可启动（`npm run dev`）
- 项目可构建（`npm run build`）
- TypeScript 类型检查通过
- ESLint 检查通过
- 目录结构清晰

---

#### Task F-002: 认证与路由框架
**优先级**: P0
**依赖**: F-001

**输入**:
- `module-breakdown.md` - 前端模块拆分
- `security-architecture.md` - JWT 认证机制
- `openapi.yaml` - 认证 API 定义

**任务描述**:
- 封装 Axios 实例（拦截器、Token 注入）
- 实现 Token 存储和恢复（localStorage）
- 实现登录状态管理（Zustand store）
- 实现路由配置（React Router）
- 实现路由守卫（未登录跳转登录页）
- 实现登录页面

**输出**:
- `src/utils/request.ts` - Axios 封装
- `src/stores/authStore.ts` - 认证状态管理
- `src/router/index.tsx` - 路由配置
- `src/router/guards.tsx` - 路由守卫
- `src/pages/Login/index.tsx` - 登录页面
- `src/services/authService.ts` - 认证 API 调用

**验收标准**:
- 登录功能正常
- Token 自动存储和注入
- 未登录自动跳转登录页
- 登录后跳转首页
- Token 过期自动跳转登录页

---

#### Task F-003: 拜访管理模块
**优先级**: P0
**依赖**: F-002

**输入**:
- `wireframes/overview.md` - 拜访管理页面线框图
- `openapi.yaml` - 拜访管理 API 定义
- `user-stories.md` - 拜访管理用户故事

**任务描述**:
- 实现拜访记录列表页（P-05）
  - 表格展示（分页）
  - 筛选器（时间区间、状态、参与人员）
  - 操作按钮（新增、查看、编辑）
- 实现拜访记录新增/编辑页（P-06）
  - 表单（客户ID、企业名称、日期、方式、状态等）
  - 表单校验
  - 提交逻辑
- 实现拜访记录详情页（P-07）
  - 详情展示
  - 编辑按钮（跳转编辑页）
- 实现拜访相关 API 调用服务
- 实现拜访状态管理（可选）

**输出**:
- `src/pages/Visits/List/index.tsx` - 列表页
- `src/pages/Visits/Form/index.tsx` - 表单页
- `src/pages/Visits/Detail/index.tsx` - 详情页
- `src/services/visitService.ts` - 拜访 API
- `src/types/visit.ts` - 拜访类型定义

**验收标准**:
- 列表页数据展示正确
- 分页功能正常
- 筛选功能正常
- 新增功能正常
- 编辑功能正常
- 详情展示正确
- 权限控制正确（只能看自己的）

---

#### Task F-004: 礼品管理模块
**优先级**: P0
**依赖**: F-002

**输入**:
- `wireframes/overview.md` - 礼品管理页面线框图
- `openapi.yaml` - 礼品管理 API 定义
- `user-stories.md` - 礼品管理用户故事

**任务描述**:
- 实现礼品申请列表页（P-08）
  - 表格展示
  - 状态筛选
  - 操作按钮（新增、查看）
- 实现礼品申请新增页（P-09）
  - 礼品选择组件
  - 数量调整
  - 总金额计算
  - 表单提交
- 实现礼品申请详情页（P-10）
  - 详情展示
  - 审批状态展示
- 实现礼品审批列表页（P-11）
  - 待审批列表
  - 审批操作（通过/驳回）
  - 驳回原因输入
- 实现礼品台账页（P-13）
  - 已审批记录展示
  - 统计筛选
- 实现礼品相关 API 调用服务

**输出**:
- `src/pages/GiftApplications/List/index.tsx` - 申请列表
- `src/pages/GiftApplications/Form/index.tsx` - 申请表单
- `src/pages/GiftApplications/Detail/index.tsx` - 申请详情
- `src/pages/GiftApprovals/List/index.tsx` - 审批列表
- `src/pages/GiftLedger/index.tsx` - 台账页
- `src/components/GiftSelector.tsx` - 礼品选择组件
- `src/services/giftService.ts` - 礼品 API
- `src/types/gift.ts` - 礼品类型定义

**验收标准**:
- 所有页面功能正确
- 礼品选择组件正常工作
- 总金额计算正确
- 审批流程正确
- 权限控制正确

---

### 3.2 P1 任务：扩展功能

#### Task F-005: 首页模块
**优先级**: P1
**依赖**: F-002

**输入**:
- `wireframes/overview.md` - 首页线框图
- `openapi.yaml` - 内容管理 API 定义
- `user-stories.md` - 首页用户故事

**任务描述**:
- 实现首页（P-02）
  - 轮播图组件
  - 新闻列表组件
  - 快捷入口（根据角色动态展示）
- 实现轮播图管理页（P-15）
  - 列表展示
  - 新增/编辑表单
  - 上传组件
- 实现新闻管理页（P-16）
  - 列表展示
  - 新增/编辑表单
  - 富文本编辑器
  - 发布/下架操作

**输出**:
- `src/pages/Home/index.tsx` - 首页
- `src/components/Carousel/index.tsx` - 轮播图组件
- `src/components/NewsList/index.tsx` - 新闻列表
- `src/pages/Content/Carousels/index.tsx` - 轮播图管理
- `src/pages/Content/News/index.tsx` - 新闻管理
- `src/services/contentService.ts` - 内容 API

**验收标准**:
- 首页展示正常
- 轮播图轮播正常
- 新闻展示正确
- 管理功能正常
- 权限控制正确

---

#### Task F-006: 数据大屏模块
**优先级**: P1
**依赖**: F-002

**输入**:
- `wireframes/overview.md` - 数据大屏线框图
- `openapi.yaml` - 数据统计 API 定义
- `user-stories.md` - 数据大屏用户故事

**任务描述**:
- 实现运营数据大屏（P-19）
  - 关键指标卡片
  - 拜访趋势折线图（ECharts）
  - 礼品支出条形图（ECharts）
  - 礼品分类饼图（ECharts）
  - 时间维度切换（天/周/月）
- 实现数据刷新逻辑

**输出**:
- `src/pages/Dashboard/index.tsx` - 数据大屏
- `src/components/MetricCard/index.tsx` - 指标卡片
- `src/components/Charts/LineChart.tsx` - 折线图封装
- `src/components/Charts/BarChart.tsx` - 条形图封装
- `src/components/Charts/PieChart.tsx` - 饼图封装
- `src/services/dashboardService.ts` - 统计 API

**验收标准**:
- 所有图表正常展示
- 数据正确
- 时间维度切换正常
- 数据自动刷新

---

### 3.3 P2 任务：AI 助理

#### Task F-007: AI 助理侧边栏
**优先级**: P2
**依赖**: F-002

**输入**:
- `wireframes/overview.md` - AI 助理线框图
- `openapi.yaml` - AI 助理 API 定义
- `user-stories.md` - AI 助理用户故事

**任务描述**:
- 实现 AI 助理侧边栏组件（全局）
  - 对话界面
  - 输入框
  - 消息列表
  - 流式响应渲染
- 实现对话 API 调用
- 实现错误处理和加载状态
- 实现折叠/展开逻辑

**输出**:
- `src/components/AIAssistant/index.tsx` - AI 助理组件
- `src/services/aiService.ts` - AI API
- `src/types/ai.ts` - AI 类型定义

**验收标准**:
- 对话功能正常
- 流式响应正常显示
- 错误处理完善
- 折叠/展开正常

---

## 4. 任务执行顺序建议

### 4.1 后端任务执行顺序
```
B-001 (数据库) → B-002 (认证) → B-003 (拜访) / B-004 (礼品) [并行]
                                      ↓
                              B-005 (内容) / B-006 (统计) [并行]
                                      ↓
                                  B-007 (AI)
```

### 4.2 前端任务执行顺序
```
F-001 (项目初始化) → F-002 (认证路由) → F-003 (拜访) / F-004 (礼品) [并行]
                                              ↓
                                      F-005 (首页) / F-006 (大屏) [并行]
                                              ↓
                                          F-007 (AI)
```

### 4.3 前后端协作建议
- 后端优先启动 B-001, B-002，为前端提供认证基础
- 前端完成 F-002 后，可与后端并行开发各业务模块
- 前端开发时可使用 Mock 数据，不阻塞后端开发
- 每个模块完成后进行联调测试

---

## 5. 质量标准

### 5.1 代码质量
- TypeScript 类型完整（无 `any`）
- Python 类型注解完整（使用 type hints）
- 代码符合 ESLint / Black / Flake8 规范
- 关键业务逻辑有注释

### 5.2 测试要求
- 后端：核心业务逻辑有单元测试（pytest）
- 前端：关键组件有单元测试（Vitest，可选）
- API：所有端点有集成测试（可选）

### 5.3 文档要求
- API 文档：基于 OpenAPI 自动生成（FastAPI Swagger）
- 组件文档：关键组件有使用说明（可选）
- README：每个项目有启动说明

---

## 6. 交付标准

### 6.1 功能完整性
- ✅ P0 任务全部完成
- ✅ P1 任务全部完成
- ✅ P2 任务全部完成

### 6.2 可运行性
- ✅ 前端项目可独立启动
- ✅ 后端项目可独立启动
- ✅ 数据库迁移可成功执行
- ✅ 核心业务流程可端到端跑通

### 6.3 代码质量
- ✅ 代码符合规范
- ✅ 关键功能有测试
- ✅ 无明显 Bug

---

## 附录：任务清单速查表

| 任务编号 | 任务名称 | 优先级 | 依赖 | 前后端 |
|---------|---------|--------|------|--------|
| B-001 | 数据库初始化 | P0 | 无 | 后端 |
| B-002 | 认证模块 | P0 | B-001 | 后端 |
| B-003 | 拜访管理模块 | P0 | B-002 | 后端 |
| B-004 | 礼品管理模块 | P0 | B-002 | 后端 |
| B-005 | 首页内容模块 | P1 | B-002 | 后端 |
| B-006 | 运营数据统计模块 | P1 | B-003, B-004 | 后端 |
| B-007 | AI 助理模块 | P2 | B-002 | 后端 |
| F-001 | 项目初始化 | P0 | 无 | 前端 |
| F-002 | 认证与路由框架 | P0 | F-001 | 前端 |
| F-003 | 拜访管理模块 | P0 | F-002 | 前端 |
| F-004 | 礼品管理模块 | P0 | F-002 | 前端 |
| F-005 | 首页模块 | P1 | F-002 | 前端 |
| F-006 | 数据大屏模块 | P1 | F-002 | 前端 |
| F-007 | AI 助理侧边栏 | P2 | F-002 | 前端 |

**总计**: 14 个任务（7 后端 + 7 前端）
