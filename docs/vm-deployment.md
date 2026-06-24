# VM 部署指南

## 架构

```
浏览器 ──80──▶ nginx ──┬── /            ──▶ 静态文件 (dist/)
                       ├── /agent       ──▶ Agent Server (3100) [WebSocket]
                       └── /session/*   ──▶ Agent Server (3100) [HTTP API]
```

前端和 agent server 共享同一个公网 origin（`http://47.108.128.71`），
前端代码自动使用 `window.location.host` 构造 WebSocket URL，无需硬编码 IP。

## 前置条件

- Node.js 18+
- nginx

## 手动部署

### 1. 服务器准备

```bash
# 安装 nginx + node
apt update && apt install -y nginx nodejs npm

# 开放 80 端口（阿里云安全组也要放行）
```

### 2. 上传代码

```bash
# 在本地
npm run build
scp -r dist/ root@47.108.128.71:/var/www/zero-one/
scp deploy/nginx.conf root@47.108.128.71:/etc/nginx/conf.d/zero-one.conf
scp -r . server/ package.json tsconfig*.json root@47.108.128.71:/opt/zero-one/
```

### 3. 服务器配置

```bash
# SSH 到服务器
ssh root@47.108.128.71

# 安装依赖
cd /opt/zero-one
npm install

# 启动 Agent Server
nohup npx tsx server/index.ts > /var/log/agent.log 2>&1 &

# 配置 nginx
nginx -t && systemctl restart nginx
```

### 4. 验证

```bash
# 健康检查
curl http://47.108.128.71/health

# 浏览器打开
open http://47.108.128.71
```

## 一键部署

```bash
bash deploy/setup.sh
```

## 开发环境

本地开发不需要 nginx，直接：

```bash
npm run dev  # Vite dev server (5173) + Agent (3100) 同时启动
```

如需指定 agent 地址，在 `.env` 中设置：

```bash
VITE_LOCAL_AGENT_WS_URL=ws://localhost:3100/agent
```

## 常见问题

### WebSocket 连接失败

检查 nginx WebSocket upgrade 配置是否正确（`proxy_http_version 1.1` + `Upgrade` 头）。

### 403 / 权限错误

确认 `AGENT_SECRET` 环境变量已设置且前后端一致。

### 端口被占用

```bash
lsof -i :80    # 检查 80 端口
lsof -i :3100  # 检查 agent 端口
```
