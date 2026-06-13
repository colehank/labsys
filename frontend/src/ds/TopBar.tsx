import React from "react";

/**
 * CIBOL TopBar — page header: title/breadcrumb on the left, actions on the right.
 */
export function TopBar({
  title,
  breadcrumb = [],
  actions = null,
  style = {},
}: any) {
  return (
    <header style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
      height: "var(--topbar-h)", padding: "0 24px", flexShrink: 0,
      background: "var(--surface)", borderBottom: "var(--border-w) solid var(--border-subtle)",
      ...style,
    }}>
      <div style={{ minWidth: 0 }}>
        {breadcrumb.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--text-xs)", color: "var(--text-faint)", marginBottom: 1 }}>
            {breadcrumb.map((b, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span style={{ opacity: 0.6 }}>/</span>}
                <span style={{ color: i === breadcrumb.length - 1 ? "var(--text-muted)" : "var(--text-faint)" }}>{b}</span>
              </React.Fragment>
            ))}
          </div>
        )}
        <h1 style={{ fontSize: "var(--text-xl)", fontWeight: "var(--fw-semibold)", color: "var(--text-strong)", margin: 0, letterSpacing: "var(--ls-tight)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</h1>
      </div>
      {actions && <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>{actions}</div>}
    </header>
  );
}
