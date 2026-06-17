import React from "react";
import { AppShell } from "./shell/AppShell";
import { useFeel, useTweaks, TWEAK_DEFAULTS } from "./feel";
import { useMe, useLogout, isAdmin } from "./auth";

import { Login } from "./screens/Login";
import { Home } from "./screens/Home";
import { Meetings } from "./screens/Meetings";
import { Server } from "./screens/Server";
import { API } from "./screens/API";
import { My } from "./screens/My";
import { Inbox } from "./screens/Inbox";
import { Approvals } from "./screens/Approvals";
import { AdminMeetingHub } from "./screens/AdminMeetingHub";
import { AdminServers } from "./screens/AdminServers";
import { AdminAnnounce } from "./screens/AdminAnnounce";
import { AdminPeople } from "./screens/AdminPeople";
import { AdminFeedback } from "./screens/AdminFeedback";

const LINKS = { mark: "/assets/mark-stone.svg" };

export function App() {
  const [t] = useTweaks(TWEAK_DEFAULTS);
  const { data: me, isLoading: meLoading } = useMe();
  const logout = useLogout();
  const [view, setView] = React.useState("home");
  const [admin, setAdmin] = React.useState(false);
  const [mtTab, setMtTab] = React.useState("schedule");
  const [mtNonce, setMtNonce] = React.useState(0);
  const [panel, setPanel] = React.useState<null | "inbox" | "settings">(null);

  const navigate = (v: string, opts?: { tab?: string }) => {
    if (v === "meetings") { setMtTab(opts && opts.tab ? opts.tab : "schedule"); setMtNonce((n) => n + 1); }
    setPanel(null);
    setView(v);
  };
  const panelNavigate = (v: string, opts?: { tab?: string }) => { setPanel(null); navigate(v, opts); };

  const toggleAdmin = () => {
    if (!isAdmin(me)) return; // 仅真实管理员可切换管理员视图
    setAdmin((a) => !a);
    if (admin && ["approvals", "meeting-hub", "server-admin", "announce", "people-admin", "feedback-admin"].includes(view)) setView("home");
  };

  useFeel(t);

  // 有 token 但仍在拉取当前用户：短暂留白，避免闪现登录页。
  if (meLoading) return null;

  if (!me) {
    return <Login mark="/assets/mark-stone.svg" />;
  }

  const screen = (() => {
    switch (view) {
      case "home": return <Home onNavigate={navigate} me={me} />;
      case "meetings": return <Meetings key={mtNonce} initialTab={mtTab} admin={admin} me={me} />;
      case "server": return <Server />;
      case "api": return <API />;
      case "approvals": return isAdmin(me) ? <Approvals /> : <Home onNavigate={navigate} me={me} />;
      case "meeting-hub": return isAdmin(me) ? <AdminMeetingHub /> : <Home onNavigate={navigate} me={me} />;
      case "server-admin": return isAdmin(me) ? <AdminServers /> : <Home onNavigate={navigate} me={me} />;
      case "announce": return isAdmin(me) ? <AdminAnnounce /> : <Home onNavigate={navigate} me={me} />;
      case "people-admin": return isAdmin(me) ? <AdminPeople /> : <Home onNavigate={navigate} me={me} />;
      case "feedback-admin": return isAdmin(me) ? <AdminFeedback /> : <Home onNavigate={navigate} me={me} />;
      default: return <Home onNavigate={navigate} me={me} />;
    }
  })();

  React.useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPanel(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [panel]);

  const panelTitle = panel === "inbox" ? "消息" : "设置";
  return (
    <>
      <AppShell active={view} onNavigate={navigate} admin={admin} onToggleAdmin={toggleAdmin} onOpenPanel={setPanel} onLogout={() => { setPanel(null); setView("home"); setAdmin(false); logout(); }} links={LINKS} me={me}>
        {screen}
        {panel && (
          <div onClick={() => setPanel(null)}
            style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "5vh 24px", background: "var(--overlay-scrim)", backdropFilter: "blur(2px)" }}>
            <div onClick={(e) => e.stopPropagation()}
              style={{ width: "100%", maxWidth: panel === "settings" ? 980 : 800, maxHeight: "90vh", display: "flex", flexDirection: "column", background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-xl)", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0 }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-strong)", whiteSpace: "nowrap" }}>{panelTitle}</span>
                <button onClick={() => setPanel(null)} aria-label="关闭" style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)", display: "inline-flex", padding: 4, borderRadius: "var(--radius-sm)" }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
              <div style={{ overflowY: "auto", flex: 1 }}>
                {panel === "inbox" ? <Inbox onNavigate={panelNavigate} embedded me={me} /> : <My onNavigate={panelNavigate} embedded me={me} />}
              </div>
            </div>
          </div>
        )}
      </AppShell>
    </>
  );
}
