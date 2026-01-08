# 后端 API 路径说明

## 问题

前端代码中定义的 API 路径与后端实际路径不一致：

- 前端：`/api/v1/auth/login`
- 后端：`/api/v1/login`

## 已解决

已修改前端代码以匹配后端实际路径：

| 功能 | 前端原路径 | 前端新路径 | 后端实际路径 |
|------|-----------|-----------|-------------|
| 登录 | `/api/v1/auth/login` | `/api/v1/login` | `/api/v1/login` ✅ |
| 获取当前用户 | `/api/v1/auth/me` | `/api/v1/me` | `/api/v1/me` ✅ |
| 更新用户信息 | `/api/v1/auth/me` | `/api/v1/me` | `/api/v1/me` ✅ |

## 后端可用的认证相关 API

- `POST /api/v1/login` - 用户登录
- `GET /api/v1/me` - 获取当前用户信息
- `PUT /api/v1/me` - 更新当前用户信息
- `PUT /api/v1/me/password` - 修改密码

## 测试命令

```bash
# 测试登录
curl -X POST 'http://localhost:8000/api/v1/login' \
  -H 'Content-Type: application/json' \
  -d '{"username":"manager001","password":"password123"}'
```

## 已知问题

后端返回 500 Internal Server Error，可能原因：
- 密码验证逻辑问题
- 数据库查询问题
- AuthService 依赖缺失

需要进一步调试后端代码。
