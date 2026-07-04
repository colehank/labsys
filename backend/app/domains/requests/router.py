"""请求路由 —— 创建 / 我的 / 状态迁移 / 审批队列。"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload

from app.core.deps import AdminUser, CurrentUser, DbSession
from app.domains.notify.service import notify
from app.domains.requests.engine import can_transition, initial_status, required_role
from app.models import Meeting, Presenter, Request, RequestEvent, RequestKind, Role, User
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


class _SwapLegacy(Exception):
    """旧请求缺少 meeting_id —— 调用方降级为仅改状态（不报错）。"""


class _SwapDataError(Exception):
    """meeting 存在但找不到 Presenter 行 —— 应拒绝接受，避免状态与数据不一致。"""
    def __init__(self, msg: str):
        super().__init__(msg)
        self.msg = msg


async def _apply_swap(db, req: Request) -> str:
    """对调被接受后，真正互换两场组会里发起人与对方的报告位（姓名/账号/主题）。

    旧请求（缺 meeting_id）→ 抛 _SwapLegacy，调用方降级为仅改状态。
    meeting 存在但找不到 Presenter 行（user_id 不匹配或外部嘉宾无 user_id）
      → 抛 _SwapDataError，调用方应拒绝整个迁移，返回 409。
    成功 → 返回一句可记入轨迹的说明。
    """
    if not (req.from_meeting_id and req.to_meeting_id and req.requester and req.target):
        raise _SwapLegacy()
    fm = (await db.execute(
        select(Meeting).where(Meeting.id == req.from_meeting_id)
        .options(selectinload(Meeting.presenters))
    )).scalar_one_or_none()
    tm = (await db.execute(
        select(Meeting).where(Meeting.id == req.to_meeting_id)
        .options(selectinload(Meeting.presenters))
    )).scalar_one_or_none()
    if fm is None or tm is None:
        raise _SwapLegacy()
    p1 = next((p for p in fm.presenters if p.user_id == req.requester_id), None)
    p2 = next((p for p in tm.presenters if p.user_id == req.target_user_id), None)
    if p1 is None:
        raise _SwapDataError(
            f"在 {fm.date} 的组会中找不到发起人（{req.requester.name}）的报告位，"
            "可能是外部嘉宾或排期已变更，无法执行互换"
        )
    if p2 is None:
        raise _SwapDataError(
            f"在 {tm.date} 的组会中找不到对方（{req.target.name}）的报告位，"
            "可能是外部嘉宾或排期已变更，无法执行互换"
        )
    # 互换报告位：各自带着主题换到对方日期；kind 跟随所在组会类型，不交换。
    p1.name, p2.name = p2.name, p1.name
    p1.user_id, p2.user_id = p2.user_id, p1.user_id
    p1.topic, p2.topic = p2.topic, p1.topic
    return f"已互换报告人：{req.requester.name} ⇄ {req.target.name}"


@router.post("", response_model=RequestOut, status_code=status.HTTP_201_CREATED)
async def create_request(body: CreateRequest, me: CurrentUser, db: DbSession) -> RequestOut:
    target_id = None
    if body.toName:
        target = (
            await db.execute(select(User).where(User.name == body.toName))
        ).scalars().first()
        if target is None and body.kind == RequestKind.swap:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"找不到用户「{body.toName}」，无法创建对调申请")
        target_id = target.id if target else None

    if body.kind == RequestKind.swap and target_id == me.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="不能向自己发起对调申请")

    # 防止同一用户重复提交同类型的活跃申请
    active_statuses = ["pending", "submitted"]
    existing = (await db.execute(
        select(Request).where(
            Request.requester_id == me.id,
            Request.kind == body.kind,
            Request.status.in_(active_statuses),
        ).limit(1)
    )).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="您已有一条同类型的待处理申请，请等待处理后再提交")

    st = initial_status(body.kind)
    at = _now()
    req = Request(
        kind=body.kind, requester_id=me.id, target_user_id=target_id,
        from_meeting_id=body.fromMeetingId, to_meeting_id=body.toMeetingId,
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

    # 授权（白名单式：未知 role 值一律拒绝）
    role = required_role(req.kind, body.next)
    if role == "requester":
        if req.requester_id != me.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="只有发起人可撤回")
    elif role == "target":
        if req.target_user_id is None or req.target_user_id != me.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="只有对方可确认对调")
    elif role == "admin":
        if me.role != Role.admin:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="需要管理员审批")
    else:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="权限不足")

    req.status = body.next
    requester_id = req.requester_id
    kind_label = _KIND_LABEL.get(req.kind.value, "申请")
    req.events.append(RequestEvent(status=body.next, note=body.note, actor_id=me.id, at=_now()))

    # 对调被接受 → 真正互换两场组会的报告人
    #   旧请求缺 meeting_id：_SwapLegacy → 降级为仅改状态（历史兼容）
    #   Presenter 行找不到：_SwapDataError → 拒绝整个迁移，返回 409
    swap_note = None
    if req.kind == RequestKind.swap and body.next == "accepted":
        try:
            swap_note = await _apply_swap(db, req)
        except _SwapLegacy:
            swap_note = None   # 旧请求，仅改状态
        except _SwapDataError as exc:
            raise HTTPException(status.HTTP_409_CONFLICT, detail=exc.msg) from exc

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
    # 对调被对方接受/拒绝 → 通知发起人
    elif req.kind == RequestKind.swap and body.next in ("accepted", "declined") and requester_id != me.id:
        if body.next == "accepted":
            extra = "，报告日期已互换" if swap_note else ""
            title, msg = "你的组会调换已被接受 ✅", f"{me.name} 已接受你的对调请求{extra}。"
        else:
            title, msg = "你的组会调换被拒绝", f"{me.name} 拒绝了你的对调请求。"
        await notify(db, user_id=requester_id, type="approval", title=title, body=msg, tasks=tasks)

    loaded = await _get_loaded(db, req_id)
    return _serialize(loaded, me.id)
