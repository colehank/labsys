import React from "react";

/**
 * CIBOL Toast — inline notification banner. Use standalone or stacked.
 * tone maps to the status palette; auto icon per tone.
 */
export function Toast({
  tone = "neutral",
  title,
  children,
  onClose,
  style = {},
}: any) {
  const map = {
    neutral: { bd: "var(--border-default)", bg: "var(--surface-raised)", fg: "var(--text-muted)", icon: "info" },
    success: { bd: "var(--success)", bg: "var(--success-soft)", fg: "var(--success-text)", icon: "check-circle-2" },
    warning: { bd: "var(--warning)", bg: "var(--warning-soft)", fg: "var(--warning-text)", icon: "alert-triangle" },
    danger:  { bd: "var(--danger)", bg: "var(--danger-soft)", fg: "var(--danger-text)", icon: "alert-circle" },
    accent:  { bd: "var(--accent)", bg: "var(--accent-soft)", fg: "var(--accent-text)", icon: "bell" },
  };
  const t = map[tone] || map.neutral;
  const glyphs = {
    "check-circle-2": <><circle cx="12" cy="12" r="9"/><path d="m9 12 2 2 4-4"/></>,
    "alert-triangle": <><path d="m10.3 3.6-8 14A1.5 1.5 0 0 0 3.6 20h16.8a1.5 1.5 0 0 0 1.3-2.4l-8-14a1.5 1.5 0 0 0-2.6 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
    "alert-circle": <><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>,
    "bell": <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></>,
    "info": <><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><line x1="12" y1="8" x2="12.01" y2="8"/></>,
  };

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 11, width: "100%", maxWidth: 380,
      padding: "12px 14px", background: t.bg,
      border: `var(--border-w) solid ${t.bd}`, borderRadius: "var(--radius-md)",
      boxShadow: "var(--shadow-md)", ...style,
    }}>
      <span style={{ display: "inline-flex", width: 18, height: 18, color: t.fg, flexShrink: 0, marginTop: 1 }}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{glyphs[t.icon]}</svg>
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <div style={{ fontSize: "var(--text-md)", fontWeight: "var(--fw-semibold)", color: "var(--text-strong)", marginBottom: children ? 2 : 0 }}>{title}</div>}
        {children && <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", lineHeight: "var(--lh-normal)" }}>{children}</div>}
      </div>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="关闭" style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-faint)", padding: 2, display: "inline-flex", flexShrink: 0 }}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
        </button>
      )}
    </div>
  );
}
