import React from "react";
import * as NS from "../ds";
import { I, Icon } from "../lib/icons";
import { toast } from "../store";
import { useEvalCompute, useExcellence, useUsers } from "../api/hooks";
import { useMe } from "../auth";
import { useIsMobile } from "../lib/useIsMobile";

// AdminRecords — 表现记录: 只读的表现档案。
//   ① 每位成员的 报告态度 / 制作精良 / 出勤 / 讨论参与 / 优秀(获奖次数)，可切换归一化。
//   ② 当前评选期已发布的优秀奖获得者。
//   ③ 数据可导出为 CSV。
  const { Avatar, Button } = NS;

  const hCell = { fontSize: 10.5, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-faint)" };
  const GRID = "150px repeat(6, 1fr)";

  function MiniBar({ pct, color }: any) {
    return (
      <div style={{ width: "100%", maxWidth: 64, height: 5, background: "var(--surface-hover)", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: `${Math.max(3, Math.min(100, pct))}%`, height: "100%", background: color, borderRadius: 999 }} />
      </div>
    );
  }

  function AdminRecords() {
    const isMobile = useIsMobile();
    const [norm, setNorm] = React.useState(true);

    const evalQ = useEvalCompute();
    const excQ = useExcellence();
    const { data: users = [] } = useUsers();
    const { data: meUser } = useMe();
    const ev = evalQ.data || { rows: [], merged: [], total: 0 };
    const exc = excQ.data;

    // 后端当前仅暴露最新一次优秀名单（非多评选期历史），渲染为长度为 1 的数组。
    const excellence = exc ? [exc] : [];

    // 身份映射来自真实用户表（按姓名 → 身份/title），不再用假花名册。
    const roleByName: any = {};
    (users as any[]).forEach((u) => { roleByName[u.name] = u.title; });

    // 优秀奖获奖次数（当前已发布名单）
    const awardCount: Record<string, number> = {};
    excellence.forEach((e) => (e.names || []).forEach((n) => { awardCount[n] = (awardCount[n] || 0) + 1; }));
    const maxAward = Math.max(1, ...Object.values(awardCount), 1);

    // 展示区间：当前评选期（由 excellence 的时间范围给出）。
    const from = exc ? exc.from : "";
    const to = exc ? exc.to : "";
    const periodLabel = exc ? exc.period : "当前评选期";

    const COLS = [
      { key: "attitude", label: "报告态度", color: "var(--terracotta-500)", raw: (r) => r.attitude.toFixed(1), pct: (r) => r.nAttitude, val: (r) => r.attitude },
      { key: "polish", label: "制作精良", color: "var(--amber-500)", raw: (r) => r.polish.toFixed(1), pct: (r) => r.nPolish, val: (r) => r.polish },
      { key: "logic", label: "逻辑清晰", color: "var(--terracotta-400)", raw: (r) => (r.logic ?? 0).toFixed(1), pct: (r) => r.nLogic, val: (r) => r.logic ?? 0 },
      { key: "attRate", label: "出勤", color: "var(--sage-500)", raw: (r) => r.attRate + "%", pct: (r) => r.nAtt, val: (r) => r.attRate },
      { key: "discuss", label: "讨论参与", color: "var(--slate-500)", raw: (r) => String(r.discuss), pct: (r) => r.nDisc, val: (r) => r.discuss },
      { key: "award", label: "优秀", color: "var(--amber-500)", raw: (r) => (awardCount[r.name] || 0) + " 次", pct: (r) => (awardCount[r.name] || 0) / maxAward * 100, val: (r) => awardCount[r.name] || 0 },
    ];

    // 排序：点击列头切换列 / 升降序；默认按组会表现降序（ev.rows 原序）
    const [sort, setSort] = React.useState({ key: null, dir: "desc" });
    const toggleSort = (key) => setSort((s) => s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: key === "name" ? "asc" : "desc" });
    const sortArrow = (key) => sort.key === key ? (sort.dir === "desc" ? " ↓" : " ↑") : "";

    const colByKey = {}; COLS.forEach((c) => { colByKey[c.key] = c; });
    let rows = ev.rows; // 已按组会表现降序
    if (sort.key) {
      const getVal = sort.key === "name" ? null : colByKey[sort.key].val;
      rows = [...ev.rows].sort((a, b) => {
        let d;
        if (sort.key === "name") d = a.name.localeCompare(b.name, "zh");
        else d = getVal(a) - getVal(b);
        return sort.dir === "asc" ? d : -d;
      });
    }

    const gridCols = isMobile ? "1fr" : GRID;

    const exportCSV = () => {
      const header = ["成员", "身份", "报告态度", "制作精良", "逻辑清晰", "出勤率", "讨论参与", "优秀次数"];
      const lines = [header.join(",")];
      rows.forEach((r) => {
        lines.push([r.name, roleByName[r.name] || "", r.attitude.toFixed(1), r.polish.toFixed(1), (r.logic ?? 0).toFixed(1), r.attRate + "%", r.discuss, awardCount[r.name] || 0].join(","));
      });
      const csv = "﻿" + lines.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `表现记录_${from}_${to}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    return (
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: isMobile ? "16px 14px 40px" : "20px 28px 40px", display: "flex", flexDirection: "column", gap: 18 }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <h2 style={{ fontSize: 19, fontWeight: 600, color: "var(--text-strong)" }}>表现记录</h2>
            <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{from} → {to} · {ev.rows.length} 名成员</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            {/* 当前评选期标签 */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 32, padding: "0 11px", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", background: "var(--surface)" }}>
              <span style={{ display: "inline-flex", color: "var(--text-faint)" }}>{I("calendar-range", { size: 14 })}</span>
              <span style={{ color: "var(--text-strong)", fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 500, maxWidth: 220, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{periodLabel}</span>
            </div>
            {/* 归一化开关 */}
            <button onClick={() => setNorm((v) => !v)}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 32, padding: "0 12px", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", background: "var(--surface)", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--text-body)" }}>
              <span style={{ width: 30, height: 17, borderRadius: 999, background: norm ? "var(--accent)" : "var(--surface-hover)", position: "relative", transition: "background var(--dur-fast)", flexShrink: 0 }}>
                <span style={{ position: "absolute", top: 2, left: norm ? 15 : 2, width: 13, height: 13, borderRadius: "50%", background: "#fff", transition: "left var(--dur-fast)", boxShadow: "var(--shadow-xs)" }} />
              </span>
              归一化
            </button>
            <Button size="sm" variant="ghost" iconLeft={I("download")} onClick={exportCSV}>导出</Button>
          </div>
        </div>

        {/* ① 成员表现表 */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-xs)", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 10, padding: "10px 18px", borderBottom: "1px solid var(--border-subtle)", background: "var(--surface-sunken)", alignItems: "center" }}>
            <button onClick={() => toggleSort("name")} title="按姓名排序"
              style={{ ...hCell, display: "inline-flex", alignItems: "center", gap: 2, border: "none", background: "none", cursor: "pointer", padding: 0, color: sort.key === "name" ? "var(--accent-text)" : "var(--text-faint)" }}>成员{sortArrow("name")}</button>
            {COLS.map((c) => (
              <button key={c.key} onClick={() => toggleSort(c.key)} title={`按${c.label}排序`}
                style={{ ...hCell, display: "inline-flex", alignItems: "center", gap: 4, border: "none", background: "none", cursor: "pointer", padding: 0, color: sort.key === c.key ? "var(--accent-text)" : "var(--text-faint)" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.color, flexShrink: 0 }} />{c.label}{sortArrow(c.key)}
              </button>
            ))}
          </div>
          {rows.map((r, i) => {
            const me = !!meUser && r.name === meUser.name;
            return (
              <div key={r.name} style={{ display: "grid", gridTemplateColumns: gridCols, gap: 10, padding: "9px 18px", alignItems: "center", borderBottom: i < rows.length - 1 ? "1px solid var(--border-subtle)" : "none", background: me ? "var(--accent-soft)" : "transparent" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <Avatar name={r.name} size="xs" />
                  <span style={{ fontSize: 13, fontWeight: me ? 600 : 500, color: "var(--text-strong)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
                </div>
                {COLS.map((c) => (
                  <div key={c.key} style={{ display: "flex", flexDirection: isMobile ? "row" : "column", alignItems: isMobile ? "center" : "stretch", justifyContent: isMobile ? "space-between" : "flex-start", gap: isMobile ? 10 : 3, minWidth: 0 }}>
                    {isMobile && <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--text-faint)" }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: c.color, flexShrink: 0 }} />{c.label}</span>}
                    {norm
                      ? <span style={{ display: "flex", flexDirection: isMobile ? "row" : "column", alignItems: "center", gap: isMobile ? 8 : 3 }}><MiniBar pct={c.pct(r)} color={c.color} /><span className="cibol-mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.raw(r)}</span></span>
                      : <span className="cibol-mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)" }}>{c.raw(r)}</span>}
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* ② 当前优秀奖获得者 */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--amber-500)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{I("award", { size: 13 })}</span>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-strong)" }}>优秀奖获得者</h3>
            <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>{exc && exc.published ? "已发布" : "预览"}</span>
          </div>
          {excellence.length === 0 ? (
            <div style={{ padding: "28px 16px", textAlign: "center", fontSize: 13, color: "var(--text-faint)", border: "1px dashed var(--border-default)", borderRadius: "var(--radius-md)" }}>尚未发布过优秀名单。</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {excellence.map((e, ei) => (
                <div key={ei}
                  style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-xs)", padding: "13px 16px" }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)" }}>{e.period}</span>
                    <span style={{ fontSize: 12, color: "var(--text-faint)" }}>{e.from} → {e.to} · 共 {e.count} 人</span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                    {(e.names || []).map((n, i) => (
                      <span key={n} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 11px 3px 4px", background: i < 3 ? "var(--amber-soft, var(--accent-soft))" : "var(--surface-sunken)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-pill)" }}>
                        <span style={{ fontFamily: "var(--font-serif)", fontSize: 11, fontWeight: 700, color: i < 3 ? "var(--amber-text, var(--accent-text))" : "var(--text-faint)", width: 15, textAlign: "center" }}>{i + 1}</span>
                        <Avatar name={n} size="xs" />
                        <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-strong)" }}>{n}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  export { AdminRecords };
