"""通知服务 —— 统一入口：写一条站内通知，并（可选）同时发邮件。

业务侧只需调用 ``notify(db, user_id=..., title=..., body=...)``，由本层决定
落库 + 是否发邮件。站内通知同步落库（真相源）；邮件为尽力而为（见 mailer），
传入 FastAPI ``BackgroundTasks`` 时在响应返回后再发、不拖慢业务请求。
"""
from __future__ import annotations

from fastapi import BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.domains.notify.mailer import send_email
from app.models import Notification, User


async def notify(
    db: AsyncSession,
    *,
    user_id: str,
    title: str,
    body: str = "",
    type: str = "info",
    send_mail: bool = True,
    tasks: BackgroundTasks | None = None,
) -> None:
    """给某用户写一条站内通知；若开启邮件且用户有邮箱，再尽力发一封同内容邮件。

    站内通知在调用方会话里落库并提交。邮件：传入 ``tasks`` 则放后台任务（响应后发，
    不拖慢请求）；否则当场 await。任一邮件失败仅记日志、不抛错。
    """
    db.add(Notification(user_id=user_id, type=type, title=title, body=body))
    await db.commit()

    if not (send_mail and settings.smtp_enabled):
        return
    user = await db.get(User, user_id)
    if user is None or not user.email:
        return

    text = f"{title}\n\n{body}".strip() if body else title
    subject = f"【CIBOL】{title}"
    if tasks is not None:
        tasks.add_task(send_email, user.email, subject, text)
    else:
        await send_email(user.email, subject, text)
