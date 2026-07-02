# Server 离线部署

## 打包

```bash
npm run package:server
```

输出：`dist/server.tar.gz`

包含：
- `server/` — 编译后的 server 代码（JS + 类型声明 + sourcemap）
- `package.json` + `package-lock.json` — 依赖清单
- `node_modules/` — 生产依赖（已安装好，离线可用）

## 部署

```bash
# 解压到目标目录
tar xzf server.tar.gz -C /opt/myapp/

# 配置环境变量
export AGENT_PORT=3100
export AGENT_SECRET=your-secret
export DEEPSEEK_API_KEY=sk-xxx

# 启动
node /opt/myapp/server/index.js
```

## 环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `DEEPSEEK_API_KEY` | 是 | DeepSeek API 密钥 |
| `AGENT_SECRET` | 推荐 | WebSocket 认证密钥 |
| `AGENT_PORT` | 否 | 监听端口，默认 3100 |

## 注意事项

- 打包时 `npm install --production` 只安装 `dependencies`（不含 `devDependencies`）
- 目标机器需要 Node.js 18+ 运行环境
- `models.json` 已包含在包内，如需修改模型配置直接编辑即可
