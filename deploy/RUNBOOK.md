# CIBOL 上线手册（turing）

turing：实验室内网 GPU 主机，IP `172.16.185.103`（amd64 / Ubuntu 20.04）。
原则：**在 turing 上 build**（不要 push Mac 的 arm64 镜像），靠官方 multi-arch 基础镜像 + lockfile 保证一致。

---

## 0. 前置

turing 上需有：`git`、`docker`、`docker compose`（v2）。验证：

```bash
docker version && docker compose version
```

## 1. 取代码

```bash
git clone <仓库地址> ~/labsys && cd ~/labsys/deploy
# 或已存在：cd ~/labsys && git pull
```

## 2. 配置 `.env`（生产凭据）

**唯一配置文件是仓库根目录的 `.env`**（本地 `uv run` 与 docker compose 都读它）：

```bash
cd ~/labsys
cp .env.example .env
```

编辑根目录 `.env`，**必须改**：

| 变量 | 说明 |
|---|---|
| `CIBOL_ENV` | 改为 `prod` |
| `POSTGRES_PASSWORD` | 强密码（compose 会用它拼出容器 DATABASE_URL，无需另写 URL） |
| `CIBOL_JWT_SECRET` | `openssl rand -hex 32` 生成 |
| `CIBOL_CORS_ORIGINS` | 改成 turing 访问地址，如 `["http://172.16.185.103"]` |

**按需填**（不填则对应功能自动禁用）：

| 变量 | 启用的功能 |
|---|---|
| `CIBOL_DMXAPI_SYSTEM_TOKEN` / `CIBOL_DMXAPI_USER_ID` | LLM 余额/计量 |
| `CIBOL_BOOKING_ACCOUNT` / `CIBOL_BOOKING_PASSWORD` | 腾讯会议预约（校园门户账号） |
| `CIBOL_SSH_ADMIN_KEY_PATH` | SSH 账号下发（labadmin 私钥，见 §6） |

> `.env` 已被 `.gitignore` 忽略，勿提交。默认情况下 `CIBOL_DATABASE_URL` 不用填——
> 容器由 compose 注入 `postgres` 主机，本地走代码默认 `localhost`。

### 2.1 接入你自己的数据库（可选）

数据库连接由环境变量 **`CIBOL_DATABASE_URL`** 决定，格式：

```
postgresql+asyncpg://用户名:密码@主机:端口/库名
```

要求：**PostgreSQL 14+**（模型用了 PG enum / JSON / `ON CONFLICT`）、驱动必须是 **`+asyncpg`**。
Alembic 只建**表**不建**库**，所以库要先 `createdb`，且连接用户需有建表权限。

**三种接法：**

| 场景 | 怎么做 |
|---|---|
| 只想换密码，仍用自带 postgres | `.env` 里改 `POSTGRES_PASSWORD`（自带库与注入 URL 共用它） |
| 本地跑 + 外部库 | `.env` 里加 `CIBOL_DATABASE_URL=postgresql+asyncpg://…`，再 `cd backend && uv run alembic upgrade head && uv run python -m app.db.seed` |
| 容器部署 + 外部库 | 改 `docker-compose.yml` 里 `api` 的 `CIBOL_DATABASE_URL`，并删掉自带的 `postgres` 服务及 `depends_on`；entrypoint 会自动迁移 + seed |

> 首次接入新库务必跑一次 `alembic upgrade head`（建表）+ `python -m app.db.seed`（管理员/成员种子，默认密码 `cibol1234`，登录后请改）。

### 2.2 独立 DB 机部署（长期推荐）

数据全在数据库里，代码/镜像不含数据。把 DB 放到**独立机器**上，应用机（跑 web+api）就能随意重建/换机，零数据迁移。

**职责划分：**

| 机器 | 跑什么 | 数据 |
|---|---|---|
| 应用机 | `web` + `api`（compose，**删掉 postgres 服务**） | 无状态，可随时重建 |
| DB 机 | 一个只对应用机开放的 PostgreSQL（≥14） | 全部数据在此，做备份 |

**① DB 机：装 PG + 建库账号**（Ubuntu 原生 apt；也可用单个 docker 容器）

```bash
sudo apt update && sudo apt install -y postgresql
sudo -u postgres psql <<'SQL'
CREATE ROLE cibol LOGIN PASSWORD '换成强密码';
CREATE DATABASE cibol OWNER cibol;
SQL
```

**② DB 机：只对应用机放开连接**（把 `10.0.0.APP` 换成应用机 IP）

```bash
sudo sed -i "s/^#listen_addresses.*/listen_addresses = '*'/" /etc/postgresql/*/main/postgresql.conf
echo "host  cibol  cibol  10.0.0.APP/32  scram-sha-256" | sudo tee -a /etc/postgresql/*/main/pg_hba.conf
sudo systemctl restart postgresql
sudo ufw allow from 10.0.0.APP to any port 5432
```

> 安全底线：**别把 5432 暴露公网**（只 `/32` + ufw 放行应用机）；强密码；应用只用最小权限的 `cibol` 账号，别用超级用户 `postgres`；跨不可信网段再加 TLS（`ssl=on` + `hostssl`）。

**③ 应用机：指向 DB 机**

- 根 `.env` 加：`CIBOL_DATABASE_URL=postgresql+asyncpg://cibol:强密码@10.0.0.DB:5432/cibol`
- `docker-compose.yml` 里**删掉 `postgres` 服务**和 api 的 `depends_on: [postgres]`
- 连通性自检：`docker compose exec api python -c "import asyncio,asyncpg; asyncio.run(asyncpg.connect('postgresql://cibol:强密码@10.0.0.DB:5432/cibol')).close()" && echo OK`

**④ 首次初始化**（全新空库，仅一次）：api entrypoint 会自动 `alembic upgrade head`；`seed` 只手动跑一次（换真实名单见「导入成员」）。

**⑤ DB 机每日备份**（`/etc/cron.daily/pg-backup`，`chmod +x`）：

```bash
sudo -u postgres pg_dump -Fc cibol > /var/backups/cibol_$(date +\%F).dump
find /var/backups -name 'cibol_*.dump' -mtime +14 -delete
```

之后换应用机零迁移；真要迁 DB 机用 `pg_dump`/`pg_restore`（见 §7 或 §8）。

### 2.3 导入真实数据（CSV 批量）

`seed` 只灌 demo 假名册。要写**真实**成员/排期/服务器，用 CSV 导入器
（`backend/app/db/import_csv.py`，在 `backend/` 目录跑 `uv run`；容器里用 `docker compose exec api uv run …`）。

**三步：拿模板 → 填表 → 导入**

```bash
cd backend
# ① 打印模板（自带一行示例，改成你的数据；Excel 填完另存为 CSV/UTF-8 亦可）
uv run python -m app.db.import_csv members  --template > members.csv
uv run python -m app.db.import_csv meetings --template > meetings.csv
uv run python -m app.db.import_csv servers  --template > servers.csv

# ② 先干跑校验（只解析、不写库，看新增/更新条数与告警）
uv run python -m app.db.import_csv members members.csv --dry-run

# ③ 正式导入
uv run python -m app.db.import_csv members  members.csv
uv run python -m app.db.import_csv meetings meetings.csv
uv run python -m app.db.import_csv servers  servers.csv
```

**各类型的列**（`role`/`scored`/`status` 可留空走默认）：

| 类型 | 列 | 认主键（重复只更新） |
|---|---|---|
| `members` | `name,email,title,role,password` | `email`（次选 `name`） |
| `meetings` | `date,type,time,place,template,scored,host,presenters` | `date` |
| `servers` | `name,ip,ssh_port,gpu,status,net,desc` | `name` |

要点：
- **幂等**：同一 CSV 重复导入不会重复插，按主键更新。改完再导即可覆盖。
- **报告人**：`meetings` 的 `presenters` 列用 `;` 或 `，` 分隔姓名，按 `name` 匹配成员库；
  匹配不到仍存姓名快照（兼容外部嘉宾）并打印提醒——先导 `members` 再导 `meetings` 匹配率最高。
- **成员密码**：`password` 留空则用默认 `cibol1234`，登录后请改。
- **申请/评分/考勤等运行时数据**不建议 CSV 导入（应由应用产生）；要迁历史走整库 `pg_dump`/`pg_restore`（§7 / §8）。

> 想彻底换掉 demo 假名册：先导入真实 `members.csv`，再把种子里的 `member01~20@cibol.lab`
> 停用或删除（有历史记录的用软删 `disabled=true`）。

## 3. 起服务（首次自动迁移 + seed）

从 `deploy/` 运行，并用 `--env-file ../.env` 让 compose 读到根 `.env`（用于 `${POSTGRES_PASSWORD}` 替换 + 注入容器）：

```bash
cd ~/labsys/deploy
docker compose --env-file ../.env -f docker-compose.yml up -d --build
```

- `--build` 在 turing 上构建 amd64 镜像。
- api 容器 entrypoint 会自动 `alembic upgrade head` + 幂等 seed（首次建库/灌数据，重启安全）。
- 显式 `-f docker-compose.yml` 避免叠加 `docker-compose.override.yml`（dev 用），**生产必须带**。

> 后续所有 compose 命令都带 `--env-file ../.env -f docker-compose.yml`，可设个别名：
> `alias dc='docker compose --env-file ../.env -f docker-compose.yml'`

查看状态/日志：

```bash
docker compose --env-file ../.env -f docker-compose.yml ps
docker compose --env-file ../.env -f docker-compose.yml logs -f api   # 看 entrypoint 迁移+seed
```

## 4. 冒烟自测

```bash
curl -s http://localhost/api/health           # {"status":"ok","env":"prod"}
curl -s -X POST http://localhost/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@cibol.lab","password":"cibol1234"}'   # 应返回 access_token
```

浏览器开 `http://172.16.185.103`，用 `admin@cibol.lab / cibol1234` 登录。
**首登后立即改管理员密码**（默认密码 `cibol1234` 全员通用）。

## 5. WebSSH / SSH 下发的容器网络（关键，最易翻车）

WebSSH 与账号下发要求 **api 容器能直连内网目标机**（turing 自身 / lecun 172.18.137.34 / hinton 172.16.185.96:80 / fodor 172.16.212.181:80）。

默认 docker bridge 网络经 NAT 出宿主网关，**通常能到内网**。自测：

```bash
# 进 api 容器测到各机的 22/80 端口
docker compose -f docker-compose.yml exec api sh -c \
  'python -c "import socket;s=socket.create_connection((\"172.16.185.103\",22),5);print(\"turing:22 OK\");s.close()"'
```

若不通（如内网路由限制），给 `api` 服务加宿主网络——编辑 `docker-compose.yml` 取消注释：

```yaml
  api:
    network_mode: host    # 直接用 turing 的网络栈，内网直连
```

> 注意：`network_mode: host` 后 api 直接监听宿主 8000，`depends_on` 仍可用但容器间不能用服务名互访——此时 `CIBOL_DATABASE_URL` 里的 `postgres` 要改成 `localhost:5432`，并给 postgres 暴露端口。多数情况下 bridge 够用，优先不动。

WebSSH 用的是**用户自己的账号密码**（前端输入），后端只透传，无需服务端凭据。

## 6. （可选）SSH 账号下发凭据

仅当要用"管理员远程开通账号"功能：

1. 把 labadmin 私钥放到 turing，如 `~/labsys/deploy/secrets/labadmin_key`（该目录已 gitignore）。
2. `.env` 设 `CIBOL_SSH_ADMIN_KEY_PATH=/run/secrets/labadmin_key`，并在 compose 的 api 服务挂载该文件（docker secret 或 volume）。
3. 注意 turing 自身有免密 sudo，可直接下发；lecun/hinton/fodor 需各自配 NOPASSWD sudo（详见内网备忘）。

## 7. 日常运维

```bash
# 更新代码后重建
git pull && docker compose -f docker-compose.yml up -d --build

# 手动重跑迁移/seed（一般不用，entrypoint 已自动）
docker compose -f docker-compose.yml exec api uv run alembic upgrade head
docker compose -f docker-compose.yml exec api uv run python -m app.db.seed

# 数据库备份
docker compose -f docker-compose.yml exec postgres \
  pg_dump -U cibol cibol > backup_$(date +%F).sql

# 停 / 重启
docker compose -f docker-compose.yml down          # 停（保留数据卷）
docker compose -f docker-compose.yml restart api
```

## 8. 备注

- **定时任务**：腾讯会议自动预约用 APScheduler，跑在 api 进程内，每日 08:00 扫描；api 重启即重建调度，无需独立 worker。
- **腾讯会议**：门户提交后进管理员审批；测试建的会记得到 vc.bnu.edu.cn 取消。
- **架构一致性**：始终在 turing 上 `--build`；Mac 上只做开发与 Dockerfile 验证。
- **HTTPS**：内网无公网域名时用 http(:80) 即可；若要 TLS，Caddyfile 配内部 CA 或具体域名，Caddy 自动签。
