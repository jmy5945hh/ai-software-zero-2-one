# Agent Server

独立的后台 Agent 服务，提供 WebSocket 和 HTTP API。

## 开发

```bash
# 直接运行（tsx 热加载）
npm run dev:agent

# 或从项目根目录
npm run dev
```

## 构建

```bash
# 仅编译 TypeScript → dist/server/
npm run build:server

# 编译 + 打包为 dist/server.tar.gz
npm run package:server
```

## 部署运行

```bash
# 1. 解压
tar xzf server.tar.gz

# 2. 进入 server 目录
cd server

# 3. 安装生产依赖
npm install --production

# 4. 启动（方式一：环境变量）
AGENT_SECRET=your_secret DEEPSEEK_API_KEY=your_key node index.js

# 或方式二：使用 .env 文件
echo "AGENT_SECRET=your_secret" >> .env
echo "DEEPSEEK_API_KEY=your_key" >> .env
node index.js
```

## 环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `DEEPSEEK_API_KEY` | 是 | LLM API 密钥 |
| `AGENT_SECRET` | 否 | WebSocket 连接认证 Token（不设置则不校验） |
| `AGENT_PORT` | 否 | 监听端口，默认 `3100` |

## 端口

默认 `3100`，健康检查：`http://localhost:3100/health`
