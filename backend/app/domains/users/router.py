"""用户路由 —— 成员名册（管理员）、个人资料更新、管理员增删改用户。"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.deps import AdminUser, CurrentUser, DbSession
from app.core.security import hash_password
from app.models import User
from app.schemas.user import UserAdminUpdate, UserCreate, UserOut, UserSettingsUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
async def list_users(_: AdminUser, db: DbSession) -> list[User]:
    """成员名册 —— 管理员可见（人员管理页）。"""
    return list((await db.execute(select(User).order_by(User.created_at))).scalars())


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(body: UserCreate, _: AdminUser, db: DbSession) -> User:
    """管理员新建用户（设邮箱/密码/身份/权限）。邮箱不限域名。"""
    dup = (await db.execute(select(User).where(User.email == str(body.email)))).scalar_one_or_none()
    if dup is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="该邮箱已被注册")
    u = User(
        email=str(body.email), name=body.name.strip(), title=body.title.strip(),
        role=body.role, password_hash=hash_password(body.password), settings={},
    )
    db.add(u)
    await db.commit()
    await db.refresh(u)
    return u


@router.patch("/{user_id}", response_model=UserOut)
async def admin_update_user(user_id: str, body: UserAdminUpdate, _: AdminUser, db: DbSession) -> User:
    """管理员改用户资料 / 权限 / 密码（password 留空则不改）。"""
    u = await db.get(User, user_id)
    if u is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="用户不存在")
    data = body.model_dump(exclude_unset=True)
    pwd = data.pop("password", None)
    if pwd:
        u.password_hash = hash_password(pwd)
    new_email = data.get("email")
    if new_email and str(new_email) != u.email:
        dup = (await db.execute(select(User).where(User.email == str(new_email)))).scalar_one_or_none()
        if dup is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="该邮箱已被注册")
    for k, v in data.items():
        if v is not None:
            setattr(u, k, str(v) if k == "email" else v)
    await db.commit()
    await db.refresh(u)
    return u


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: str, me: AdminUser, db: DbSession) -> None:
    """管理员删除用户。不能删自己；有历史关联（组会/请求等）的用户会被拒。"""
    if user_id == me.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="不能删除当前登录的自己")
    u = await db.get(User, user_id)
    if u is None:
        return
    try:
        await db.delete(u)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="该用户存在关联记录（组会报告 / 请求 / 密钥等），无法删除",
        )


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
