import React from "react";

/**
 * CIBOL Avatar — initials or image, with optional presence node.
 * Presence reuses the brand's neural-node dot.
 */
export function Avatar({
  name = "",
  src = null,
  size = "md",
  presence = null, // "online" | "offline" | "busy" | null
  style = {},
}: any) {
  const sizes = { xs: 24, sm: 30, md: 38, lg: 48, xl: 64 };
  const dim = sizes[size] || sizes.md;
  const fontSize = Math.round(dim * 0.4);

  const initials = name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "·";

  // deterministic warm tint from name
  const palette = ["var(--terracotta-400)", "var(--sage-500)", "var(--slate-400)", "var(--amber-400)", "var(--stone-500)"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const bg = palette[h % palette.length];

  const presenceColors = { online: "var(--success)", offline: "var(--stone-400)", busy: "var(--warning)" };

  return (
    <span style={{ position: "relative", display: "inline-flex", width: dim, height: dim, flexShrink: 0, ...style }}>
      <span style={{
        width: dim, height: dim, borderRadius: "var(--radius-pill)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: src ? "var(--surface-sunken)" : bg, overflow: "hidden",
        color: "#fff", fontFamily: "var(--font-sans)", fontWeight: "var(--fw-semibold)",
        fontSize, letterSpacing: "0.02em", userSelect: "none",
      }}>
        {src ? <img src={src} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials}
      </span>
      {presence && (
        <span style={{
          position: "absolute", right: -1, bottom: -1,
          width: Math.max(8, dim * 0.26), height: Math.max(8, dim * 0.26),
          borderRadius: "50%", background: presenceColors[presence] || "var(--stone-400)",
          border: "2px solid var(--surface)",
        }} />
      )}
    </span>
  );
}
