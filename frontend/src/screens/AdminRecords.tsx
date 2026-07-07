import React from "react";
import * as NS from "../ds";
import { I } from "../lib/icons";
import { useExcellenceAll, useUsers } from "../api/hooks";
import { useIsMobile } from "../lib/useIsMobile";
import { toast } from "../store";

const { Avatar, Button, ScreenState, EmptyState } = NS;

type Excellence = {
  period: string;
  from: string;
  to: string;
  names: string[];
  count: number;
  perfect_attendance?: string[];
  award_excellence?: number;
  award_attendance?: number;
  note?: string;
  published: boolean;
  published_at?: string | null;
};

function PeriodCard({ exc, isMobile }: { exc: Excellence; isMobile: boolean }) {
  const names = exc.names || [];
  const att = exc.perfect_attendance || [];
  const awdExc = exc.award_excellence ?? 1000;
  const awdAtt = exc.award_attendance ?? 100;

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-xs)", overflow: "hidden" }}>
      {/* 期标题 */}
      <div style={{ padding: "11px 16px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", background: "var(--surface-sunken)" }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)" }}>{exc.period || "（未命名评选期）"}</span>
        <span style={{ fontSize: 12, color: "var(--text-faint)" }}>{exc.from} → {exc.to}</span>
      </div>

      <div style={{ padding: "12px 16px", display: "flex", flexDirection: isMobile ? "column" : "row", gap: 16 }}>
        {/* 优秀奖 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--amber-500)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 11 }}>{I("award", { size: 11 })}</span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-strong)" }}>优秀奖</span>
            <span style={{ fontSize: 11.5, color: "var(--text-faint)", marginLeft: 2 }}>¥{awdExc.toLocaleString()}/人</span>
            <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-faint)" }}>{names.length} 人</span>
          </div>
          {names.length === 0 ? (
            <span style={{ fontSize: 12, color: "var(--text-faint)" }}>—</span>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {names.map((n, i) => (
                <span key={n} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px 3px 4px", background: i < 3 ? "var(--amber-soft, var(--accent-soft))" : "var(--surface-sunken)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-pill)" }}>
                  <span style={{ fontFamily: "var(--font-serif)", fontSize: 10.5, fontWeight: 700, color: i < 3 ? "var(--amber-text, var(--accent-text))" : "var(--text-faint)", width: 14, textAlign: "center" }}>{i + 1}</span>
                  <Avatar name={n} size="xs" />
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-strong)" }}>{n}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {!isMobile && <div style={{ width: 1, background: "var(--border-subtle)", flexShrink: 0 }} />}

        {/* 全勤奖 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--sage-500)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 11 }}>{I("check-circle", { size: 11 })}</span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-strong)" }}>全勤奖</span>
            <span style={{ fontSize: 11.5, color: "var(--text-faint)", marginLeft: 2 }}>¥{awdAtt.toLocaleString()}/人</span>
            <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-faint)" }}>{att.length} 人</span>
          </div>
          {att.length === 0 ? (
            <span style={{ fontSize: 12, color: "var(--text-faint)" }}>—</span>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {att.map((n) => (
                <span key={n} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px 3px 6px", background: "var(--sage-soft, var(--surface-sunken))", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-pill)" }}>
                  <Avatar name={n} size="xs" />
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-strong)" }}>{n}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BonusTable({ history, members, isMobile }: { history: Excellence[]; members: any[]; isMobile: boolean }) {
  const [open, setOpen] = React.useState(false);

  // 汇总每人奖金
  type Row = { name: string; attCount: number; excCount: number; total: number };
  const map = new Map<string, Row>();
  for (const e of history) {
    const awdExc = e.award_excellence ?? 1000;
    const awdAtt = e.award_attendance ?? 100;
    for (const n of e.names || []) {
      const r = map.get(n) ?? { name: n, attCount: 0, excCount: 0, total: 0 };
      r.excCount += 1;
      r.total += awdExc;
      map.set(n, r);
    }
    for (const n of e.perfect_attendance || []) {
      const r = map.get(n) ?? { name: n, attCount: 0, excCount: 0, total: 0 };
      r.attCount += 1;
      r.total += awdAtt;
      map.set(n, r);
    }
  }
  const rows = [...map.values()].sort((a, b) => b.total - a.total);

  // 导出做账表（#10）：按月透视（姓名/全勤/优秀/职务/总额，列同人工 Excel）+ 跨周期按人合计。
  // 数据全部来自系统：全勤/优秀来自各评选期发布结果，职务来自成员「月职务津贴」。
  const exportBonusCSV = () => {
    const esc = (v: any) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    // 职务津贴（当前值，按月固定发放）与在册成员顺序
    const dutyOf = new Map<string, number>();
    const roster: string[] = [];
    for (const m of members || []) {
      if (m.disabled) continue;
      dutyOf.set(m.name, m.duty_allowance || 0);
      roster.push(m.name);
    }
    const seen = new Set(roster);
    // 跨周期按人合计
    type Sum = { att: number; exc: number; duty: number; total: number };
    const grand = new Map<string, Sum>();
    const bump = (n: string, k: keyof Sum, v: number) => {
      const s = grand.get(n) ?? { att: 0, exc: 0, duty: 0, total: 0 };
      s[k] += v; s.total += v; grand.set(n, s);
    };
    const lines: string[] = [];
    lines.push("奖金做账表 · 按月（姓名/全勤/优秀/职务/总额，金额单位：元）");
    // 每个评选周期一段（对应人工 Excel 的每月一个 sheet）
    for (const e of history) {
      const awdExc = e.award_excellence ?? 1000;
      const awdAtt = e.award_attendance ?? 100;
      const nameSet = new Set(e.names || []);
      const attSet = new Set(e.perfect_attendance || []);
      // 本期名单 = 在册成员 ∪ 本期任一获奖者（含已离开的成员，保证不漏）
      const monthNames = [...roster];
      for (const n of [...nameSet, ...attSet]) if (!seen.has(n)) monthNames.push(n);
      lines.push("");
      lines.push(esc(`${e.period || "（未命名评选期）"}  ${e.from ?? ""}~${e.to ?? ""}`));
      lines.push(["姓名", "全勤", "优秀", "职务", "总额"].join(","));
      let sa = 0, se = 0, sd = 0, st = 0;
      for (const n of monthNames) {
        const att = attSet.has(n) ? awdAtt : 0;
        const exc = nameSet.has(n) ? awdExc : 0;
        const duty = dutyOf.get(n) ?? 0;
        const total = att + exc + duty;
        lines.push([n, att, exc, duty, total].map(esc).join(","));
        sa += att; se += exc; sd += duty; st += total;
        bump(n, "att", att); bump(n, "exc", exc); bump(n, "duty", duty);
      }
      lines.push(["小计", sa, se, sd, st].map(esc).join(","));
    }
    // 跨周期按人合计
    lines.push("");
    lines.push("跨周期按人合计");
    lines.push(["姓名", "全勤合计", "优秀合计", "职务合计", "总合计"].join(","));
    const sums = [...grand.entries()].sort((a, b) => b[1].total - a[1].total);
    let ga = 0, ge = 0, gd = 0, gt = 0;
    for (const [n, s] of sums) {
      lines.push([n, s.att, s.exc, s.duty, s.total].map(esc).join(","));
      ga += s.att; ge += s.exc; gd += s.duty; gt += s.total;
    }
    lines.push(["合计", ga, ge, gd, gt].map(esc).join(","));
    const csv = "﻿" + lines.join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url; a.download = `奖金做账表_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("已导出做账表");
  };

  const hCell: React.CSSProperties = { fontSize: 10.5, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-faint)" as any };
  const GRID = isMobile ? "1fr 1fr 1fr 1fr" : "180px 1fr 1fr 1fr";

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-xs)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px" }}>
        <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--terracotta-500)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{I("coins", { size: 13 })}</span>
        <button type="button" onClick={() => setOpen((v) => !v)}
          style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)", flex: 1 }}>奖金汇总</span>
          <span style={{ fontSize: 12, color: "var(--text-faint)" }}>{rows.length} 人获奖</span>
          <span style={{ color: "var(--text-faint)", transition: "transform var(--dur-fast)", transform: open ? "rotate(180deg)" : "rotate(0deg)", display: "inline-flex" }}>{I("chevron-down", { size: 16 })}</span>
        </button>
        <Button size="sm" variant="ghost" iconLeft={I("download")} onClick={exportBonusCSV} disabled={rows.length === 0}>导出做账表</Button>
      </div>

      {open && (
        <div style={{ borderTop: "1px solid var(--border-subtle)" }}>
          {/* 表头 */}
          <div style={{ display: "grid", gridTemplateColumns: GRID, gap: 8, padding: "8px 16px", background: "var(--surface-sunken)", alignItems: "center" }}>
            <span style={hCell}>成员</span>
            <span style={{ ...hCell, textAlign: "right" }}>全勤奖次数</span>
            <span style={{ ...hCell, textAlign: "right" }}>优秀奖次数</span>
            <span style={{ ...hCell, textAlign: "right" }}>总奖金</span>
          </div>
          {rows.length === 0 ? (
            <EmptyState compact title="暂无奖金记录" style={{ padding: "20px 0" }} />
          ) : (
            rows.map((r, i) => (
              <div key={r.name} style={{ display: "grid", gridTemplateColumns: GRID, gap: 8, padding: "8px 16px", alignItems: "center", borderTop: "1px solid var(--border-subtle)", background: i === 0 ? "var(--accent-soft)" : "transparent" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                  <Avatar name={r.name} size="xs" />
                  <span style={{ fontSize: 13, fontWeight: i === 0 ? 600 : 500, color: "var(--text-strong)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
                </div>
                <span className="cibol-mono" style={{ fontSize: 13, color: "var(--sage-700, var(--text-body))", textAlign: "right", fontWeight: r.attCount > 0 ? 600 : 400 }}>
                  {r.attCount > 0 ? `× ${r.attCount}` : "—"}
                </span>
                <span className="cibol-mono" style={{ fontSize: 13, color: "var(--amber-700, var(--text-body))", textAlign: "right", fontWeight: r.excCount > 0 ? 600 : 400 }}>
                  {r.excCount > 0 ? `× ${r.excCount}` : "—"}
                </span>
                <span className="cibol-mono" style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-strong)", textAlign: "right" }}>
                  ¥{r.total.toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function AdminRecords() {
  const isMobile = useIsMobile();
  const allQ = useExcellenceAll();
  const history: Excellence[] = (allQ.data as any) || [];
  const { data: members = [] } = useUsers();

  if (allQ.isLoading) return <ScreenState loading />;
  if (allQ.isError) return <ScreenState error onRetry={() => allQ.refetch()} />;

  const latest = history[0];
  const periodLabel = latest?.period || "当前评选期";
  const from = latest?.from || "";
  const to = latest?.to || "";

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: isMobile ? "16px 14px 40px" : "20px 28px 40px", display: "flex", flexDirection: "column", gap: 18 }}>
      {/* 页头 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 19, fontWeight: 600, color: "var(--text-strong)" }}>表现记录</h2>
          {from && <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{from} → {to}</span>}
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 32, padding: "0 11px", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", background: "var(--surface)" }}>
          {I("calendar-range", { size: 14 })}
          <span style={{ color: "var(--text-strong)", fontSize: 12.5, fontWeight: 500, maxWidth: 220, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{periodLabel}</span>
        </div>
      </div>

      {/* 各期获奖名单 */}
      {history.length === 0 ? (
        <div style={{ padding: "32px 16px", textAlign: "center", fontSize: 13, color: "var(--text-faint)", border: "1px dashed var(--border-default)", borderRadius: "var(--radius-md)" }}>
          尚未发布过任何评选期的奖项。
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {history.map((e, i) => <PeriodCard key={i} exc={e} isMobile={isMobile} />)}
        </div>
      )}

      {/* 奖金汇总（可展开） */}
      <BonusTable history={history} members={members as any[]} isMobile={isMobile} />
    </div>
  );
}

export { AdminRecords };
