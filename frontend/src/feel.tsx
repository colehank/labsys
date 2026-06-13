// Feel — the design-system "feel reshaper" from the prototype's index.html.
// useFeel applies the default accent / vibe / surface as CSS variables (this is
// what gives the app its warm serif headings, large radii and floating cards by
// default). FeelTweaks is a small floating panel to switch them live — the
// prototype drove this from the Claude Design host; here a corner button toggles it.
import React from "react";
import { Icon } from "./lib/icons";

export const TWEAK_DEFAULTS = { accent: "terracotta", vibe: "warm", surface: "float" };

// accent character — remaps the whole accent family (light + dark variants)
const PALETTES: Record<string, any> = {
  terracotta: { light: { a: "#BD5D3A", h: "#A54E2F", p: "#883E26", s: "#FBF0EA", sb: "#E9BCA3", t: "#A54E2F" }, dark: { a: "#CE7B50", h: "#DC9B77", p: "#E9BCA3", s: "rgba(189,93,58,0.16)", sb: "rgba(206,123,80,0.34)", t: "#DC9B77" } },
  forest: { light: { a: "#4C7458", h: "#3D5E47", p: "#2E4836", s: "#E2EBE4", sb: "#A9C3B0", t: "#3D5E47" }, dark: { a: "#7FA98A", h: "#9DC2A6", p: "#B9D6BF", s: "rgba(76,116,88,0.20)", sb: "rgba(125,169,138,0.34)", t: "#9DC2A6" } },
  indigo: { light: { a: "#3F5E86", h: "#334D70", p: "#283D59", s: "#E3E9F1", sb: "#A9BCD5", t: "#334D70" }, dark: { a: "#7E9BC2", h: "#9DB4D3", p: "#BACBE2", s: "rgba(63,94,134,0.22)", sb: "rgba(126,155,194,0.34)", t: "#9DB4D3" } },
  ink: { light: { a: "#5A554E", h: "#46423C", p: "#38352F", s: "#ECE7DD", sb: "#C3BAAA", t: "#4E4A44" }, dark: { a: "#A39A8B", h: "#C3BAAA", p: "#DBD4C6", s: "rgba(131,123,111,0.24)", sb: "rgba(163,154,139,0.34)", t: "#C3BAAA" } },
};
// overall vibe — heading personality (serif/sans) + corner language
const VIBES: Record<string, any> = {
  modern: { head: "var(--font-sans)", r: ["3px", "5px", "8px", "12px", "16px"] },
  academic: { head: "var(--font-serif)", r: ["2px", "4px", "6px", "8px", "12px"] },
  warm: { head: "var(--font-serif)", r: ["8px", "12px", "16px", "22px", "28px"] },
};
// surface texture — flat paper vs floating cards
const SURFACES: Record<string, any> = {
  flat: { xs: "0 1px 2px rgba(42,42,40,0.05)", sm: "0 1px 2px rgba(42,42,40,0.06)", md: "0 2px 4px rgba(42,42,40,0.06), 0 6px 16px rgba(42,42,40,0.06)", lg: "0 4px 8px rgba(42,42,40,0.07), 0 16px 36px rgba(42,42,40,0.10)" },
  float: { xs: "0 2px 6px rgba(42,42,40,0.10)", sm: "0 3px 10px rgba(42,42,40,0.13)", md: "0 8px 22px rgba(42,42,40,0.16)", lg: "0 18px 44px rgba(42,42,40,0.20)" },
};

export function useFeel(t: { accent: string; vibe: string; surface: string }) {
  React.useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const dark = root.getAttribute("data-theme") === "dark";
      const pal = (PALETTES[t.accent] || PALETTES.terracotta)[dark ? "dark" : "light"];
      const vibe = VIBES[t.vibe] || VIBES.modern;
      const surf = SURFACES[t.surface] || SURFACES.flat;
      const set = (k: string, v: string) => root.style.setProperty(k, v);
      set("--accent", pal.a); set("--accent-hover", pal.h); set("--accent-press", pal.p);
      set("--accent-soft", pal.s); set("--accent-soft-bd", pal.sb); set("--accent-text", pal.t);
      set("--terracotta-500", pal.a); set("--terracotta-400", pal.a); set("--border-focus", pal.a);
      set("--heading-font", vibe.head); set("--display-font", vibe.head);
      ["--radius-xs", "--radius-sm", "--radius-md", "--radius-lg", "--radius-xl"].forEach((k, i) => set(k, vibe.r[i]));
      set("--shadow-xs", surf.xs); set("--shadow-sm", surf.sm); set("--shadow-md", surf.md); set("--shadow-lg", surf.lg);
    };
    apply();
    const obs = new MutationObserver(apply);
    obs.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, [t.accent, t.vibe, t.surface]);
}

export function useTweaks(defaults: typeof TWEAK_DEFAULTS) {
  const [values, setValues] = React.useState(defaults);
  const setTweak = React.useCallback((key: string, val: string) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  }, []);
  return [values, setTweak] as const;
}

function Segmented({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", padding: 3, gap: 2, background: "var(--surface-sunken)", borderRadius: "var(--radius-md)" }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" onClick={() => onChange(o.value)}
            style={{
              flex: 1, padding: "6px 10px", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5,
              fontWeight: 600, borderRadius: "var(--radius-sm)",
              background: on ? "var(--surface-raised)" : "transparent",
              color: on ? "var(--accent-text)" : "var(--text-muted)",
              boxShadow: on ? "var(--shadow-xs)" : "none", transition: "all var(--dur-fast) var(--ease-out)",
            }}>{o.label}</button>
        );
      })}
    </div>
  );
}

export function FeelTweaks({ t, setTweak }: { t: typeof TWEAK_DEFAULTS; setTweak: (k: string, v: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const section = (label: string) => (
    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-faint)", paddingTop: 4 }}>{label}</div>
  );
  return (
    <>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label="界面气质" title="界面气质"
        style={{
          position: "fixed", right: 18, bottom: 18, zIndex: 2147483645, width: 42, height: 42,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          border: "1px solid var(--border-subtle)", background: "var(--surface-raised)", color: "var(--text-muted)",
          borderRadius: "var(--radius-pill)", boxShadow: "var(--shadow-lg)", cursor: "pointer",
        }}>
        <span style={{ width: 19, height: 19, display: "inline-flex" }}><Icon name="sliders-horizontal" /></span>
      </button>
      {open && (
        <div style={{
          position: "fixed", right: 18, bottom: 70, zIndex: 2147483646, width: 244,
          display: "flex", flexDirection: "column", gap: 12,
          background: "var(--surface-raised)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-xl)", padding: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)" }}>界面气质</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="关闭"
              style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-faint)", display: "inline-flex", padding: 2 }}>
              <span style={{ width: 16, height: 16, display: "inline-flex" }}><Icon name="x" /></span>
            </button>
          </div>
          {section("主色")}
          <Segmented value={t.accent} onChange={(v) => setTweak("accent", v)}
            options={[{ value: "terracotta", label: "赤陶" }, { value: "forest", label: "墨绿" }, { value: "indigo", label: "黛蓝" }, { value: "ink", label: "素墨" }]} />
          {section("格调")}
          <Segmented value={t.vibe} onChange={(v) => setTweak("vibe", v)}
            options={[{ value: "modern", label: "现代" }, { value: "academic", label: "学术" }, { value: "warm", label: "温润" }]} />
          {section("质感")}
          <Segmented value={t.surface} onChange={(v) => setTweak("surface", v)}
            options={[{ value: "flat", label: "平整" }, { value: "float", label: "悬浮" }]} />
        </div>
      )}
    </>
  );
}
