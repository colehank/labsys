"""自动预约调度 —— 每天扫描临近组会，提前 N 天自动建腾讯会议。

仅当 LabConfig.auto_book 开启且 settings.booking_enabled 时实际预约。
失败不影响其它组会：标记 online_status="failed" 并记录日志，下次扫描会重试。
"""
from __future__ import annotations

import logging
from datetime import date, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select

from app.core.config import settings
from app.core.db import SessionLocal
from app.domains.booking.service import book_meeting
from app.models import LabConfig, Meeting

log = logging.getLogger("cibol.booking")
_scheduler: AsyncIOScheduler | None = None


async def auto_book_pass() -> None:
    """一次扫描：对 [今天, 今天+N] 内、尚未成功预约的组会逐个预约。"""
    if not settings.booking_enabled:
        return
    # 先用短会话收集待预约的会议 id（随即释放连接），再逐个用自包含的 book_meeting
    async with SessionLocal() as db:
        cfg = (await db.execute(select(LabConfig))).scalars().first()
        if cfg is None or not cfg.auto_book:
            return
        horizon = date.today() + timedelta(days=settings.booking_auto_days_ahead)
        rows = (await db.execute(
            select(Meeting)
            .where(Meeting.date >= date.today(), Meeting.date <= horizon)
        )).scalars().all()
        todo = [
            (m.id, m.date, m.type)
            for m in rows
            if not (m.online_status == "ok" and m.online_url)
        ]

    for mid, mdate, mtype in todo:
        try:
            await book_meeting(mid)  # 自管会话；失败内部已标记 failed
            log.info("自动预约成功：%s %s", mdate, mtype)
        except Exception as exc:  # noqa: BLE001 —— 单场失败不阻断其它
            log.warning("自动预约失败：%s %s — %s", mdate, mtype, exc)


def start_scheduler() -> None:
    """应用启动时调用：每天 08:00 跑一次自动预约扫描。"""
    global _scheduler
    if _scheduler is not None or not settings.booking_enabled:
        return
    _scheduler = AsyncIOScheduler(timezone="Asia/Shanghai")
    _scheduler.add_job(auto_book_pass, "cron", hour=8, minute=0, id="auto_book", replace_existing=True)
    _scheduler.start()
    log.info("腾讯会议自动预约调度已启动（每日 08:00，提前 %d 天）", settings.booking_auto_days_ahead)


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
