"""服务器路由 —— 用户只读清单；管理员增删改。"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.core.deps import AdminUser, CurrentUser, DbSession
from app.models import Server
from app.schemas.server import ServerCreate, ServerOut, ServerUpdate

router = APIRouter(prefix="/servers", tags=["servers"])


@router.get("", response_model=list[ServerOut])
async def list_servers(_: CurrentUser, db: DbSession) -> list[Server]:
    return list((await db.execute(select(Server).order_by(Server.name))).scalars())


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
