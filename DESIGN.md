# CIBOL · 实验室系统 — 全栈技术方案

> 从纯前端 demo（Vite + React + TS，mock 数据）演进为「前端 + 后端」完整应用。
> 决策基线：**后端 Python + FastAPI**｜**账号密码 + JWT**｜**全部集成真实可用**｜**部署在实验室 turing（内网 `10.12.0.11`）**。

---

## 0. 部署拓扑前提（决定了很多设计）

```
                    实验室内网 10.12.0.0/24
  ┌──────────────────────────────────────────────────────────┐
  │  turing  10.12.0.11  ← 应用宿主（4× A6000，本应用 docker 化）│
  │    ├─ web (前端静态)                                         │
  │    ├─ api (FastAPI)                                          │
  │    └─ postgres / redis                                       │
  │         │ 内网直连，做 SSH 代理 / 账号下发                     │
  │         │ 出网调用 dmxapi.cn（LLM 中转 + 余额查询）            │
  │         ▼                                                     │
  │  lecun 10.12.0.12 · hinton 10.12.0.13 · fodor 10.12.0.14    │
  └──────────────────────────────────────────────────────────┘
            ▲ 反向代理 / VPN 暴露给实验室成员（见 §7）
```

**关键红利**：应用就跑在内网受信主机上 → 后端可直接用一个**特权服务账号**对各服务器做真实 SSH（WebSSH 代理 + `useradd` 下发），无需把 SSH 凭据下放到浏览器。

---

## 1. 需求梳理（领域模型）

### 1.1 角色
- **成员 (member)**：默认角色，看自己的组会/评分/服务器/密钥/消息。
- **管理员 (admin)**：审批中心、组会中心全流程、人员/服务器/公告管理。
- 前端已有「成员视图 / 管理员视图」切换 → 后端用 **RBAC**（role + 细粒度 scope）。

### 1.2 业务域（8 个，对应前端 surfaces）

| 域 | 实体 | 核心行为 | 难度 |
|---|---|---|---|
| **身份** | User, Session | 登录、改密、角色、个人设置 | 低 |
| **组会排期** | Semester, MeetingDefault, Meeting, Presenter | 整学期轮转排期、在线会议链接、取消/恢复 | 中 |
| **请求状态机** | Request(swap/absence/api/ssh) | 发起→审批迁移、历史轨迹、对调双向 | 中 |
| **评选引擎** | Report, Attendance, Discussion, Rating, Excellence | 出勤/发言/评分录入 → 加权归一化 → 晋级排名 → 发布优秀名单 | **高** |
| **公告** | Announcement | 分级/置顶/受众/过期、排序规则 | 低 |
| **服务器** | Server, ServerAccount | 管理员维护清单；**真实 WebSSH**；**真实账号下发** | **高** |
| **密钥/API** | ApiKey, Usage | **真实代理转发 LLM 厂商 + 计量/预算** | **高** |
| **消息** | Notification | 站内信、组会/审批事件推送 | 中 |

### 1.3 三个"硬"特性（"全部真实"的落点）
1. **WebSSH 终端**：浏览器 ↔ FastAPI WebSocket ↔ 目标服务器 PTY 实时双向流。
2. **API 密钥真实可用**：不是发个假字符串，而是签发**可直接调用 LLM 的虚拟 key**，带预算上限与用量统计。
3. **SSH 账号真实下发**：管理员"通过"后，后端在目标机真正 `useradd` 并注入用户公钥。

---

## 2. 技术栈总览

### 2.1 前端（在现有基础上增量，**不重写**）
保留 `Vite + React 18 + TS` 与全部 `src/ds/` 设计系统组件、`src/feel.tsx`、`src/styles/` tokens。新增：

| 关注点 | 选型 | 说明 |
|---|---|---|
| 服务端状态 | **TanStack Query v5** | 替代 `store.ts` 的全局 mock store；缓存/失效/乐观更新 |
| 客户端状态 | **Zustand**（轻量） | 仅留 UI 态（feel、视图切换、抽屉），其余下沉到服务端 |
| 路由 | **React Router v6** | 当前是 state 驱动切屏 → 升级为真实路由（可分享/刷新保持） |
| 表单 | **react-hook-form + zod** | 申请/录入/发布等表单校验，zod schema 与后端共享语义 |
| 终端 | **xterm.js + addon-fit** | WebSSH 前端，配合 WebSocket |
| 请求 | **openapi-typescript + openapi-fetch** | 从后端 OpenAPI 自动生成 TS 类型与 client，前后端类型零漂移 |
| 实时 | 原生 **WebSocket**（SSH） + **SSE**（通知流） | |

> `store.ts` 的演进：纯逻辑（状态机表 `REQ_FLOW`、排序、归一化）部分作为**前端展示辅助**保留；权威计算（`computeEval`/`rankSeriesFor`）**迁移到后端**，前端只消费结果。

### 2.2 后端（Python + FastAPI）

| 关注点 | 选型 | 理由 |
|---|---|---|
| 框架 | **FastAPI**（async） | 类型驱动、自动 OpenAPI、WebSocket 一等公民 |
| 校验/序列化 | **Pydantic v2** | DTO 层 |
| ORM | **SQLAlchemy 2.0 (async) + asyncpg** | 成熟、可控复杂查询（评选引擎需要） |
| 迁移 | **Alembic** | schema 版本化 |
| 认证 | **JWT**（`python-jose`）+ `passlib[bcrypt]` | access(短)+refresh(长)；依赖注入做 RBAC |
| 后台任务 | **Celery + Redis**（或先用 APScheduler） | 账号下发、用量结算、会议链接创建、公告过期、排名快照 |
| SSH | **AsyncSSH** | WebSSH 代理 + 远程 `useradd` 下发，纯 async，契合 FastAPI |
| LLM API | **dmxapi.cn**（中转聚合，OpenAI 兼容） | 自带令牌/配额/余额，后端封装其余额接口，§5.3 |
| 缓存/队列 | **Redis** | Celery broker + 会话/限流/SSE 扇出 |
| 测试 | **pytest + httpx.AsyncClient + testcontainers** | |

### 2.3 数据与基础设施
- **PostgreSQL 16**（主库）
- **Redis 7**（队列/缓存/实时扇出）
- **Docker Compose**（turing 单机编排）
- **Caddy / Nginx**（反向代理 + TLS + 静态前端托管）
- 可观测：**结构化日志 (structlog)** + 可选 Prometheus 指标

---

## 3. 数据模型（核心表，简化）

```
users(id, name, email, password_hash, role[member|admin], title角色头衔,
      ssh_pubkey, settings_json, created_at)

semesters(id, name, short, start, end, is_current)
meeting_defaults(id, semester_id, weekday, time, place)

meetings(id, semester_id, date, type[进展汇报|文献精读], place, time,
         online_url, online_provider, online_id, status[scheduled|cancelled], created_at)
presenters(id, meeting_id, user_id, topic, kind, minutes)

requests(id, kind[swap|absence|api|ssh], requester_id, target_user_id?,
         from_date?, to_date?, topic?, detail?, reason?,
         status, created_at)                     -- 状态机见 §5.1
request_events(id, request_id, status, note, actor_id, at)   -- history 轨迹

reports(id, meeting_id|date, type, eval_period_id)            -- 评选用的历次组会
attendance(report_id, user_id, status[present|leave|absent])
discussion(report_id, user_id, points)
ratings(report_id, presenter_id, attitude, polish, raters)
peer_baseline(user_id, attitude, polish)
eval_periods(id, name, from, to)
eval_config(id, weights_json, filters_json, range_json, progress_order_json)
excellence(id, period, from, to, names_json, count, published_at)

announcements(id, title, body, level[info|important|urgent], pinned,
              audience[all|students], author_id, published_at, expires_at)

servers(id, name, ip, gpu, status[online|busy|offline], net[intranet|public], desc)
server_accounts(id, server_id, user_id, username, status[pending|active|revoked],
                provisioned_at)

api_keys(id, user_id, litellm_key_id, label, budget, spent, status, created_at)
api_usage(id, api_key_id, model, tokens_in, tokens_out, cost, at)   -- 或直接读 LiteLLM

notifications(id, user_id, type, title, body, read, created_at)
```

---

## 4. 后端模块 / API 划分

```
app/
  core/        config, security(JWT/RBAC), db, redis, deps
  domains/
    auth/      登录、刷新、改密
    users/     成员、个人设置、SSH 公钥
    meetings/  排期、报告人、在线会议链接、取消/恢复
    requests/  状态机引擎（4 类）、审批迁移
    evals/     评选引擎（computeEval/rankSeries 迁移）、优秀名单
    announce/  公告 CRUD + 排序/过期
    servers/   清单维护 + WebSSH(ws) + 账号下发
    apikeys/   LiteLLM 虚拟 key 签发 + 用量查询
    notify/    站内信 + SSE 推送
  workers/     celery tasks: provision_ssh, create_meeting_link,
               settle_usage, expire_announcements, snapshot_ranks
```

REST 资源 + 两个实时端点：
- `WS  /ws/ssh/{server_id}` — WebSSH（鉴权后建立 PTY 隧道）
- `GET /sse/notifications` — 通知流

OpenAPI 自动生成 → 前端 `openapi-typescript` 拉取类型，**前后端契约单一真相源**。

---

## 5. 关键技术难点方案

### 5.1 请求状态机（swap / absence / api / ssh）
直接把 demo 里的 `REQ_FLOW` 迁到后端做**权威校验**：

```python
FLOW = {
  "swap":    {"initial":"pending",   "pending":   ["accepted","declined","cancelled"]},
  "absence": {"initial":"submitted", "submitted": ["approved","rejected","cancelled"]},
  "api":     {"initial":"submitted", "submitted": ["approved","rejected","cancelled"]},
  "ssh":     {"initial":"submitted", "submitted": ["approved","rejected","cancelled"]},
}
```
- 迁移在 service 层校验合法性，非法迁移 → 409。
- 每次迁移写 `request_events`（= 前端 `history` 轨迹）。
- **副作用挂钩**：`api/approved` → 触发签发虚拟 key；`ssh/approved` → 触发 Celery 账号下发；`swap/accepted` → 改 `presenters` 归属。

### 5.2 评选引擎（最高复杂度，从 `store.ts` 迁移）
`computeEval` / `rankSeriesFor` 是纯函数式打分流水线，**逐行移植到 Python**（建议放 `domains/evals/engine.py`，纯函数、好测）：
1. 区间过滤 reports（排除已取消）
2. 每人聚合：出勤率、发言分、态度/打磨均值（缺测回落 `peer_baseline`）
3. 四维 min-max 归一化 → 加权得 `meeting` 分 → `meetingRank`
4. 过滤阈值 → 幸存者 → 晋级序 `progressOrder`
5. `(meetingRank + progressRank)/2` 合成 → `finalRank`
6. 发布 → 写 `excellence` 快照

> 建议：把它写成**纯函数 + 用 pytest 对拍** demo 现有输出，保证迁移零行为漂移。前端只调 `GET /evals/compute?from=&to=` 拿结果渲染。

### 5.3 API 密钥"真实可用"（dmxapi.cn 中转平台）
实验室的 LLM API 由 **dmxapi.cn** 提供（OpenAI 兼容的多模型聚合中转，base `https://www.dmxapi.cn/v1`）。
它**自带「令牌 + 配额 + 余额」能力**，因此**不再叠加 LiteLLM**——dmxapi 本身就是网关（少造轮子）。

实验室持有一个 dmxapi 账户：`system_token` + `user_id`（工作台 → 个人设置 → 系统令牌获取）。

- **签发**：管理员审批 `api` 请求 → 后端调 dmxapi 令牌管理接口，为该成员创建**带配额上限的令牌**（`sk-…`）→ 存 `api_keys.upstream_key`。
  > ⚠️ 令牌「创建」接口需在 https://doc.dmxapi.com/ 进一步确认；MVP 可由管理员在 dmxapi 后台建好令牌、粘贴回填，后端只管余额/计量。
- **调用**：成员用该 `sk-…` 直接打 `https://www.dmxapi.cn/v1/chat/completions`，dmxapi 自动计量与限额。
- **单令牌用量条**（密钥管理页）：
  `GET https://www.dmxapi.cn/api/token/key/{sk}`，头 `Rix-Api-User: {user_id}`
  → 返回 `used_quota` / `remain_quota`（**RMB = quota ÷ 500000**）。
- **账户总余额**（管理员看板）：
  `GET https://www.dmxapi.cn/api/user/self`，头 `Authorization: Bearer {system_token}` + `Rix-Api-User: {user_id}`
  → 返回 `data.quota`（RMB = quota ÷ 500000）。
- **后端做法**：`domains/apikeys/dmxapi.py` 封装上述调用；用 Celery 定时把各令牌的 `remain_quota` 拉取入库（或前端展示时按需查询 + 短缓存），避免每次都打 dmxapi。
- `system_token` / `user_id` 作为 secret 注入后端，**绝不下发前端**。

### 5.4 SSH 账号"真实下发"（AsyncSSH + Celery）
`ssh` 请求批准后异步执行：
```python
async def provision(server, username, pubkey):
    async with asyncssh.connect(server.ip, username="labadmin",
                                client_keys=[ADMIN_KEY]) as c:
        await c.run(f"sudo useradd -m {username}", check=True)
        await c.run(f"sudo -u {username} mkdir -p ~{username}/.ssh ...")
        await c.run(f"... install pubkey ...", check=True)
    # 回写 server_accounts.status = active，发通知
```
- 特权账号 `labadmin` 仅后端持有私钥（挂载为 secret，不入库不下发浏览器）。
- 幂等：已存在用户跳过；失败回写 `pending` + 通知管理员。
- **安全边界**：白名单命令、参数严格转义、审计日志。

### 5.5 WebSSH 终端（AsyncSSH PTY ↔ WebSocket ↔ xterm.js）
```
xterm.js --keystrokes--> WS /ws/ssh/{id} --> AsyncSSH PTY --> 目标机
        <--output stream--                <--               
```
- 进入前校验：该用户在该服务器有 `active` 账号才放行。
- 用**用户自己的账号**登录（非 labadmin），权限隔离。
- 处理 resize（fit addon → 发 resize 帧 → `chan.change_terminal_size`）、心跳、超时回收。
- 终端始终深色（demo 既有约定）。

### 5.6 在线会议链接（腾讯会议 API）
- Celery 任务在排期生成/邻近时调腾讯会议 REST API 建会 → 回写 `meetings.online_*`。
- 失败 → `status` 标记，前端提示"需管理员设置"（demo 已有 `status:"ok"` 字段语义）。

---

## 6. 项目结构（monorepo）

```
labsys/
  frontend/            ← 现有 src/ 迁入，加 router/query/api client
  backend/
    app/  ...（见 §4）
    alembic/
    tests/
    pyproject.toml
  gateway/litellm/      ← LiteLLM 配置
  deploy/
    docker-compose.yml
    Caddyfile
    .env.example
  DESIGN.md
```

---

## 7. 部署（turing 单机）

`docker compose` 服务：`caddy`(反代+TLS+静态前端) · `api`(FastAPI/uvicorn) · `worker`(celery) · `postgres` · `redis` · `litellm`。

- **对外暴露**：turing 是 intranet 主机。给实验室成员访问的方式（任选）：
  1. 实验室 VPN/WireGuard 进内网后访问；
  2. 经一台 public 机（如 hinton）反代到 turing；
  3. 校园网内 DNS + Caddy 自签/内部 CA。
- **Secrets**：`labadmin` SSH 私钥、JWT 密钥、LLM 主 key → docker secrets / `.env`（不入库、不进前端）。
- **备份**：`pg_dump` 定时任务（成员/评选/审批是关键数据）。
- 资源：turing 是训练主机，给容器设 CPU/内存 limit，避免挤占 GPU 训练。

### 7.1 开发/生产一致性（Mac mini arm64 ↔ turing amd64）

**唯一真正的不一致来源是 CPU 架构**：Mac mini 是 Apple Silicon（`arm64`），turing 是 x86_64（`amd64`）。用以下四条消除它：

1. **base 镜像用官方 multi-arch + 钉死小版本**（不用 `latest`）：
   `postgres:16.4` · `redis:7.4-alpine` · `python:3.12-slim` · `node:20-slim`。
   同一 tag 在两种架构上是同一套软件、各自原生构建 → 行为一致。
2. **依赖锁死**：后端 `uv` + `uv.lock`；前端 `npm ci`（严格按 `package-lock.json`，不用 `npm install`）。
3. **生产镜像必须按 amd64 产出**（本地 `docker build` 默认出 arm64，传 turing 跑不了）。三选一：
   - **在 turing 上 `docker compose build`**（天然 amd64，起步推荐，零配置）；
   - 本地 `docker buildx build --platform linux/amd64 ... --push`（推 registry，turing 拉）；
   - CI（GitHub Actions buildx）出 amd64 推 registry（团队协作时上）。
4. **开发原生 arm64、部署 amd64 是 OK 的**——因 1+2 保证同代码同依赖，业务行为一致；
   上线前需 100% 仿真时本地可 `--platform linux/amd64` 跑（QEMU，慢，仅验证用）。

**坑**：不要 `docker save` 本地 arm64 镜像再 `scp` 到 turing `load`——架构不对。turing 本地 build 或 buildx 出 amd64。

**确认 turing 架构**（在 turing 上）：`uname -m` 应为 `x86_64`；`docker version` 确认可用。

### 7.2 文件骨架

**`backend/Dockerfile`**（多阶段，amd64/arm64 通吃，靠 lockfile 锁依赖）
```dockerfile
FROM python:3.12-slim AS base
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
RUN pip install --no-cache-dir uv
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev          # 严格按 lock，跨架构装各自 wheel
COPY app ./app
CMD ["uv","run","uvicorn","app.main:app","--host","0.0.0.0","--port","8000"]
```

**`deploy/docker-compose.yml`**（本地与 turing 同一份；钉死版本）
```yaml
services:
  caddy:
    image: caddy:2.8
    ports: ["80:80","443:443"]
    volumes: ["./Caddyfile:/etc/caddy/Caddyfile", "../frontend/dist:/srv"]
    depends_on: [api]
  api:
    build: ../backend
    env_file: .env
    depends_on: [postgres, redis]
  worker:
    build: ../backend
    command: uv run celery -A app.workers worker -l info
    env_file: .env
    depends_on: [postgres, redis]
    secrets: [labadmin_key]          # SSH 下发私钥，仅 worker 可读
  postgres:
    image: postgres:16.4
    environment: { POSTGRES_DB: cibol, POSTGRES_USER: cibol, POSTGRES_PASSWORD_FILE: /run/secrets/pg_pw }
    volumes: ["pgdata:/var/lib/postgresql/data"]
    secrets: [pg_pw]
  redis:
    image: redis:7.4-alpine
    volumes: ["redisdata:/data"]
  litellm:
    image: ghcr.io/berriai/litellm:main-stable
    env_file: .env                   # 主 key 在此注入
    volumes: ["./litellm.config.yaml:/app/config.yaml"]
volumes: { pgdata: {}, redisdata: {} }
secrets:
  labadmin_key: { file: ./secrets/labadmin_ed25519 }
  pg_pw:        { file: ./secrets/pg_password }
```

**`deploy/docker-compose.override.yml`**（仅本地开发自动叠加：挂源码热重载、暴露端口）
```yaml
services:
  api:
    command: uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    volumes: ["../backend/app:/app/app"]   # 改代码即热重载，不重建镜像
    ports: ["8000:8000"]
  postgres: { ports: ["5432:5432"] }       # 本地可直连调试
  redis:    { ports: ["6379:6379"] }
```
> `docker compose up` 本地自动合并 override（热重载开发）；turing 上用
> `docker compose -f docker-compose.yml up -d`（不带 override = 纯镜像 + 资源 limit）。

**turing 资源限额**（生产侧，可单列 `docker-compose.prod.yml` 或写进主文件）
```yaml
services:
  api:    { deploy: { resources: { limits: { cpus: "2", memory: 2g } } } }
  worker: { deploy: { resources: { limits: { cpus: "1", memory: 1g } } } }
```

---

## 8. 安全要点（"全部真实"必须重视）
- WebSSH/下发用**用户级账号**做实际操作，labadmin 仅用于受控的建账号命令（白名单+转义+审计）。
- 所有特权操作写**审计日志**（谁、何时、对哪台机、做了什么）。
- API 虚拟 key 设**预算硬上限**，避免烧钱。
- RBAC：管理员操作二次校验角色；状态机非法迁移拒绝。
- 前端永不接触任何服务器凭据/主 key。

---

## 9. 分期实施路线

| 阶段 | 内容 | 产出 |
|---|---|---|
| **P0 地基** | monorepo、docker compose、Postgres、Alembic、auth(JWT)、users、OpenAPI→前端 client | 能登录、跑通一条数据链路 |
| **P1 核心业务** | meetings 排期、requests 状态机、announcements、notify、servers 清单 | 成员/管理员主流程在真实数据上跑通 |
| **P2 评选引擎** | evals 引擎迁移 + pytest 对拍 demo、excellence 发布、组会中心全流程 | 评选/排名/优秀名单权威化 |
| **P3 硬集成** | LiteLLM 网关 + api key 签发计量、AsyncSSH 账号下发、WebSSH 终端、腾讯会议链接 | 三个"真实"特性上线 |
| **P4 上线** | turing 部署、反代/TLS、备份、审计、资源限额、压测 | 实验室可用 |

> 建议先 P0+P1 拿到可演示后端，再啃 P2 评选引擎（纯逻辑、可对拍最稳），最后 P3 啃集成（依赖运维权限，单独排期）。
