import React from "react";

/**
 * CIBOL Checkbox — supports checked/indeterminate, with optional label.
 */
export function Checkbox({
  checked,
  defaultChecked = false,
  indeterminate = false,
  onChange,
  disabled = false,
  label,
  id,
  style = {},
}: any) {
  const [internal, setInternal] = React.useState(defaultChecked);
  const on = checked !== undefined ? checked : internal;
  const reactId = React.useId();
  const fieldId = id || reactId;

  const toggle = () => {
    if (disabled) return;
    if (checked === undefined) setInternal(!on);
    onChange && onChange(!on);
  };

  const filled = on || indeterminate;

  const box = (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 18, height: 18, flexShrink: 0,
      background: filled ? "var(--accent)" : "var(--surface)",
      border: `1.5px solid ${filled ? "var(--accent)" : "var(--border-strong)"}`,
      borderRadius: "var(--radius-xs)",
      transition: "background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)",
      color: "#fff",
    }}>
      {indeterminate ? (
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
      ) : on ? (
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
      ) : null}
    </span>
  );

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 9,
      cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, ...style,
    }} onClick={!disabled ? toggle : undefined}>
      <button type="button" role="checkbox" aria-checked={indeterminate ? "mixed" : on}
        aria-label={label} id={fieldId} disabled={disabled} onClick={(e) => e.stopPropagation()}
        style={{ padding: 0, border: "none", background: "none", cursor: "inherit", display: "inline-flex" }}>
        {box}
      </button>
      {label && <span style={{ fontSize: "var(--text-md)", color: "var(--text-body)" }}>{label}</span>}
    </span>
  );
}
