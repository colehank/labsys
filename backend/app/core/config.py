"""应用配置 — 全部从环境变量 / .env 读取（pydantic-settings）。

唯一真相源是仓库根目录的 `.env`（本地 `uv run` 经绝对路径读取；
容器里该路径不存在会被忽略，改由 docker compose 注入环境变量）。
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# config.py = <root>/backend/app/core/config.py → parents[3] = 仓库根
_ROOT_ENV = Path(__file__).resolve().parents[3] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_ROOT_ENV, env_prefix="CIBOL_", extra="ignore")

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

    # ── 邮件通知（校园 SMTP，如 mail.bnu.edu.cn）──
    smtp_host: str = ""             # SMTP 服务器，如 mail.bnu.edu.cn
    smtp_port: int = 465            # 465=SSL / 587=STARTTLS
    smtp_user: str = ""             # 发件邮箱账号
    smtp_password: str = ""         # 邮箱密码 / 授权码
    smtp_ssl: bool = True           # True=隐式 SSL(465)；False=STARTTLS(587)
    smtp_from: str = ""             # 发件显示地址；留空则用 smtp_user
    smtp_from_name: str = "CIBOL 实验室系统"  # 发件人显示名

    @property
    def dmxapi_enabled(self) -> bool:
        return bool(self.dmxapi_system_token and self.dmxapi_user_id)

    @property
    def smtp_enabled(self) -> bool:
        return bool(self.smtp_host and self.smtp_user and self.smtp_password)

    @property
    def smtp_sender(self) -> str:
        return self.smtp_from or self.smtp_user

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
