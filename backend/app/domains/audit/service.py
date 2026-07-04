"""审计日志写入 helper（反馈 #14）。

调用方在业务操作的同一事务里调用 write_audit，随业务一起 commit —— 保证「操作成功才留痕」。
"""
from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditLog


async def write_audit(
    db: AsyncSession, *, actor: str, action: str, summary: str, detail: dict | None = None
) -> None:
    db.add(AuditLog(actor=actor or "?", action=action, summary=summary[:255], detail=detail or {}))
    await db.flush()
