# 火山引擎云 VM 部署指南

将 Zero-One Agent Server 部署到火山引擎公有云虚拟机，实现前端-后端完全分离。

---

## 一、创建云 VM

1. 登录 [火山引擎控制台](https://console.volcengine.com/)
2. **ECS → 创建实例**
   - 地域：选择离你最近的（如北京、上海）
   - 镜像：**Ubuntu 22.04 LTS** 或 Debian 12
   - 规格：2C4G 起步（DeepSeek API 不走本地算力，够用）
   - 网络：分配**公网 IPv4 地址**
3. 安全组 → 添加入方向规则：
   - 协议：**TCP**，端口：**3100**，来源：`0.0.0.0/0`
4. 创建后记下 **公网 IP**，如 `123.45.67.89`

---

## 二、环境安装

SSH 登录云 VM 后执行：

```bash
# 1. 安装 Node.js 22+
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs rsync

# 验证
node -v  # 应显示 v22.x.x
npm -v

# 2. 安装进程守护 PM2
sudo npm install -g pm2
```

---

## 三、项目部署

```bash
# 1. 克隆项目（或上传代码）
git clone <your-repo-url> /opt/zero-one-software
cd /opt/zero-one-software

# 2. 安装依赖
npm install

# 3. 配置 API Key
export DEEPSEEK_API_KEY="sk-your-deepseek-api-key"

# 4. 启动 Agent Server（使用 PM2）
pm2 start npm --name "agent-server" -- run dev:agent

# 5. 设置为开机自启
pm2 save
pm2 startup  # 按提示执行输出的 sudo 命令
```

---

## 四、验证部署

从任意位置验证后端是否正常运行：

```bash
# HTTP 健康检查
curl http://47.108.128.71:3100/health
# 应返回: {"status":"ok","timestamp":1716710400000}

# WebSocket 连通性（可选）
wscat -c ws://47.108.128.71:3100/agent
# 连接成功后发送: {"type":"ping","ts":1716710400000}
# 应收到: {"type":"pong","ts":1716710400000}
```

---

## 五、本地前端直连云 VM

1. 在项目根目录创建 `.env` 文件：

```bash
# 将 123.45.67.89 替换为你的云 VM 公网 IP
VITE_AGENT_WS_URL=ws://47.108.128.71:3100/agent
```

2. 启动前端（不启动本地 Agent）：

```bash
npm run dev:ui
```

3. 打开浏览器访问 `http://localhost:5173`，前端会自动连接云 VM 上的 Agent。

---

## 六、验证前后端分离效果

| 验证项 | 方法 |
|--------|------|
| 前端 UI 正常渲染 | 打开 localhost:5173 |
| 创建任务后 Agent 开始工作 | 观察控制台和 UI 中的 streaming 响应 |
| 前端网络请求指向云 VM | 打开浏览器 DevTools → Network → WS，确认连接地址是 `ws://云VM公网IP:3100/agent` |

如果一切正常，说明前后端已完全解耦——你的本地电脑是**纯客户端**，所有 Agent 计算都在云端完成。

---

## 七、日常运维

```bash
# 查看 Agent 日志
pm2 logs agent-server

# 重启服务
pm2 restart agent-server

# 停止服务
pm2 stop agent-server

# 查看服务状态
pm2 status
```

---

## 附：常见问题

**Q: 连接不上怎么办？**
1. 确认安全组已开放 TCP 3100 端口
2. `curl http://云IP:3100/health` 确认后端在线
3. 检查负载均衡/防火墙是否拦截 WebSocket（某些云厂商默认关闭 WebSocket 长连接）

**Q: 如何配置 HTTPS / WSS？**
原型阶段可直接用 `ws://`。生产化时建议在前面加 Nginx 反向代理 + Let's Encrypt 证书。WebSocket 升级配置示例：
```nginx
location /agent {
    proxy_pass http://127.0.0.1:3100;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

**Q: 多前端能同时连接吗？**
可以。Agent Server 支持多 WebSocket 连接，每个 task+step 组合有独立 Session。
