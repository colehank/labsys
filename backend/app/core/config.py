"""应用配置 — 全部从环境变量 / .env 读取（pydantic-settings）。"""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="CIBOL_", extra="ignore")

    # ── 基础 ──
    env: str = "dev"
    api_prefix: str = "/api"
    # 允许的前端来源（开发：Vite dev server）
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    # ── 数据库 ──
    database_url: str = "postgresql+asyncpg://cibol:cibol@localhost:5432/cibol"

    # ── Redis（队列/缓存，P1+ 用） ──
    redis_url: str = "redis://localhost:6379/0"

    # ── 认证 ──
    jwt_secret: str = "dev-insecure-change-me"
    jwt_algorithm: str = "HS256"
    access_token_ttl_min: int = 30
    refresh_token_ttl_days: int = 14

    # ── dmxapi（LLM 中转平台余额/计量；P3）──
    dmxapi_base: str = "https://www.dmxapi.cn"
    dmxapi_system_token: str = ""   # 工作台→个人设置→系统令牌
    dmxapi_user_id: str = ""        # Rix-Api-User
    dmxapi_quota_per_rmb: int = 500000  # RMB = quota / 500000

    # ── SSH 下发 / WebSSH（P3）——内网受信主机上的特权账号 ──
    ssh_admin_user: str = "labadmin"
    ssh_admin_key_path: str = ""    # labadmin 私钥路径（docker secret 挂载）

    # ── 腾讯会议预约（Playwright 自动化 vc.bnu.edu.cn 校园门户，非腾讯官方 API）──
    booking_url: str = "https://vc.bnu.edu.cn"
    booking_account: str = ""        # 校园统一身份认证学号
    booking_password: str = ""       # 门户密码（docker secret）
    booking_headless: bool = True    # 调试时可设 False 看浏览器
    booking_default_duration_hours: float = 2.0
    booking_auto_days_ahead: int = 3  # 自动预约：组会前几天

    @property
    def dmxapi_enabled(self) -> bool:
        return bool(self.dmxapi_system_token and self.dmxapi_user_id)

    @property
    def booking_enabled(self) -> bool:
        return bool(self.booking_account and self.booking_password)

    @property
    def is_prod(self) -> bool:
        return self.env == "prod"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
