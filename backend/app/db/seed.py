"""开发种子数据 —— 从 demo 名册建用户。

用法：  uv run python -m app.db.seed
幂等：已存在（按 email）则跳过。默认密码 `cibol1234`，登录后请改。
"""
from __future__ import annotations

import asyncio

from sqlalchemy import select

from app.core.db import SessionLocal
from app.core.security import hash_password
from app.models import Role, User

DEFAULT_PASSWORD = "cibol1234"

# (name, title) —— 取自 frontend/src/data.ts 的 members；苏沐为当前登录演示成员
ROSTER: list[tuple[str, str]] = [
    ("林知远", "博士三年级"), ("Wei Chen", "博士后"), ("苏沐", "硕士二年级"),
    ("顾长川", "博士一年级"), ("陈屿", "硕士一年级"), ("Mei Lin", "博士二年级"),
    ("周野", "研究助理"), ("沈书瑶", "博士四年级"), ("Hao Zhang", "博士后"),
    ("唐辒", "博士二年级"), ("罗一帆", "博士一年级"), ("Priya Nair", "访问学者"),
    ("钱牧之", "硕士二年级"), ("叶承", "硕士一年级"), ("白露", "硕士一年级"),
    ("Kenji Sato", "博士三年级"), ("卫青禾", "博士二年级"), ("孟繁", "研究助理"),
    ("陆鸢", "硕士二年级"), ("韩望舒", "博士一年级"),
]

# 管理员（对应 demo 公告作者「管理员 · 周明」）
ADMIN = ("周明", "admin@cibol.lab", "管理员")


def _email(idx: int, name: str) -> str:
    # 中文名无法直接作邮箱本地部分，用稳定的 member 序号生成。
    return f"member{idx:02d}@cibol.lab"


async def seed() -> None:
    async with SessionLocal() as db:
        created = 0

        async def ensure(email: str, name: str, title: str, role: Role) -> None:
            nonlocal created
            exists = (
                await db.execute(select(User.id).where(User.email == email))
            ).scalar_one_or_none()
            if exists:
                return
            db.add(
                User(
                    name=name,
                    email=email,
                    title=title,
                    role=role,
                    password_hash=hash_password(DEFAULT_PASSWORD),
                    settings={},
                )
            )
            created += 1

        await ensure(ADMIN[1], ADMIN[0], ADMIN[2], Role.admin)
        for i, (name, title) in enumerate(ROSTER, start=1):
            await ensure(_email(i, name), name, title, Role.member)

        await db.commit()
        print(f"seed 完成：新建 {created} 个用户（默认密码 {DEFAULT_PASSWORD}）")
        print(f"  管理员登录： {ADMIN[1]}")
        print("  成员示例（苏沐）： member03@cibol.lab")

        # 业务数据（学期/公告/排期）—— 依赖 users 已建好以关联报告人
        from app.db.seed_lab import seed_lab

        await seed_lab(db)


if __name__ == "__main__":
    asyncio.run(seed())
