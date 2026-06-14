import React from "react";
import * as NS from "../ds";
import { I, Icon } from "../lib/icons";
import { toast } from "../store";
import { useEvalCompute, useEvalReports, useSetAttendance } from "../api/hooks";
import { useMe } from "../auth";
import { useIsMobile } from "../lib/useIsMobile";

// AdminMeetingStats — 组会统计: 管理员逐次组会核对「出勤」。
// 报告评分（态度/精良）与讨论参与来自成员匿名评分，此处只读 —— 单一数据源，不重复录入。
  const { Card, Avatar, Badge, Button } = NS;

  const ATT = [
    { key: "present", label: "出勤", tone: "success", icon: "check" },
    { key: "leave", label: "请假", tone: "amber", icon: "clock" },
    { key: "absent", label: "缺席", tone: "danger", icon: "x" },
  ];

  // 出勤三态分段控件
  function AttendSeg({ value, onChange }: any) {
    return (
      <div style={{ display: "inline-flex", padding: 2, gap: 2, background: "var(--surface-hover)", borderRadius: "var(--radius-md)" }}>
        {ATT.map((a) => {
          const on = value === a.key;
          return (
            <button key={a.key} type="button" onClick={() => onChange(a.key)} title={a.label}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px", border: "none", cursor: "pointer",
                fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 600, borderRadius: "var(--radius-sm)",
                background: on ? `var(--${a.tone}-soft)` : "transparent",
                color: on ? `var(--${a.tone}-text)` : "var(--text-faint)",
                boxShadow: on ? "var(--shadow-xs)" : "none", transition: "all var(--dur-fast) var(--ease-out)",
              }}>
              <span style={{ width: 13, height: 13, display: "inline-flex" }}>{I(a.icon, { size: 13 })}</span>
              {a.label}
            </button>
          );
        })}
      </div>
    );
  }

  function AdminMeetingStats() {
    const isMobile = useIsMobile();
    const { data: compute } = useEvalCompute();
    const { data: reportData } = useEvalReports();
    const { data: meUser } = useMe();
    const setAtt = useSetAttendance();

    const rows = compute?.rows ?? [];
    const reports = reportData ?? [];
    const members = rows.map((r) => r.name);

    const [sel, setSel] = React.useState(0); // 默认最近一次（末位），加载后校正
    React.useEffect(() => { setSel(Math.max(0, reports.length - 1)); }, [reports.length]);

    // 出勤本地态：以各会次后端值为种子，管理员可逐人核对。
    const [attEdits, setAttEdits] = React.useState<Record<string, Record<string, string>>>({});
    const setAttendance = (key: string, name: string, status: string) =>
      setAttEdits((prev) => ({ ...prev, [key]: { ...(prev[key] || {}), [name]: status } }));

    const attendanceOf = (key: string): Record<string, string> => {
      const seed = (reports.find((rr) => rr.key === key)?.attendance || {}) as Record<string, string>;
      return { ...seed, ...(attEdits[key] || {}) };
    };

    const mdLabelOf = (rr: { mo: number; day: number }) => `${rr.mo + 1}/${String(rr.day).padStart(2, "0")}`;

    const r = reports[sel];

    // 评分 / 讨论得分由成员匿名提交，此处只读；后端暂未下发明细，缺省为空。
    const ratings: Record<string, { attitude: number; polish: number; raters: number }> = {};
    const disc: Record<string, number> = {};
    const cancelled = false;

    // 当前报告汇总
    const att = r ? attendanceOf(r.key) : {};
    const present = members.filter((n) => att[n] === "present").length;
    const leave = members.filter((n) => att[n] === "leave").length;
    const absent = members.filter((n) => att[n] === "absent").length;
    const totalDisc = members.reduce((s, n) => s + (disc[n] || 0), 0);

    const Stat = ({ label, value, tone }: any) => (
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span className="cibol-mono" style={{ fontSize: 19, fontWeight: 600, color: tone ? `var(--${tone}-text)` : "var(--text-strong)", lineHeight: 1 }}>{value}</span>
        <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{label}</span>
      </div>
    );

    if (!r) {
      return (
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: isMobile ? "16px 14px 48px" : "24px 32px 48px" }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-strong)" }}>组会统计</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>核对每次组会出勤 · 评分由成员提交</p>
        </div>
      );
    }

    return (
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: isMobile ? "16px 14px 48px" : "24px 32px 48px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 6, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-strong)" }}>组会统计</h2>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>核对每次组会出勤 · 评分由成员提交</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Button size="sm" variant="primary" iconLeft={I("check")} disabled={cancelled}
              onClick={() => {
                const key = reports[sel]?.key;
                const edits = key ? (attEdits[key] || {}) : {};
                const entries = Object.entries(edits);
                if (!key || entries.length === 0) { toast("出勤无改动"); return; }
                Promise.all(entries.map(([name, status]) => setAtt.mutateAsync({ key, name, status })))
                  .then(() => toast("已保存 · 本次组会出勤"))
                  .catch(() => toast("保存失败", { tone: "error" }));
              }}>保存出勤</Button>
          </div>
        </div>

        {/* 报告选择 — 横向滚动的会次条 */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "12px 0 14px" }}>
          {reports.map((rr, i) => {
            const on = i === sel;
            const a = attendanceOf(rr.key);
            const filled = members.some((n) => a[n]);
            return (
              <button key={rr.key} onClick={() => setSel(i)}
                style={{
                  flexShrink: 0, display: "flex", flexDirection: "column", gap: 4, padding: "10px 14px", textAlign: "left", cursor: "pointer",
                  border: `1px solid ${on ? "var(--accent)" : "var(--border-subtle)"}`,
                  background: on ? "var(--accent-soft)" : "var(--surface)", borderRadius: "var(--radius-md)",
                  transition: "all var(--dur-fast) var(--ease-out)",
                }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span className="cibol-mono" style={{ fontSize: 13, fontWeight: 600, color: on ? "var(--accent-text)" : "var(--text-strong)" }}>{mdLabelOf(rr)}</span>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: filled ? "var(--success)" : "var(--border-strong)", flexShrink: 0 }} />
                </div>
                <span style={{ fontSize: 11.5, color: "var(--text-faint)", whiteSpace: "nowrap" }}>{filled ? "已核对" : "待核对"}</span>
              </button>
            );
          })}
        </div>

        {/* 当前会次摘要 */}
        <Card padding="lg" style={{ marginBottom: 16, opacity: cancelled ? 0.62 : 1 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: "var(--text-strong)", textDecoration: cancelled ? "line-through" : "none" }}>{r.dateLabel}</span>
                {cancelled && <Badge tone="danger" size="sm">已取消</Badge>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-muted)" }}>
                <span style={{ width: 14, height: 14, display: "inline-flex", color: "var(--text-faint)" }}>{I("presentation", { size: 14 })}</span>
                <span>报告人：{r.presenters.join("、")}</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 26, flexWrap: "wrap" }}>
              <Stat label="出勤" value={present} tone="success" />
              <Stat label="请假" value={leave} tone="amber" />
              <Stat label="缺席" value={absent} tone="danger" />
              <div style={{ width: 1, height: 30, background: "var(--border-subtle)" }} />
              <Stat label="讨论得分" value={totalDisc} />
            </div>
          </div>
          {cancelled && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, padding: "9px 12px", background: "var(--danger-soft)", borderRadius: "var(--radius-md)", fontSize: 12.5, color: "var(--danger-text)" }}>
              <span style={{ width: 15, height: 15, display: "inline-flex" }}>{I("info", { size: 15 })}</span>
              <span>本次已取消，不计入表现，汇报顺序顺延。</span>
            </div>
          )}
        </Card>

        {/* 报告人评分（成员提交，只读）*/}
        {!cancelled && r.presenters.length > 0 && (
          <Card padding="none" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
              <span style={{ width: 15, height: 15, display: "inline-flex", color: "var(--text-faint)" }}>{I("star", { size: 15 })}</span>
              <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-faint)" }}>报告人评分 · 成员提交</span>
              <span style={{ fontSize: 11.5, color: "var(--text-faint)", marginLeft: "auto" }}>只读</span>
            </div>
            {r.presenters.map((pn, i) => {
              const rt = ratings[pn] || { attitude: 0, polish: 0, raters: 0 };
              return (
                <div key={pn} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 20px", borderTop: i ? "1px solid var(--border-subtle)" : "none" }}>
                  <Avatar name={pn} size="sm" />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)" }}>{pn}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
                    {([["报告态度", rt.attitude, "var(--terracotta-500)"], ["制作精良", rt.polish, "var(--amber-500)"]] as [string, number, string][]).map(([lb, v, c]) => (
                      <div key={lb} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{lb}</span>
                        <span className="cibol-mono" style={{ fontSize: 14, fontWeight: 700, color: c }}>{v ? v.toFixed(1) : "—"}</span>
                      </div>
                    ))}
                    <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{rt.raters} 人已评</span>
                  </div>
                </div>
              );
            })}
          </Card>
        )}

        {/* 逐人出勤核对 + 讨论得分(只读) */}
        <Card padding="none" style={{ opacity: cancelled ? 0.5 : 1, pointerEvents: cancelled ? "none" : "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr auto auto", gap: 16, padding: "11px 20px", borderBottom: "1px solid var(--border-subtle)", alignItems: "center" }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-faint)" }}>成员</span>
            <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-faint)", textAlign: "center" }}>出勤情况</span>
            <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-faint)", textAlign: "right", minWidth: 96 }}>讨论得分</span>
          </div>
          <div>
            {members.map((name, i) => {
              const status = att[name] || "present";
              const isPresenter = r.presenters.includes(name);
              const me = !!meUser && name === meUser.name;
              const dv = disc[name] || 0;
              return (
                <div key={name} style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr auto auto", gap: isMobile ? 8 : 16, padding: "10px 20px", alignItems: "center", borderBottom: i < members.length - 1 ? "1px solid var(--border-subtle)" : "none", background: me ? "var(--accent-soft)" : "transparent" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <Avatar name={name} size="sm" />
                    <span style={{ fontSize: 13.5, fontWeight: me ? 600 : 500, color: "var(--text-strong)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
                    {isPresenter && <Badge tone="accent" size="sm">报告人</Badge>}
                  </div>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <AttendSeg value={status} onChange={(v) => setAttendance(r.key, name, v)} />
                  </div>
                  <div style={{ minWidth: 96, textAlign: "right" }}>
                    <span className="cibol-mono" style={{ fontSize: 14, fontWeight: 600, color: status === "present" ? "var(--text-strong)" : "var(--text-faint)", fontVariantNumeric: "tabular-nums" }}>{status === "present" ? dv : "—"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 12.5, color: "var(--text-faint)" }}>
          <span style={{ width: 14, height: 14, display: "inline-flex" }}>{I("info", { size: 14 })}</span>
          <span>请假 / 缺席 均计作未出勤。报告评分与讨论得分由成员提交，管理员只核对出勤。</span>
        </div>
      </div>
    );
  }

  export { AdminMeetingStats };
