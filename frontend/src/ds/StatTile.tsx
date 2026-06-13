import React from "react";

/**
 * CIBOL StatTile — a single metric: label, big serif numeral, optional
 * delta and sublabel. Used across dashboard / API / rank.
 */
export function StatTile({
  label,
  value,
  unit,
  delta = null, // { dir: "up"|"down", text: "..." }
  sublabel,
  icon = null,
  accent = false,
  style = {},
}: any) {
  const deltaColor = delta?.dir === "up" ? "var(--success-text)" : delta?.dir === "down" ? "var(--danger-text)" : "var(--text-faint)";
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 8, padding: "var(--space-6)",
      background: accent ? "var(--accent-soft)" : "var(--surface)",
      border: `var(--border-w) solid ${accent ? "var(--accent-soft-bd)" : "var(--border-subtle)"}`,
      borderRadius: "var(--radius-lg)", minWidth: 0, ...style,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{
          fontSize: "var(--text-xs)", fontWeight: "var(--fw-semibold)",
          letterSpacing: "var(--ls-wide)", textTransform: "uppercase",
          color: "var(--text-faint)", whiteSpace: "nowrap", lineHeight: 1.3,
        }}>{label}</span>
        {icon && <span style={{ display: "inline-flex", width: 16, height: 16, flexShrink: 0, color: accent ? "var(--accent-text)" : "var(--text-faint)" }}>{icon}</span>}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "nowrap", lineHeight: 1.1, marginTop: 2 }}>
        <span style={{
          fontFamily: "var(--font-serif)", fontVariantNumeric: "tabular-nums lining-nums",
          fontSize: "var(--text-4xl)", fontWeight: "var(--fw-semibold)",
          lineHeight: 1.1, letterSpacing: "var(--ls-tight)", whiteSpace: "nowrap",
          color: accent ? "var(--accent-text)" : "var(--text-strong)",
        }}>{value}</span>
        {unit && <span style={{ fontSize: "var(--text-base)", color: "var(--text-muted)", fontWeight: "var(--fw-medium)", whiteSpace: "nowrap" }}>{unit}</span>}
      </div>
      {(delta || sublabel) && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--text-xs)", whiteSpace: "nowrap" }}>
          {delta && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: deltaColor, fontWeight: "var(--fw-semibold)" }}>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                {delta.dir === "down" ? <polyline points="6 9 12 15 18 9" /> : <polyline points="18 15 12 9 6 15" />}
              </svg>
              {delta.text}
            </span>
          )}
          {sublabel && <span style={{ color: "var(--text-faint)" }}>{sublabel}</span>}
        </div>
      )}
    </div>
  );
}
