"""用户路由 —— 成员名册（管理员）、个人资料更新、管理员增删改用户。"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError

from app.core.deps import AdminUser, CurrentUser, DbSession
from app.core.security import hash_password
from app.models import Attendance, Discussion, Presenter, Rating, User
from app.schemas.user import (
    UserAdminUpdate,
    UserCreate,
    UserDeleteResult,
    UserOut,
    UserSettingsUpdate,
)

router = APIRouter(prefix="/users", tags=["users"])


async def _cascade_rename(db: DbSession, user_id: str, old_name: str, new_name: str) -> None:
    """成员改名后，同步组会/评估表里去规范化的姓名快照，避免历史记录脱钩。

    组会报告人按 user_id 精确匹配；评估表（出勤/发言/评分）只存姓名字符串，按旧名匹配。
    """
    if not new_name or old_name == new_name:
        return
    await db.execute(update(Presenter).where(Presenter.user_id == user_id).values(name=new_name))
    await db.execute(update(Attendance).where(Attendance.name == old_name).values(name=new_name))
    await db.execute(update(Discussion).where(Discussion.name == old_name).values(name=new_name))
    await db.execute(update(Rating).where(Rating.presenter == old_name).values(presenter=new_name))


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
    old_name = u.name
    for k, v in data.items():
        if v is not None:
            setattr(u, k, str(v) if k == "email" else v)
    await _cascade_rename(db, u.id, old_name, u.name)
    await db.commit()
    await db.refresh(u)
    return u


@router.delete("/{user_id}", response_model=UserDeleteResult)
async def delete_user(user_id: str, me: AdminUser, db: DbSession) -> UserDeleteResult:
    """管理员删除用户。不能删自己。

    纯净账号（无任何历史关联）直接物理删除；有组会 / 请求 / 通知 / 密钥等历史
    关联的用户无法物理删除（外键约束），自动改为「停用」（软删除）——禁止登录、
    名册标灰，但历史记录全部保留。
    """
    if user_id == me.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="不能删除当前登录的自己")
    u = await db.get(User, user_id)
    if u is None:
        return UserDeleteResult(action="deleted", detail="用户不存在")
    name = u.name
    try:
        await db.delete(u)
        await db.commit()
        return UserDeleteResult(action="deleted", detail=f"已删除 {name}")
    except IntegrityError:
        await db.rollback()
        u = await db.get(User, user_id)
        if u is not None:
            u.disabled = True
            await db.commit()
        return UserDeleteResult(
            action="disabled",
            detail=f"{name} 有历史记录无法删除，已停用（无法登录，历史保留）",
        )


@router.patch("/me", response_model=UserOut)
async def update_me(body: UserSettingsUpdate, user: CurrentUser, db: DbSession) -> User:
    """更新本人资料 / 设置（「我的」页）。"""
    data = body.model_dump(exclude_unset=True)
    if "settings" in data and data["settings"] is not None:
        user.settings = {**(user.settings or {}), **data.pop("settings")}
    old_name = user.name
    for field, value in data.items():
        if value is not None:
            setattr(user, field, value)
    await _cascade_rename(db, user.id, old_name, user.name)
    await db.commit()
    await db.refresh(user)
    return user
