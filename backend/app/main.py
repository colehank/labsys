"""CIBOL 后端入口。"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.domains.apikeys.router import router as apikeys_router
from app.domains.audit.router import router as audit_router
from app.domains.auth.router import router as auth_router
from app.domains.booking.router import router as booking_router
from app.domains.evals.router import router as evals_router
from app.domains.feedback.router import router as feedback_router
from app.domains.lab.router import router as lab_router
from app.domains.notify.router import router as notify_router
from app.domains.requests.router import router as requests_router
from app.domains.servers.router import router as servers_router
from app.domains.ssh.credentials import router as credentials_router
from app.domains.users.router import router as users_router

@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.is_prod and len(settings.jwt_secret.encode()) < 32:
        raise RuntimeError("CIBOL_JWT_SECRET 至少需要 32 字节（256 bit），请更换后重启")
    if settings.is_prod and settings.jwt_secret == "dev-insecure-change-me":
        raise RuntimeError(
            "生产环境检测到默认 JWT 密钥，请设置 CIBOL_JWT_SECRET 环境变量后重启"
        )
    # 腾讯会议自动预约调度：仅在配置了凭据时启动（booking_enabled）
    from app.domains.booking.scheduler import shutdown_scheduler, start_scheduler
    start_scheduler()
    yield
    shutdown_scheduler()


app = FastAPI(
    title="CIBOL · 实验室系统 API",
    version="0.1.0",
    openapi_url=None if settings.is_prod else f"{settings.api_prefix}/openapi.json",
    docs_url=None if settings.is_prod else f"{settings.api_prefix}/docs",
    redoc_url=None if settings.is_prod else f"{settings.api_prefix}/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)


@app.get(f"{settings.api_prefix}/health", tags=["meta"])
async def health() -> dict[str, str]:
    return {"status": "ok"}


# 各域路由统一挂在 /api 下
for r in (auth_router, users_router, lab_router, requests_router, servers_router,
          credentials_router, notify_router, evals_router, apikeys_router, booking_router,
          feedback_router, audit_router):
    app.include_router(r, prefix=settings.api_prefix)

# WebSSH 实时端点（WebSocket，挂在 /ws 下，不带 api 前缀以匹配反代规则）
from app.domains.ssh.webssh import router as webssh_router  # noqa: E402

app.include_router(webssh_router)
