"""对调真正互换报告人 + 评分去重 端到端测试。"""
from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Rating, RatingVote

API = "/api"


async def _token(client: AsyncClient, email: str) -> str:
    r = await client.post(f"{API}/auth/login", json={"email": email, "password": "cibol1234"})
    return r.json()["access_token"]


def _h(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}"}


async def _make_meetings(client: AsyncClient, admin_tok: str) -> list[dict]:
    """管理员排两场组会：6/14 苏沐报告、6/21 周明报告。"""
    body = {"meetings": [
        {"date": "2026-06-14", "type": "进展汇报", "presenters": [{"name": "苏沐"}]},
        {"date": "2026-06-21", "type": "文献精读", "presenters": [{"name": "周明"}]},
    ]}
    r = await client.put(f"{API}/meetings/schedule", headers=_h(admin_tok), json=body)
    assert r.status_code == 200
    return r.json()


async def test_swap_accept_swaps_presenters(client: AsyncClient) -> None:
    m = await _token(client, "member03@cibol.lab")   # 苏沐
    a = await _token(client, "admin@cibol.lab")       # 周明

    meetings = await _make_meetings(client, a)
    m1 = next(x for x in meetings if x["presenters"][0]["name"] == "苏沐")
    m2 = next(x for x in meetings if x["presenters"][0]["name"] == "周明")

    # 苏沐 发起对调（带两场组会 id）
    r = await client.post(f"{API}/requests", headers=_h(m), json={
        "kind": "swap", "toName": "周明", "fromDate": "6/14", "toDate": "6/21",
        "fromMeetingId": m1["id"], "toMeetingId": m2["id"],
    })
    rid = r.json()["id"]

    # 周明（对方）接受
    ok = await client.post(f"{API}/requests/{rid}/advance", headers=_h(a), json={"next": "accepted"})
    assert ok.status_code == 200

    # 报告人已真正互换
    after = (await client.get(f"{API}/meetings", headers=_h(a))).json()
    a1 = next(x for x in after if x["id"] == m1["id"])
    a2 = next(x for x in after if x["id"] == m2["id"])
    assert [p["name"] for p in a1["presenters"]] == ["周明"]
    assert [p["name"] for p in a2["presenters"]] == ["苏沐"]


async def test_swap_without_meeting_ids_rejected(client: AsyncClient) -> None:
    """新契约：对调申请必须带双方组会 id，缺失即 422（不再有旧式「仅改状态」降级）。"""
    m = await _token(client, "member03@cibol.lab")
    r = await client.post(f"{API}/requests", headers=_h(m),
                          json={"kind": "swap", "toName": "周明", "fromDate": "6/14", "toDate": "6/21"})
    assert r.status_code == 422


async def test_rating_dedup_repeat_submit(client: AsyncClient, db_session: AsyncSession) -> None:
    m = await _token(client, "member03@cibol.lab")   # 苏沐 评分人
    a = await _token(client, "admin@cibol.lab")
    meetings = await _make_meetings(client, a)
    key = next(x for x in meetings if x["presenters"][0]["name"] == "周明")["id"]

    # 苏沐 对 周明 连续提交两次（值不同）
    await client.post(f"{API}/eval/reports/{key}/rating", headers=_h(m),
                      json={"presenter": "周明", "attitude": 5, "polish": 5, "logic": 5, "top5": ["苏沐"]})
    await client.post(f"{API}/eval/reports/{key}/rating", headers=_h(m),
                      json={"presenter": "周明", "attitude": 3, "polish": 3, "logic": 3, "top5": ["苏沐"]})

    db_session.expire_all()
    votes = (await db_session.execute(
        select(func.count()).select_from(RatingVote).where(RatingVote.meeting_id == key)
    )).scalar_one()
    rt = (await db_session.execute(
        select(Rating).where(Rating.meeting_id == key, Rating.presenter == "周明")
    )).scalar_one()
    # 只算一票，且为最后一次提交的值（去重覆盖，不累加）
    assert votes == 1
    assert rt.raters == 1
    assert rt.attitude == 3 and rt.polish == 3 and rt.logic == 3


async def test_rating_cannot_rate_self(client: AsyncClient) -> None:
    a = await _token(client, "admin@cibol.lab")
    meetings = await _make_meetings(client, a)
    key = next(x for x in meetings if x["presenters"][0]["name"] == "周明")["id"]
    # 周明 给自己评分被拒
    bad = await client.post(f"{API}/eval/reports/{key}/rating", headers=_h(a),
                            json={"presenter": "周明", "attitude": 5, "polish": 5, "logic": 5, "top5": []})
    assert bad.status_code == 403
