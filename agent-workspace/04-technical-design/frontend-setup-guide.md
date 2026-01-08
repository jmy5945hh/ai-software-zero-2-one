# 前端项目搭建指南

**文档版本**: v1.0
**创建时间**: 2026-01-08
**负责人**: 技术负责人
**关联文档**: 技术/技术栈.md, module-breakdown.md

---

## 文档说明

本文档提供前端项目的完整搭建指南,包括项目初始化、目录结构、配置文件、依赖安装和开发工具配置,确保开发者可以快速启动开发。

---

## 1. 项目初始化

### 1.1 使用 Vite 创建项目

```bash
# 使用 npm
npm create vite@latest frontend -- --template react-ts

# 或使用 yarn
yarn create vite frontend --template react-ts

# 或使用 pnpm
pnpm create vite frontend --template react-ts
```

### 1.2 进入项目目录

```bash
cd frontend
```

### 1.3 安装依赖

```bash
# npm
npm install

# 或 yarn
yarn

# 或 pnpm
pnpm install
```

### 1.4 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:5173 查看项目。

---

## 2. 目录结构设计

### 2.1 推荐目录结构

```
frontend/
├── public/                     # 静态资源
│   └── favicon.ico
├── src/
│   ├── main.tsx                # 应用入口
│   ├── App.tsx                 # 根组件
│   ├── vite-env.d.ts           # Vite 类型声明
│   ├── router/                 # 路由配置
│   │   ├── index.tsx           # 路由定义
│   │   └── guards.tsx         # 路由守卫
│   ├── layouts/                # 布局组件
│   │   ├── MainLayout.tsx      # 主布局
│   │   └── BlankLayout.tsx     # 空白布局
│   ├── pages/                  # 页面组件
│   │   ├── Login/              # 登录页
│   │   ├── Home/               # 首页
│   │   ├── VisitRecords/       # 拜访记录管理
│   │   ├── GiftApplications/   # 礼品申请
│   │   ├── GiftApprovals/      # 礼品审批
│   │   ├── GiftLedger/         # 礼品台账
│   │   ├── Content/            # 内容管理
│   │   │   ├── Carousels/      # 轮播图管理
│   │   │   └── News/           # 新闻管理
│   │   ├── Dashboard/          # 数据大屏
│   │   └── Profile/            # 个人中心
│   ├── components/             # 公共组件
│   │   ├── common/             # 通用组件
│   │   ├── business/           # 业务组件
│   │   └── layout/             # 布局组件
│   ├── stores/                 # 状态管理
│   │   ├── auth.ts             # 认证状态
│   │   ├── user.ts             # 用户状态
│   │   └── ai.ts               # AI 对话状态
│   ├── services/               # API 服务
│   │   ├── api.ts              # Axios 实例
│   │   ├── auth.ts             # 认证 API
│   │   ├── visits.ts           # 拜访 API
│   │   ├── gifts.ts            # 礼品 API
│   │   ├── content.ts          # 内容 API
│   │   ├── dashboard.ts        # 数据大屏 API
│   │   └── ai.ts               # AI API
│   ├── hooks/                  # 自定义 Hooks
│   │   ├── useAuth.ts          # 认证 Hook
│   │   ├── usePermission.ts    # 权限 Hook
│   │   └── useRequest.ts       # 请求 Hook
│   ├── utils/                  # 工具函数
│   │   ├── request.ts          # 请求工具
│   │   ├── format.ts           # 格式化工具
│   │   └── validate.ts         # 校验工具
│   ├── types/                  # TypeScript 类型
│   │   ├── api.ts              # API 类型
│   │   ├── models.ts           # 数据模型类型
│   │   └── views.ts            # 视图类型
│   └── styles/                 # 全局样式
│       └── global.css
├── .env.development            # 开发环境变量
├── .env.production             # 生产环境变量
├── .env.example                # 环境变量示例
├── .eslintrc.cjs               # ESLint 配置
├── .prettierrc                # Prettier 配置
├── index.html                  # HTML 入口
├── package.json                # 依赖管理
├── tsconfig.json               # TypeScript 配置
├── tsconfig.node.json          # TypeScript Node 配置
├── vite.config.ts              # Vite 配置
└── README.md                   # 项目说明
```

---

## 3. 配置文件说明

### 3.1 vite.config.ts

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
```

### 3.2 tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,

    /* Path mapping */
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### 3.3 package.json

```json
{
  "name": "zero-one-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "preview": "vite preview"
  },
  "dependencies": {
    "@ant-design/icons": "^5.2.6",
    "@ant-design/pro-components": "^2.6.43",
    "ahooks": "^3.7.8",
    "antd": "^5.11.5",
    "axios": "^1.6.2",
    "dayjs": "^1.11.10",
    "echarts": "^5.4.3",
    "echarts-for-react": "^3.0.2",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "zustand": "^4.4.7"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@typescript-eslint/eslint-plugin": "^6.13.1",
    "@typescript-eslint/parser": "^6.13.1",
    "@vitejs/plugin-react": "^4.2.1",
    "eslint": "^8.54.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.4.5",
    "prettier": "^3.1.0",
    "typescript": "^5.3.2",
    "vite": "^5.0.7"
  }
}
```

---

## 4. 依赖安装

### 4.1 核心依赖

```bash
# React 相关
npm install react react-dom react-router-dom

# UI 组件库
npm install antd @ant-design/icons @ant-design/pro-components

# 状态管理
npm install zustand

# HTTP 请求
npm install axios ahooks

# 数据可视化
npm install echarts echarts-for-react

# 工具库
npm install dayjs
```

### 4.2 开发依赖

```bash
# TypeScript
npm install -D typescript @types/react @types/react-dom

# ESLint
npm install -D eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser
npm install -D eslint-plugin-react-hooks eslint-plugin-react-refresh

# Prettier
npm install -D prettier

# Vite
npm install -D vite @vitejs/plugin-react
```

---

## 5. 环境变量配置

### 5.1 .env.development

```bash
# API 地址
VITE_API_BASE_URL=http://localhost:8000

# 应用标题
VITE_APP_TITLE=招财银行运营门户(开发)

# 其他配置
VITE_APP_VERSION=1.0.0
```

### 5.2 .env.production

```bash
# API 地址
VITE_API_BASE_URL=https://api.example.com

# 应用标题
VITE_APP_TITLE=招财银行运营门户

# 其他配置
VITE_APP_VERSION=1.0.0
```

### 5.3 .env.example

```bash
# API 地址
VITE_API_BASE_URL=http://localhost:8000

# 应用标题
VITE_APP_TITLE=招财银行运营门户

# 其他配置
VITE_APP_VERSION=1.0.0
```

### 5.4 使用环境变量

```typescript
// src/config/index.ts
const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
  appTitle: import.meta.env.VITE_APP_TITLE,
  appVersion: import.meta.env.VITE_APP_VERSION,
};

export default config;
```

---

## 6. 开发工具配置

### 6.1 ESLint 配置 (.eslintrc.cjs)

```javascript
module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
  },
};
```

### 6.2 Prettier 配置 (.prettierrc)

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "arrowParens": "always"
}
```

### 6.3 Git 提交规范 (Husky + Commitlint)

```bash
# 安装 Husky 和 Commitlint
npm install -D husky commitlint @commitlint/config-conventional commitlint/cli

# 初始化 Husky
npx husky install

# 添加 commit-msg hook
npx husky add .husky/commit-msg 'npx --no -- commitlint --edit $1'
```

### 6.4 commitlint.config.js

```javascript
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'docs', 'style', 'refactor', 'test', 'chore']],
    'subject-case': [0],
  },
};
```

---

## 7. 核心代码模板

### 7.1 Axios 实例配置 (src/services/api.ts)

```typescript
import axios, { AxiosInstance, AxiosError } from 'axios';
import { message } from 'antd';

const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error: AxiosError) => {
    if (error.response) {
      const { status, data } = error.response as any;

      if (status === 401) {
        message.error('登录已过期,请重新登录');
        localStorage.removeItem('access_token');
        window.location.href = '/login';
        return Promise.reject(error);
      }

      if (data?.message) {
        message.error(data.message);
      }
    } else {
      message.error('网络错误,请稍后重试');
    }

    return Promise.reject(error);
  }
);

export default api;
```

### 7.2 认证 Store (src/stores/auth.ts)

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  user_id: string;
  username: string;
  name: string;
  role: string;
  department: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setAuth: (user, token) => set({ user, token }),
      clearAuth: () => set({ user: null, token: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);
```

### 7.3 路由配置 (src/router/index.tsx)

```typescript
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { MainLayout } from '@/layouts/MainLayout';
import { BlankLayout } from '@/layouts/BlankLayout';
import { Login } from '@/pages/Login';
import { Home } from '@/pages/Home';
import { VisitRecords } from '@/pages/VisitRecords';
import { ProtectedRoute } from './guards';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <BlankLayout />,
    children: [
      {
        path: '',
        element: <Login />,
      },
    ],
  },
  {
    path: '/',
    element: <ProtectedRoute><MainLayout /></ProtectedRoute>,
    children: [
      {
        path: '',
        element: <Home />,
      },
      {
        path: 'visit-records',
        element: <VisitRecords />,
      },
      // ... 其他路由
    ],
  },
]);
```

### 7.4 路由守卫 (src/router/guards.tsx)

```typescript
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';

export const ProtectedRoute = ({ children, roles }: any) => {
  const { user } = useAuthStore();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/403" replace />;
  }

  return children;
};
```

---

## 8. Git 提交规范

### 8.1 Commit Message 格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### 8.2 Type 类型

- `feat`: 新功能
- `fix`: 修复 Bug
- `docs`: 文档更新
- `style`: 代码格式调整(不影响功能)
- `refactor`: 重构(既不是新功能也不是修复 Bug)
- `test`: 测试相关
- `chore`: 构建过程或辅助工具的变动

### 8.3 示例

```bash
# 新功能
git commit -m "feat(visit): 添加拜访记录列表页"

# 修复 Bug
git commit -m "fix(auth): 修复 Token 过期未跳转登录页的问题"

# 文档
git commit -m "docs(readme): 更新项目搭建指南"

# 重构
git commit -m "refactor(api): 重构 Axios 拦截器"
```

---

## 9. 开发工作流

### 9.1 启动开发服务器

```bash
# 前端
cd frontend
npm run dev

# 后端(在另一个终端)
cd backend
uvicorn main:app --reload
```

### 9.2 代码检查

```bash
# ESLint 检查
npm run lint

# Prettier 格式化
npx prettier --write src/
```

### 9.3 构建生产版本

```bash
npm run build
```

输出目录: `dist/`

---

## 10. 常见问题

### 10.1 端口被占用

```bash
# 修改 vite.config.ts 中的端口
server: {
  port: 3000,  # 修改为其他端口
}
```

### 10.2 代理配置不生效

确保 `vite.config.ts` 中的 proxy 配置正确:

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true,
    },
  },
},
```

### 10.3 TypeScript 类型错误

确保 `tsconfig.json` 配置正确,并安装所有类型定义:

```bash
npm install -D @types/react @types/react-dom
```

---

**文档变更记录**:
- v1.0 (2026-01-08): 初始版本,定义前端项目搭建指南
