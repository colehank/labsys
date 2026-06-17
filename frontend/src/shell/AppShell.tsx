// AppShell — the persistent CIBOL chrome for the app screens.
// Claude-style: a collapsible icon rail (collapsed by default), no top bar —
// the right side is entirely content. Theme + view toggles live in the sidebar.
import React from "react";
import { Sidebar, Avatar } from "../ds";
import { I } from "../lib/icons";
import { useMyRequests, usePendingRequests, useNotifications, useFeedbackUnreadCount } from "../api/hooks";
import { useIsMobile } from "../lib/useIsMobile";

const NAV = [
  { section: "工作台" },
  { id: "home", label: "首页", icon: I("house") },
  { id: "meetings", label: "组会", icon: I("presentation") },
  { id: "server", label: "服务器", icon: I("terminal") },
  { id: "api", label: "密钥管理", icon: I("key-round") },
];

const ADMIN_NAV = [
  { section: "管理" },
  { id: "approvals", label: "审批中心", icon: I("clipboard-check") },
  { id: "meeting-hub", label: "组会中心", icon: I("presentation") },
  { id: "people-admin", label: "人员管理", icon: I("users-round") },
  { id: "server-admin", label: "服务器管理", icon: I("server-cog") },
  { id: "announce", label: "通知公告", icon: I("megaphone") },
  { id: "feedback-admin", label: "匿名意见", icon: I("message-circle") },
];

// Avatar → popout menu (通知 / 设置), opens the corresponding panel dialog.
function AvatarMenu({ collapsed, me, onOpenPanel, onLogout, unread }: any) {
  const [open, setOpen] = React.useState(false);
  const item = (icon: React.ReactNode, label: string, badge: any, handler: () => void, danger?: boolean) => (
    <button
      type="button"
      onClick={() => { handler(); setOpen(false); }}
      style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px",
        border: "none", background: "transparent", cursor: "pointer", textAlign: "left",
        fontFamily: "var(--font-sans)", fontSize: "var(--text-md)", color: "var(--text-body)", borderRadius: "var(--radius-sm)",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface-hover)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      <span style={{ display: "inline-flex", width: 18, height: 18, color: danger ? "var(--danger-text)" : "var(--text-muted)", flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, color: danger ? "var(--danger-text)" : "var(--text-body)" }}>{label}</span>
      {badge ? <span style={{ minWidth: 18, height: 18, padding: "0 5px", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--terracotta-500)", color: "#fff", fontSize: "var(--text-2xs)", fontWeight: "var(--fw-bold)", borderRadius: "var(--radius-pill)" }}>{badge}</span> : null}
    </button>
  );
  return (
    <div style={{ position: "relative", width: "100%" }}>
      {open && <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />}
      <button
        type="button"
        aria-label={`${me.name} 用户菜单`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 10, width: "100%",
          padding: collapsed ? 0 : "4px 6px", justifyContent: collapsed ? "center" : "flex-start",
          border: "none", background: open ? "var(--surface-hover)" : "transparent", cursor: "pointer", borderRadius: "var(--radius-md)",
          position: "relative",
        }}
      >
        <span style={{ position: "relative", display: "inline-flex" }}>
          <Avatar name={me.name} size="sm" presence="online" />
          {unread ? <span style={{ position: "absolute", top: -2, right: -2, width: 9, height: 9, borderRadius: "50%", background: "var(--terracotta-500)", border: "2px solid var(--surface)" }} /> : null}
        </span>
        {!collapsed && (
          <div style={{ fontSize: 13, minWidth: 0, textAlign: "left", flex: 1 }}>
            <div style={{ fontWeight: 600, color: "var(--text-strong)", whiteSpace: "nowrap" }}>{me.name}</div>
            <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{me.title}</div>
          </div>
        )}
        {!collapsed && <span style={{ display: "inline-flex", width: 16, height: 16, color: "var(--text-faint)" }}>{I("chevrons-up-down")}</span>}
      </button>
      {open && (
        <div
          style={{
            position: "absolute", bottom: "calc(100% + 8px)", left: collapsed ? 6 : 0, zIndex: 50, minWidth: 200,
            background: "var(--surface-raised)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-lg)", padding: 6,
          }}
        >
          {item(I("bell"), "消息", unread, () => onOpenPanel("inbox"))}
          {item(I("settings"), "设置", null, () => onOpenPanel("settings"))}
          <div style={{ height: 1, background: "var(--border-subtle)", margin: "5px 6px" }} />
          {item(I("log-out"), "退出登录", null, () => onLogout && onLogout(), true)}
        </div>
      )}
    </div>
  );
}

function BottomAction({ icon, label, onClick, collapsed, active }: any) {
  const [hover, setHover] = React.useState(false);
  return (
    <div style={{ position: "relative" }} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button
        type="button"
        onClick={onClick}
        title={collapsed ? label : undefined}
        style={{
          display: "flex", alignItems: "center", gap: collapsed ? 0 : 11,
          justifyContent: collapsed ? "center" : "flex-start",
          width: "100%", padding: collapsed ? "10px 0" : "9px 12px", border: "none",
          background: active ? "var(--accent-soft)" : hover ? "var(--surface-hover)" : "transparent",
          color: active ? "var(--accent-text)" : "var(--text-body)",
          borderRadius: "var(--radius-md)", cursor: "pointer",
          fontFamily: "var(--font-sans)", fontSize: "var(--text-md)", fontWeight: "var(--fw-medium)",
          transition: "background var(--dur-fast) var(--ease-out)",
        }}
      >
        <span style={{ display: "inline-flex", width: 20, height: 20, color: active ? "var(--accent)" : "var(--text-muted)", flexShrink: 0 }}>{icon}</span>
        {!collapsed && <span style={{ flex: 1, textAlign: "left" }}>{label}</span>}
      </button>
      {collapsed && hover && (
        <span
          style={{
            position: "absolute", left: "calc(100% + 12px)", top: "50%", transform: "translateY(-50%)",
            zIndex: 50, whiteSpace: "nowrap", pointerEvents: "none",
            padding: "5px 10px", background: "var(--stone-900)", color: "var(--cream)",
            fontSize: "var(--text-sm)", fontWeight: "var(--fw-medium)", borderRadius: "var(--radius-sm)", boxShadow: "var(--shadow-md)",
          }}
        >{label}</span>
      )}
    </div>
  );
}

// ── 移动端：底部 Tab 栏 + 「更多」抽屉 ──
function MobileTabBar({ active, onNavigate, admin, onOpenMore, badge }: any) {
  const tabs = [
    { id: "home", label: "首页", icon: I("house") },
    { id: "meetings", label: "组会", icon: I("presentation") },
    { id: "server", label: "服务器", icon: I("terminal") },
    { id: "api", label: "密钥", icon: I("key-round") },
  ];
  const adminViews = ["approvals", "meeting-hub", "people-admin", "server-admin", "announce", "feedback-admin"];
  const moreActive = adminViews.includes(active);
  const cell = (key: string, on: boolean, icon: React.ReactNode, label: string, onClick: () => void, dot?: boolean) => (
    <button key={key} type="button" onClick={onClick} style={{
      flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
      border: "none", background: "transparent", cursor: "pointer", padding: "6px 0", position: "relative",
      color: on ? "var(--accent)" : "var(--text-muted)",
    }}>
      <span style={{ display: "inline-flex", width: 22, height: 22, position: "relative" }}>{icon}
        {dot && <span style={{ position: "absolute", top: -3, right: -5, minWidth: 8, height: 8, borderRadius: "50%", background: "var(--terracotta-500)" }} />}
      </span>
      <span style={{ fontSize: 10.5, fontWeight: on ? 600 : 500 }}>{label}</span>
    </button>
  );
  return (
    <nav aria-label="主导航" style={{
      position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 60,
      display: "flex", alignItems: "stretch",
      background: "var(--surface)", borderTop: "1px solid var(--border-subtle)",
      paddingBottom: "env(safe-area-inset-bottom, 0px)", boxShadow: "0 -2px 12px rgba(0,0,0,0.05)",
    }}>
      {tabs.map((t) => cell(t.id, active === t.id, t.icon, t.label, () => onNavigate(t.id)))}
      {cell("more", moreActive, I("menu"), "更多", onOpenMore, badge > 0)}
    </nav>
  );
}

function MobileMoreSheet({ open, onClose, admin, onNavigate, onToggleAdmin, onOpenPanel, onLogout, me, reqCount, unread, fbUnread }: any) {
  if (!open) return null;
  const adminItems = [
    { id: "approvals", label: "审批中心", icon: I("clipboard-check"), badge: reqCount },
    { id: "meeting-hub", label: "组会中心", icon: I("presentation") },
    { id: "people-admin", label: "人员管理", icon: I("users-round") },
    { id: "server-admin", label: "服务器管理", icon: I("server-cog") },
    { id: "announce", label: "通知公告", icon: I("megaphone") },
    { id: "feedback-admin", label: "匿名意见", icon: I("message-circle"), badge: fbUnread || undefined },
  ];
  const row = (icon: React.ReactNode, label: string, onClick: () => void, badge?: any, danger?: boolean) => (
    <button type="button" onClick={() => { onClick(); onClose(); }} style={{
      display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "13px 16px", border: "none",
      background: "transparent", cursor: "pointer", textAlign: "left", fontFamily: "var(--font-sans)", fontSize: 15,
      color: danger ? "var(--danger-text)" : "var(--text-body)", borderRadius: "var(--radius-md)",
    }}>
      <span style={{ display: "inline-flex", width: 20, height: 20, color: danger ? "var(--danger-text)" : "var(--text-muted)", flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge ? <span style={{ minWidth: 18, height: 18, padding: "0 5px", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--terracotta-500)", color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: "var(--radius-pill)" }}>{badge}</span> : null}
    </button>
  );
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.35)" }} />
      <div style={{
        position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 71, maxHeight: "80vh", overflowY: "auto",
        background: "var(--surface)", borderRadius: "18px 18px 0 0", boxShadow: "var(--shadow-lg)",
        paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
      }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 6px" }}>
          <span style={{ width: 38, height: 4, borderRadius: 2, background: "var(--border-default)" }} />
        </div>
        {/* 用户 */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 16px 14px", borderBottom: "1px solid var(--border-subtle)" }}>
          <Avatar name={me.name} size="md" presence="online" />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 15, color: "var(--text-strong)" }}>{me.name}</div>
            <div style={{ fontSize: 12.5, color: "var(--text-faint)" }}>{me.title}</div>
          </div>
        </div>
        <div style={{ padding: "8px 8px" }}>
          {admin && (
            <>
              <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-faint)", padding: "8px 12px 4px" }}>管理</div>
              {adminItems.map((it) => row(it.icon, it.label, () => onNavigate(it.id), it.badge))}
              <div style={{ height: 1, background: "var(--border-subtle)", margin: "6px 12px" }} />
            </>
          )}
          {row(I("bell"), "消息", () => onOpenPanel("inbox"), unread)}
          {row(I("settings"), "设置", () => onOpenPanel("settings"))}
          {row(I(admin ? "shield-check" : "shield"), admin ? "管理员视图（点击切换为成员）" : "成员视图（点击切换为管理员）", onToggleAdmin)}
          <div style={{ height: 1, background: "var(--border-subtle)", margin: "6px 12px" }} />
          {row(I("log-out"), "退出登录", () => onLogout && onLogout(), null, true)}
        </div>
      </div>
    </>
  );
}

export function AppShell({ active, onNavigate, links, children, admin, onToggleAdmin, onOpenPanel, onLogout, me }: any) {
  // badge：管理员看「待我审批」数，成员看「我发起的进行中」数（均来自真后端）
  const { data: mineReqs = [] } = useMyRequests();
  const { data: pendingReqs = [] } = usePendingRequests(admin);
  const reqCount = admin
    ? (pendingReqs as any[]).length
    : (mineReqs as any[]).filter((r) => ["pending", "submitted"].includes(r.status)).length;
  // 未读通知 = 真实站内通知未读数 + 需我确认的对调请求（与「消息·通知」tab 一致）
  const { data: notifFeed = [] } = useNotifications();
  const incomingSwaps = (mineReqs as any[]).filter((r) => r.incoming && r.kind === "swap" && r.status === "pending").length;
  const unreadNotif = (notifFeed as any[]).filter((n) => !n.read).length + incomingSwaps;
  const badgeCount = unreadNotif;
  const [collapsed, setCollapsed] = React.useState(true);
  const isMobile = useIsMobile();
  const [moreOpen, setMoreOpen] = React.useState(false);

  const { data: feedbackUnread } = useFeedbackUnreadCount(admin);
  const fbCount: number = (feedbackUnread as any)?.count ?? 0;

  // 桌面侧栏审批项徽标用真实待审批数（与移动端一致），不再写死。
  const nav = admin
    ? [...NAV, ...ADMIN_NAV.map((it) => {
        if (it.id === "approvals") return { ...it, badge: reqCount || undefined };
        if (it.id === "feedback-admin") return { ...it, badge: fbCount || undefined };
        return it;
      })]
    : NAV;

  // ── 移动端布局：内容全宽 + 底部 Tab 栏 ──
  if (isMobile) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--canvas)" }}>
        <main style={{ minHeight: "100vh", paddingBottom: "calc(64px + env(safe-area-inset-bottom, 0px))" }}>{children}</main>
        <MobileTabBar active={active} onNavigate={onNavigate} admin={admin} badge={badgeCount} onOpenMore={() => setMoreOpen(true)} />
        <MobileMoreSheet
          open={moreOpen} onClose={() => setMoreOpen(false)} admin={admin}
          onNavigate={onNavigate} onToggleAdmin={onToggleAdmin} onOpenPanel={onOpenPanel} onLogout={onLogout}
          me={me} reqCount={reqCount} unread={badgeCount} fbUnread={fbCount}
        />
      </div>
    );
  }

  const bottomActions = (
    <>
      <BottomAction icon={I(admin ? "shield-check" : "shield")} label={admin ? "管理员视图" : "成员视图"} collapsed={collapsed} active={admin} onClick={onToggleAdmin} />
    </>
  );

  const footer = <AvatarMenu collapsed={collapsed} me={me} onOpenPanel={onOpenPanel} onLogout={onLogout} unread={badgeCount} />;

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--canvas)" }}>
      <Sidebar
        items={nav}
        active={active}
        onSelect={onNavigate}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        logoSrc={links.mark}
        bottomActions={bottomActions}
        footer={footer}
      />
      <main style={{ flex: 1, overflowY: "auto", minWidth: 0 }}>{children}</main>
    </div>
  );
}
