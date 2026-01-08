# 部署架构

**文档版本**: v1.0
**创建时间**: 2026-01-08
**负责人**: 系统架构师
**关联文档**: system-overview.md, security-architecture.md, 技术/环境&配置.md

---

## 文档说明

本文档定义"招财银行北京分行运营门户系统"的部署架构，包括开发环境配置、生产环境配置、环境变量管理、Docker 化建议和部署流程。

---

## 1. 部署架构总览

### 1.1 开发环境部署

```
┌────────────────────────────────────────────────────────────┐
│                    开发机 (Developer Machine)               │
│                                                             │
│  ┌─────────────────┐     ┌─────────────────┐               │
│  │   前端开发服务器  │     │   后端开发服务器  │               │
│  │   (Vite Dev)    │     │   (Uvicorn)     │               │
│  │   Port: 5173    │     │   Port: 8000    │               │
│  └─────────────────┘     └─────────────────┘               │
│          │                       │                         │
│          │                       │                         │
│          └───────────┬───────────┘                         │
│                      ▼                                     │
│  ┌─────────────────────────────────────────┐               │
│  │        本地 MySQL 数据库 (Docker)        │               │
│  │        Host: 127.0.0.1 Port: 3306       │               │
│  └─────────────────────────────────────────┘               │
└────────────────────────────────────────────────────────────┘
```

### 1.2 生产环境部署建议

```
┌────────────────────────────────────────────────────────────┐
│                       生产服务器                             │
│                                                             │
│  ┌───────────────────────────────────────────────────┐     │
│  │              Nginx (反向代理 + 静态资源)            │     │
│  │              Port: 80 / 443                       │     │
│  └───────────────────────────────────────────────────┘     │
│          │                       │                         │
│    静态资源                    API 代理                     │
│          │                       │                         │
│          ▼                       ▼                         │
│  ┌─────────────────┐     ┌─────────────────┐               │
│  │  前端静态资源    │     │  后端应用服务    │               │
│  │  (build/dist)   │     │  (Uvicorn)      │               │
│  └─────────────────┘     │  Port: 8000     │               │
│                          └─────────────────┘               │
│                                  │                         │
│                                  ▼                         │
│  ┌─────────────────────────────────────────┐               │
│  │        MySQL 数据库 (独立服务器)         │               │
│  │        Host: db.internal Port: 3306     │               │
│  └─────────────────────────────────────────┘               │
│                                                             │
│  ┌─────────────────────────────────────────┐               │
│  │        外部服务: 火山引擎 LLM API         │               │
│  │        (公网 HTTPS)                      │               │
│  └─────────────────────────────────────────┘               │
└────────────────────────────────────────────────────────────┘
```

---

## 2. 开发环境配置

### 2.1 前端开发环境

**目录结构**:
```
frontend/
├── .env.development          # 开发环境变量
├── package.json
├── vite.config.ts
└── src/
```

**环境变量** (.env.development):
```bash
# API 地址
VITE_API_BASE_URL=http://localhost:8000

# 其他配置
VITE_APP_TITLE=招财银行运营门户
```

**启动命令**:
```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 访问地址
# 前端: http://localhost:5173
# 后端: http://localhost:8000
# Swagger: http://localhost:8000/docs
```

### 2.2 后端开发环境

**目录结构**:
```
backend/
├── .env                       # 环境变量
├── requirements.txt
├── main.py
└── alembic/                   # 数据库迁移
```

**环境变量** (.env):
```bash
# 数据库
DB_TYPE=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=zero_one
DB_CHARSET=utf8mb4
DB_USER=root
DB_PASSWORD=99912345

# JWT
JWT_SECRET_KEY=zero-one-test
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=120

# LLM
LLM_API_BASE=https://ark.cn-beijing.volces.com/api/v3
LLM_API_KEY=d96aede4-f372-46c6-bde7-e98af9ac583b
LLM_MODEL_NAME=d96aede4-f372-46c6-bde7-e98af9ac583b
LLM_TEMPERATURE=0.5
LLM_MAX_TOKENS=65535
LLM_STREAM=TRUE
LLM_API_TIMEOUT=60
```

**启动命令**:
```bash
# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

# 安装依赖
pip install -r requirements.txt

# 初始化数据库
alembic upgrade head

# 启动开发服务器（热重载）
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2.3 数据库启动 (Docker)

**docker-compose.yml**:
```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    container_name: zero_one_mysql
    environment:
      MYSQL_ROOT_PASSWORD: 99912345
      MYSQL_DATABASE: zero_one
      MYSQL_CHARSET: utf8mb4
      MYSQL_COLLATION: utf8mb4_unicode_ci
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    command: --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci

volumes:
  mysql_data:
```

**启动命令**:
```bash
# 启动 MySQL
docker-compose up -d

# 查看日志
docker-compose logs -f mysql

# 停止 MySQL
docker-compose down
```

---

## 3. 生产环境配置

### 3.1 前端生产部署

**打包命令**:
```bash
# 构建生产版本
npm run build

# 输出目录: dist/
```

**Nginx 配置**:
```nginx
server {
    listen 80;
    server_name app.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name app.example.com;

    # SSL 证书
    ssl_certificate /etc/letsencrypt/live/app.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    # 静态资源
    location / {
        root /var/www/zero-one-frontend/dist;
        try_files $uri $uri/ /index.html;

        # 缓存策略
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

**部署流程**:
```bash
# 1. 构建前端
npm run build

# 2. 上传到服务器
scp -r dist/* user@server:/var/www/zero-one-frontend/dist/

# 3. 重启 Nginx
sudo nginx -s reload
```

### 3.2 后端生产部署

**Systemd 服务配置**:
```ini
# /etc/systemd/system/zero-one-backend.service

[Unit]
Description=Zero One Backend API
After=network.target mysql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/zero-one-backend
Environment="PATH=/var/www/zero-one-backend/venv/bin"
ExecStart=/var/www/zero-one-backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**启动命令**:
```bash
# 1. 创建虚拟环境并安装依赖
cd /var/www/zero-one-backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 2. 配置环境变量 (.env.production)
# 复制 .env.example 并修改配置

# 3. 运行数据库迁移
alembic upgrade head

# 4. 启动服务
sudo systemctl start zero-one-backend
sudo systemctl enable zero-one-backend

# 5. 查看日志
sudo journalctl -u zero-one-backend -f
```

**Nginx 反向代理配置**:
```nginx
upstream backend {
    server 127.0.0.1:8000;
}

server {
    listen 443 ssl http2;
    server_name api.example.com;

    # SSL 证书
    ssl_certificate /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;

    # API 代理
    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 超时配置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 文件上传大小限制
    client_max_body_size 10M;
}
```

### 3.3 数据库生产部署

**独立数据库服务器**（推荐）:
- 使用云数据库（如阿里云 RDS、腾讯云 MySQL）
- 或自建 MySQL 服务器

**配置建议**:
```ini
[mysqld]
# 字符集
character-set-server=utf8mb4
collation-server=utf8mb4_unicode_ci

# 连接数
max_connections=200

# 缓冲区大小
innodb_buffer_pool_size=1G

# 日志
slow_query_log=1
slow_query_log_file=/var/log/mysql/slow.log
long_query_time=2
```

**备份策略**:
```bash
# 全量备份脚本 (每天凌晨 2 点)
0 2 * * * mysqldump -u root -p --single-transaction --routines --triggers zero_one > /backup/zero_one_$(date +\%Y\%m\%d).sql
```

---

## 4. 环境变量管理

### 4.1 环境变量文件

| 文件 | 用途 | 是否提交到 Git |
| --- | --- | --- |
| `.env` | 本地开发环境 | 否 |
| `.env.development` | 前端开发环境 | 是（可包含默认值） |
| `.env.production` | 前端生产环境 | 否（敏感信息） |
| `.env.example` | 环境变量模板 | 是 |

### 4.2 环境变量优先级

```
1. 系统环境变量
2. .env 文件
3. 代码默认值
```

### 4.3 前端环境变量

**.env.development**:
```bash
VITE_API_BASE_URL=http://localhost:8000
VITE_APP_TITLE=招财银行运营门户（开发）
```

**.env.production**:
```bash
VITE_API_BASE_URL=https://api.example.com
VITE_APP_TITLE=招财银行运营门户
```

### 4.4 后端环境变量

**.env.example**:
```bash
# 数据库
DB_HOST=localhost
DB_PORT=3306
DB_NAME=zero_one
DB_USER=root
DB_PASSWORD=your-password

# JWT
JWT_SECRET_KEY=your-secret-key
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=120

# LLM
LLM_API_BASE=https://ark.cn-beijing.volces.com/api/v3
LLM_API_KEY=your-api-key
LLM_MODEL_NAME=your-model-name
```

**生产环境 .env** (不提交到 Git):
```bash
DB_HOST=db.internal
DB_PASSWORD=StrongPassword123!
JWT_SECRET_KEY=<强随机密钥>
LLM_API_KEY=<生产环境 API Key>
```

---

## 5. Docker 化部署（可选）

### 5.1 前端 Dockerfile

```dockerfile
# frontend/Dockerfile

FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 5.2 后端 Dockerfile

```dockerfile
# backend/Dockerfile

FROM python:3.10-slim

WORKDIR /app

# 安装依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制代码
COPY . .

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 5.3 Docker Compose

```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_PASSWORD}
      MYSQL_DATABASE: zero_one
      MYSQL_CHARSET: utf8mb4
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DB_HOST=mysql
      - DB_PASSWORD=${DB_PASSWORD}
      - JWT_SECRET_KEY=${JWT_SECRET_KEY}
    depends_on:
      - mysql

  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  mysql_data:
```

**启动命令**:
```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

---

## 6. CI/CD 流程（可选）

### 6.1 GitHub Actions 示例

```yaml
# .github/workflows/deploy.yml

name: Deploy to Production

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Deploy Backend
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /var/www/zero-one-backend
            git pull origin main
            source venv/bin/activate
            pip install -r requirements.txt
            alembic upgrade head
            sudo systemctl restart zero-one-backend

      - name: Deploy Frontend
        run: |
          cd frontend
          npm install
          npm run build
          scp -r dist/* ${{ secrets.SERVER_USER }}@${{ secrets.SERVER_HOST }}:/var/www/zero-one-frontend/dist/
          ssh ${{ secrets.SERVER_USER }}@${{ secrets.SERVER_HOST }} "sudo nginx -s reload"
```

---

## 7. 部署检查清单

### 7.1 部署前检查

- [ ] 环境变量已正确配置
- [ ] 数据库连接正常
- [ ] 数据库迁移脚本已执行
- [ ] SSL 证书已配置
- [ ] 防火墙规则已设置
- [ ] JWT_SECRET_KEY 已更换为强随机密钥
- [ ] 数据库密码强度足够

### 7.2 部署后验证

- [ ] 前端页面可访问
- [ ] 后端 API 可访问
- [ ] 登录功能正常
- [ ] Swagger 文档可访问
- [ ] 数据库连接正常
- [ ] 日志正常输出
- [ ] 监控指标正常

---

## 8. 运维建议

### 8.1 日志管理

**前端日志**:
- 浏览器控制台
- 前端错误上报（可选，如 Sentry）

**后端日志**:
```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/zero-one-backend/app.log'),
        logging.StreamHandler()
    ]
)
```

**日志轮转** (logrotate):
```bash
/var/log/zero-one-backend/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
}
```

### 8.2 监控告警（可选）

**监控指标**:
- API 响应时间
- 错误率
- 数据库连接数
- 服务器 CPU/内存使用率

**告警方式**:
- 邮件告警
- 钉钉/企业微信告警

---

## 9. 待确认事项

1. **部署方式**:
   - 是否使用 Docker 容器化部署
   - 是否使用 Kubernetes 编排

2. **CI/CD**:
   - 是否需要自动化部署流程
   - 是否需要多环境部署（开发/测试/生产）

3. **监控告警**:
   - 是否需要接入监控系统（如 Prometheus + Grafana）
   - 是否需要日志集中存储（如 ELK）

4. **高可用**:
   - 是否需要负载均衡
   - 是否需要数据库主从复制

5. **备份策略**:
   - 数据库备份周期
   - 备份保留时间
   - 异地备份

---

**文档变更记录**:
- v1.0 (2026-01-08): 初始版本，定义部署架构
