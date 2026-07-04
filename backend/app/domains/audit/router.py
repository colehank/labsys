"""审计日志查询路由（管理员）——「谁·何时·做了什么」，反馈 #14。只读，无撤销。"""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.core.deps import AdminUser, DbSession
from app.models import AuditLog

router = APIRouter(prefix="/audit-logs", tags=["audit"])


class AuditLogOut(BaseModel):
    id: str
    actor: str
    action: str
    summary: str
    detail: dict = {}
    created_at: datetime = Field(serialization_alias="createdAt")

    model_config = {"populate_by_name": True}


@router.get("", response_model=list[AuditLogOut])
async def list_audit_logs(_: AdminUser, db: DbSession, limit: int = 200) -> list[AuditLogOut]:
    rows = list((await db.execute(
        select(AuditLog).order_by(AuditLog.created_at.desc()).limit(max(1, min(limit, 500)))
    )).scalars())
    return [
        AuditLogOut(id=r.id, actor=r.actor, action=r.action, summary=r.summary,
                    detail=r.detail or {}, created_at=r.created_at)
        for r in rows
    ]
