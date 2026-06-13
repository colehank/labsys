import React from "react";

/**
 * CIBOL Badge — small status / category label with optional leading dot.
 * Tones map to the warm status palette.
 */
export function Badge({
  children,
  tone = "neutral",
  variant = "soft",
  dot = false,
  size = "md",
  style = {},
}: any) {
  const tones = {
    neutral:    { soft: "var(--surface-sunken)", softFg: "var(--text-muted)", solid: "var(--stone-600)", dot: "var(--stone-400)" },
    accent:     { soft: "var(--accent-soft)", softFg: "var(--accent-text)", solid: "var(--accent)", dot: "var(--accent)" },
    success:    { soft: "var(--success-soft)", softFg: "var(--success-text)", solid: "var(--success)", dot: "var(--success)" },
    warning:    { soft: "var(--warning-soft)", softFg: "var(--warning-text)", solid: "var(--warning)", dot: "var(--warning)" },
    danger:     { soft: "var(--danger-soft)", softFg: "var(--danger-text)", solid: "var(--danger)", dot: "var(--danger)" },
    info:       { soft: "var(--info-soft)", softFg: "var(--info-text)", solid: "var(--info)", dot: "var(--info)" },
  };
  const t = tones[tone] || tones.neutral;
  const sizes = { sm: { h: 18, px: 7, fs: "var(--text-2xs)" }, md: { h: 22, px: 9, fs: "var(--text-xs)" } };
  const s = sizes[size] || sizes.md;

  const isSolid = variant === "solid";
  const isOutline = variant === "outline";

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, height: s.h,
      padding: `0 ${s.px}px`,
      background: isSolid ? t.solid : isOutline ? "transparent" : t.soft,
      color: isSolid ? "#fff" : t.softFg,
      border: isOutline ? `1px solid ${t.dot}` : "1px solid transparent",
      borderRadius: "var(--radius-pill)",
      fontFamily: "var(--font-sans)", fontSize: s.fs, fontWeight: "var(--fw-semibold)",
      letterSpacing: "var(--ls-tight)", lineHeight: 1, whiteSpace: "nowrap",
      ...style,
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: isSolid ? "#fff" : t.dot, flexShrink: 0 }} />}
      {children}
    </span>
  );
}
