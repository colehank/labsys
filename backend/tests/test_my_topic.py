"""组员自设汇报主题：本人可改、非报告人 403、会议不存在 404。"""
from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Meeting, MeetingStatus, Presenter


@pytest.mark.asyncio
async def test_member_sets_own_topic(client: AsyncClient, db_session: AsyncSession):
    m = Meeting(date="2026-03-01", status=MeetingStatus.scheduled, type="进展汇报")
    m.presenters = [Presenter(name="苏沐", topic="", kind="进展", ord=0)]
    db_session.add(m)
    await db_session.commit()
    mid = m.id
    r = await client.post("/api/auth/login", json={"email": "member03@cibol.lab", "password": "cibol1234"})
    headers = {"Authorization": f"Bearer {r.json()['access']}"}
    r = await client.put(f"/api/meetings/{mid}/my-topic", json={"topic": "扩散模型综述"}, headers=headers)
    assert r.status_code == 200, r.text
    assert next(p for p in r.json()["presenters"] if p["name"] == "苏沐")["topic"] == "扩散模型综述"
    r = await client.put(f"/api/meetings/{mid}/my-topic", json={"topic": "  改成新主题  "}, headers=headers)
    assert r.status_code == 200, r.text
    assert next(p for p in r.json()["presenters"] if p["name"] == "苏沐")["topic"] == "改成新主题"


@pytest.mark.asyncio
async def test_non_presenter_forbidden(client: AsyncClient, db_session: AsyncSession):
    m = Meeting(date="2026-03-08", status=MeetingStatus.scheduled, type="进展汇报")
    m.presenters = [Presenter(name="苏沐", topic="", kind="进展", ord=0)]
    db_session.add(m)
    await db_session.commit()
    mid = m.id
    r = await client.post("/api/auth/login", json={"email": "admin@cibol.lab", "password": "cibol1234"})
    headers = {"Authorization": f"Bearer {r.json()['access']}"}
    r = await client.put(f"/api/meetings/{mid}/my-topic", json={"topic": "越权"}, headers=headers)
    assert r.status_code == 403, r.text


@pytest.mark.asyncio
async def test_meeting_not_found(client: AsyncClient):
    r = await client.post("/api/auth/login", json={"email": "member03@cibol.lab", "password": "cibol1234"})
    headers = {"Authorization": f"Bearer {r.json()['access']}"}
    r = await client.put("/api/meetings/nonexistent/my-topic", json={"topic": "x"}, headers=headers)
    assert r.status_code == 404, r.text
