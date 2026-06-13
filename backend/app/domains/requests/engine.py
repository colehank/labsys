"""请求状态机引擎 —— 从 frontend/src/store.ts 的 REQ_FLOW 移植，作权威校验。"""
from __future__ import annotations

from app.models import RequestKind

# 每个 kind 的初始态与合法迁移。
FLOW: dict[str, dict] = {
    "swap": {
        "initial": "pending",
        "transitions": {"pending": ["accepted", "declined", "cancelled"]},
    },
    "absence": {
        "initial": "submitted",
        "transitions": {"submitted": ["approved", "rejected", "cancelled"]},
    },
    "api": {
        "initial": "submitted",
        "transitions": {"submitted": ["approved", "rejected", "cancelled"]},
    },
    "ssh": {
        "initial": "submitted",
        "transitions": {"submitted": ["approved", "rejected", "cancelled"]},
    },
}

# 终态
TERMINAL = {"accepted", "declined", "approved", "rejected", "cancelled"}


def initial_status(kind: RequestKind | str) -> str:
    k = kind.value if isinstance(kind, RequestKind) else kind
    return FLOW[k]["initial"]


def can_transition(kind: RequestKind | str, frm: str, to: str) -> bool:
    k = kind.value if isinstance(kind, RequestKind) else kind
    return to in FLOW[k]["transitions"].get(frm, [])


def required_role(kind: RequestKind | str, to: str) -> str:
    """谁有权执行该迁移：cancelled=requester；swap accept/decline=target；其余审批=admin。"""
    if to == "cancelled":
        return "requester"
    k = kind.value if isinstance(kind, RequestKind) else kind
    if k == "swap":
        return "target"          # 对调由对方确认
    return "admin"               # 请假/API/SSH 由管理员审批
