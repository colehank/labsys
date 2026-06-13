import React from "react";

/**
 * CIBOL Textarea — multi-line field (reasons, anonymous feedback).
 */
export function Textarea({
  label,
  hint,
  error,
  rows = 4,
  maxLength,
  value,
  disabled = false,
  fullWidth = true,
  id,
  style = {},
  onChange,
  ...rest
}: any) {
  const [focus, setFocus] = React.useState(false);
  const [internal, setInternal] = React.useState("");
  const reactId = React.useId();
  const fieldId = id || reactId;
  const val = value !== undefined ? value : internal;

  const borderColor = error ? "var(--danger)" : focus ? "var(--accent)" : "var(--border-default)";

  return (
    <div style={{ width: fullWidth ? "100%" : "auto", ...style }}>
      {label && (
        <label htmlFor={fieldId} style={{
          display: "flex", justifyContent: "space-between", marginBottom: 6,
          fontSize: "var(--text-sm)", fontWeight: "var(--fw-medium)", color: "var(--text-body)",
        }}>
          <span>{label}</span>
          {maxLength && (
            <span style={{ color: "var(--text-faint)", fontVariantNumeric: "tabular-nums" }}>
              {(val || "").length}/{maxLength}
            </span>
          )}
        </label>
      )}
      <textarea
        id={fieldId}
        rows={rows}
        maxLength={maxLength}
        disabled={disabled}
        value={val}
        onChange={(e) => { if (value === undefined) setInternal(e.target.value); onChange && onChange(e); }}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          display: "block", width: "100%", padding: "10px 12px",
          background: disabled ? "var(--surface-sunken)" : "var(--surface)",
          color: "var(--text-strong)", fontFamily: "var(--font-sans)", fontSize: "var(--text-md)",
          lineHeight: "var(--lh-normal)", resize: "vertical",
          border: `var(--border-w) solid ${borderColor}`, borderRadius: "var(--radius-md)",
          boxShadow: focus ? "var(--ring)" : "none", outline: "none",
          transition: "border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)",
        }}
        {...rest}
      />
      {(hint || error) && (
        <div style={{ marginTop: 5, fontSize: "var(--text-xs)", color: error ? "var(--danger-text)" : "var(--text-faint)" }}>
          {error || hint}
        </div>
      )}
    </div>
  );
}
