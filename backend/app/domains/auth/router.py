"""认证路由 —— 登录、刷新、当前用户、改密。"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from jose import JWTError
from sqlalchemy import select

from app.core.deps import CurrentUser, DbSession
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models import User
from app.schemas.auth import (
    AccessToken,
    ChangePasswordRequest,
    LoginRequest,
    RefreshRequest,
    TokenPair,
)
from app.schemas.user import UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenPair)
async def login(body: LoginRequest, db: DbSession) -> TokenPair:
    user = (await db.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="邮箱或密码错误")
    if user.disabled:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="该账号已停用，请联系管理员")
    return TokenPair(
        access_token=create_access_token(user.id, user.role.value),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/refresh", response_model=AccessToken)
async def refresh(body: RefreshRequest, db: DbSession) -> AccessToken:
    try:
        payload = decode_token(body.refresh_token, expect="refresh")
    except JWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="刷新令牌无效") from exc
    user = await db.get(User, payload.get("sub"))
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="用户不存在")
    if user.disabled:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="该账号已停用")
    return AccessToken(access_token=create_access_token(user.id, user.role.value))


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser) -> User:
    return user


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(body: ChangePasswordRequest, user: CurrentUser, db: DbSession) -> None:
    if not verify_password(body.old_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="原密码错误")
    user.password_hash = hash_password(body.new_password)
    await db.commit()
