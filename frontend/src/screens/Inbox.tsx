import React from "react";
import * as NS from "../ds";
import { I, Icon } from "../lib/icons";
import { toast } from "../store";
import { useMyRequests, useAdvanceRequest, useNotifications, useMarkAllRead, useMarkRead } from "../api/hooks";
import { RequestTracker } from "./RequestTracker";
import { useIsMobile } from "../lib/useIsMobile";

// Inbox — 消息: 个人消息中心。两类内容，互不重复：
//   · 通知 — 与你相关、需知晓或处理的提醒（他人发起的对调、评分窗口、组会安排等）。
//   · 申请 — 你自己发起的事项及其状态（对调 / 轮空 / API 密钥 / 服务器账号），默认折叠，点击展开。
// 申请「结果」只在「申请」标签里以状态卡片体现，不再重复进通知，避免内容重叠。
  const { Card, Button, Badge, Tabs, EmptyState } = NS;

  const ACTIVE = ["pending", "submitted"];

  // 通知图标/配色按 type 映射。type 与后端 Notification.type 对齐（approval/info/…），
  // 外加前端合成的 swap_in（来自实时对调请求）。
  const N_META = {
    swap_in:  { icon: "repeat", tone: "accent" },
    approval: { icon: "clipboard-check", tone: "success" },
    rating:   { icon: "star", tone: "warning" },
    meeting:  { icon: "calendar-clock", tone: "accent" },
    info:     { icon: "info", tone: "accent" },
  };

  // created_at → 相对时间（刚刚 / X 分钟前 / X 小时前 / X 天前 / 月日）。
  function relTime(iso) {
    if (!iso) return "";
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return "";
    const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
    if (s < 60) return "刚刚";
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} 分钟前`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} 小时前`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d} 天前`;
    const dt = new Date(iso);
    return `${dt.getMonth() + 1} 月 ${dt.getDate()} 日`;
  }

  function NotifItem({ n, onNavigate, advance, markRead }: any) {
    const meta = N_META[n.type] || N_META.info;
    const map = { "去评分": () => onNavigate("meetings", { tab: "rating" }) };
    // 真实站内通知（带 dbId）：未读时点击整条标记已读。对调请求用按钮处理，不在此处标记。
    const clickRead = n.dbId && n.unread ? () => markRead && markRead.mutate(n.dbId) : undefined;
    return (
      <div onClick={clickRead} style={{ display: "flex", gap: 13, alignItems: "flex-start", padding: "15px 18px", borderBottom: "1px solid var(--border-subtle)", background: n.unread ? "var(--accent-soft)" : "transparent", position: "relative", cursor: clickRead ? "pointer" : "default" }}>
        {n.unread && <span style={{ position: "absolute", left: 7, top: 21, width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }}></span>}
        <span style={{ width: 36, height: 36, flexShrink: 0, borderRadius: "var(--radius-md)", background: `var(--${meta.tone}-soft)`, color: `var(--${meta.tone}-text)`, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name={meta.icon} style={{ width: 17, height: 17 }} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>{n.title}</span>
            <span style={{ fontSize: 12, color: "var(--text-faint)" }}>· {n.time}</span>
          </div>
          <p style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.5 }}>{n.body}</p>
          {n.req ? (
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <Button size="sm" variant="primary" disabled={advance.isPending}
                onClick={() => advance.mutate(
                  { id: n.req.id, next: "accepted", note: `已接受 ${n.req.from} 的对调` },
                  { onSuccess: () => toast("已接受对调"), onError: (e: any) => toast(e?.error?.detail || e?.detail || e?.message || "操作失败，请重试") })}>接受</Button>
              <Button size="sm" variant="ghost" disabled={advance.isPending}
                onClick={() => advance.mutate(
                  { id: n.req.id, next: "declined", note: `已拒绝 ${n.req.from} 的对调` },
                  { onSuccess: () => toast("已拒绝对调"), onError: (e: any) => toast(e?.error?.detail || e?.detail || e?.message || "操作失败，请重试") })}>拒绝</Button>
            </div>
          ) : n.actions.length > 0 && (
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              {n.actions.map((a, i) => (
                <Button key={a} size="sm" variant={i === 0 ? "primary" : "ghost"} onClick={() => (map[a] ? map[a]() : null)}>{a}</Button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  function ReqGroup({ label, items, tone }: any) {
    const Tracker = RequestTracker;
    if (!items.length) return null;
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 2px 11px" }}>
          <span className="cibol-eyebrow">{label}</span>
          <span style={{ minWidth: 18, height: 18, padding: "0 6px", display: "inline-flex", alignItems: "center", justifyContent: "center", background: tone === "active" ? "var(--warning-soft)" : "var(--surface-sunken)", color: tone === "active" ? "var(--warning-text)" : "var(--text-muted)", fontSize: 11, fontWeight: 700, borderRadius: "var(--radius-pill)" }}>{items.length}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((r) => <Tracker key={r.id} req={r} collapsible />)}
        </div>
      </div>
    );
  }

  function Inbox({ onNavigate, embedded, me }: any) {
    const isMobile = useIsMobile();
    const [tab, setTab] = React.useState("notif");
    const advance = useAdvanceRequest();
    const allRequests = useMyRequests().data ?? [];
    const { data: feed = [] } = useNotifications();
    const markAll = useMarkAllRead();
    const markRead = useMarkRead();

    // ① 实时对调请求 —— 需你确认，带接受/拒绝按钮（来自 requests，可操作）。
    const incoming = allRequests.filter((r) => r.incoming && r.kind === "swap" && r.status === "pending");
    const incomingNotifs = incoming.map((q) => ({
      id: q.id, type: "swap_in", unread: true, req: q,
      title: `${q.from}想和你对调报告`,
      body: `${q.fromDate} ⇄ ${q.toDate} · ${q.reason || "需要你确认。"}`,
      time: "刚刚", actions: [],
    }));
    // ② 真实站内通知 —— 审批结果、组会提醒等（来自 /api/notifications）。
    const feedNotifs = (feed as any[]).map((f) => ({
      id: "notif-" + f.id, dbId: f.id, type: f.type, unread: !f.read,
      title: f.title, body: f.body, time: relTime(f.created_at), actions: [],
    }));
    const notifs = [...incomingNotifs, ...feedNotifs];
    const unread = notifs.filter((n) => n.unread).length;
    const hasUnreadFeed = feedNotifs.some((n) => n.unread);
    const reqs = allRequests.filter((r) => !r.incoming);
    const active = reqs.filter((r) => ACTIVE.includes(r.status));
    const closed = reqs.filter((r) => !ACTIVE.includes(r.status));

    return (
      <div style={{ maxWidth: embedded ? "none" : 760, margin: embedded ? 0 : "0 auto", padding: embedded ? (isMobile ? "14px 14px 20px" : "16px 22px 26px") : (isMobile ? "16px 14px 32px" : "22px 32px 48px") }}>
        {!embedded && <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-strong)", marginBottom: 4 }}>消息</h2>}
        <Tabs active={tab} onChange={setTab} style={{ marginBottom: 16 }}
          tabs={[
            { id: "notif", label: "通知", badge: unread || undefined },
            { id: "req", label: "申请", badge: active.length || undefined },
          ]} />

        {tab === "notif" ? (
          <Card padding="none">
            {hasUnreadFeed && (
              <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 14px", borderBottom: "1px solid var(--border-subtle)" }}>
                <Button size="sm" variant="ghost" loading={markAll.isPending} onClick={() => markAll.mutate(undefined as void)}>全部已读</Button>
              </div>
            )}
            {notifs.length ? notifs.map((n) => <NotifItem key={n.id} n={n} onNavigate={onNavigate} advance={advance} markRead={markRead} />)
              : <EmptyState compact title="没有新通知" description="与你相关的提醒会出现在这里。" />}
          </Card>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {reqs.length ? (
              <>
                <ReqGroup label="进行中" items={active} tone="active" />
                <ReqGroup label="已结束" items={closed} tone="neutral" />
              </>
            ) : (
              <EmptyState compact title="暂无申请" description="发起对调、请假或资源申请后，进度会显示在这里。" />
            )}
          </div>
        )}
      </div>
    );
  }

  export { Inbox };
