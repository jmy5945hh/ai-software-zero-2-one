# 架构设计文档目录

**版本**: v1.0
**创建时间**: 2026-01-08
**负责人**: 系统架构师

---

## 文档清单

本目录包含"招财银行北京分行运营门户系统"的完整架构设计文档：

| 序号 | 文档名称 | 文件名 | 说明 |
| --- | --- | --- | --- |
| 1 | 系统架构总览 | system-overview.md | 系统架构图、技术栈选型、系统边界、部署架构 |
| 2 | 架构决策记录 | architecture-decisions.md | 关键架构决策的 ADR 记录（12 个决策） |
| 3 | 组件设计 | component-diagram.md | 前后端组件划分、依赖关系、数据流向 |
| 4 | 数据架构设计 | data-architecture.md | 数据库表设计、索引、ER 图、迁移策略 |
| 5 | API 契约总览 | api-contract-overview.md | API 设计原则、分组、响应格式、错误码 |
| 6 | 安全架构设计 | security-architecture.md | 认证授权、加密策略、安全防护 |
| 7 | 部署架构 | deployment-architecture.md | 开发/生产环境配置、Docker 化、CI/CD |
| 8 | 非功能性需求 | non-functional-requirements.md | 性能、可扩展性、可维护性、可观测性 |

---

## 文档阅读顺序建议

### 对于技术负责人
1. 系统架构总览 (system-overview.md)
2. 架构决策记录 (architecture-decisions.md)
3. 数据架构设计 (data-architecture.md)
4. API 契约总览 (api-contract-overview.md)
5. 安全架构设计 (security-architecture.md)

### 对于前端开发人员
1. 系统架构总览 (system-overview.md) - 了解技术栈
2. 组件设计 (component-diagram.md) - 前端组件划分
3. API 契约总览 (api-contract-overview.md) - 接口规范
4. 部署架构 (deployment-architecture.md) - 开发环境配置

### 对于后端开发人员
1. 系统架构总览 (system-overview.md) - 了解技术栈
2. 架构决策记录 (architecture-decisions.md) - 理解架构决策
3. 组件设计 (component-diagram.md) - 后端模块划分
4. 数据架构设计 (data-architecture.md) - 数据库设计
5. API 契约总览 (api-contract-overview.md) - 接口实现
6. 安全架构设计 (security-architecture.md) - 安全实现

### 对于运维人员
1. 系统架构总览 (system-overview.md) - 了解系统架构
2. 部署架构 (deployment-architecture.md) - 部署流程
3. 非功能性需求 (non-functional-requirements.md) - 性能和监控
4. 安全架构设计 (security-architecture.md) - 安全配置

---

## 架构设计要点总结

### 技术栈
- **前端**: React 18 + TypeScript + Vite + Ant Design 5.x + Zustand + ECharts
- **后端**: FastAPI + Python 3.10+ + SQLAlchemy 2.x + Uvicorn
- **数据库**: MySQL 8.0+ (utf8mb4)

### 架构模式
- **前后端分离**: RESTful API 通信
- **分层架构**: API 路由层 → 业务逻辑层 → 数据访问层
- **RBAC 权限**: 基于角色的访问控制

### 核心模块
1. **认证模块**: JWT 认证、RBAC 授权
2. **拜访管理**: 拜访记录 CRUD、查询统计
3. **礼品管理**: 礼品申请、审批、台账
4. **内容管理**: 轮播图、新闻管理
5. **数据大屏**: 运营指标统计、可视化
6. **AI 助理**: 接入火山引擎 LLM API

### 安全措施
- **认证**: JWT Token (2 小时过期)
- **授权**: RBAC 权限模型
- **加密**: 密码 bcrypt 哈希、HTTPS 传输
- **防护**: SQL 注入防护、XSS 防护、CSRF 防护

### 部署方式
- **开发环境**: Vite Dev Server + Uvicorn + Docker MySQL
- **生产环境**: Nginx + Uvicorn + MySQL (独立服务器)

---

## 待确认事项汇总

基于架构设计，以下事项需要与业务方或技术团队确认：

### 业务规则相关
1. **拜访方式枚举值**: 现场/电话/视频/邮件/其他是否完整？
2. **拜访状态枚举值**: 新建/进行中/成功/失败/已取消是否完整？
3. **营销成功定义**: 如何判断营销成功？
4. **目的类型枚举值**: 客户拜访/节日慰问/营销活动/其他是否完整？
5. **礼品分类维度**: 如何分类（如"实物"/"服务"）？
6. **库存管理**: 是否需要管理礼品库存数量？
7. **实际领用**: 是否需要记录实际领用日期和数量？

### 技术实现相关
1. **JWT 算法**: 使用 HS256 还是国密 SM2/SM3？
2. **密码策略**: 复杂度要求、过期策略、账号锁定策略？
3. **会话超时**: 当前 2 小时是否合适？
4. **API 版本**: 是否需要支持多版本 API？
5. **缓存策略**: 是否需要引入 Redis 缓存？
6. **监控告警**: 是否需要接入监控系统？
7. **日志存储**: 审计日志是否需要持久化？

### 功能扩展相关
1. **数据导出**: 是否需要支持导出 Excel？
2. **批量操作**: 是否需要支持批量删除、批量审批？
3. **文件上传**: 轮播图图片上传方式（本地存储/对象存储）？
4. **AI 对话历史**: 是否需要持久化存储对话历史？
5. **数据大屏访问权限**: 是否需要更细粒度的权限控制？

---

## 下一步工作

架构设计完成后，建议按以下顺序推进：

1. **确认待确认事项**: 与业务方和技术团队确认上述待确认事项
2. **数据库初始化**: 根据 data-architecture.md 创建数据库表
3. **API 契约评审**: 评审 API 接口设计，前后端达成一致
4. **前端框架搭建**: 初始化前端项目，配置路由和状态管理
5. **后端框架搭建**: 初始化后端项目，配置数据库连接和 JWT
6. **核心功能开发**: 按 P0 → P1 → P2 优先级开发功能
7. **集成测试**: 前后端联调测试
8. **部署上线**: 按部署文档进行生产环境部署

---

## 文档维护

本文档由系统架构师维护，如有变更请及时更新。

**联系方式**: [待填写]

---

**文档变更记录**:
- v1.0 (2026-01-08): 初始版本，完成所有架构设计文档
