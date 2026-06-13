import React from "react";
import { icons as lucideIcons } from "lucide-react";

// CIBOL icon helper. The design prototype rendered lucide glyphs two ways:
//   · I("house", { size, style })  → returns a React element (used inline in JS)
//   · <i data-lucide="house" />    → lucide replaced the <i> with an <svg>
// Both map here onto lucide-react. An icon renders at width/height 100% so it
// fills a sized parent span; an explicit style width/height overrides that, and
// `size` pins both dimensions — matching the prototype's I() semantics exactly.

type IconOpts = { size?: number; style?: React.CSSProperties };

const toPascal = (name: string) =>
  String(name)
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");

function resolve(name: string) {
  const pascal = toPascal(name);
  return (lucideIcons as Record<string, React.ComponentType<any>>)[pascal] || null;
}

export function I(name: string, opts: IconOpts = {}): React.ReactElement | null {
  const Comp = resolve(name);
  const style: React.CSSProperties = { display: "block", flexShrink: 0, ...opts.style };
  const dim = opts.size ?? "100%";
  if (!Comp) return null;
  return <Comp width={dim} height={dim} style={style} />;
}

export function Icon({
  name,
  size,
  style,
  ...rest
}: { name: string; size?: number; style?: React.CSSProperties } & Record<string, any>) {
  const Comp = resolve(name);
  if (!Comp) return null;
  const dim = size ?? "100%";
  return <Comp width={dim} height={dim} style={{ display: "block", flexShrink: 0, ...style }} {...rest} />;
}
