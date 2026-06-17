"""通知路由 —— 我的站内信、标记已读。"""
from __future__ import annotations

from fastapi import APIRouter, status
from sqlalchemy import select, update

from app.core.deps import CurrentUser, DbSession
from app.models import Notification
from app.schemas.server import NotificationOut

router = APIRouter(prefix="/notifications", tags=["notify"])


@router.get("", response_model=list[NotificationOut])
async def my_notifications(me: CurrentUser, db: DbSession) -> list[Notification]:
    return list(
        (
            await db.execute(
                select(Notification)
                .where(Notification.user_id == me.id)
                .order_by(Notification.created_at.desc())
                .limit(50)
            )
        ).scalars()
    )


@router.post("/{notif_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_read(notif_id: str, me: CurrentUser, db: DbSession) -> None:
    n = await db.get(Notification, notif_id)
    if n is not None and n.user_id == me.id:
        n.read = True
        await db.commit()


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_read(me: CurrentUser, db: DbSession) -> None:
    await db.execute(
        update(Notification).where(Notification.user_id == me.id).values(read=True)
    )
    await db.commit()
