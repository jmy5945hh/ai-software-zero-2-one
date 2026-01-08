# 快速开始指南

## 5 分钟快速启动

### 步骤 1: 安装依赖 (1 分钟)

```bash
cd /Users/jingmengyuan/code/for-cc-and-glm/ai-software-zero-2-one/agent-workspace/05-implementation/backend
pip install -r requirements.txt
```

### 步骤 2: 配置环境 (1 分钟)

```bash
cp .env.example .env
```

编辑 `.env` 文件,修改数据库密码:

```bash
DB_PASSWORD=your-password
```

### 步骤 3: 创建数据库 (1 分钟)

```bash
mysql -u root -p
CREATE DATABASE zero_one CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
```

### 步骤 4: 运行迁移 (1 分钟)

```bash
alembic upgrade head
```

### 步骤 5: 初始化测试数据 (可选, 30 秒)

```bash
python init_test_data.py
```

### 步骤 6: 启动服务 (30 秒)

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

或使用启动脚本:

```bash
./start.sh
```

### 步骤 7: 访问文档

打开浏览器访问:

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

---

## 测试登录

### 方式 1: 使用 Swagger UI

1. 访问 http://localhost:8000/docs
2. 找到 `POST /api/v1/auth/login`
3. 点击 "Try it out"
4. 输入测试账号:
   ```json
   {
     "username": "manager001",
     "password": "password123"
   }
   ```
5. 点击 "Execute"
6. 复制返回的 `access_token`
7. 点击页面右上角的 "Authorize" 按钮
8. 输入 `Bearer <your_token>` (注意 Bearer 后面有空格)
9. 现在可以测试其他需要认证的接口

### 方式 2: 使用测试脚本

```bash
python test_auth.py
```

### 方式 3: 使用 curl

```bash
# 登录
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"manager001","password":"password123"}'

# 获取用户信息(替换 YOUR_TOKEN)
curl -X GET "http://localhost:8000/api/v1/auth/me" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 测试账号

| 账号 | 密码 | 角色 |
|------|------|------|
| manager001 | password123 | MANAGER (管理者) |
| operations001 | password123 | OPERATIONS (运营人员) |
| approver001 | password123 | APPROVER (审批人员) |
| cm001 | password123 | CUSTOMER_MANAGER (客户经理) |
| cm002 | password123 | CUSTOMER_MANAGER (客户经理) |

---

## 常见问题

### Q: 数据库连接失败?

A: 检查以下几点:

1. MySQL 服务是否启动
2. `.env` 文件中的数据库配置是否正确
3. 数据库 `zero_one` 是否已创建

### Q: Alembic 迁移失败?

A: 确保已创建数据库:

```sql
CREATE DATABASE zero_one CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### Q: 登录失败?

A: 确保:

1. 已运行 `python init_test_data.py` 初始化测试数据
2. 用户名和密码正确(见上方测试账号列表)
3. 用户状态为 ACTIVE

---

## 项目结构速览

```
backend/
├── app/
│   ├── api/v1/auth.py       # 认证 API
│   ├── core/               # 核心模块(配置、安全、依赖注入)
│   ├── models/             # 数据库模型(8 张表)
│   ├── schemas/            # Pydantic 数据模型
│   ├── crud/               # 数据访问层
│   ├── services/           # 业务逻辑层
│   └── db/                 # 数据库连接
├── alembic/                # 数据库迁移
├── init_test_data.py       # 初始化测试数据
├── test_auth.py            # 测试脚本
└── README.md               # 详细文档
```

---

## 下一步

- 阅读完整文档: `README.md`
- 查看开发文档: `DEVELOPMENT.md`
- 查看 API 文档: http://localhost:8000/docs

---

**需要帮助?**

- 查看 `README.md` - 完整项目文档
- 查看 `DEVELOPMENT.md` - 开发指南
- 查看项目总结: `PROJECT_SUMMARY.md`
