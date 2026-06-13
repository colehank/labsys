// AppShell — the persistent CIBOL chrome for the app screens.
// Claude-style: a collapsible icon rail (collapsed by default), no top bar —
// the right side is entirely content. Theme + view toggles live in the sidebar.
import React from "react";
import { Sidebar, Avatar } from "../ds";
import { I } from "../lib/icons";
import { STORE } from "../store";
import { DATA } from "../data";

const NAV = [
  { section: "工作台" },
  { id: "home", label: "首页", icon: I("house") },
  { id: "meetings", label: "组会", icon: I("presentation") },
  { id: "server", label: "服务器", icon: I("terminal") },
  { id: "api", label: "密钥管理", icon: I("key-round") },
];

const ADMIN_NAV = [
  { section: "管理" },
  { id: "approvals", label: "审批中心", icon: I("clipboard-check"), badge: 3 },
  { id: "meeting-hub", label: "组会中心", icon: I("presentation") },
  { id: "people-admin", label: "人员管理", icon: I("users-round") },
  { id: "server-admin", label: "服务器管理", icon: I("server-cog") },
  { id: "announce", label: "通知公告", icon: I("megaphone") },
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

export function AppShell({ active, onNavigate, links, children, admin, onToggleAdmin, onOpenPanel, onLogout, me }: any) {
  const data = DATA;
  STORE.use(); // re-render when requests change so the badge stays current
  const reqCount = (STORE.myRequests() || []).filter((r: any) => ["pending", "submitted"].includes(r.status)).length;
  const unreadNotif = 2; // 未读通知（演示）
  const badgeCount = reqCount + unreadNotif;
  const [collapsed, setCollapsed] = React.useState(true);
  const [dark, setDark] = React.useState(() => document.documentElement.getAttribute("data-theme") === "dark");
  React.useEffect(() => { document.documentElement.setAttribute("data-theme", dark ? "dark" : "light"); }, [dark]);

  const nav = admin ? [...NAV, ...ADMIN_NAV] : NAV;

  const bottomActions = (
    <>
      <BottomAction icon={I(dark ? "moon" : "sun")} label={dark ? "深色模式" : "浅色模式"} collapsed={collapsed} onClick={() => setDark((v) => !v)} />
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
