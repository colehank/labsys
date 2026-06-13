"""SSH 账号下发 —— 用特权账号在目标机 useradd 并注入用户公钥。

在 turing 内网受信主机上运行，可直连 lecun/hinton/fodor。
凭据：labadmin 私钥（docker secret，settings.ssh_admin_key_path），绝不下放浏览器。
未配置私钥时抛 RuntimeError，调用方据此降级（标记 pending + 通知管理员手动处理）。

⚠️ 需真实目标机 + labadmin 账号才能 E2E；本地开发环境无法验证执行。
"""
from __future__ import annotations

import shlex

import asyncssh

from app.core.config import settings


async def provision_account(host: str, username: str, pubkey: str) -> None:
    """在 host 上为 username 建账号并注入 pubkey。幂等：已存在则跳过建号。"""
    if not settings.ssh_admin_key_path:
        raise RuntimeError("未配置 labadmin SSH 私钥（settings.ssh_admin_key_path）")

    u = shlex.quote(username)
    key = shlex.quote(pubkey.strip())
    async with asyncssh.connect(
        host, username=settings.ssh_admin_user,
        client_keys=[settings.ssh_admin_key_path], known_hosts=None,
    ) as conn:
        # 幂等建号
        await conn.run(f"id -u {u} >/dev/null 2>&1 || sudo useradd -m {u}", check=True)
        # 注入公钥
        script = (
            f"sudo -u {u} bash -lc 'mkdir -p ~/.ssh && chmod 700 ~/.ssh && "
            f"touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && "
            f"grep -qF {key} ~/.ssh/authorized_keys || echo {key} >> ~/.ssh/authorized_keys'"
        )
        await conn.run(script, check=True)
