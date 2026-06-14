"""请求路由 —— 创建 / 我的 / 状态迁移 / 审批队列。"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload

from app.core.deps import AdminUser, CurrentUser, DbSession
from app.domains.notify.service import notify
from app.domains.requests.engine import can_transition, initial_status, required_role
from app.models import Request, RequestEvent, RequestKind, Role, User
from app.schemas.request import AdvanceRequest, CreateRequest, RequestEventOut, RequestOut

router = APIRouter(prefix="/requests", tags=["requests"])

# 各申请类型的中文标签 —— 用于审批结果通知文案
_KIND_LABEL = {
    "swap": "组会调换",
    "absence": "轮空请假",
    "api": "API 密钥申请",
    "ssh": "服务器账号申请",
}

_INITIAL_NOTE = {
    "swap": "已发送对调请求",
    "absence": "已提交轮空请假，等待管理员审批",
    "api": "已提交 API 密钥申请，等待管理员下发",
    "ssh": "已提交服务器账号申请",
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _serialize(r: Request, me_id: str) -> RequestOut:
    return RequestOut(
        id=r.id,
        kind=r.kind,
        from_=r.requester.name if r.requester else "",
        toName=r.target.name if r.target else "",
        fromDate=r.from_date,
        toDate=r.to_date,
        topic=r.topic,
        detail=r.detail,
        reason=r.reason,
        status=r.status,
        incoming=r.target_user_id == me_id and r.requester_id != me_id,
        createdAt=r.created_at,
        history=[RequestEventOut(status=e.status, note=e.note, at=e.at) for e in r.events],
    )


_LOAD = (
    selectinload(Request.requester),
    selectinload(Request.target),
    selectinload(Request.events),
)


async def _get_loaded(db, req_id: str) -> Request | None:
    return (
        await db.execute(select(Request).where(Request.id == req_id).options(*_LOAD))
    ).scalar_one_or_none()


@router.post("", response_model=RequestOut, status_code=status.HTTP_201_CREATED)
async def create_request(body: CreateRequest, me: CurrentUser, db: DbSession) -> RequestOut:
    target_id = None
    if body.toName:
        target = (
            await db.execute(select(User).where(User.name == body.toName))
        ).scalar_one_or_none()
        target_id = target.id if target else None

    st = initial_status(body.kind)
    at = _now()
    req = Request(
        kind=body.kind, requester_id=me.id, target_user_id=target_id,
        from_date=body.fromDate, to_date=body.toDate, topic=body.topic,
        detail=body.detail, reason=body.reason, status=st,
        events=[RequestEvent(status=st, note=body.note or _INITIAL_NOTE.get(body.kind.value, "已提交"), actor_id=me.id, at=at)],
    )
    db.add(req)
    await db.commit()
    loaded = await _get_loaded(db, req.id)
    return _serialize(loaded, me.id)


@router.get("/mine", response_model=list[RequestOut])
async def my_requests(me: CurrentUser, db: DbSession) -> list[RequestOut]:
    """与我相关的全部请求（我发起的 + 收到的对调），按时间倒序。"""
    rows = list(
        (
            await db.execute(
                select(Request)
                .where(or_(Request.requester_id == me.id, Request.target_user_id == me.id))
                .options(*_LOAD)
                .order_by(Request.created_at.desc())
            )
        ).scalars()
    )
    return [_serialize(r, me.id) for r in rows]


@router.get("/pending", response_model=list[RequestOut])
async def pending_requests(admin: AdminUser, db: DbSession) -> list[RequestOut]:
    """审批中心队列：请假/API/SSH 中待管理员处理（submitted）的请求。"""
    rows = list(
        (
            await db.execute(
                select(Request)
                .where(
                    Request.kind.in_([RequestKind.absence, RequestKind.api, RequestKind.ssh]),
                    Request.status == "submitted",
                )
                .options(*_LOAD)
                .order_by(Request.created_at.desc())
            )
        ).scalars()
    )
    return [_serialize(r, admin.id) for r in rows]


@router.get("/processed", response_model=list[RequestOut])
async def processed_requests(admin: AdminUser, db: DbSession) -> list[RequestOut]:
    """审批中心历史：请假/API/SSH 中已通过或已驳回的，按时间倒序。"""
    rows = list(
        (
            await db.execute(
                select(Request)
                .where(
                    Request.kind.in_([RequestKind.absence, RequestKind.api, RequestKind.ssh]),
                    Request.status.in_(["approved", "rejected"]),
                )
                .options(*_LOAD)
                .order_by(Request.created_at.desc())
            )
        ).scalars()
    )
    return [_serialize(r, admin.id) for r in rows]


@router.post("/{req_id}/advance", response_model=RequestOut)
async def advance_request(
    req_id: str, body: AdvanceRequest, me: CurrentUser, db: DbSession,
    tasks: BackgroundTasks,
) -> RequestOut:
    req = await _get_loaded(db, req_id)
    if req is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="请求不存在")
    if not can_transition(req.kind, req.status, body.next):
        raise HTTPException(status.HTTP_409_CONFLICT, detail=f"非法状态迁移 {req.status} → {body.next}")

    # 授权
    role = required_role(req.kind, body.next)
    if role == "requester" and req.requester_id != me.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="只有发起人可撤回")
    if role == "target" and req.target_user_id != me.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="只有对方可确认对调")
    if role == "admin" and me.role != Role.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="需要管理员审批")

    req.status = body.next
    requester_id = req.requester_id
    kind_label = _KIND_LABEL.get(req.kind.value, "申请")
    req.events.append(RequestEvent(status=body.next, note=body.note, actor_id=me.id, at=_now()))
    await db.commit()

    # 审批有结果时通知发起人（站内 + 邮件，邮件走后台不拖慢响应）
    if body.next in ("approved", "rejected") and requester_id != me.id:
        result = "已通过 ✅" if body.next == "approved" else "已驳回"
        note = f"\n备注：{body.note}" if body.note else ""
        await notify(
            db, user_id=requester_id, type="approval",
            title=f"你的{kind_label}{result}",
            body=f"管理员已处理你的{kind_label}。{note}".strip(),
            tasks=tasks,
        )

    loaded = await _get_loaded(db, req_id)
    return _serialize(loaded, me.id)
