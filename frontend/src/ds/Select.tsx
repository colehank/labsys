import React from "react";

/**
 * CIBOL Select — styled native select with label/hint/error.
 */
export function Select({
  label,
  hint,
  error,
  options = [],
  placeholder,
  size = "md",
  disabled = false,
  fullWidth = true,
  id,
  value,
  onChange,
  style = {},
  ...rest
}: any) {
  const [focus, setFocus] = React.useState(false);
  const reactId = React.useId();
  const fieldId = id || reactId;
  const sizes = { sm: 32, md: 38, lg: 44 };
  const h = sizes[size] || sizes.md;
  const borderColor = error ? "var(--danger)" : focus ? "var(--accent)" : "var(--border-default)";

  return (
    <div style={{ width: fullWidth ? "100%" : "auto", ...style }}>
      {label && (
        <label htmlFor={fieldId} style={{
          display: "block", marginBottom: 6, fontSize: "var(--text-sm)",
          fontWeight: "var(--fw-medium)", color: "var(--text-body)",
        }}>{label}</label>
      )}
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <select
          id={fieldId}
          disabled={disabled}
          value={value}
          onChange={onChange}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            appearance: "none", WebkitAppearance: "none", width: "100%", height: h,
            padding: "0 36px 0 12px",
            background: disabled ? "var(--surface-sunken)" : "var(--surface)",
            color: value || !placeholder ? "var(--text-strong)" : "var(--text-faint)",
            fontFamily: "var(--font-sans)", fontSize: "var(--text-md)",
            border: `var(--border-w) solid ${borderColor}`, borderRadius: "var(--radius-md)",
            boxShadow: focus ? "var(--ring)" : "none", outline: "none", cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.6 : 1,
            transition: "border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)",
          }}
          {...rest}
        >
          {placeholder && <option value="" disabled>{placeholder}</option>}
          {options.map((o) => {
            const opt = typeof o === "string" ? { value: o, label: o } : o;
            return <option key={opt.value} value={opt.value}>{opt.label}</option>;
          })}
        </select>
        <span style={{
          position: "absolute", right: 12, pointerEvents: "none",
          display: "inline-flex", color: "var(--text-faint)", width: 16, height: 16,
        }}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
        </span>
      </div>
      {(hint || error) && (
        <div style={{ marginTop: 5, fontSize: "var(--text-xs)", color: error ? "var(--danger-text)" : "var(--text-faint)" }}>
          {error || hint}
        </div>
      )}
    </div>
  );
}
