"""密码哈希与 JWT 签发/校验。"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings

TokenType = Literal["access", "refresh"]


def _to72(raw: str) -> bytes:
    # bcrypt 仅取前 72 字节，超出会报错 —— 主动截断以容纳长口令。
    return raw.encode("utf-8")[:72]


def hash_password(raw: str) -> str:
    return bcrypt.hashpw(_to72(raw), bcrypt.gensalt()).decode("utf-8")


def verify_password(raw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(_to72(raw), hashed.encode("utf-8"))
    except ValueError:
        return False


def _create_token(sub: str, kind: TokenType, ttl: timedelta, extra: dict[str, Any]) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": sub,
        "type": kind,
        "iat": now,
        "exp": now + ttl,
        "jti": uuid.uuid4().hex,
        **extra,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(sub: str, role: str) -> str:
    return _create_token(
        sub, "access", timedelta(minutes=settings.access_token_ttl_min), {"role": role}
    )


def create_refresh_token(sub: str) -> str:
    return _create_token(
        sub, "refresh", timedelta(days=settings.refresh_token_ttl_days), {}
    )


def decode_token(token: str, expect: TokenType) -> dict[str, Any]:
    """解码并校验 token 类型；失败抛 JWTError。"""
    payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    if payload.get("type") != expect:
        raise JWTError(f"expected {expect} token")
    return payload
