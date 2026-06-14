"""认证 / 授权依赖 —— 从 Bearer token 解析当前用户，RBAC。"""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.security import decode_token
from app.models import Role, User

_bearer = HTTPBearer(auto_error=True)

DbSession = Annotated[AsyncSession, Depends(get_db)]
_credentials_error = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="无效或过期的凭据",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(
    db: DbSession,
    creds: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
) -> User:
    try:
        payload = decode_token(creds.credentials, expect="access")
    except JWTError as exc:
        raise _credentials_error from exc
    user = await db.get(User, payload.get("sub"))
    if user is None:
        raise _credentials_error
    if user.disabled:
        # 停用（软删除）即时全站失效——即便 access token 未过期也拒绝。
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="该账号已停用")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


async def require_admin(user: CurrentUser) -> User:
    if user.role != Role.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="需要管理员权限")
    return user


AdminUser = Annotated[User, Depends(require_admin)]
