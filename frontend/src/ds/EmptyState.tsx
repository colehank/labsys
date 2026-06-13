import React from "react";

/**
 * CIBOL EmptyState — friendly empty/first-run state: muted node mark,
 * one reassuring line, one clear action.
 */
export function EmptyState({
  icon = null,
  title,
  description,
  action = null,
  compact = false,
  style = {},
}: any) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      textAlign: "center", padding: compact ? "var(--space-8)" : "var(--space-11) var(--space-8)",
      gap: 6, ...style,
    }}>
      <span style={{
        width: compact ? 44 : 56, height: compact ? 44 : 56, marginBottom: 8,
        borderRadius: "var(--radius-lg)", background: "var(--surface-sunken)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        color: "var(--text-faint)",
      }}>
        <span style={{ width: compact ? 22 : 26, height: compact ? 22 : 26, display: "inline-flex" }}>
          {icon || (
            <svg viewBox="0 0 72 72" width="100%" height="100%">
              <path d="M 58,10 A 28,28 0 1,0 58,62" fill="none" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" />
              <circle cx="58" cy="10" r="4.5" fill="currentColor" />
              <circle cx="58" cy="62" r="4.5" fill="currentColor" />
            </svg>
          )}
        </span>
      </span>
      {title && <div style={{ fontSize: "var(--text-base)", fontWeight: "var(--fw-semibold)", color: "var(--text-strong)" }}>{title}</div>}
      {description && <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", maxWidth: 340, margin: 0, lineHeight: "var(--lh-normal)" }}>{description}</p>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}
