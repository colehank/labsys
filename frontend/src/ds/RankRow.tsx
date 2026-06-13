import React from "react";
import { Avatar } from "./Avatar";

/**
 * CIBOL RankRow — one member's standing on a rank board.
 * Shows rank index, avatar, name, a score bar, and the numeral.
 * Top-3 ranks get a warm medal tint.
 */
export function RankRow({
  rank,
  name,
  subtitle,
  score,
  maxScore = 100,
  unit,
  highlight = false,
  barTone = "accent",
  medals = true,
  style = {},
}: any) {
  const medal = medals && rank <= 3;
  const medalColors = { 1: "var(--terracotta-500)", 2: "var(--stone-400)", 3: "var(--amber-400)" };
  const barColors = {
    accent: "var(--accent)", sage: "var(--sage-500)", slate: "var(--slate-500)", amber: "var(--amber-400)",
  };
  const pct = Math.max(3, Math.min(100, (score / maxScore) * 100));

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14, padding: "10px 14px",
      background: highlight ? "var(--accent-soft)" : "transparent",
      border: `var(--border-w) solid ${highlight ? "var(--accent-soft-bd)" : "transparent"}`,
      borderRadius: "var(--radius-md)", ...style,
    }}>
      <span style={{
        flexShrink: 0, width: 26, height: 26, display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--font-serif)", fontSize: "var(--text-lg)", fontWeight: "var(--fw-semibold)",
        fontVariantNumeric: "tabular-nums",
        color: medal ? "#fff" : "var(--text-faint)",
        background: medal ? medalColors[rank] : "transparent",
        borderRadius: "50%",
      }}>{rank}</span>
      <Avatar name={name} size="sm" />
      <div style={{ minWidth: 0, flex: "0 0 auto", width: 120 }}>
        <div style={{ fontSize: "var(--text-md)", fontWeight: "var(--fw-medium)", color: "var(--text-strong)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
        {subtitle && <div style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>{subtitle}</div>}
      </div>
      <div style={{ flex: 1, minWidth: 40, height: 7, background: "var(--surface-sunken)", borderRadius: "var(--radius-pill)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: barColors[barTone] || barColors.accent, borderRadius: "var(--radius-pill)", transition: "width var(--dur-slow) var(--ease-out)" }} />
      </div>
      <span style={{
        flexShrink: 0, minWidth: 52, textAlign: "right",
        fontFamily: "var(--font-serif)", fontVariantNumeric: "tabular-nums",
        fontSize: "var(--text-lg)", fontWeight: "var(--fw-semibold)", color: "var(--text-strong)",
      }}>{score}{unit && <span style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)", marginLeft: 2 }}>{unit}</span>}</span>
    </div>
  );
}
