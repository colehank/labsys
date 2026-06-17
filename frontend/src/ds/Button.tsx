import React from "react";

/**
 * CIBOL Button — the primary action primitive.
 * Variants: primary (terracotta) · secondary (bordered) · ghost · danger · subtle
 */
export function Button({
  children,
  variant = "primary",
  size = "md",
  iconLeft = null,
  iconRight = null,
  fullWidth = false,
  disabled = false,
  loading = false,
  type = "button",
  onClick,
  style = {},
  ...rest
}: any) {
  const [hover, setHover] = React.useState(false);
  const [active, setActive] = React.useState(false);

  const sizes = {
    sm: { h: 30, px: 12, fs: "var(--text-sm)", gap: 6, icon: 15 },
    md: { h: 38, px: 16, fs: "var(--text-md)", gap: 7, icon: 17 },
    lg: { h: 46, px: 22, fs: "var(--text-base)", gap: 8, icon: 19 },
  };
  const s = sizes[size] || sizes.md;

  const palettes = {
    primary: {
      bg: "var(--accent)", bgH: "var(--accent-hover)", bgA: "var(--accent-press)",
      fg: "var(--text-on-accent)", bd: "transparent", sh: "var(--shadow-xs)",
    },
    danger: {
      bg: "var(--danger)", bgH: "var(--clay-400)", bgA: "var(--clay-500)",
      fg: "#fff", bd: "transparent", sh: "var(--shadow-xs)",
    },
    secondary: {
      bg: "var(--surface)", bgH: "var(--surface-hover)", bgA: "var(--surface-sunken)",
      fg: "var(--text-strong)", bd: "var(--border-default)", sh: "var(--shadow-xs)",
    },
    subtle: {
      bg: "var(--surface-sunken)", bgH: "var(--surface-hover)", bgA: "var(--border-subtle)",
      fg: "var(--text-body)", bd: "transparent", sh: "none",
    },
    ghost: {
      bg: "transparent", bgH: "var(--surface-hover)", bgA: "var(--surface-sunken)",
      fg: "var(--text-body)", bd: "transparent", sh: "none",
    },
  };
  const p = palettes[variant] || palettes.primary;

  const bg = disabled ? p.bg : active ? p.bgA : hover ? p.bgH : p.bg;

  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setActive(false); }}
      onPointerDown={() => setActive(true)}
      onPointerUp={() => setActive(false)}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        gap: s.gap, height: s.h, padding: `0 ${s.px}px`,
        width: fullWidth ? "100%" : "auto",
        font: "inherit", fontFamily: "var(--font-sans)", fontSize: s.fs,
        fontWeight: "var(--fw-semibold)", letterSpacing: "var(--ls-tight)",
        lineHeight: 1, color: p.fg, background: bg,
        border: `var(--border-w) solid ${p.bd}`,
        borderRadius: "var(--radius-md)", boxShadow: p.sh,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transform: active && !disabled ? "translateY(0.5px)" : "none",
        transition: "background var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)",
        whiteSpace: "nowrap", userSelect: "none",
        ...style,
      }}
      {...rest}
    >
      {loading ? (
        <span aria-hidden="true" style={{
          width: s.icon, height: s.icon, borderRadius: "50%",
          border: `2px solid ${p.fg}`, borderTopColor: "transparent",
          display: "inline-block", animation: "cibol-spin 0.7s linear infinite",
        }} />
      ) : iconLeft ? (
        <span style={{ display: "inline-flex", width: s.icon, height: s.icon }}>{iconLeft}</span>
      ) : null}
      {children && <span>{children}</span>}
      {iconRight && !loading && (
        <span style={{ display: "inline-flex", width: s.icon, height: s.icon }}>{iconRight}</span>
      )}
    </button>
  );
}
