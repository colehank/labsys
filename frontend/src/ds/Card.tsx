import React from "react";

/**
 * CIBOL Card — base surface container. Optional header (title/subtitle/action)
 * and interactive hover lift.
 */
export function Card({
  children,
  title,
  subtitle,
  eyebrow,
  action,
  padding = "md",
  interactive = false,
  onClick,
  style = {},
  bodyStyle = {},
  ...rest
}: any) {
  const [hover, setHover] = React.useState(false);
  const pads = { none: 0, sm: "var(--space-5)", md: "var(--space-7)", lg: "var(--space-8)" };
  const pad = pads[padding] !== undefined ? pads[padding] : pads.md;

  return (
    <section
      onClick={onClick}
      onMouseEnter={() => interactive && setHover(true)}
      onMouseLeave={() => interactive && setHover(false)}
      onKeyDown={interactive ? (e: React.KeyboardEvent) => {
        if ((e.key === "Enter" || e.key === " ") && onClick) {
          e.preventDefault();
          onClick(e as any);
        }
      } : undefined}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      style={{
        background: "var(--surface)",
        border: `var(--border-w) solid ${hover ? "var(--border-default)" : "var(--border-subtle)"}`,
        borderRadius: "var(--radius-lg)",
        boxShadow: hover ? "var(--shadow-md)" : "var(--shadow-sm)",
        cursor: interactive ? "pointer" : "default",
        transform: hover ? "translateY(-1px)" : "none",
        transition: "border-color var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out)",
        overflow: "hidden",
        ...style,
      }}
      {...rest}
    >
      {(title || eyebrow || action) && (
        <header style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          gap: 16, padding: pad === 0 ? "var(--space-5)" : pad,
          paddingBottom: "var(--space-5)",
        }}>
          <div style={{ minWidth: 0 }}>
            {eyebrow && (
              <div style={{
                fontSize: "var(--text-2xs)", fontWeight: "var(--fw-semibold)",
                letterSpacing: "var(--ls-widest)", textTransform: "uppercase",
                color: "var(--text-faint)", marginBottom: 6,
              }}>{eyebrow}</div>
            )}
            {title && <h3 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--fw-semibold)", color: "var(--text-strong)", margin: 0 }}>{title}</h3>}
            {subtitle && <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", margin: "4px 0 0" }}>{subtitle}</p>}
          </div>
          {action && <div style={{ flexShrink: 0 }}>{action}</div>}
        </header>
      )}
      <div style={{
        padding: pad,
        paddingTop: (title || eyebrow || action) ? 0 : pad,
        ...bodyStyle,
      }}>
        {children}
      </div>
    </section>
  );
}
