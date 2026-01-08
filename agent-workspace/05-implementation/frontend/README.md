# 招财银行北京分行运营门户系统 - 前端

基于 React 18 + TypeScript + Vite + Ant Design 5 的现代化前端应用。

## 技术栈

- **React 18.2.0** - UI 框架
- **TypeScript 5.9** - 类型安全
- **Vite 7.2** - 构建工具
- **Ant Design 5.29** - UI 组件库
- **Zustand 5.0** - 状态管理
- **React Router 7.12** - 路由管理
- **Axios 1.13** - HTTP 请求
- **dayjs** - 日期处理
- **ahooks** - React Hooks 工具库

## 项目结构

```
frontend/
├── public/                     # 静态资源
├── src/
│   ├── assets/                 # 静态资源
│   ├── components/             # 通用组件
│   │   ├── common/             # 通用组件
│   │   ├── business/           # 业务组件
│   │   └── layout/             # 布局组件
│   ├── pages/                  # 页面组件
│   │   ├── Login/              # 登录页
│   │   └── Home/               # 首页
│   ├── services/               # API 服务
│   │   └── authService.ts      # 认证 API
│   ├── stores/                 # 状态管理
│   │   └── authStore.ts        # 认证状态
│   ├── types/                  # TypeScript 类型
│   │   └── auth.ts             # 认证类型
│   ├── utils/                  # 工具函数
│   │   ├── request.ts          # Axios 封装
│   │   └── auth.ts             # Token 工具
│   ├── router/                 # 路由配置
│   │   ├── index.tsx           # 路由定义
│   │   └── AuthGuard.tsx       # 路由守卫
│   ├── layouts/                # 布局组件
│   ├── hooks/                  # 自定义 Hooks
│   ├── main.tsx                # 应用入口
│   └── index.css               # 全局样式
├── .env.development            # 开发环境变量
├── .env.production             # 生产环境变量
├── .env.example                # 环境变量示例
├── .eslintrc.cjs               # ESLint 配置
├── .prettierrc                # Prettier 配置
├── index.html                  # HTML 入口
├── package.json                # 依赖管理
├── tsconfig.json               # TypeScript 配置
├── vite.config.ts              # Vite 配置
└── README.md                   # 项目说明
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:5173

### 3. 构建生产版本

```bash
npm run build
```

构建产物位于 `dist/` 目录

### 4. 预览生产版本

```bash
npm run preview
```

## 开发指南

### 代码规范

项目使用 ESLint 和 Prettier 进行代码格式化:

```bash
# ESLint 检查
npm run lint

# ESLint 自动修复
npm run lint:fix

# Prettier 格式化
npm run format

# TypeScript 类型检查
npm run type-check
```

### 类型安全

项目使用 TypeScript 严格模式,禁止使用 `any` 类型。

所有组件和函数必须有完整的类型定义。

### 状态管理

使用 Zustand 进行全局状态管理:

- `useAuthStore` - 认证状态
- 支持持久化到 localStorage

### API 请求

使用封装的 `request` 工具:

```typescript
import request from '@/utils/request';

export const fetchData = async (id: string) => {
  return request<Data>({
    method: 'GET',
    url: `/api/v1/resource/${id}`,
  });
};
```

### 路由守卫

使用 `AuthGuard` 组件保护需要认证的页面:

```tsx
import AuthGuard from '@/router/AuthGuard';

<AuthGuard>
  <YourComponent />
</AuthGuard>
```

## 环境变量

### 开发环境 (.env.development)

```bash
VITE_API_BASE_URL=http://localhost:8000
VITE_APP_TITLE=招财银行运营门户(开发)
VITE_APP_VERSION=1.0.0
```

### 生产环境 (.env.production)

```bash
VITE_API_BASE_URL=https://api.example.com
VITE_APP_TITLE=招财银行运营门户
VITE_APP_VERSION=1.0.0
```

## 后端 API 对接

- **后端地址**: http://localhost:8000
- **Swagger 文档**: http://localhost:8000/docs
- **登录 API**: POST /api/v1/auth/login

### 测试账号

| 角色       | 账号            | 密码         |
| ---------- | --------------- | ------------ |
| 管理者     | manager001      | password123  |
| 运营人员   | operations001   | password123  |
| 审批人员   | approver001     | password123  |
| 客户经理   | cm001           | password123  |
| 客户经理   | cm002           | password123  |

## 功能特性

### 已实现

- ✅ 用户登录
- ✅ Token 管理
- ✅ 路由守卫
- ✅ 状态持久化
- ✅ 请求/响应拦截器
- ✅ 错误处理
- ✅ TypeScript 类型安全
- ✅ 响应式布局

### 待实现

- ⏳ 首页轮播图和新闻列表
- ⏳ 拜访记录管理
- ⏳ 礼品申请与审批
- ⏳ 内容管理
- ⏳ 数据大屏
- ⏳ AI 助理

## 开发注意事项

1. **代码提交前必须通过 ESLint 检查**
2. **所有 API 请求必须使用封装的 request 工具**
3. **所有状态管理使用 Zustand**
4. **所有组件必须有完整的 TypeScript 类型定义**
5. **遵循设计系统和交互规范**

## 常见问题

### 1. 端口被占用

修改 `vite.config.ts` 中的端口号:

```typescript
server: {
  port: 3000, // 修改为其他端口
}
```

### 2. API 请求失败

确保后端服务已启动,并且地址配置正确。

### 3. Token 过期

Token 过期后会自动跳转到登录页。

## 版本历史

- v1.0.0 (2026-01-08) - 初始版本
  - 实现项目初始化
  - 实现认证与路由框架
  - 实现登录页面

## 许可证

Copyright © 2026 招财银行北京分行

## 联系方式

- 项目负责人: 前端开发团队
- Email: support@example.com
