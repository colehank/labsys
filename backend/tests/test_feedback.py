"""匿名意见 端到端测试。"""
from __future__ import annotations

from httpx import AsyncClient

API = "/api"


async def _token(client: AsyncClient, email: str) -> str:
    r = await client.post(f"{API}/auth/login", json={"email": email, "password": "cibol1234"})
    return r.json()["access_token"]


def _h(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}"}


async def test_member_submits_admin_reads(client: AsyncClient) -> None:
    m = await _token(client, "member03@cibol.lab")
    a = await _token(client, "admin@cibol.lab")

    # 成员匿名提交
    r = await client.post(f"{API}/feedback", headers=_h(m), json={"body": "组会时间能否提前"})
    assert r.status_code == 204

    # 管理员看得到，且不含任何身份信息
    lst = (await client.get(f"{API}/feedback", headers=_h(a))).json()
    assert len(lst) == 1
    assert lst[0]["body"] == "组会时间能否提前"
    assert lst[0]["read"] is False
    assert "user" not in lst[0] and "rater" not in lst[0]

    # 标记已读
    fid = lst[0]["id"]
    assert (await client.post(f"{API}/feedback/{fid}/read", headers=_h(a))).status_code == 204
    lst2 = (await client.get(f"{API}/feedback", headers=_h(a))).json()
    assert lst2[0]["read"] is True


async def test_member_cannot_list_feedback(client: AsyncClient) -> None:
    m = await _token(client, "member03@cibol.lab")
    assert (await client.get(f"{API}/feedback", headers=_h(m))).status_code == 403


async def test_empty_feedback_rejected(client: AsyncClient) -> None:
    m = await _token(client, "member03@cibol.lab")
    # 空白内容被 pydantic min_length 拦下（422）
    assert (await client.post(f"{API}/feedback", headers=_h(m), json={"body": "   "})).status_code in (400, 422)
