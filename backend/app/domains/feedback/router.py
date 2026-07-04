"""匿名意见路由 —— 成员匿名提交，管理员查看/标记已读。

提交端点刻意不记录提交者身份（不写 user 关联），兑现「完全匿名」承诺。
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from app.core.deps import AdminUser, CurrentUser, DbSession
from app.models import Feedback
from app.schemas.feedback import FeedbackCreate, FeedbackOut

router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.post("", status_code=status.HTTP_204_NO_CONTENT)
async def submit_feedback(body: FeedbackCreate, _: CurrentUser, db: DbSession) -> None:
    """任意登录成员匿名提交；不落任何身份信息。"""
    text = body.body.strip()
    if not text:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="内容不能为空")
    db.add(Feedback(body=text, created_at=datetime.now(timezone.utc)))
    await db.commit()


@router.get("", response_model=list[FeedbackOut])
async def list_feedback(_: AdminUser, db: DbSession) -> list[Feedback]:
    """管理员查看全部匿名意见，按时间倒序。"""
    return list((await db.execute(
        select(Feedback).order_by(Feedback.created_at.desc())
    )).scalars())


@router.get("/unread-count")
async def unread_count(_: AdminUser, db: DbSession) -> dict[str, int]:
    n = (await db.execute(
        select(func.count()).select_from(Feedback).where(Feedback.read.is_(False))
    )).scalar_one()
    return {"count": int(n)}


@router.post("/{fb_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_feedback_read(fb_id: str, _: AdminUser, db: DbSession) -> None:
    fb = await db.get(Feedback, fb_id)
    if fb is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="意见不存在")
    fb.read = True
    await db.commit()


@router.delete("/{fb_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_feedback(fb_id: str, _: AdminUser, db: DbSession) -> None:
    """管理员删除意见（清理无效/违规条目）。"""
    fb = await db.get(Feedback, fb_id)
    if fb is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="意见不存在")
    await db.delete(fb)
    await db.commit()
