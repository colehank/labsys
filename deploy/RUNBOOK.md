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

> `.env` 已被 `.gitignore` 忽略，勿提交。`CIBOL_DATABASE_URL` 不用填——
> 容器由 compose 注入 `postgres` 主机，本地走代码默认 `localhost`。

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
