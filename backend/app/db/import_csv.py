"""从 CSV 批量导入业务数据 —— 成员 / 组会排期 / 服务器。

Excel 里填好表另存为 CSV（UTF-8），然后：

    uv run python -m app.db.import_csv members  members.csv
    uv run python -m app.db.import_csv meetings meetings.csv
    uv run python -m app.db.import_csv servers  servers.csv

不确定列名？先打印模板（自带一行示例，可直接改）：

    uv run python -m app.db.import_csv members --template > members.csv

要点：
  · 幂等 upsert：members 按 email、meetings 按 date、servers 按 name 认主键，重复导入只更新不重复插。
  · --dry-run 只解析+校验、打印将发生什么，不写库。
  · 成员默认密码 cibol1234（可在 CSV 加 password 列覆盖），登录后请改。
  · 排期里的报告人按姓名匹配 users 表；匹配不到仍保留姓名快照（兼容外部成员）并给出提醒。
"""
from __future__ import annotations

import argparse
import asyncio
import csv
import io
import sys
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.db import SessionLocal
from app.core.security import hash_password
from app.models import Meeting, Presenter, Role, Server, User
from app.models.lab import MeetingStatus
from app.models.server import ServerStatus

DEFAULT_PASSWORD = "cibol1234"

# ── 每种实体的列模板（首行=表头，次行=示例）───────────────────────────
TEMPLATES: dict[str, str] = {
    "members": (
        "name,email,title,role,password,status\n"
        "张三,zhangsan@cibol.lab,博士二年级,member,,active\n"
    ),
    "meetings": (
        "date,type,time,place,template,scored,host,presenters\n"
        "2026-09-07,进展汇报,14:00 – 16:00,理科楼 A301,正式报告,true,周明,张三;李四\n"
    ),
    "servers": (
        "name,ip,ssh_port,gpu,status,net,desc\n"
        "turing,172.16.185.103,22,4×A100,online,intranet,主力训练机\n"
    ),
}


def _rows(path: str) -> list[dict[str, str]]:
    """读 CSV → 行字典列表。utf-8-sig 兼容 Excel 存的 BOM。"""
    with open(path, encoding="utf-8-sig", newline="") as f:
        return [
            {(k or "").strip(): (v or "").strip() for k, v in row.items()}
            for row in csv.DictReader(f)
        ]


def _truthy(s: str, default: bool = True) -> bool:
    if not s:
        return default
    return s.strip().lower() in {"1", "true", "t", "yes", "y", "是", "对", "√"}


def _role(s: str) -> Role:
    return Role.admin if s.strip().lower() in {"admin", "管理员", "administrator"} else Role.member


def _disabled(s: str) -> bool:
    """status 列 → 软删标记。left/离开/毕业/停用 → 已下线；其余（含空/active）→ 在职。"""
    return s.strip().lower() in {"left", "disabled", "inactive", "离开", "毕业", "停用", "已离开"}


# ── 各实体导入器：返回 (created, updated, warnings) ─────────────────────
async def imp_members(db: AsyncSession, rows: list[dict], dry: bool) -> tuple[int, int, list[str]]:
    created = updated = 0
    warns: list[str] = []
    for i, r in enumerate(rows, 2):  # 2 = 表头之后第一数据行
        name, email = r.get("name", ""), r.get("email", "")
        if not name or not email:
            warns.append(f"第{i}行：name/email 为空，跳过")
            continue
        u = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if u is None:  # email 没查到，再看 name（name 也 unique，避免撞唯一约束）
            u = (await db.execute(select(User).where(User.name == name))).scalar_one_or_none()
        if u:
            u.name, u.email = name, email
            u.title = r.get("title", u.title)
            u.role = _role(r.get("role", u.role.value if u.role else "member"))
            if r.get("password"):
                u.password_hash = hash_password(r["password"])
            if r.get("status"):  # 显式给了 status 才改（空则不动现有在职/停用状态）
                u.disabled = _disabled(r["status"])
            updated += 1
        else:
            db.add(User(
                name=name, email=email, title=r.get("title", ""), role=_role(r.get("role", "")),
                password_hash=hash_password(r.get("password") or DEFAULT_PASSWORD), settings={},
                disabled=_disabled(r.get("status", "")),
            ))
            created += 1
    if not dry:
        await db.commit()
    return created, updated, warns


async def imp_meetings(db: AsyncSession, rows: list[dict], dry: bool) -> tuple[int, int, list[str]]:
    created = updated = 0
    warns: list[str] = []
    # 姓名 → user_id 映射，用于关联报告人
    name2id = dict((await db.execute(select(User.name, User.id))).all())
    for i, r in enumerate(rows, 2):
        raw = r.get("date", "")
        try:
            d = date.fromisoformat(raw)
        except ValueError:
            warns.append(f"第{i}行：日期 {raw!r} 非 YYYY-MM-DD，跳过")
            continue
        # 预加载 presenters：async 会话下不能隐式懒加载，重建报告人前必须先取到集合
        m = (await db.execute(
            select(Meeting).options(selectinload(Meeting.presenters)).where(Meeting.date == d)
        )).scalar_one_or_none()
        mtype = r.get("type") or "进展汇报"
        fields = dict(
            type=mtype, host=r.get("host", ""), place=r.get("place", ""),
            time=r.get("time", ""), template=r.get("template") or "正式报告",
            scored=_truthy(r.get("scored", ""), True), status=MeetingStatus.scheduled,
        )
        if m:
            for k, v in fields.items():
                setattr(m, k, v)
            m.presenters.clear()  # cascade delete-orphan：重建报告人
            updated += 1
        else:
            m = Meeting(date=d, **fields)
            db.add(m)
            created += 1
        # 报告人：分号 / 逗号 / 中文分隔
        people = [p.strip() for p in r.get("presenters", "").replace("，", ";").replace(",", ";").split(";") if p.strip()]
        for order, pname in enumerate(people):
            uid = name2id.get(pname)
            if uid is None:
                warns.append(f"第{i}行：报告人「{pname}」在成员库中查无此人，仅存姓名快照")
            m.presenters.append(Presenter(user_id=uid, name=pname, kind=mtype, ord=order))
    if not dry:
        await db.commit()
    return created, updated, warns


async def imp_servers(db: AsyncSession, rows: list[dict], dry: bool) -> tuple[int, int, list[str]]:
    created = updated = 0
    warns: list[str] = []
    for i, r in enumerate(rows, 2):
        name = r.get("name", "")
        if not name:
            warns.append(f"第{i}行：name 为空，跳过")
            continue
        s = (await db.execute(select(Server).where(Server.name == name))).scalar_one_or_none()
        try:
            status = ServerStatus(r.get("status") or "online")
        except ValueError:
            status = ServerStatus.online
            warns.append(f"第{i}行：status {r.get('status')!r} 非法，回退 online")
        port = int(r["ssh_port"]) if r.get("ssh_port", "").isdigit() else 22
        fields = dict(
            ip=r.get("ip", ""), ssh_port=port, gpu=r.get("gpu", ""),
            status=status, net=r.get("net") or "intranet", desc=r.get("desc", ""),
        )
        if s:
            for k, v in fields.items():
                setattr(s, k, v)
            updated += 1
        else:
            db.add(Server(name=name, **fields))
            created += 1
    if not dry:
        await db.commit()
    return created, updated, warns


IMPORTERS = {"members": imp_members, "meetings": imp_meetings, "servers": imp_servers}


async def _run(entity: str, path: str, dry: bool) -> None:
    rows = _rows(path)
    if not rows:
        sys.exit(f"⚠️  {path} 没有数据行")
    async with SessionLocal() as db:
        created, updated, warns = await IMPORTERS[entity](db, rows, dry)
    tag = "（dry-run，未写库）" if dry else ""
    for w in warns:
        print(f"  · {w}")
    print(f"✅ {entity} 导入完成{tag}：新增 {created}、更新 {updated}、读取 {len(rows)} 行")
    if entity == "members" and created:
        print(f"   新成员默认密码：{DEFAULT_PASSWORD}（登录后请改）")


def main() -> None:
    ap = argparse.ArgumentParser(description="从 CSV 批量导入 CIBOL 业务数据")
    ap.add_argument("entity", choices=list(IMPORTERS), help="导入的数据类型")
    ap.add_argument("csv", nargs="?", help="CSV 文件路径")
    ap.add_argument("--template", action="store_true", help="打印该类型的 CSV 模板到 stdout 后退出")
    ap.add_argument("--dry-run", action="store_true", help="只解析校验、不写库")
    args = ap.parse_args()

    if args.template:
        sys.stdout.write(TEMPLATES[args.entity])
        return
    if not args.csv:
        ap.error("需要提供 CSV 文件路径（或加 --template 打印模板）")
    asyncio.run(_run(args.entity, args.csv, args.dry_run))


if __name__ == "__main__":
    main()
