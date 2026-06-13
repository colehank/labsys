"""dmxapi 余额换算单测（纯函数，不联网）。"""
from __future__ import annotations

from app.domains.apikeys.dmxapi import quota_to_rmb


def test_quota_to_rmb() -> None:
    # RMB = quota / 500000
    assert quota_to_rmb(500000) == 1.0
    assert quota_to_rmb(100000000) == 200.0
    assert quota_to_rmb(0) == 0.0
    assert quota_to_rmb(None) is None
