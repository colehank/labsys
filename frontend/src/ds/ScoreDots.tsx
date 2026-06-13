import React from "react";

/**
 * CIBOL ScoreDots — 5-point rating as filled neural nodes (brand motif).
 * Read-only display or interactive input. Used for 报告态度 / 制作精良.
 */
export function ScoreDots({
  value = 0,
  max = 5,
  onChange,
  readOnly = false,
  size = "md",
  showValue = false,
  style = {},
}: any) {
  const [hover, setHover] = React.useState(0);
  const dims = { sm: 12, md: 16, lg: 22 };
  const d = dims[size] || dims.md;
  const active = hover || value;

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: size === "sm" ? 4 : 6, ...style }}>
      <span style={{ display: "inline-flex", gap: size === "sm" ? 4 : 6 }}>
        {Array.from({ length: max }).map((_, i) => {
          const n = i + 1;
          const filled = n <= active;
          return (
            <button
              key={n}
              type="button"
              disabled={readOnly}
              aria-label={`${n} 分`}
              onMouseEnter={() => !readOnly && setHover(n)}
              onMouseLeave={() => !readOnly && setHover(0)}
              onClick={() => !readOnly && onChange && onChange(n)}
              style={{
                padding: 0, border: "none", background: "none", lineHeight: 0,
                cursor: readOnly ? "default" : "pointer",
              }}
            >
              <span style={{
                display: "block", width: d, height: d, borderRadius: "50%",
                background: filled ? "var(--accent)" : "transparent",
                border: `1.5px solid ${filled ? "var(--accent)" : "var(--border-strong)"}`,
                boxShadow: filled ? "0 0 0 3px var(--accent-soft)" : "none",
                transition: "all var(--dur-fast) var(--ease-out)",
              }} />
            </button>
          );
        })}
      </span>
      {showValue && (
        <span style={{
          fontFamily: "var(--font-serif)", fontVariantNumeric: "tabular-nums",
          fontSize: "var(--text-md)", fontWeight: "var(--fw-semibold)",
          color: "var(--text-body)", marginLeft: 2,
        }}>{Number(value).toFixed(1)}</span>
      )}
    </span>
  );
}
