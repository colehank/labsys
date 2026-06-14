"""ORM 模型聚合 —— Alembic autogenerate 与应用都从这里导入 Base。"""
from app.models.apikey import ApiKey
from app.models.base import Base
from app.models.evaluation import (
    Attendance,
    Discussion,
    EvalConfig,
    Excellence,
    PeerBaseline,
    Rating,
)
from app.models.lab import (
    AnnLevel,
    Announcement,
    LabConfig,
    Meeting,
    MeetingStatus,
    MeetingType,
    Presenter,
    Semester,
)
from app.models.notification import Notification
from app.models.request import Request, RequestEvent, RequestKind
from app.models.server import Server, ServerStatus
from app.models.ssh_credential import SshCredential
from app.models.user import Role, User

__all__ = [
    "Base",
    "User",
    "Role",
    "Semester",
    "LabConfig",
    "Announcement",
    "AnnLevel",
    "Meeting",
    "MeetingType",
    "MeetingStatus",
    "Presenter",
    "Request",
    "RequestEvent",
    "RequestKind",
    "Server",
    "ServerStatus",
    "SshCredential",
    "Notification",
    "ApiKey",
    "Attendance",
    "Discussion",
    "Rating",
    "PeerBaseline",
    "EvalConfig",
    "Excellence",
]
