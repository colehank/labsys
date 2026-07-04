// RequestTracker — the request state-machine card, shared by 组会 and 消息·申请.
import React from "react";
import { Badge, Button } from "../ds";
import { I } from "../lib/icons";
import { REQ_FLOW } from "../lib/reqFlow";
import { useAdvanceRequest } from "../api/hooks";
import { useIsMobile } from "../lib/useIsMobile";

const REQ_META: Record<string, any> = {
  pending: { label: "待对方确认", tone: "warning", icon: "loader" },
  accepted: { label: "对调已生效", tone: "success", icon: "check-check" },
  declined: { label: "对方已拒绝", tone: "danger", icon: "x" },
  submitted: { label: "待管理员审批", tone: "warning", icon: "loader" },
  approved: { label: "已批准", tone: "success", icon: "check-check" },
  rejected: { label: "已驳回", tone: "danger", icon: "x" },
  cancelled: { label: "已撤回", tone: "neutral", icon: "rotate-ccw" },
};
const FLOW_STEPS: Record<string, string[]> = {
  swap: ["已发送", "待对方确认", "对调生效"],
  absence: ["已提交", "待管理员审批", "已批准"],
  api: ["已提交", "待管理员审批", "密钥下发"],
  ssh: ["已提交", "待管理员审批", "账号开通"],
};
const REQ_HEAD: Record<string, any> = {
  swap: { icon: "repeat", title: (r: any) => `与 ${r.toName} 对调`, sub: (r: any) => `${r.fromDate} ⇄ ${r.toDate}` },
  absence: { icon: "calendar-x", title: () => "轮空请假", sub: (r: any) => r.fromDate },
  api: { icon: "key-round", title: () => "API 密钥申请", sub: (r: any) => r.detail || r.reason },
  ssh: { icon: "server-cog", title: () => "服务器账号申请", sub: (r: any) => r.detail || r.reason },
};
const NEXT_LABEL: Record<string, string> = { accepted: "模拟对方接受", declined: "模拟对方拒绝", approved: "模拟管理员批准", rejected: "模拟管理员驳回" };

function StepNode({ state, n, label }: { state: string; n: number; label: string }) {
  const C: any = {
    done: { bg: "var(--success)", bd: "var(--success)", fg: "#fff", ic: "check" },
    active: { bg: "var(--warning-soft)", bd: "var(--warning)", fg: "var(--warning-text)", ic: null },
    fail: { bg: "var(--danger)", bd: "var(--danger)", fg: "#fff", ic: "x" },
    future: { bg: "var(--surface)", bd: "var(--border-default)", fg: "var(--text-faint)", ic: null },
    skip: { bg: "var(--surface-sunken)", bd: "var(--border-subtle)", fg: "var(--text-faint)", ic: null },
  }[state];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, flex: 1, minWidth: 0 }}>
      <span style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: C.bg, border: `2px solid ${C.bd}`, color: C.fg, fontSize: 12, fontWeight: 700,
        boxShadow: state === "active" ? "0 0 0 4px var(--warning-soft)" : "none" }}>
        {C.ic ? I(C.ic, { size: 14 }) : (state === "active" ? <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--warning)" }} /> : n)}
      </span>
      <span style={{ fontSize: 11.5, fontWeight: state === "active" ? 700 : 500, color: state === "future" || state === "skip" ? "var(--text-faint)" : "var(--text-body)", textAlign: "center", lineHeight: 1.3 }}>{label}</span>
    </div>
  );
}

export function RequestTracker({ req, compact, collapsible }: { req: any; compact?: boolean; collapsible?: boolean }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = React.useState(!collapsible);
  const advance = useAdvanceRequest();
  const meta = REQ_META[req.status] || REQ_META.pending;
  const steps = FLOW_STEPS[req.kind] || FLOW_STEPS.swap;
  const head = REQ_HEAD[req.kind] || REQ_HEAD.swap;
  const success = req.status === "accepted" || req.status === "approved";
  const fail = ["declined", "rejected", "cancelled"].includes(req.status);
  const allowed = (REQ_FLOW[req.kind] || REQ_FLOW.swap).transitions[req.status] || [];
  const last = req.history[req.history.length - 1];
  const fmt = (iso: string) => { const x = new Date(iso); return `${x.getMonth() + 1}/${x.getDate()} ${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`; };

  const stateOf = (i: number) => {
    if (fail) return i === 0 ? "done" : i === 1 ? "fail" : "skip";
    if (success) return "done";
    return i < 1 ? "done" : i === 1 ? "active" : "future";
  };
  const labelOf = (i: number) => (i === 1 && fail ? meta.label : i === 2 && success ? steps[2] : steps[i]);
  const connDone = (i: number) => stateOf(i) === "done";

  return (
    <div style={{ border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", background: "var(--surface)", overflow: "hidden" }}>
      <div onClick={collapsible ? () => setOpen((o) => !o) : undefined}
        role={collapsible ? "button" : undefined} tabIndex={collapsible ? 0 : undefined}
        onKeyDown={collapsible ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); } } : undefined}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: open ? "1px solid var(--border-subtle)" : "none", cursor: collapsible ? "pointer" : "default", userSelect: "none" }}>
        <span style={{ width: 30, height: 30, flexShrink: 0, borderRadius: "var(--radius-md)", background: `var(--${meta.tone}-soft)`, color: `var(--${meta.tone}-text)`, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          {I(head.icon, { size: 16 })}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{head.title(req)}</div>
          <div style={{ fontSize: 12, color: "var(--text-faint)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{head.sub(req)}</div>
        </div>
        <Badge tone={meta.tone} size="sm" dot={meta.tone === "warning"}>{meta.label}</Badge>
        {collapsible && I(open ? "chevron-up" : "chevron-down", { size: 16, style: { color: "var(--text-faint)" } })}
      </div>

      {open && <>
        <div style={{ display: "flex", alignItems: "flex-start", padding: isMobile ? "16px 12px 14px" : "16px 18px 14px", position: "relative" }}>
          {[0, 1, 2].map((i) => (
            <React.Fragment key={i}>
              <StepNode state={stateOf(i)} n={i + 1} label={labelOf(i)} />
              {i < 2 && <div style={{ flex: "0 0 auto", width: isMobile ? 12 : 22, height: 2, marginTop: 12, background: connDone(i) ? "var(--success)" : "var(--border-default)", alignSelf: "flex-start" }} />}
            </React.Fragment>
          ))}
        </div>

        <div style={{ padding: "0 16px 14px" }}>
          {last && last.note && (
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--text-muted)", marginBottom: allowed.length ? 12 : 0 }}>
              {I("history", { size: 13, style: { color: "var(--text-faint)" } })}
              <span>{last.note}</span><span style={{ color: "var(--text-faint)" }}>· {fmt(last.at)}</span>
            </div>
          )}
          {allowed.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", paddingTop: 12, borderTop: "1px solid var(--border-subtle)" }}>
              {allowed.includes("cancelled") && (
                <Button size="sm" variant="ghost" iconLeft={I("rotate-ccw")} onClick={() => advance.mutate({ id: req.id, next: "cancelled", note: "已撤回" })}>撤回</Button>
              )}
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>演示状态：</span>
                {allowed.filter((s: string) => s !== "cancelled").map((s: string) => (
                  <Button key={s} size="sm" variant="secondary" onClick={() => advance.mutate({ id: req.id, next: s, note: NEXT_LABEL[s].replace("模拟", "") })}>{NEXT_LABEL[s]}</Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </>}
    </div>
  );
}
