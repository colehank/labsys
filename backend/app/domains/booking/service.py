"""腾讯会议预约服务层 —— 串起 booking.py 与 Meeting 持久化。

凭据从 settings 注入（booking.py 本身是纯函数，不读 settings）。
未配置 BOOKING_ACCOUNT/PASSWORD 时抛 RuntimeError，调用方据此降级。
"""
from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.domains.booking.booking import book_tencent_meeting
from app.models import Meeting

# 组会时间字段形如 "14:00 – 16:00" / "14:00-16:00"，取起始 HH:MM 给门户
def _start_hhmm(time_str: str | None) -> str:
    if not time_str:
        return "14:00"
    head = time_str.replace("–", "-").split("-")[0].strip()
    return head or "14:00"


async def book_meeting(db: AsyncSession, meeting: Meeting, *, duration_hours: float | None = None) -> Meeting:
    """为一场组会预约腾讯会议，结果写回 meeting.online_*。

    成功：online_status="ok" + url/id/password。
    失败：抛异常（路由层捕获转成 4xx/通知）；不静默吞。
    """
    if not settings.booking_enabled:
        raise RuntimeError("未配置腾讯会议预约凭据（CIBOL_BOOKING_ACCOUNT / CIBOL_BOOKING_PASSWORD）")

    # 主题保持短、无分隔符 —— 门户会议列表对长主题会截断，影响读回匹配
    topic = f"CIBOL组会 {meeting.date.isoformat()}"
    result = await book_tencent_meeting(
        topic=topic,
        date=meeting.date.isoformat(),
        time=_start_hhmm(meeting.time),
        duration_hours=duration_hours or settings.booking_default_duration_hours,
        password="",  # 用门户默认密码
        account=settings.booking_account,
        account_password=settings.booking_password,
        booking_url=settings.booking_url,
        headless=settings.booking_headless,
    )

    meeting.online_url = result.get("url") or None
    meeting.online_provider = "tencent"
    meeting.online_id = result.get("meeting_id") or None
    meeting.online_password = result.get("password") or None
    meeting.online_status = "ok"
    await db.commit()
    await db.refresh(meeting)
    return meeting
