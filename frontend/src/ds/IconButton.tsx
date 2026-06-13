import React from "react";

/**
 * CIBOL IconButton — square icon-only control for toolbars & nav.
 */
export function IconButton({
  icon,
  label,
  variant = "ghost",
  size = "md",
  active = false,
  disabled = false,
  onClick,
  style = {},
  ...rest
}: any) {
  const [hover, setHover] = React.useState(false);
  const sizes = { sm: 30, md: 36, lg: 42 };
  const dim = sizes[size] || sizes.md;
  const iconSize = Math.round(dim * 0.5);

  const bg = active
    ? "var(--accent-soft)"
    : hover && !disabled
    ? "var(--surface-hover)"
    : variant === "solid"
    ? "var(--surface)"
    : "transparent";
  const fg = active ? "var(--accent-text)" : "var(--text-muted)";

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: dim, height: dim, padding: 0,
        color: hover && !disabled && !active ? "var(--text-body)" : fg,
        background: bg,
        border: variant === "solid" ? "var(--border-w) solid var(--border-subtle)" : "var(--border-w) solid transparent",
        borderRadius: "var(--radius-md)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)",
        ...style,
      }}
      {...rest}
    >
      <span style={{ display: "inline-flex", width: iconSize, height: iconSize }}>{icon}</span>
    </button>
  );
}
