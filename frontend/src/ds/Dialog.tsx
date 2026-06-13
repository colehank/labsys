import React from "react";

/**
 * CIBOL Dialog — centered modal with scrim. Header (title/subtitle), body,
 * and a footer action row. Controlled via `open`.
 */
export function Dialog({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer = null,
  width = 460,
  icon = null,
  tone = "neutral",
}: any) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const tones = {
    neutral: "var(--surface-sunken)", accent: "var(--accent-soft)",
    danger: "var(--danger-soft)", success: "var(--success-soft)", warning: "var(--warning-soft)",
  };
  const toneFg = {
    neutral: "var(--text-muted)", accent: "var(--accent-text)",
    danger: "var(--danger-text)", success: "var(--success-text)", warning: "var(--warning-text)",
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        background: "var(--overlay-scrim)", backdropFilter: "blur(2px)",
        animation: "cibol-fade var(--dur-base) var(--ease-out)",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: width, maxHeight: "calc(100vh - 48px)", overflowY: "auto",
          background: "var(--surface-raised)", border: "var(--border-w) solid var(--border-subtle)",
          borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-xl)",
          animation: "cibol-pop var(--dur-slow) var(--ease-spring)",
        }}
      >
        <div style={{ padding: "var(--space-7)", display: "flex", gap: 14, alignItems: "flex-start" }}>
          {icon && (
            <span style={{
              width: 40, height: 40, flexShrink: 0, borderRadius: "var(--radius-md)",
              background: tones[tone], color: toneFg[tone],
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ width: 20, height: 20, display: "inline-flex" }}>{icon}</span>
            </span>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            {title && <h2 style={{ fontSize: "var(--text-xl)", fontWeight: "var(--fw-semibold)", color: "var(--text-strong)", margin: 0 }}>{title}</h2>}
            {subtitle && <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", margin: "5px 0 0", lineHeight: "var(--lh-normal)" }}>{subtitle}</p>}
          </div>
        </div>
        {children && <div style={{ padding: "0 var(--space-7) var(--space-6)" }}>{children}</div>}
        {footer && (
          <div style={{
            display: "flex", justifyContent: "flex-end", gap: 10,
            padding: "var(--space-5) var(--space-7)",
            borderTop: "var(--border-w) solid var(--border-subtle)", background: "var(--surface)",
            borderRadius: "0 0 var(--radius-xl) var(--radius-xl)",
          }}>{footer}</div>
        )}
      </div>
      <style>{`
        @keyframes cibol-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes cibol-pop { from { opacity: 0; transform: translateY(8px) scale(0.98) } to { opacity: 1; transform: none } }
      `}</style>
    </div>
  );
}
