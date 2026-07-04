import React from "react";

const FOCUSABLE = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/**
 * CIBOL Dialog — centered modal with scrim. Header (title/subtitle), body,
 * and a footer action row. Controlled via `open`.
 *
 * A11y: focus trap, auto-focus on open, focus restore on close,
 * ESC via onKeyDown (not window), aria-labelledby on dialog role.
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
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const returnFocusRef = React.useRef<Element | null>(null);
  const titleId = React.useId();

  // Capture which element had focus before the dialog opened.
  React.useEffect(() => {
    if (open) returnFocusRef.current = document.activeElement;
  }, [open]);

  // Auto-focus first focusable element inside the dialog on open.
  React.useEffect(() => {
    if (!open || !dialogRef.current) return;
    const els = dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
    (els[0] || dialogRef.current).focus();
  }, [open]);

  // Restore focus to the trigger element when dialog closes.
  React.useEffect(() => {
    if (!open && returnFocusRef.current instanceof HTMLElement) {
      returnFocusRef.current.focus();
      returnFocusRef.current = null;
    }
  }, [open]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose?.();
      return;
    }
    if (e.key !== "Tab" || !dialogRef.current) return;
    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
    );
    if (!focusable.length) { e.preventDefault(); return; }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  };

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
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
        style={{
          outline: "none",
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
            {title && <h2 id={titleId} style={{ fontSize: "var(--text-xl)", fontWeight: "var(--fw-semibold)", color: "var(--text-strong)", margin: 0 }}>{title}</h2>}
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
    </div>
  );
}
