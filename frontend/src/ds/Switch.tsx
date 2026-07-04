import React from "react";

/**
 * CIBOL Switch — on/off toggle (email reminders, theme, etc).
 */
export function Switch({
  checked,
  defaultChecked = false,
  onChange,
  disabled = false,
  size = "md",
  label,
  id,
  style = {},
}: any) {
  const [internal, setInternal] = React.useState(defaultChecked);
  const on = checked !== undefined ? checked : internal;
  const reactId = React.useId();
  const fieldId = id || reactId;

  const dims = { sm: { w: 34, h: 20, k: 14 }, md: { w: 42, h: 24, k: 18 } };
  const d = dims[size] || dims.md;

  const toggle = () => {
    if (disabled) return;
    if (checked === undefined) setInternal(!on);
    onChange && onChange(!on);
  };

  const control = (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      id={fieldId}
      disabled={disabled}
      onClick={toggle}
      style={{
        position: "relative", width: d.w, height: d.h, padding: 0, flexShrink: 0,
        background: on ? "var(--accent)" : "var(--border-strong)",
        border: "none", borderRadius: "var(--radius-pill)",
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
        transition: "background var(--dur-base) var(--ease-out)",
      }}
    >
      <span style={{
        position: "absolute", top: (d.h - d.k) / 2,
        left: on ? d.w - d.k - (d.h - d.k) / 2 : (d.h - d.k) / 2,
        width: d.k, height: d.k, borderRadius: "50%", background: "#fff",
        boxShadow: "var(--shadow-sm)",
        transition: "left var(--dur-base) var(--ease-spring)",
      }} />
    </button>
  );

  if (!label) return <span style={style}>{control}</span>;
  return (
    <span aria-hidden="true" style={{
      display: "inline-flex", alignItems: "center", gap: 10,
      cursor: disabled ? "not-allowed" : "pointer", ...style,
    }} onClick={toggle}>
      {control}
      <span style={{ fontSize: "var(--text-md)", color: "var(--text-body)" }}>{label}</span>
    </span>
  );
}
