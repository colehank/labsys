"""腾讯会议预约路由 —— 管理员手动预约 + 自动预约开关。"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.config import settings
from app.core.deps import AdminUser, DbSession
from app.domains.booking.scheduler import auto_book_pass
from app.domains.booking.service import book_meeting
from app.domains.lab.serializers import meeting_out
from app.models import LabConfig, Meeting
from app.schemas.lab import MeetingOut

router = APIRouter(prefix="/booking", tags=["booking"])


class BookingSettings(BaseModel):
    enabled: bool        # 是否已配置凭据（只读）
    auto_book: bool      # 自动预约开关
    days_ahead: int      # 提前几天


class AutoBookUpdate(BaseModel):
    auto_book: bool


@router.get("/settings", response_model=BookingSettings)
async def get_settings(_: AdminUser, db: DbSession) -> BookingSettings:
    cfg = (await db.execute(select(LabConfig))).scalars().first()
    return BookingSettings(
        enabled=settings.booking_enabled,
        auto_book=bool(cfg and cfg.auto_book),
        days_ahead=settings.booking_auto_days_ahead,
    )


@router.put("/settings", response_model=BookingSettings)
async def update_settings(body: AutoBookUpdate, _: AdminUser, db: DbSession) -> BookingSettings:
    cfg = (await db.execute(select(LabConfig))).scalars().first()
    if cfg is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="缺少实验室配置")
    cfg.auto_book = body.auto_book
    await db.commit()
    return BookingSettings(
        enabled=settings.booking_enabled,
        auto_book=cfg.auto_book,
        days_ahead=settings.booking_auto_days_ahead,
    )


@router.post("/meetings/{meeting_id}/book", response_model=MeetingOut)
async def book_one(meeting_id: str, _: AdminUser, db: DbSession) -> MeetingOut:
    if not settings.booking_enabled:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail="未配置腾讯会议预约凭据（CIBOL_BOOKING_ACCOUNT / CIBOL_BOOKING_PASSWORD）")
    meeting = await db.get(Meeting, meeting_id)
    if meeting is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="组会不存在")
    try:
        meeting = await book_meeting(db, meeting)
    except Exception as exc:  # noqa: BLE001
        # 失败时 session 可能已脏：先回滚再用干净状态标记 failed
        await db.rollback()
        fresh = await db.get(Meeting, meeting_id)
        if fresh is not None:
            fresh.online_status = "failed"
            await db.commit()
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=f"预约失败：{exc}") from exc
    return meeting_out(meeting)


@router.post("/run-auto", status_code=status.HTTP_202_ACCEPTED)
async def run_auto(_: AdminUser) -> dict[str, str]:
    """立即触发一次自动预约扫描（便于管理员手动催一次）。"""
    if not settings.booking_enabled:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail="未配置预约凭据")
    await auto_book_pass()
    return {"status": "ok"}
