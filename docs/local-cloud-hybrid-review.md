
### 当前架构总览

```
┌──────────────────────────────────────────────────────────┐
│  浏览器 (static/*.js)                                      │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ api() → new URL(path, document.baseURI)              │ │
│  │ 始终连接同源服务器（即提供 HTML 的那个 server.py）      │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────┬───────────────────────────────────┘
                       │ HTTP (同源)
┌──────────────────────▼───────────────────────────────────┐
│  WebUI server.py (端口 8787)                              │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ _run_agent_streaming() 直接 import run_agent.AIAgent │ │
│  │ 在进程内创建 AIAgent 实例，同步执行                     │ │
│  └─────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ 备选: gateway_chat.py → HTTP 到 Hermes Gateway       │ │
│  │ (需显式设置 HERMES_WEBUI_CHAT_BACKEND=gateway)        │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

**核心问题：WebUI 和 Agent Runtime 是同一个 Python 进程**（默认模式），通过直接 `import` 耦合。

---

### 当前 2×2 支持情况

|  | Agent Runtime 本地 | Agent Runtime 云端 |
|---|---|---|
| **Web 本地** | ✅ 默认进程内模式 | ⚠️ Gateway 代理模式（实验性） |
| **Web 云端** | ❌ **不支持** | ⚠️ 同属云端 = 退化为本地模式 |

**具体问题：**

1. **Web 云端 → Agent 本地不可行**：浏览器前端只能连接同源（`document.baseURI`），无法跨越公网连接到用户本地的 Agent Runtime
2. **Agent 云端 → Web 本地也不完整**：Gateway 模式只覆盖了聊天流式传输（`/v1/chat/completions`），不覆盖文件操作、审批、工作空间管理等
3. **前端无 Agent 端点配置能力**：`workspace.js` 中的 `api()` 函数硬编码为相对路径

---

### 当前已有的解耦基础（可利用）

好消息是项目已经在做相关解耦工作：

1. **`RuntimeAdapter` 接缝**（RFC #1925）：定义了 `start_run` / `observe_run` / `cancel_run` 等协议接口，`api/runtime_adapter.py` 已实现
2. **`RunnerRuntimeAdapter`**（RFC 4b）：`api/runner_client.py` 实现了通过 HTTP 调用远程 Runner 的 `HttpRunnerClient`，支持 `/v1/runs` CRUD
3. **`gateway_chat.py`**：已实现通过 Hermes Gateway API 代理聊天
4. **Agent Source Boundary RFC**（#2453）：已识别出所有 Agent 源码依赖点，规划迁移为 HTTP API + 共享 client 包

---

## 推荐架构方案

### 目标架构：Clean Separation of Concerns

```
┌──────────────────────────────────────────────────────┐
│                   Web 前端层                           │
│  (纯静态资源，可部署到任意 HTTP 服务器 / CDN)            │
│  ┌────────────────────────────────────────────────┐  │
│  │ 配置: AGENT_RUNTIME_URL = http://<agent>:8642   │  │
│  │ api() 支持跨域请求到 Agent Runtime API            │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────┬───────────────────────────────┘
                       │ HTTP/HTTPS (支持跨域)
┌──────────────────────▼───────────────────────────────┐
│              Agent Runtime API 层                      │
│  (独立服务，可部署在本地或云端)                          │
│  ┌────────────────────────────────────────────────┐  │
│  │ Hermes Gateway / API Server (端口 8642)          │  │
│  │ ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │  │
│  │ │ /v1/runs │ │ /v1/chat │ │ /v1/sessions     │ │  │
│  │ │ (运行)    │ │ (聊天)    │ │ (会话管理)        │ │  │
│  │ ├──────────┤ ├──────────┤ ├──────────────────┤ │  │
│  │ │ /v1/files│ │ /v1/auth │ │ /v1/workspace    │ │  │
│  │ │ (文件)    │ │ (认证)    │ │ (工作空间)        │ │  │
│  │ └──────────┘ └──────────┘ └──────────────────┘ │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

### 三层架构设计

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: Web Frontend (纯静态)                            │
│ • 部署位置: 本地 localhost / VPS / Vercel / Cloudflare   │
│ • 技术: 现有 vanilla JS (static/*.js) 改造成可配置后端     │
│ • 关键改造:                                              │
│   - 增加 AGENT_RUNTIME_URL 前端配置                       │
│   - api() 支持绝对 URL + 跨域                             │
│   - 本地发现机制: Web UI 启动时探测本地 Agent              │
└─────────────────────────────────────────────────────────┘
                          │
                          │ HTTP/HTTPS + CORS
                          │
┌─────────────────────────────────────────────────────────┐
│ Layer 2: API Gateway / BFF (可选中间层)                   │
│ • 部署位置: 与 Agent 同机或独立                            │
│ • 职责: 认证、速率限制、请求路由、WebSocket 管理            │
│ • 技术: 现有 server.py 瘦身改造 或 Nginx/Kong             │
│   - 当前 server.py 可改造为此角色                          │
│   - 转发所有 /api/* 请求到 Agent Runtime                  │
│   - 不再直接导入 AIAgent                                  │
└─────────────────────────────────────────────────────────┘
                          │
                          │ HTTP (内网或本地)
                          │
┌─────────────────────────────────────────────────────────┐
│ Layer 3: Agent Runtime (核心引擎)                         │
│ • 部署位置: 本地机器 / 云端服务器                           │
│ • 技术: 现有 Hermes Agent + Gateway API                   │
│ • API:                                                   │
│   POST   /v1/runs             创建运行                   │
│   GET    /v1/runs/:id/events  SSE 事件流                 │
│   POST   /v1/runs/:id/cancel  取消运行                   │
│   POST   /v1/runs/:id/approvals/:aid/respond  审批       │
│   GET    /v1/sessions         会话列表                   │
│   POST   /v1/chat/completions 聊天补全                    │
│   POST   /v1/files/upload     文件上传                   │
│   GET    /v1/files/:path      文件读取                   │
│   GET    /v1/workspace/list   目录列表                   │
│   POST   /v1/auth/login       认证                       │
│   GET    /v1/health           健康检查                   │
│   GET    /v1/models           模型列表                   │
└─────────────────────────────────────────────────────────┘
```

### 关键改造点

#### 1. 前端 `api()` 改造 — 支持可配置的 Agent Runtime 端点

`static/workspace.js` 当前实现：
```javascript
async function api(path, opts={}) {
  const rel = path.startsWith('/') ? path.slice(1) : path;
  const url = new URL(rel, document.baseURI || location.href);
  // ...
}
```

改造成：
```javascript
// static/config.js (新增)
const APP_CONFIG = {
  // 默认同源（兼容现有部署），可通过环境变量或启动参数覆盖
  agentRuntimeUrl: window.__HERMES_AGENT_RUNTIME_URL__ || '',
  // 是否启用本地 Agent 探测
  localDiscovery: true,
};

async function api(path, opts={}) {
  const base = APP_CONFIG.agentRuntimeUrl || (document.baseURI || location.href);
  const url = new URL(path.startsWith('/') ? path.slice(1) : path, base);
  // ... 跨域请求加上 credentials: 'include' 和 CORS 处理
}
```

#### 2. `server.py` 改造 — 从 Runtime Host 变为 API Proxy

当前架构中 `server.py` 直接 `import run_agent.AIAgent`，改造后变为纯粹的 **请求代理层**：

```python
# 改造后的 server.py（或新的 api/routes.py）
# 不再直接导入 AIAgent
# 所有 Agent 操作通过 HttpRunnerClient 转发到 Agent Runtime

from api.runner_client import HttpRunnerClient

def _get_agent_client():
    """获取 Agent Runtime 客户端，支持本地和远程配置"""
    agent_url = os.getenv("HERMES_AGENT_RUNTIME_URL", "http://127.0.0.1:8642")
    api_key = os.getenv("HERMES_AGENT_API_KEY", "")
    return HttpRunnerClient(base_url=agent_url, api_key=api_key)

# /api/chat/start 改造
def handle_chat_start(handler):
    client = _get_agent_client()
    result = client.start_run(StartRunRequest(...))
    # 返回 stream_id 给前端，前端通过 SSE 连接到 Agent Runtime
    return j(handler, {"stream_id": result.run_id, ...})
```

#### 3. Agent Runtime API 标准化

需要 Hermes Gateway 补全以下 API 端点（部分已有，部分需新增）：

| 端点 | 当前状态 | 需要的工作 |
|------|---------|-----------|
| `POST /v1/runs` | `runner_client.py` 已定义协议 | Agent Gateway 侧需实现 |
| `GET /v1/runs/:id/events` | 同上 | Agent Gateway 侧需实现 SSE |
| `POST /v1/chat/completions` | ✅ Gateway 已有 | 增强（审批、工具回调） |
| `GET /v1/sessions` | ⚠️ 部分（通过 state.db 读取） | 标准化 REST API |
| `POST /v1/files/*` | ❌ 缺失 | 需新增文件操作端点 |
| `GET /v1/models` | ⚠️ 部分 | 标准化响应格式 |
| `GET /v1/health` | ✅ 已有 | 保持 |

#### 4. 本地 Agent 发现机制

对于「Web 云端 → Agent 本地」场景，需要一种安全的本地发现方式：

```
方案 A: 本地 Agent 启动时向云端 Web 注册
  Agent 本地 → POST https://cloud-web.example.com/api/register
  { "agent_id": "xxx", "local_url": "http://192.168.1.100:8642", "token": "..." }

方案 B: Web 提供连接码，Agent 本地输入
  Web 显示: "连接码: ABCD-1234"
  Agent CLI: hermes connect --code ABCD-1234 --web https://cloud-web.example.com

方案 C: 使用 Tailscale/WireGuard 等 VPN 组网
  两个设备在同一虚拟网络中，直接通过内网 IP 通信
```

推荐方案 C + 方案 B 作为备选，因为 VPN 方案提供端到端加密且无需额外发现协议。

#### 5. 工作空间/文件系统解耦

当前文件操作直接读本地磁盘，跨网络时需要改为 API 调用：

```python
# 当前: 直接读文件系统
content = Path(workspace, rel_path).read_text()

# 改造后: 通过 Agent Runtime API
client = _get_agent_client()
content = client.read_file(session_id, rel_path)
```

### 迁移路径（分阶段）

```
Phase 1: Consolidate（当前 → 2周）
├── 完善 HttpRunnerClient，覆盖所有现有 WebUI API
├── 将 /api/chat/start 改为默认通过 RuntimeAdapter 调用
├── 前端增加 AGENT_RUNTIME_URL 配置项（默认同源兼容）
└── agent-api-contract.md 中标记的端点全部实现

Phase 2: Decouple（2-4周）
├── server.py 移除直接 AIAgent 导入
├── 文件操作改为通过 Agent API
├── 前端支持跨域 SSE (EventSource with CORS)
├── 本地 Agent 发现机制（Tailscale + 连接码）
└── 添加 Agent Runtime 健康检查和自动重连

Phase 3: Optimize（4-8周）
├── Agent Runtime 支持 WebSocket（替代 SSE 长连接）
├── 前端离线缓存 + 断线重连（已有 sw.js 基础）
├── 多 Agent Runtime 支持和负载选择
├── 端到端加密通道
└── 生产级认证体系（OAuth2 / API Key / mTLS）
```

### 推荐的部署拓扑

```
场景 1: 全部本地 (开发)
  Browser ── localhost:8787 ── WebUI(proxy) ── localhost:8642 ── Agent

场景 2: Web本地 + Agent云端
  Browser ── localhost:8787 ── WebUI(proxy) ── https://cloud:8642 ── Agent

场景 3: Web云端 + Agent本地 (通过 Tailscale)
  Browser ── https://cloud-web.example.com ── WebUI(proxy)
     │                                              │
     └────────── Tailscale ───────── 100.64.x.x:8642 ── Agent

场景 4: 全部云端
  Browser ── https://cloud-web.example.com ── WebUI(proxy)
     └────────── 内网 ───────── http://agent:8642 ── Agent
```

---

## 对当前代码的具体改建议

当前项目已经有非常好的解耦基础（`RuntimeAdapter`、`HttpRunnerClient`、`gateway_chat.py`），但需要以下关键调整才能支持完整的 2×2：

### 立即可做的（不改架构，增强现有 Gateway 路径）：

1. **`static/workspace.js`** — `api()` 增加 base URL 配置：
   ```javascript
   const RUNTIME_URL = window.__HERMES_RUNTIME_URL__ || '';
   const base = RUNTIME_URL || (document.baseURI || location.href);
   ```

2. **`static/index.html`** — 注入配置：
   ```html
   <script>window.__HERMES_RUNTIME_URL__ = "{{ AGENT_RUNTIME_URL }}" || "";</script>
   ```

3. **`server.py`** — 增加 `HERMES_AGENT_RUNTIME_URL` 环境变量支持，当设置时自动启用代理模式

### 中期需要的（架构调整）：

4. **`api/streaming.py`** — 将 `_run_agent_streaming` 改为默认通过 `HttpRunnerClient` 远程调用，本地直接模式变为 fallback
5. **`api/routes.py`** — 所有文件操作端点（`/api/list`、`/api/file` 等）增加远程代理模式
6. **`api/runner_client.py`** — 增加文件操作、会话管理的 API 方法

### 长期目标：

7. `server.py` 完全不再 `import run_agent.AIAgent`，所有 Agent 操作通过标准化 HTTP API
8. 前端支持直接连接远程 Agent Runtime（绕过 WebUI proxy，减少一跳延迟）