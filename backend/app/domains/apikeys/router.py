"""API 密钥路由 —— 我的密钥（含 dmxapi 实时用量）；管理员签发/撤销。"""
from __future__ import annotations

import asyncio

from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from sqlalchemy import select

from app.core.deps import AdminUser, CurrentUser, DbSession
from app.domains.apikeys import dmxapi
from app.domains.notify.service import notify
from app.models import ApiKey, User
from app.schemas.apikey import ApiKeyIssue, ApiKeyOut


def _mask(sk: str) -> str:
    if len(sk) <= 12:
        return sk[:4] + "…"
    return sk[:8] + "…" + sk[-4:]


async def _serialize(k: ApiKey) -> ApiKeyOut:
    usage = await dmxapi.token_balance(k.upstream_key)  # None if 未配置 / 调用失败
    return ApiKeyOut(
        id=k.id, label=k.label, masked_key=_mask(k.upstream_key), budget=k.budget,
        status=k.status, created_at=k.created_at,
        used_rmb=usage.get("used_rmb") if usage else None,
        remain_rmb=usage.get("remain_rmb") if usage else None,
    )


router = APIRouter(prefix="/apikeys", tags=["apikeys"])


@router.get("/mine", response_model=list[ApiKeyOut])
async def my_keys(me: CurrentUser, db: DbSession) -> list[ApiKeyOut]:
    rows = list(
        (
            await db.execute(
                select(ApiKey).where(ApiKey.user_id == me.id).order_by(ApiKey.created_at.desc())
            )
        ).scalars()
    )
    return list(await asyncio.gather(*[_serialize(k) for k in rows]))


@router.post("", response_model=ApiKeyOut, status_code=status.HTTP_201_CREATED)
async def issue_key(body: ApiKeyIssue, _: AdminUser, db: DbSession, tasks: BackgroundTasks) -> ApiKeyOut:
    """管理员签发：把 dmxapi 后台建好的令牌下发给某成员（审批 api 请求后调用）。"""
    user = (await db.execute(select(User).where(User.name == body.user_name))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="成员不存在")
    k = ApiKey(user_id=user.id, label=body.label, upstream_key=body.upstream_key, budget=body.budget)
    db.add(k)
    await db.commit()
    await db.refresh(k)
    await notify(
        db, user_id=user.id,
        title="API 密钥已签发",
        body=f"你的 API 密钥「{body.label}」已签发，可在「我的」页面查看。",
        type="approval", tasks=tasks,
    )
    return await _serialize(k)


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_key(key_id: str, _: AdminUser, db: DbSession, tasks: BackgroundTasks) -> None:
    k = await db.get(ApiKey, key_id)
    if k is not None:
        user_id = k.user_id
        label = k.label
        k.status = "revoked"
        await db.commit()
        await notify(
            db, user_id=user_id,
            title="API 密钥已撤销",
            body=f"你的 API 密钥「{label}」已被管理员撤销。如有疑问请联系管理员。",
            type="info", tasks=tasks,
        )
