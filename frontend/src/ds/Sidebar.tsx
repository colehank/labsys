import React from "react";

/**
 * CIBOL Sidebar — the app's left rail. Collapsible to an icon-only rail
 * (Claude-style): a top toggle expands/collapses; collapsed items show a
 * hover tooltip. Brand lockup + nav items with the terracotta active indicator.
 * Items: { id, label, icon, badge } or { section }.
 */
export function Sidebar({
  items = [],
  active,
  onSelect,
  footer = null,
  bottomActions = null,
  collapsed = false,
  onToggleCollapse,
  logoSrc = "assets/mark-stone.svg",
  brand = "CIBOL",
  brandSub = "实验室系统",
  style = {},
}: any) {
  return (
    <nav style={{
      width: collapsed ? "var(--sidebar-w-collapsed)" : "var(--sidebar-w)",
      flexShrink: 0, height: "100%",
      display: "flex", flexDirection: "column",
      background: "var(--surface)", borderRight: "var(--border-w) solid var(--border-subtle)",
      transition: "width var(--dur-base) var(--ease-out)",
      ...style,
    }}>
      {/* top: toggle + brand */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: collapsed ? "14px 0 4px" : "14px 14px 4px",
        justifyContent: collapsed ? "center" : "flex-start",
      }}>
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "展开侧栏" : "收起侧栏"}
            title={collapsed ? "展开侧栏" : "收起侧栏"}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 36, height: 36, flexShrink: 0, padding: 0,
              border: "none", background: "transparent", color: "var(--text-muted)",
              borderRadius: "var(--radius-md)", cursor: "pointer",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-hover)"; e.currentTarget.style.color = "var(--text-body)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; }}
          >
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2" /><line x1="9" y1="4" x2="9" y2="20" />
            </svg>
          </button>
        )}
        {!collapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <span className="cibol-brand-tile" style={{
              width: 32, height: 32, borderRadius: "var(--radius-md)",
            }}>
              <img className="cibol-mark-cream" src={logoSrc.replace("stone", "cream")} alt="" style={{ width: 21, height: 21 }} />
              <img className="cibol-mark-stone" src={logoSrc.replace("cream", "stone")} alt="" style={{ width: 21, height: 21 }} />
            </span>
            <div style={{ lineHeight: 1.2, minWidth: 0 }}>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: "var(--text-base)", fontWeight: "var(--fw-semibold)", color: "var(--text-strong)", letterSpacing: "0.04em" }}>{brand}</div>
              <div style={{ fontSize: "var(--text-2xs)", color: "var(--text-faint)", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>{brandSub}</div>
            </div>
          </div>
        )}
      </div>

      <div style={{ height: 4 }} />

      {/* items */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "visible", padding: collapsed ? "0 10px" : "0 12px", display: "flex", flexDirection: "column", gap: 2 }}>
        {items.map((it, i) => {
          if (it.section) {
            const firstSection = i === 0;
            return collapsed
              ? <div key={it.section} style={{ height: firstSection ? 6 : 14 }} />
              : <div key={it.section} style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--fw-semibold)", letterSpacing: "var(--ls-widest)", textTransform: "uppercase", color: "var(--text-faint)", padding: firstSection ? "4px 12px 6px" : "16px 12px 6px" }}>{it.section}</div>;
          }
          const on = it.id === active;
          return <SideItem key={it.id} item={it} active={on} collapsed={collapsed} onClick={() => onSelect && onSelect(it.id)} />;
        })}
      </div>

      {bottomActions && (
        <div style={{ padding: collapsed ? "8px 10px" : "8px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
          {bottomActions}
        </div>
      )}
      {footer && <div style={{ padding: collapsed ? "6px 8px 12px" : "6px 12px 12px", display: "flex", justifyContent: collapsed ? "center" : "flex-start" }}>{footer}</div>}
    </nav>
  );
}

function SideItem({ item, active, collapsed, onClick }: any) {
  const [hover, setHover] = React.useState(false);
  return (
    <div style={{ position: "relative" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}>
      <button
        type="button"
        onClick={onClick}
        title={collapsed ? item.label : undefined}
        style={{
          position: "relative", display: "flex", alignItems: "center",
          gap: collapsed ? 0 : 11, justifyContent: collapsed ? "center" : "flex-start",
          width: "100%", padding: collapsed ? "10px 0" : "9px 12px", border: "none", textAlign: "left",
          background: active ? "var(--accent-soft)" : hover ? "var(--surface-hover)" : "transparent",
          color: active ? "var(--accent-text)" : "var(--text-body)",
          borderRadius: "var(--radius-md)", cursor: "pointer",
          fontFamily: "var(--font-sans)", fontSize: "var(--text-md)",
          fontWeight: active ? "var(--fw-semibold)" : "var(--fw-medium)",
          transition: "background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)",
        }}
      >
        {active && !collapsed && <span style={{ position: "absolute", left: -12, top: "50%", transform: "translateY(-50%)", width: 3, height: 18, background: "var(--accent)", borderRadius: "0 3px 3px 0" }} />}
        <span style={{ position: "relative", display: "inline-flex", width: 20, height: 20, color: active ? "var(--accent)" : "var(--text-muted)", flexShrink: 0 }}>
          {item.icon}
          {collapsed && item.badge != null && (
            <span style={{ position: "absolute", top: -5, right: -6, minWidth: 14, height: 14, padding: "0 3px", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--terracotta-500)", color: "#fff", fontSize: 9, fontWeight: "var(--fw-bold)", borderRadius: "var(--radius-pill)", lineHeight: 1 }}>{item.badge}</span>
          )}
        </span>
        {!collapsed && <span style={{ flex: 1 }}>{item.label}</span>}
        {!collapsed && item.badge != null && (
          <span style={{
            minWidth: 18, height: 18, padding: "0 5px", display: "inline-flex", alignItems: "center", justifyContent: "center",
            background: active ? "var(--accent)" : "var(--terracotta-500)", color: "#fff",
            fontSize: "var(--text-2xs)", fontWeight: "var(--fw-bold)", borderRadius: "var(--radius-pill)",
          }}>{item.badge}</span>
        )}
      </button>

      {/* collapsed hover tooltip */}
      {collapsed && hover && (
        <span style={{
          position: "absolute", left: "calc(100% + 12px)", top: "50%", transform: "translateY(-50%)",
          zIndex: 50, whiteSpace: "nowrap", pointerEvents: "none",
          padding: "5px 10px", background: "var(--stone-900)", color: "var(--cream)",
          fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", fontWeight: "var(--fw-medium)",
          borderRadius: "var(--radius-sm)", boxShadow: "var(--shadow-md)",
        }}>{item.label}</span>
      )}
    </div>
  );
}
