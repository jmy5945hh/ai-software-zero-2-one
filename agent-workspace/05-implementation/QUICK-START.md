# 招财银行北京分行运营门户系统 - 快速启动指南

**项目名称**: 招财银行北京分行运营门户系统
**交付阶段**: P0 核心功能
**文档版本**: v1.0
**更新日期**: 2026-01-08

---

## 目录

1. [环境准备](#1-环境准备)
2. [后端启动](#2-后端启动)
3. [前端启动](#3-前端启动)
4. [测试验证](#4-测试验证)
5. [常见问题](#5-常见问题)
6. [测试账号](#6-测试账号)
7. [开发指南](#7-开发指南)

---

## 1. 环境准备

### 1.1 必需软件

#### 后端环境

| 软件 | 版本要求 | 下载地址 |
|------|---------|---------|
| Python | 3.9+ | https://www.python.org/downloads/ |
| PostgreSQL | 15+ | https://www.postgresql.org/download/ |
| Git | 最新版 | https://git-scm.com/downloads |

#### 前端环境

| 软件 | 版本要求 | 下载地址 |
|------|---------|---------|
| Node.js | 18+ | https://nodejs.org/ |
| npm | 9+ | 随 Node.js 一起安装 |

### 1.2 推荐工具

- **IDE**: VSCode / PyCharm / WebStorm
- **API 测试**: Postman / Insomnia
- **数据库管理**: pgAdmin / DBeaver
- **Git 客户端**: SourceTree / GitKraken

### 1.3 环境检查

```bash
# 检查 Python 版本
python --version
# 输出: Python 3.9.x 或更高

# 检查 Node.js 版本
node --version
# 输出: v18.x.x 或更高

# 检查 npm 版本
npm --version
# 输出: 9.x.x 或更高

# 检查 PostgreSQL
psql --version
# 输出: psql (PostgreSQL) 15.x 或更高
```

---

## 2. 后端启动

### 2.1 安装 Python 依赖

```bash
# 进入后端目录
cd backend

# (推荐) 创建虚拟环境
python -m venv venv

# 激活虚拟环境
# macOS / Linux:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt
```

### 2.2 配置数据库

#### 1. 创建数据库

```bash
# 使用 PostgreSQL 命令行工具
createdb fortune_bank_ops

# 或使用 psql
psql -U postgres
CREATE DATABASE fortune_bank_ops;
\q
```

#### 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，修改数据库连接信息
```

`.env` 文件示例：

```env
# 数据库配置
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/fortune_bank_ops

# JWT 配置
JWT_SECRET_KEY=change-this-secret-key-in-production
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30

# 应用配置
APP_NAME=Fortune Bank Operations Portal
APP_VERSION=1.0.0
DEBUG=True
```

#### 3. 初始化数据库

```bash
# 执行数据库迁移（创建表结构）
alembic upgrade head

# 初始化测试数据（测试账号和礼品数据）
python init_test_data.py
```

**预期输出**:

```
==================================================
初始化测试数据脚本
==================================================

开始初始化测试数据...
创建测试用户...
✓ 创建了 5 个测试用户
创建礼品数据...
✓ 创建了 5 个礼品
创建系统配置...
✓ 创建了 4 个系统配置
创建轮播图...
✓ 创建了 2 个轮播图
创建新闻...
✓ 创建了 2 条新闻

==================================================
测试数据初始化完成!
==================================================

测试账号:
  管理者: manager001 / password123
  运营人员: operations001 / password123
  审批人员: approver001 / password123
  客户经理: cm001 / password123
  客户经理: cm002 / password123
```

### 2.3 启动后端服务

#### 开发模式（支持热重载）

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**预期输出**:

```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [xxxxx] using StatReload
INFO:     Started server process [xxxxx]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

#### 生产模式

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### 2.4 验证后端服务

1. **访问 API 文档**

打开浏览器访问：http://localhost:8000/docs

2. **测试健康检查**

```bash
curl http://localhost:8000/docs
```

3. **测试登录 API**

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"cm001","password":"password123"}'
```

**预期响应**:

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "user_id": "USER...",
      "username": "cm001",
      "name": "赵六(客户经理)",
      "role": "CUSTOMER_MANAGER"
    }
  }
}
```

---

## 3. 前端启动

### 3.1 安装 Node.js 依赖

```bash
# 进入前端目录
cd frontend

# 安装依赖
npm install
```

### 3.2 配置环境变量

创建 `.env.development` 文件：

```bash
# 开发环境 API 地址
VITE_API_BASE_URL=http://localhost:8000

# 应用标题
VITE_APP_TITLE=招财银行运营门户
```

### 3.3 启动前端开发服务器

```bash
npm run dev
```

**预期输出**:

```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

### 3.4 验证前端服务

1. **访问前端应用**

打开浏览器访问：http://localhost:5173

2. **测试登录**

- 输入用户名：`cm001`
- 输入密码：`password123`
- 点击登录

3. **验证功能**

- 登录成功后应进入拜访记录列表页面
- 可以创建新的拜访记录
- 可以申请礼品

---

## 4. 测试验证

### 4.1 自动化测试

#### 运行后端 API 测试

```bash
# 确保后端服务正在运行
cd backend

# 运行拜访和礼品管理 API 测试
python test_visit_gift_apis.py
```

**预期输出**:

```
================================================================================
测试拜访管理和礼品管理 API
================================================================================

1. 登录系统...
   状态码: 200
   ✅ 登录成功, User ID: USER...

2. 创建拜访记录...
   状态码: 200
   ✅ 创建拜访记录成功, ID: VIS...

...（更多测试输出）

================================================================================
✅ 所有测试完成!
================================================================================
```

#### 运行全面测试

```bash
python test_comprehensive.py
```

**预期输出**:

```
================================================================================
招财银行北京分行运营门户系统 - P0 阶段全面测试
================================================================================

总测试用例: 31
通过: 25
失败: 6
通过率: 80.6%

✅ 测试报告已保存到: test_results.json
```

### 4.2 手功能测试

#### 测试流程 1: 客户经理创建拜访并申请礼品

1. **登录系统**
   - 用户名：`cm001`
   - 密码：`password123`

2. **创建拜访记录**
   - 进入"拜访管理"页面
   - 点击"新增拜访"
   - 填写表单：
     - 客户ID：`CUST001`
     - 公司名称：`测试科技有限公司`
     - 计划日期：`2026-01-20`
     - 拜访方式：`现场拜访`
     - 营销状态：`新拜访`
   - 点击"提交"

3. **申请礼品**
   - 进入"礼品管理" → "礼品申请"
   - 点击"新建申请"
   - 选择礼品：`茶叶礼盒`，数量：`2`
   - 选择目的类型：`客户拜访`
   - 关联拜访记录：选择刚创建的拜访
   - 点击"提交"

4. **查看申请状态**
   - 进入"我的申请"
   - 查看申请状态应为"待审批"

#### 测试流程 2: 审批人员审批礼品申请

1. **登录系统**
   - 用户名：`approver001`
   - 密码：`password123`

2. **查看待审批列表**
   - 进入"礼品管理" → "礼品审批"
   - 查看待审批的申请列表

3. **审批通过**
   - 选择一条待审批申请
   - 点击"审批通过"
   - 填写审批意见：`符合规定，同意发放`
   - 点击"提交"

4. **验证状态更新**
   - 申请人（`cm001`）再次登录
   - 查看"我的申请"
   - 申请状态应为"已通过"

#### 测试流程 3: 运营人员查看礼品台账

1. **登录系统**
   - 用户名：`operations001`
   - 密码：`password123`

2. **查看礼品台账**
   - 进入"礼品管理" → "礼品台账"
   - 查看所有已审批通过的礼品记录
   - 验证可以按礼品类型、时间区间筛选

---

## 5. 常见问题

### 5.1 后端问题

#### 问题 1: 数据库连接失败

**错误信息**:

```
sqlalchemy.exc.OperationalError: (psycopg2.OperationalError) could not connect to server
```

**解决方案**:

1. 检查 PostgreSQL 服务是否启动：
   ```bash
   # macOS
   brew services list
   brew services start postgresql

   # Linux
   sudo systemctl status postgresql
   sudo systemctl start postgresql

   # Windows
   # 在服务管理器中启动 PostgreSQL 服务
   ```

2. 检查 `.env` 文件中的数据库连接字符串是否正确：
   ```env
   DATABASE_URL=postgresql://postgres:your_password@localhost:5432/fortune_bank_ops
   ```

3. 确认数据库已创建：
   ```bash
   psql -U postgres -l | grep fortune_bank_ops
   ```

#### 问题 2: Alembic 迁移失败

**错误信息**:

```
alembic.util.exc.CommandError: Target database is not up to date
```

**解决方案**:

```bash
# 查看当前迁移版本
alembic current

# 查看迁移历史
alembic history

# 重置数据库（谨慎操作，会删除所有数据）
alembic downgrade base
alembic upgrade head

# 重新初始化测试数据
python init_test_data.py
```

#### 问题 3: JWT Token 验证失败

**错误信息**:

```
Detail: "invalid or expired token"
```

**解决方案**:

1. 检查 `.env` 文件中的 `JWT_SECRET_KEY` 是否设置
2. 重新登录获取新的 token
3. 检查 token 是否过期（默认 30 分钟）

```bash
# 修改 token 有效期（.env 文件）
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60
```

#### 问题 4: 端口被占用

**错误信息**:

```
OSError: [Errno 48] Address already in use
```

**解决方案**:

```bash
# 查找占用 8000 端口的进程
lsof -i :8000

# 终止进程
kill -9 <PID>

# 或使用其他端口
uvicorn app.main:app --port 8001
```

### 5.2 前端问题

#### 问题 1: npm install 失败

**错误信息**:

```
npm ERR! code ERESOLVE
```

**解决方案**:

```bash
# 清除 npm 缓存
npm cache clean --force

# 删除 node_modules 和 package-lock.json
rm -rf node_modules package-lock.json

# 重新安装
npm install
```

#### 问题 2: API 请求失败（CORS 错误）

**错误信息**:

```
Access to XMLHttpRequest at 'http://localhost:8000' has been blocked by CORS policy
```

**解决方案**:

1. 检查后端是否允许 CORS（已配置）
2. 检查前端 `.env` 文件中的 `VITE_API_BASE_URL` 是否正确
3. 确保后端服务正在运行

#### 问题 3: 页面刷新后 404

**问题描述**: 刷新页面时显示 404 Not Found

**解决方案**:

这是 Vite 开发服务器的正常行为，生产环境不会有这个问题。如需解决：

1. 配置 Vite History API Fallback
2. 或使用 `HashRouter` 替代 `BrowserRouter`

#### 问题 4: 构建失败

**错误信息**:

```
TypeError: Cannot read properties of undefined
```

**解决方案**:

```bash
# 检查 TypeScript 类型错误
npm run type-check

# 修复 ESLint 错误
npm run lint

# 清除构建缓存
rm -rf dist
npm run build
```

### 5.3 数据库问题

#### 问题 1: 数据库权限不足

**错误信息**:

```
Permission denied for database fortune_bank_ops
```

**解决方案**:

```bash
# 使用 psql 授予权限
psql -U postgres
GRANT ALL PRIVILEGES ON DATABASE fortune_bank_ops TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
```

#### 问题 2: 表已存在

**错误信息**:

```
Relation "users" already exists
```

**解决方案**:

```bash
# 方案 1: 删除所有表重新创建
psql -U postgres -d fortune_bank_ops
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
\q

# 重新执行迁移
alembic upgrade head
```

---

## 6. 测试账号

### 6.1 账号清单

| 角色 | 用户名 | 密码 | 姓名 | 权限 |
|------|--------|------|------|------|
| 管理员 | manager001 | password123 | 张三(管理者) | 全部权限 |
| 运营人员 | operations001 | password123 | 李四(运营) | 查看台账、统计 |
| 审批人员 | approver001 | password123 | 王五(审批) | 审批礼品申请 |
| 客户经理 | cm001 | password123 | 赵六(客户经理) | 创建拜访、申请礼品 |
| 客户经理 | cm002 | password123 | 孙七(客户经理) | 创建拜访、申请礼品 |

### 6.2 角色说明

#### 管理员 (MANAGER)

- 查看所有拜访记录
- 查看所有礼品申请
- 查看礼品台账
- 审批礼品申请
- 查看运营数据统计（待实现）

#### 运营人员 (OPERATIONS)

- 查看所有拜访记录
- 查看所有礼品申请
- 查看礼品台账
- 查看运营数据统计（待实现）

#### 审批人员 (APPROVER)

- 查看所有礼品申请
- 审批礼品申请（通过/驳回）
- 查看审批历史

#### 客户经理 (CUSTOMER_MANAGER)

- 创建拜访记录
- 查看自己的拜访记录
- 编辑自己的拜访记录
- 提交礼品申请
- 查看自己的礼品申请

### 6.3 使用建议

**学习测试**:
- 使用 `cm001` 测试拜访管理和礼品申请流程
- 使用 `approver001` 测试审批流程
- 使用 `operations001` 测试台账查看功能
- 使用 `manager001` 测试管理员权限

**数据隔离测试**:
- 使用 `cm001` 创建拜访记录
- 登出后使用 `cm002` 登录，验证无法看到 `cm001` 的记录（当前未实现）

---

## 7. 开发指南

### 7.1 后端开发

#### 目录结构

```
backend/
├── app/
│   ├── api/v1/          # API 路由
│   ├── core/            # 核心配置
│   ├── models/          # 数据模型
│   ├── schemas/         # Pydantic 模型
│   ├── services/        # 业务逻辑
│   └── crud/            # 数据库操作
├── alembic/             # 数据库迁移
├── tests/               # 测试
└── main.py              # 应用入口
```

#### 添加新的 API 端点

1. 在 `app/schemas/` 中定义请求/响应模型
2. 在 `app/services/` 中实现业务逻辑
3. 在 `app/api/v1/` 中添加路由
4. 在 `app/main.py` 中注册路由

#### 数据库迁移

```bash
# 创建新的迁移
alembic revision --autogenerate -m "描述"

# 执行迁移
alembic upgrade head

# 回滚迁移
alembic downgrade -1
```

### 7.2 前端开发

#### 目录结构

```
frontend/
├── src/
│   ├── api/             # API 调用
│   ├── components/      # 公共组件
│   ├── pages/           # 页面组件
│   ├── stores/          # 状态管理
│   ├── types/           # TypeScript 类型
│   ├── utils/           # 工具函数
│   ├── App.tsx          # 应用根组件
│   └── main.tsx         # 应用入口
└── public/              # 静态资源
```

#### 添加新页面

1. 在 `src/pages/` 中创建页面组件
2. 在 `src/api/` 中添加 API 调用
3. 在 `src/App.tsx` 中添加路由
4. 在菜单中添加入口

#### API 调用示例

```typescript
import { api } from '@/api/request';

// 登录
export const login = (username: string, password: string) => {
  return api.post('/api/v1/auth/login', { username, password });
};

// 获取拜访列表
export const getVisits = (params: any) => {
  return api.get('/api/v1/visits', { params });
};
```

### 7.3 代码规范

#### Python 代码规范

- 遵循 PEP 8 规范
- 使用 Type Hints
- 编写 Docstring
- 单元测试覆盖率 > 60%

```python
from typing import List
from fastapi import APIRouter, Depends

router = APIRouter()

@router.get("/visits", summary="查询拜访记录")
async def list_visits(
    page: int = 1,
    current_user: User = Depends(get_current_user)
) -> PaginatedResponse[VisitResponse]:
    """
    查询拜访记录列表

    Args:
        page: 页码
        current_user: 当前登录用户

    Returns:
        分页的拜访记录列表
    """
    pass
```

#### TypeScript 代码规范

- 使用 ESLint + Prettier
- 优先使用函数式组件
- 使用 TypeScript 类型声明
- 避免使用 any 类型

```typescript
interface Visit {
  visit_id: string;
  company_name: string;
  planned_date: string;
}

export const VisitList: React.FC = () => {
  const [visits, setVisits] = useState<Visit[]>([]);

  useEffect(() => {
    fetchVisits().then(setVisits);
  }, []);

  return <div>{/* ... */}</div>;
};
```

### 7.4 调试技巧

#### 后端调试

```bash
# 使用 Python 调试器
python -m pdb app/main.py

# 使用 VSCode 调试
# 在 VSCode 中配置 launch.json
```

#### 前端调试

```bash
# 使用 Chrome DevTools
# 在浏览器中按 F12

# 使用 React Developer Tools
# 安装 Chrome 扩展：React Developer Tools
```

---

## 8. 获取帮助

### 8.1 文档资源

- **API 文档**: http://localhost:8000/docs
- **测试报告**: `/05-implementation/P0-TEST-REPORT.md`
- **交付报告**: `/05-implementation/P0-FINAL-DELIVERY.md`
- **API 规范**: `/04-technical-design/api-contracts/api-guidelines.md`

### 8.2 常用命令速查

```bash
# 后端
cd backend
pip install -r requirements.txt          # 安装依赖
alembic upgrade head                       # 数据库迁移
python init_test_data.py                  # 初始化测试数据
uvicorn app.main:app --reload            # 启动开发服务器
python test_comprehensive.py              # 运行测试

# 前端
cd frontend
npm install                                # 安装依赖
npm run dev                                # 启动开发服务器
npm run build                              # 构建生产版本
npm run lint                               # 代码检查

# 数据库
psql -U postgres -d fortune_bank_ops     # 连接数据库
\dt                                        # 查看所有表
\du                                        # 查看所有用户
```

### 8.3 问题反馈

如遇到问题，请按以下步骤操作：

1. 查看本文档的"常见问题"部分
2. 查看相关文档和测试报告
3. 检查日志文件（后端：`server.log`）
4. 联系技术支持团队

---

## 附录

### A. 端口占用说明

| 服务 | 默认端口 | 说明 |
|------|---------|------|
| 后端 API | 8000 | FastAPI 服务 |
| 前端开发服务器 | 5173 | Vite 开发服务器 |
| PostgreSQL | 5432 | 数据库 |

### B. 文件说明

| 文件/目录 | 说明 |
|----------|------|
| `backend/.env` | 后端环境变量配置 |
| `backend/requirements.txt` | Python 依赖清单 |
| `backend/init_test_data.py` | 测试数据初始化脚本 |
| `backend/test_*.py` | 测试脚本 |
| `frontend/package.json` | Node 依赖清单 |
| `frontend/.env.development` | 前端开发环境配置 |

### C. 快捷键

| 操作 | 快捷键 |
|------|--------|
| 停止服务 | Ctrl + C |
| 清屏 | Cmd + K (macOS) / Ctrl + L (Windows) |
| 退出 psql | \q |

---

**文档更新时间**: 2026-01-08
**文档版本**: v1.0
**维护人**: Test Engineer Subagent
