import React from "react";

/**
 * CIBOL Tabs — underline tab bar. tabs: { id, label, badge }.
 */
export function Tabs({
  tabs = [],
  active,
  onChange,
  style = {},
}: any) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 4,
      borderBottom: "var(--border-w) solid var(--border-subtle)", ...style,
    }}>
      {tabs.map((t) => {
        const on = t.id === active;
        return <TabItem key={t.id} tab={t} active={on} onClick={() => onChange && onChange(t.id)} />;
      })}
    </div>
  );
}

function TabItem({ tab, active, onClick }: any) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative", display: "inline-flex", alignItems: "center", gap: 7,
        padding: "10px 14px 12px", border: "none", background: "none", cursor: "pointer",
        fontFamily: "var(--font-sans)", fontSize: "var(--text-md)",
        fontWeight: active ? "var(--fw-semibold)" : "var(--fw-medium)",
        color: active ? "var(--text-strong)" : hover ? "var(--text-body)" : "var(--text-muted)",
        transition: "color var(--dur-fast) var(--ease-out)",
      }}
    >
      {tab.label}
      {tab.badge != null && (
        <span style={{
          minWidth: 17, height: 17, padding: "0 5px", display: "inline-flex", alignItems: "center", justifyContent: "center",
          background: active ? "var(--accent-soft)" : "var(--surface-sunken)",
          color: active ? "var(--accent-text)" : "var(--text-muted)",
          fontSize: "var(--text-2xs)", fontWeight: "var(--fw-bold)", borderRadius: "var(--radius-pill)",
        }}>{tab.badge}</span>
      )}
      <span style={{
        position: "absolute", left: 8, right: 8, bottom: -1, height: 2,
        background: active ? "var(--accent)" : "transparent", borderRadius: "2px 2px 0 0",
        transition: "background var(--dur-fast) var(--ease-out)",
      }} />
    </button>
  );
}
