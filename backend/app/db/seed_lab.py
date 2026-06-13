"""实验室业务种子 —— 学期 / 默认组会 / 公告 / 整学期排期。

复刻 frontend/src/data.ts 的排期生成逻辑，报告人按姓名关联到 users。
幂等：已存在（按学期 is_current / 公告 title / 组会 date）则跳过。
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    AnnLevel,
    Announcement,
    ApiKey,
    LabConfig,
    Meeting,
    MeetingType,
    Notification,
    Presenter,
    Request,
    RequestEvent,
    RequestKind,
    Semester,
    Server,
    ServerStatus,
    User,
)

PLACE = "认知楼 3 楼 · 讨论室 A"
TIME = "14:00 – 16:00"

# 报告人轮转名册（与 data.ts members 顺序一致）
ROSTER = [
    "林知远", "Wei Chen", "苏沐", "顾长川", "陈屿", "Mei Lin", "周野", "沈书瑶",
    "Hao Zhang", "唐辒", "罗一帆", "Priya Nair", "钱牧之", "叶承", "白露",
    "Kenji Sato", "卫青禾", "孟繁", "陆鸢", "韩望舒",
]

# 首场（6/14）报告人与主题（= data.ts nextMeeting）
FIRST_PRESENTERS = [
    ("林知远", "前额叶皮层在工作记忆中的门控机制", "进展汇报", 40),
    ("顾长川", "扩散模型在 fMRI 解码中的应用综述", "文献精读", 30),
]
ONLINE_0 = ("https://meet.cibol.lab/grp/0614-prefrontal", "腾讯会议", "938 217 460", "ok")
ONLINE_1 = ("https://meet.cibol.lab/grp/0621-decode", "腾讯会议", "204 668 391", "ok")
# 轮转中预置主题：n -> [(name, topic)]
SEEDED_TOPICS = {
    1: [("苏沐", "基于扩散模型的神经表征解码")],
    2: [("Mei Lin", "生成式神经解码综述"), ("顾长川", "对比学习在 EEG 表征中的应用")],
}

ANNOUNCEMENTS = [
    ("暑期组会时间调整", "7 月起组会改为每周六上午 9:30 开始，地点不变（认知楼 3 楼讨论室 A）。请相互转告，并据此安排汇报准备。",
     AnnLevel.important, True, "管理员 · 周明", "2026-06-11T09:00:00+00:00", date(2026, 7, 20)),
    ("GPU 服务器例行维护", "本周五 20:00–22:00 对 lab-gpu-03 停机维护，期间无法连接，请提前保存训练任务与检查点。",
     AnnLevel.urgent, False, "管理员 · 周明", "2026-06-10T15:00:00+00:00", date(2026, 6, 14)),
    ("新版组会汇报模板已发布", "即日起组会统一使用新版汇报模板，可在「我的 · 资料」中下载。",
     AnnLevel.info, False, "管理员 · 周明", "2026-06-05T10:00:00+00:00", None),
]


async def seed_lab(db: AsyncSession) -> None:
    users = {u.name: u.id for u in (await db.execute(select(User))).scalars()}

    # ── 学期 ──
    has_sem = (await db.execute(select(Semester.id).where(Semester.is_current))).first()
    if not has_sem:
        db.add(Semester(name="2026 春季学期", short="2026 春",
                        start=date(2026, 2, 23), end=date(2026, 7, 12), is_current=True))

    # ── 默认组会配置 ──
    has_cfg = (await db.execute(select(LabConfig.id))).first()
    if not has_cfg:
        db.add(LabConfig(weekday="周日", time=TIME, place=PLACE))

    # ── 公告 ──
    for title, body, level, pinned, author, pub, exp in ANNOUNCEMENTS:
        exists = (
            await db.execute(select(Announcement.id).where(Announcement.title == title))
        ).first()
        if exists:
            continue
        db.add(Announcement(
            title=title, body=body, level=level, pinned=pinned, audience="all",
            author=author, published_at=datetime.fromisoformat(pub), expires_at=exp,
        ))

    # ── 整学期排期（每周日一次，从 6/14 起，30 场）──
    has_meetings = (await db.execute(select(Meeting.id))).first()
    if not has_meetings:
        d = date(2026, 6, 14)
        end = date(2027, 1, 16)
        n = ri = 0
        created = 0
        while d <= end and created < 30:
            is_progress = n % 2 == 0
            per = 2 if n % 3 == 0 else 1
            mtype = MeetingType.progress if is_progress else MeetingType.literature

            # 报告人
            rows: list[tuple[str, str, str, int | None]] = []
            if n == 0:
                rows = list(FIRST_PRESENTERS)
            elif n in SEEDED_TOPICS:
                rows = [(nm, tp, mtype.value, None) for nm, tp in SEEDED_TOPICS[n]]
            else:
                for k in range(per):
                    rows.append((ROSTER[ri % len(ROSTER)], "", mtype.value, None))
                    ri += 1

            online = ONLINE_0 if n == 0 else ONLINE_1 if n == 1 else None
            m = Meeting(
                date=d, type=mtype, place=PLACE, time=TIME,
                online_url=online[0] if online else None,
                online_provider=online[1] if online else None,
                online_id=online[2] if online else None,
                online_status=online[3] if online else None,
                presenters=[
                    Presenter(user_id=users.get(nm), name=nm, topic=tp, kind=kind, minutes=mins, ord=i)
                    for i, (nm, tp, kind, mins) in enumerate(rows)
                ],
            )
            db.add(m)
            created += 1
            d += timedelta(days=7)
            n += 1

    await db.commit()
    print("lab seed 完成：学期 / 默认组会 / 公告 / 排期 已就绪")
    await seed_requests(db)
    await seed_servers(db)
    await seed_notifications(db)
    await seed_apikeys(db)
    from app.domains.evals.store import seed_eval_db

    await seed_eval_db(db)


async def seed_apikeys(db: AsyncSession) -> None:
    if (await db.execute(select(ApiKey.id))).first():
        return
    sumu = (await db.execute(select(User).where(User.name == "苏沐"))).scalar_one_or_none()
    if sumu is None:
        return
    db.add(ApiKey(user_id=sumu.id, label="多模态对齐实验",
                  upstream_key="sk-cibol-demo-aa11bb22cc33", budget=200.0, status="active"))
    await db.commit()
    print("apikeys seed 完成")


# 演示请求（复刻 store.ts）：(kind, from, to, fromDate, toDate, topic, detail, reason, status, events)
# events: [(status, note, iso)]
_REQS = [
    ("swap", "林知远", "苏沐", "6月14日 周日", "6月21日 周日",
     "前额叶皮层在工作记忆中的门控机制", "", "当周出差参会，时间冲突。", "pending",
     [("pending", "林知远 向你发起对调请求", "2026-06-13T02:10:00+00:00")]),
    ("api", "苏沐", None, "", "", "", "多模态对齐实验 · 预算 ¥200", "调用脑电特征模型做对齐评测。", "submitted",
     [("submitted", "已提交 API 密钥申请，等待管理员下发", "2026-06-12T02:40:00+00:00")]),
    ("ssh", "苏沐", None, "", "", "", "用户名 sumu · lab-gpu-03", "跑行为数据预处理。", "approved",
     [("submitted", "已提交服务器账号申请", "2026-06-09T06:00:00+00:00"),
      ("approved", "管理员已开通 sumu@lab-gpu-03", "2026-06-10T03:20:00+00:00")]),
    ("absence", "陈屿", None, "7月5日 周日", "", "", "", "学术会议，本次报告轮空。", "submitted",
     [("submitted", "已提交轮空请假，等待管理员审批", "2026-06-12T09:00:00+00:00")]),
    ("api", "Mei Lin", None, "", "", "", "脑电特征提取 · 预算 ¥80", "调用脑电特征模型。", "submitted",
     [("submitted", "已提交 API 密钥申请，等待管理员下发", "2026-06-12T07:30:00+00:00")]),
    ("ssh", "周野", None, "", "", "", "希望用户名 zhouye · 行为数据预处理", "跑行为数据预处理。", "submitted",
     [("submitted", "已提交服务器账号申请", "2026-06-11T11:00:00+00:00")]),
]


async def seed_requests(db: AsyncSession) -> None:
    if (await db.execute(select(Request.id))).first():
        return
    users = {u.name: u.id for u in (await db.execute(select(User))).scalars()}
    for kind, frm, to, fd, td, topic, detail, reason, st, events in _REQS:
        req = Request(
            kind=RequestKind(kind),
            requester_id=users[frm],
            target_user_id=users.get(to) if to else None,
            from_date=fd, to_date=td, topic=topic, detail=detail, reason=reason, status=st,
            events=[
                RequestEvent(status=s, note=note, actor_id=users.get(frm),
                             at=datetime.fromisoformat(iso))
                for s, note, iso in events
            ],
        )
        db.add(req)
    await db.commit()
    print(f"requests seed 完成：{len(_REQS)} 条演示请求")


# 实测内网 IP / 端口（开发机探测，详见记忆 labsys-intranet）。fodor/hinton 的 SSH 走 80。
_SERVERS = [
    ("turing", "172.16.185.103", 22, "4× RTX A6000", ServerStatus.online, "intranet",
     "通用训练主机，适合中等规模实验与交互式调试。无需报备，按需使用。"),
    ("lecun", "172.18.137.34", 22, "8× A100 80G", ServerStatus.online, "intranet",
     "大显存集群，用于大模型预训练与多卡分布式任务。占用 4 卡以上请先在群里报备。"),
    ("hinton", "172.16.185.96", 80, "4× RTX 4090", ServerStatus.busy, "intranet",
     "推理与微调主机，当前负载较高，建议错峰使用或先 nvidia-smi 查看空闲卡。"),
    ("fodor", "172.16.212.181", 80, "2× RTX 3090", ServerStatus.online, "intranet",
     "备用主机，按需使用。"),
]


async def seed_servers(db: AsyncSession) -> None:
    if (await db.execute(select(Server.id))).first():
        return
    for name, ip, port, gpu, st, net, desc in _SERVERS:
        db.add(Server(name=name, ip=ip, ssh_port=port, gpu=gpu, status=st, net=net, desc=desc))
    await db.commit()
    print(f"servers seed 完成：{len(_SERVERS)} 台")


async def seed_notifications(db: AsyncSession) -> None:
    if (await db.execute(select(Notification.id))).first():
        return
    sumu = (await db.execute(select(User).where(User.name == "苏沐"))).scalar_one_or_none()
    if sumu is None:
        return
    db.add_all([
        Notification(user_id=sumu.id, type="meeting", title="下周轮到你报告",
                     body="6月21日 周日 · 记得提前设置汇报主题。", read=False),
        Notification(user_id=sumu.id, type="approval", title="SSH 账号已开通",
                     body="管理员已开通 sumu@lab-gpu-03。", read=True),
    ])
    await db.commit()
    print("notifications seed 完成")
