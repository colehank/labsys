"""用户路由 —— 成员名册（管理员）、个人资料更新。"""
from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import select

from app.core.deps import AdminUser, CurrentUser, DbSession
from app.models import User
from app.schemas.user import UserOut, UserSettingsUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
async def list_users(_: AdminUser, db: DbSession) -> list[User]:
    """成员名册 —— 管理员可见（人员管理页）。"""
    return list((await db.execute(select(User).order_by(User.created_at))).scalars())


@router.patch("/me", response_model=UserOut)
async def update_me(body: UserSettingsUpdate, user: CurrentUser, db: DbSession) -> User:
    """更新本人资料 / 设置（「我的」页）。"""
    data = body.model_dump(exclude_unset=True)
    if "settings" in data and data["settings"] is not None:
        user.settings = {**(user.settings or {}), **data.pop("settings")}
    for field, value in data.items():
        if value is not None:
            setattr(user, field, value)
    await db.commit()
    await db.refresh(user)
    return user
