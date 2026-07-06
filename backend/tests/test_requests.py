"""请求状态机 + 授权 端到端测试。"""
from __future__ import annotations

from httpx import AsyncClient

API = "/api"


async def _token(client: AsyncClient, email: str) -> str:
    r = await client.post(f"{API}/auth/login", json={"email": email, "password": "cibol1234"})
    return r.json()["access_token"]


def _h(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}"}


async def test_member_creates_api_request_and_admin_approves(client: AsyncClient) -> None:
    m = await _token(client, "member03@cibol.lab")
    a = await _token(client, "admin@cibol.lab")

    # 成员发起 API 申请
    r = await client.post(f"{API}/requests", headers=_h(m),
                          json={"kind": "api", "detail": "测试 · 预算 ¥50", "reason": "跑实验"})
    assert r.status_code == 201
    req = r.json()
    assert req["status"] == "submitted" and req["from"] == "苏沐"
    rid = req["id"]

    # 出现在 admin 审批队列
    pend = (await client.get(f"{API}/requests/pending", headers=_h(a))).json()
    assert any(x["id"] == rid for x in pend)

    # 成员无权审批
    bad = await client.post(f"{API}/requests/{rid}/advance", headers=_h(m), json={"next": "approved"})
    assert bad.status_code == 403

    # 管理员批准
    ok = await client.post(f"{API}/requests/{rid}/advance", headers=_h(a),
                           json={"next": "approved", "note": "已下发"})
    assert ok.status_code == 200 and ok.json()["status"] == "approved"
    assert ok.json()["history"][-1]["note"] == "已下发"


async def test_swap_only_target_can_accept(client: AsyncClient) -> None:
    m = await _token(client, "member03@cibol.lab")
    a = await _token(client, "admin@cibol.lab")

    # 管理员先排两场组会（6/14 苏沐、6/21 周明），对调需引用双方组会 id（新契约）
    sch = await client.put(f"{API}/meetings/schedule", headers=_h(a), json={"meetings": [
        {"date": "2026-06-14", "type": "进展汇报", "presenters": [{"name": "苏沐"}]},
        {"date": "2026-06-21", "type": "文献精读", "presenters": [{"name": "周明"}]},
    ]})
    ms = sch.json()
    m1 = next(x for x in ms if x["presenters"][0]["name"] == "苏沐")
    m2 = next(x for x in ms if x["presenters"][0]["name"] == "周明")

    # 苏沐 向 周明(admin) 发起对调（带双方组会 id）
    r = await client.post(f"{API}/requests", headers=_h(m), json={
        "kind": "swap", "toName": "周明", "fromDate": "6/14", "toDate": "6/21",
        "fromMeetingId": m1["id"], "toMeetingId": m2["id"],
    })
    rid = r.json()["id"]
    assert r.json()["status"] == "pending"

    # 对 admin 而言是 incoming
    admin_mine = (await client.get(f"{API}/requests/mine", headers=_h(a))).json()
    target_view = next(x for x in admin_mine if x["id"] == rid)
    assert target_view["incoming"] is True

    # 发起人不能自己接受（role=target）
    bad = await client.post(f"{API}/requests/{rid}/advance", headers=_h(m), json={"next": "accepted"})
    assert bad.status_code == 403

    # 目标(admin)接受
    ok = await client.post(f"{API}/requests/{rid}/advance", headers=_h(a), json={"next": "accepted"})
    assert ok.status_code == 200 and ok.json()["status"] == "accepted"


async def test_illegal_transition_409(client: AsyncClient) -> None:
    m = await _token(client, "member03@cibol.lab")
    a = await _token(client, "admin@cibol.lab")
    r = await client.post(f"{API}/requests", headers=_h(m), json={"kind": "absence", "fromDate": "7/5"})
    rid = r.json()["id"]
    await client.post(f"{API}/requests/{rid}/advance", headers=_h(a), json={"next": "approved"})
    # 已是终态，再迁移非法
    again = await client.post(f"{API}/requests/{rid}/advance", headers=_h(a), json={"next": "rejected"})
    assert again.status_code == 409


async def test_requester_can_cancel(client: AsyncClient) -> None:
    m = await _token(client, "member03@cibol.lab")
    r = await client.post(f"{API}/requests", headers=_h(m), json={"kind": "api", "detail": "x"})
    rid = r.json()["id"]
    ok = await client.post(f"{API}/requests/{rid}/advance", headers=_h(m),
                           json={"next": "cancelled", "note": "已撤回"})
    assert ok.status_code == 200 and ok.json()["status"] == "cancelled"
