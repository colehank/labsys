"""用户 SSH 账密路由 —— 用户级、与服务器解耦、可多条。

供「设置 → 服务器账密」和「服务器」页共用同一份存储：列出 / 新增或更新 / 删除。
绝不返回密码本身；密码加密落库（见 core/crypto）。
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.crypto import cred_enabled, encrypt
from app.core.deps import AdminUser, CurrentUser, DbSession
from app.models import SshCredential, User

router = APIRouter(prefix="/credentials", tags=["credentials"])


class CredOut(BaseModel):
    id: str
    username: str


class CredCreate(BaseModel):
    username: str
    password: str


class CredIssue(BaseModel):
    user_name: str
    username: str
    password: str


class CredList(BaseModel):
    feature: bool          # 后端是否启用了加密（未配密钥则不能保存）
    items: list[CredOut]


@router.get("", response_model=CredList)
async def list_credentials(me: CurrentUser, db: DbSession) -> CredList:
    rows = (await db.execute(
        select(SshCredential).where(SshCredential.user_id == me.id).order_by(SshCredential.username)
    )).scalars().all()
    return CredList(feature=cred_enabled(), items=[CredOut(id=c.id, username=c.username) for c in rows])


@router.post("", response_model=CredOut, status_code=status.HTTP_201_CREATED)
async def upsert_credential(body: CredCreate, me: CurrentUser, db: DbSession) -> CredOut:
    """新增或更新一条账密（同名即更新密码）。"""
    if not cred_enabled():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail="未配置凭据加密密钥")
    username = body.username.strip()
    if not username:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="账号不能为空")
    cred = (await db.execute(
        select(SshCredential).where(
            SshCredential.user_id == me.id, SshCredential.username == username
        )
    )).scalars().first()
    if cred is None:
        cred = SshCredential(user_id=me.id, username=username, password_enc=encrypt(body.password))
        db.add(cred)
    else:
        cred.password_enc = encrypt(body.password)
    await db.commit()
    await db.refresh(cred)
    return CredOut(id=cred.id, username=cred.username)


@router.post("/issue", response_model=CredOut, status_code=status.HTTP_201_CREATED)
async def issue_credential(body: CredIssue, _: AdminUser, db: DbSession) -> CredOut:
    """管理员下发：把服务器账密写入某成员的「我的 · SSH 账密」（审批 ssh 申请后调用）。

    同名即更新密码。绝不返回密码本身；密码加密落库。
    """
    if not cred_enabled():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail="未配置凭据加密密钥")
    user = (await db.execute(select(User).where(User.name == body.user_name))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="成员不存在")
    username = body.username.strip()
    if not username:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="账号不能为空")
    cred = (await db.execute(
        select(SshCredential).where(
            SshCredential.user_id == user.id, SshCredential.username == username
        )
    )).scalars().first()
    if cred is None:
        cred = SshCredential(user_id=user.id, username=username, password_enc=encrypt(body.password))
        db.add(cred)
    else:
        cred.password_enc = encrypt(body.password)
    await db.commit()
    await db.refresh(cred)
    return CredOut(id=cred.id, username=cred.username)


@router.delete("/{cred_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_credential(cred_id: str, me: CurrentUser, db: DbSession) -> None:
    cred = await db.get(SshCredential, cred_id)
    if cred is not None and cred.user_id == me.id:
        await db.delete(cred)
        await db.commit()
