"""腾讯会议预约服务层 —— 串起 booking.py 与 Meeting 持久化。

凭据从 settings 注入（booking.py 本身是纯函数，不读 settings）。
未配置 BOOKING_ACCOUNT/PASSWORD 时抛 RuntimeError，调用方据此降级。

**关键设计（并发/连接稳定性）**：腾讯会议预约是 2~4 分钟的浏览器自动化（含等
门户审批发号）。若在此期间持有调用方传入的请求级 DB 会话，长时间空闲的 asyncpg
连接会失效，导致后续提交抛 ``MissingGreenlet``。故本服务**自包含**：只按 id 工作，
跑 Playwright 时不持有任何 DB 连接，前后各用一个全新短会话读取/写回。
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.db import SessionLocal
from app.domains.booking.booking import book_tencent_meeting
from app.domains.lab.serializers import meeting_out
from app.models import Meeting
from app.schemas.lab import MeetingOut


# 组会时间字段形如 "14:00 – 16:00" / "14:00-16:00"，取起始 HH:MM 给门户
def _start_hhmm(time_str: str | None) -> str:
    if not time_str:
        return "14:00"
    head = time_str.replace("–", "-").split("-")[0].strip()
    return head or "14:00"


async def book_meeting(meeting_id: str, *, duration_hours: float | None = None) -> MeetingOut:
    """为一场组会预约腾讯会议，结果写回 Meeting.online_*，返回序列化后的会议。

    自包含：只按 meeting_id 工作，跑 Playwright 期间不持有 DB 连接。
    成功 → online_status="ok" + url/id/password；失败 → 标记 failed 后抛异常。
    meeting 不存在 → LookupError。
    """
    if not settings.booking_enabled:
        raise RuntimeError("未配置腾讯会议预约凭据（CIBOL_BOOKING_ACCOUNT / CIBOL_BOOKING_PASSWORD）")

    # 1) 短会话读取所需字段，随即释放连接
    async with SessionLocal() as db:
        meeting = await db.get(Meeting, meeting_id)
        if meeting is None:
            raise LookupError("组会不存在")
        # 主题保持短、无分隔符 —— 门户会议列表对长主题会截断，影响读回匹配
        topic = f"CIBOL组会 {meeting.date.isoformat()}"
        date_iso = meeting.date.isoformat()
        time_hhmm = _start_hhmm(meeting.time)

    # 2) 跑 Playwright（不持有任何 DB 连接，可能耗时 2~4 分钟）
    try:
        result = await book_tencent_meeting(
            topic=topic,
            date=date_iso,
            time=time_hhmm,
            duration_hours=duration_hours or settings.booking_default_duration_hours,
            password="",  # 用门户默认密码
            account=settings.booking_account,
            account_password=settings.booking_password,
            booking_url=settings.booking_url,
            headless=settings.booking_headless,
        )
    except Exception:
        # 全新会话标记 failed（不沿用任何旧连接）
        async with SessionLocal() as db:
            m = await db.get(Meeting, meeting_id)
            if m is not None:
                m.online_status = "failed"
                await db.commit()
        raise

    # 3) 全新会话写回成功结果并序列化返回（脱离会话）
    async with SessionLocal() as db:
        m = await db.get(Meeting, meeting_id)
        if m is None:
            raise LookupError("组会不存在")
        m.online_url = result.get("url") or None
        m.online_provider = "tencent"
        m.online_id = result.get("meeting_id") or None
        m.online_password = result.get("password") or None
        m.online_status = "ok"
        await db.commit()
        # 预加载 presenters 关系——meeting_out 会访问它，异步下不能靠懒加载
        m = (
            await db.execute(
                select(Meeting)
                .where(Meeting.id == meeting_id)
                .options(selectinload(Meeting.presenters))
            )
        ).scalars().first()
        return meeting_out(m)
