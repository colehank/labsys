"""对称加密 —— 用于把用户保存的 SSH 密码加密存库。

密钥来自 settings.ssh_cred_key（一段 Fernet key，放 .env，绝不入库/不进代码）。
未配置密钥时 ``cred_enabled`` 为 False，保存/读取凭据的功能整体降级（前端回退到每次手输）。

生成一个密钥：``python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"``
"""
from __future__ import annotations

from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


@lru_cache(maxsize=1)
def _fernet() -> Fernet | None:
    key = settings.ssh_cred_key.strip()
    if not key:
        return None
    return Fernet(key.encode())


def cred_enabled() -> bool:
    """是否已配置加密密钥（决定能否保存 SSH 凭据）。"""
    return _fernet() is not None


def encrypt(plaintext: str) -> str:
    """加密一段明文，返回可入库的字符串。未配置密钥则抛 RuntimeError。"""
    f = _fernet()
    if f is None:
        raise RuntimeError("未配置 SSH 凭据加密密钥（CIBOL_SSH_CRED_KEY）")
    return f.encrypt(plaintext.encode()).decode()


def decrypt(token: str) -> str | None:
    """解密入库的密文；密钥未配置或密文损坏/换过密钥时返回 None（不抛错）。"""
    f = _fernet()
    if f is None:
        return None
    try:
        return f.decrypt(token.encode()).decode()
    except (InvalidToken, ValueError):
        return None
