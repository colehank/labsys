"""P0 认证 / RBAC 端到端测试。"""
from __future__ import annotations

from httpx import AsyncClient

API = "/api"


async def _login(client: AsyncClient, email: str, pw: str = "cibol1234"):
    return await client.post(f"{API}/auth/login", json={"email": email, "password": pw})


async def test_health(client: AsyncClient) -> None:
    r = await client.get(f"{API}/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


async def test_login_ok_and_me(client: AsyncClient) -> None:
    r = await _login(client, "member03@cibol.lab")
    assert r.status_code == 200
    tok = r.json()
    assert tok["access_token"] and tok["refresh_token"]

    r2 = await client.get(
        f"{API}/auth/me", headers={"Authorization": f"Bearer {tok['access_token']}"}
    )
    assert r2.status_code == 200
    assert r2.json()["name"] == "苏沐"
    assert r2.json()["role"] == "member"


async def test_login_wrong_password(client: AsyncClient) -> None:
    r = await _login(client, "member03@cibol.lab", "wrong")
    assert r.status_code == 401


async def test_refresh(client: AsyncClient) -> None:
    tok = (await _login(client, "admin@cibol.lab")).json()
    r = await client.post(f"{API}/auth/refresh", json={"refresh_token": tok["refresh_token"]})
    assert r.status_code == 200
    assert r.json()["access_token"]


async def test_refresh_token_rejected_as_access(client: AsyncClient) -> None:
    # refresh token 不能当 access 用（type 校验）
    tok = (await _login(client, "admin@cibol.lab")).json()
    r = await client.get(
        f"{API}/auth/me", headers={"Authorization": f"Bearer {tok['refresh_token']}"}
    )
    assert r.status_code == 401


async def test_rbac_member_forbidden(client: AsyncClient) -> None:
    tok = (await _login(client, "member03@cibol.lab")).json()
    r = await client.get(f"{API}/users", headers={"Authorization": f"Bearer {tok['access_token']}"})
    assert r.status_code == 403


async def test_rbac_admin_lists_users(client: AsyncClient) -> None:
    tok = (await _login(client, "admin@cibol.lab")).json()
    r = await client.get(f"{API}/users", headers={"Authorization": f"Bearer {tok['access_token']}"})
    assert r.status_code == 200
    assert len(r.json()) == 2


async def test_no_token_unauthorized(client: AsyncClient) -> None:
    r = await client.get(f"{API}/auth/me")
    assert r.status_code in (401, 403)
