"""服务器路由 —— 用户只读清单；管理员增删改；用户自己的 SSH 凭据保存/清除。"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.crypto import cred_enabled
from app.core.deps import AdminUser, CurrentUser, DbSession
from app.models import Server, ServerCredential
from app.schemas.server import ServerCreate, ServerOut, ServerUpdate

router = APIRouter(prefix="/servers", tags=["servers"])


class CredentialStatus(BaseModel):
    saved: bool          # 是否已保存可用凭据（前端据此自动连接）
    username: str = ""   # 已保存的账号（跨设备带出来填充）
    feature: bool        # 后端是否启用了凭据加密（未配密钥则不能保存）


@router.get("", response_model=list[ServerOut])
async def list_servers(_: CurrentUser, db: DbSession) -> list[Server]:
    return list((await db.execute(select(Server).order_by(Server.name))).scalars())


@router.get("/{server_id}/credential", response_model=CredentialStatus)
async def get_credential(server_id: str, me: CurrentUser, db: DbSession) -> CredentialStatus:
    """查询「我」在某服务器是否已保存凭据（绝不返回密码本身）。"""
    cred = (await db.execute(
        select(ServerCredential).where(
            ServerCredential.user_id == me.id,
            ServerCredential.server_id == server_id,
        )
    )).scalars().first()
    return CredentialStatus(
        saved=cred is not None,
        username=cred.username if cred else "",
        feature=cred_enabled(),
    )


@router.delete("/{server_id}/credential", status_code=status.HTTP_204_NO_CONTENT)
async def delete_credential(server_id: str, me: CurrentUser, db: DbSession) -> None:
    """清除「我」在某服务器保存的凭据。"""
    cred = (await db.execute(
        select(ServerCredential).where(
            ServerCredential.user_id == me.id,
            ServerCredential.server_id == server_id,
        )
    )).scalars().first()
    if cred is not None:
        await db.delete(cred)
        await db.commit()


@router.post("", response_model=ServerOut, status_code=status.HTTP_201_CREATED)
async def create_server(body: ServerCreate, _: AdminUser, db: DbSession) -> Server:
    srv = Server(**body.model_dump())
    db.add(srv)
    await db.commit()
    await db.refresh(srv)
    return srv


@router.patch("/{server_id}", response_model=ServerOut)
async def update_server(server_id: str, body: ServerUpdate, _: AdminUser, db: DbSession) -> Server:
    srv = await db.get(Server, server_id)
    if srv is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="服务器不存在")
    for k, v in body.model_dump(exclude_unset=True).items():
        if v is not None:
            setattr(srv, k, v)
    await db.commit()
    await db.refresh(srv)
    return srv


@router.delete("/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_server(server_id: str, _: AdminUser, db: DbSession) -> None:
    srv = await db.get(Server, server_id)
    if srv is not None:
        await db.delete(srv)
        await db.commit()
