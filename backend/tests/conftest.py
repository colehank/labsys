"""测试夹具 —— in-memory SQLite + 依赖覆盖，无需 Postgres。"""
from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.core.db import get_db
from app.core.security import hash_password
from app.main import app
from app.models import Base, Role, User


@pytest_asyncio.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    maker = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with maker() as session:
        # 种子：一个管理员 + 一个成员
        session.add_all(
            [
                User(name="周明", email="admin@cibol.lab", title="管理员",
                     role=Role.admin, password_hash=hash_password("cibol1234"), settings={}),
                User(name="苏沐", email="member03@cibol.lab", title="硕士二年级",
                     role=Role.member, password_hash=hash_password("cibol1234"), settings={}),
            ]
        )
        await session.commit()
        yield session
    await engine.dispose()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncIterator[AsyncClient]:
    async def _override() -> AsyncIterator[AsyncSession]:
        yield db_session

    app.dependency_overrides[get_db] = _override
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()
