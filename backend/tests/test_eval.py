"""评选引擎对拍 —— Python 移植 vs JS 原版（eval_reference.mjs），逐字段比对。"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

import pytest

from app.domains.evals.engine import (
    DEFAULT_FILTERS,
    DEFAULT_RANGE,
    DEFAULT_WEIGHTS,
    MEMBERS,
    build_past_reports,
    compute_eval,
    seed_eval,
)

REF = Path(__file__).parent / "eval_reference.mjs"


def _js_reference() -> dict:
    out = subprocess.run(["node", str(REF)], capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def _py_eval() -> dict:
    reports = build_past_reports()
    seed = seed_eval(reports)
    return compute_eval(
        MEMBERS, reports, seed["attendance"], seed["discussion"], seed["ratings"],
        seed["peer_baseline"], DEFAULT_WEIGHTS, DEFAULT_FILTERS, DEFAULT_RANGE,
    )


def test_total_matches() -> None:
    ref = _js_reference()
    py = _py_eval()
    assert py["total"] == ref["total"] == 8


def test_rows_match_js_reference() -> None:
    ref = _js_reference()
    py = _py_eval()
    py_rows = {r["name"]: r for r in py["rows"]}
    assert len(ref["rows"]) == len(py_rows) == len(MEMBERS)
    for jr in ref["rows"]:
        pr = py_rows[jr["name"]]
        assert pr["attRate"] == jr["attRate"], f"{jr['name']} attRate"
        assert pr["discuss"] == jr["discuss"], f"{jr['name']} discuss"
        assert pr["meetingRank"] == jr["meetingRank"], f"{jr['name']} meetingRank"
        assert pr["attitude"] == pytest.approx(jr["attitude"], abs=1e-9), f"{jr['name']} attitude"
        assert pr["polish"] == pytest.approx(jr["polish"], abs=1e-9), f"{jr['name']} polish"
        assert pr["meeting"] == pytest.approx(jr["meeting"], abs=1e-9), f"{jr['name']} meeting"


def test_merged_ranking_matches_js_reference() -> None:
    ref = _js_reference()
    py = _py_eval()
    assert len(py["merged"]) == len(ref["merged"])
    # 最终排名顺序与分数逐一对齐
    for jm, pm in zip(ref["merged"], py["merged"]):
        assert pm["name"] == jm["name"], "最终排名顺序不一致"
        assert pm["finalRank"] == jm["finalRank"]
        assert pm["mRank"] == jm["mRank"]
        assert pm["pRank"] == jm["pRank"]
        assert pm["score"] == pytest.approx(jm["score"], abs=1e-9)
