"""dmxapi.cn 余额/用量封装。

接口（见 DESIGN.md §5.3 / https://doc.dmxapi.com/）：
  账户总余额：GET {base}/api/user/self          头 Authorization + Rix-Api-User → data.quota
  单令牌余额：GET {base}/api/token/key/{sk}      头 Rix-Api-User → used_quota / remain_quota
  RMB = quota / dmxapi_quota_per_rmb（默认 500000）
未配置凭据时（dmxapi_enabled False）返回 None，调用方据此降级展示。
"""
from __future__ import annotations

import httpx

from app.core.config import settings


def quota_to_rmb(quota: int | float | None) -> float | None:
    if quota is None:
        return None
    return round(quota / settings.dmxapi_quota_per_rmb, 6)


async def account_balance() -> dict | None:
    """实验室 dmxapi 账户总额度（管理员看板）。"""
    if not settings.dmxapi_enabled:
        return None
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {settings.dmxapi_system_token}",
        "Rix-Api-User": settings.dmxapi_user_id,
    }
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.get(f"{settings.dmxapi_base}/api/user/self", headers=headers)
        r.raise_for_status()
        quota = (r.json().get("data") or {}).get("quota")
    return {"quota": quota, "rmb": quota_to_rmb(quota)}


async def token_balance(sk: str) -> dict | None:
    """单个令牌(密钥)的已用/剩余额度（成员用量条）。"""
    if not settings.dmxapi_enabled or not sk:
        return None
    headers = {"Accept": "application/json", "Rix-Api-User": settings.dmxapi_user_id}
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.get(f"{settings.dmxapi_base}/api/token/key/{sk}", headers=headers)
        r.raise_for_status()
        d = r.json()
    used = d.get("used_quota")
    remain = d.get("remain_quota")
    return {
        "used_quota": used, "remain_quota": remain,
        "used_rmb": quota_to_rmb(used), "remain_rmb": quota_to_rmb(remain),
    }
