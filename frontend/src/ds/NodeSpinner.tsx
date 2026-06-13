import React from "react";

/**
 * CIBOL NodeSpinner — loading indicator built from the brand's neural nodes:
 * three dots pulsing along a dashed arc. Use for connecting / pending states.
 */
export function NodeSpinner({ size = 28, label, style = {} }: any) {
  const dot = Math.max(4, size * 0.16);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, ...style }}>
      <span style={{ position: "relative", display: "inline-block", width: size, height: size }}>
        {[0, 1, 2].map((i) => {
          const angle = (-50 + i * 50) * (Math.PI / 180);
          const r = size * 0.36;
          const cx = size / 2 + r * Math.cos(angle) - dot / 2;
          const cy = size / 2 + r * Math.sin(angle) - dot / 2;
          return (
            <span key={i} style={{
              position: "absolute", left: cx, top: cy, width: dot, height: dot,
              borderRadius: "50%", background: "var(--accent)",
              animation: `cibol-node-pulse 1.1s ${i * 0.18}s var(--ease-in-out) infinite`,
            }} />
          );
        })}
      </span>
      {label && <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>{label}</span>}
      <style>{`@keyframes cibol-node-pulse{0%,100%{opacity:.25;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}`}</style>
    </span>
  );
}
