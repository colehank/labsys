import React from "react";

/**
 * CIBOL Input — text field with optional label, hint, error, icon, suffix.
 */
export function Input({
  label,
  hint,
  error,
  iconLeft = null,
  suffix = null,
  size = "md",
  type = "text",
  disabled = false,
  fullWidth = true,
  id,
  style = {},
  ...rest
}: any) {
  const [focus, setFocus] = React.useState(false);
  const reactId = React.useId();
  const fieldId = id || reactId;
  const hintId = (hint || error) ? `${fieldId}-hint` : undefined;
  const sizes = { sm: 32, md: 38, lg: 44 };
  const h = sizes[size] || sizes.md;

  const borderColor = error
    ? "var(--danger)"
    : focus
    ? "var(--accent)"
    : "var(--border-default)";

  return (
    <div style={{ width: fullWidth ? "100%" : "auto", ...style }}>
      {label && (
        <label htmlFor={fieldId} style={{
          display: "block", marginBottom: 6, fontSize: "var(--text-sm)",
          fontWeight: "var(--fw-medium)", color: "var(--text-body)",
        }}>{label}</label>
      )}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, height: h,
        padding: "0 12px", background: disabled ? "var(--surface-sunken)" : "var(--surface)",
        border: `var(--border-w) solid ${borderColor}`,
        borderRadius: "var(--radius-md)",
        boxShadow: focus ? "var(--ring)" : "none",
        transition: "border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)",
        opacity: disabled ? 0.6 : 1,
      }}>
        {iconLeft && (
          <span style={{ display: "inline-flex", width: 17, height: 17, color: "var(--text-faint)", flexShrink: 0 }}>{iconLeft}</span>
        )}
        <input
          id={fieldId}
          type={type}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={hintId}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            flex: 1, minWidth: 0, height: "100%", border: "none", outline: "none",
            background: "transparent", color: "var(--text-strong)",
            fontFamily: "var(--font-sans)", fontSize: "var(--text-md)",
          }}
          {...rest}
        />
        {suffix && (
          <span style={{ display: "inline-flex", alignItems: "center", color: "var(--text-faint)", fontSize: "var(--text-sm)", flexShrink: 0 }}>{suffix}</span>
        )}
      </div>
      {(hint || error) && (
        <div id={hintId} style={{
          marginTop: 5, fontSize: "var(--text-xs)",
          color: error ? "var(--danger-text)" : "var(--text-faint)",
        }}>{error || hint}</div>
      )}
    </div>
  );
}
