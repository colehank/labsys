import React from "react";
import { I } from "../lib/icons";
import { useIsMobile } from "../lib/useIsMobile";
import { MarkdownView, MARKDOWN_CSS } from "../lib/markdown";

// Docs —— 层级文档中心。
// 内容完全由 src/docs/**/*.md 驱动：目录名即分类、文件名的数字前缀决定排序、
// 文件里第一个 `# 标题` 即文档标题。要新增文档，丢一个 .md 进去即可，无需改代码。

type Doc = { id: string; label: string; content: string; order: number };
type Cat = { key: string; label: string; order: number; docs: Doc[] };

// 分类可选图标：按分类名关键字挑一个 lucide 图标（纯装饰，匹配不到就用默认）。
function catIcon(label: string): string {
  if (/评优|评分|评选/.test(label)) return "award";
  if (/使用|上手|指南|教程/.test(label)) return "book-open";
  if (/年度|日程|日历|事项/.test(label)) return "calendar-days";
  return "folder";
}

const stripPrefix = (s: string) => s.replace(/^\d+[-._\s]*/, "");
const orderOf = (s: string) => { const m = /^(\d+)/.exec(s); return m ? parseInt(m[1], 10) : 9999; };

function buildTree(): Cat[] {
  const modules = import.meta.glob("../docs/**/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
  const byCat = new Map<string, Cat>();

  for (const path of Object.keys(modules)) {
    const content = modules[path];
    const parts = path.split("/");
    const di = parts.lastIndexOf("docs");
    const catSeg = parts[di + 1] ?? "未分类";
    const fileSeg = parts[parts.length - 1].replace(/\.md$/, "");

    const titleMatch = /^#\s+(.+)$/m.exec(content);
    const docLabel = titleMatch ? titleMatch[1].trim() : stripPrefix(fileSeg);

    let cat = byCat.get(catSeg);
    if (!cat) {
      cat = { key: catSeg, label: stripPrefix(catSeg), order: orderOf(catSeg), docs: [] };
      byCat.set(catSeg, cat);
    }
    cat.docs.push({ id: path, label: docLabel, content, order: orderOf(fileSeg) });
  }

  const cats = [...byCat.values()];
  cats.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, "zh"));
  for (const c of cats) c.docs.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, "zh"));
  return cats;
}

const TREE = buildTree();
const ALL_DOCS = TREE.flatMap((c) => c.docs);

export function Docs() {
  const isMobile = useIsMobile();
  const [activeId, setActiveId] = React.useState<string>(ALL_DOCS[0]?.id ?? "");
  const active = ALL_DOCS.find((d) => d.id === activeId) ?? ALL_DOCS[0];

  // 切换文档后把正文区滚回顶部
  const articleRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { if (articleRef.current) articleRef.current.scrollTop = 0; }, [activeId]);

  if (!TREE.length) {
    return <div style={{ padding: 32, color: "var(--text-muted)" }}>暂无文档。在 <code>src/docs/</code> 下新增 .md 文件即可。</div>;
  }

  const navTree = (
    <nav aria-label="文档目录" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {TREE.map((cat) => (
        <div key={cat.key}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "0 10px 6px", color: "var(--text-faint)" }}>
            <span style={{ display: "inline-flex", width: 15, height: 15 }}>{I(catIcon(cat.label), { size: 15 })}</span>
            <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{cat.label}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {cat.docs.map((doc) => {
              const on = doc.id === activeId;
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => setActiveId(doc.id)}
                  style={{
                    display: "block", width: "100%", textAlign: "left", padding: "7px 12px",
                    border: "none", cursor: "pointer", borderRadius: "var(--radius-sm)",
                    background: on ? "var(--accent-soft)" : "transparent",
                    color: on ? "var(--accent-text)" : "var(--text-body)",
                    fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: on ? 600 : 500,
                    transition: "background var(--dur-fast) var(--ease-out)",
                  }}
                  onMouseEnter={(e) => { if (!on) (e.currentTarget as HTMLElement).style.background = "var(--surface-hover)"; }}
                  onMouseLeave={(e) => { if (!on) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  {doc.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  const article = (
    <article ref={articleRef} style={{ flex: 1, minWidth: 0, overflowY: isMobile ? "visible" : "auto", height: isMobile ? "auto" : "100%" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: isMobile ? "8px 2px 40px" : "8px 40px 64px" }}>
        {active && <MarkdownView source={active.content} />}
      </div>
    </article>
  );

  return (
    <>
      <style>{MARKDOWN_CSS}</style>
      {isMobile ? (
        <div style={{ padding: "16px 14px 32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <span style={{ display: "inline-flex", width: 20, height: 20, color: "var(--accent)" }}>{I("book-open", { size: 20 })}</span>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "var(--text-strong)" }}>文档</h1>
          </div>
          {/* 移动端：文档选择器 */}
          <select
            value={activeId}
            onChange={(e) => setActiveId(e.target.value)}
            style={{
              width: "100%", padding: "10px 12px", marginBottom: 18, fontSize: 15,
              borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)",
              background: "var(--surface)", color: "var(--text-strong)",
            }}
          >
            {TREE.map((cat) => (
              <optgroup key={cat.key} label={cat.label}>
                {cat.docs.map((doc) => <option key={doc.id} value={doc.id}>{doc.label}</option>)}
              </optgroup>
            ))}
          </select>
          {article}
        </div>
      ) : (
        <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
          <aside style={{
            width: 248, flexShrink: 0, overflowY: "auto", height: "100%",
            borderRight: "1px solid var(--border-subtle)", background: "var(--surface)",
            padding: "26px 14px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 10px 20px" }}>
              <span style={{ display: "inline-flex", width: 19, height: 19, color: "var(--accent)" }}>{I("book-open", { size: 19 })}</span>
              <span style={{ fontSize: 16, fontWeight: 600, color: "var(--text-strong)" }}>文档</span>
            </div>
            {navTree}
          </aside>
          {article}
        </div>
      )}
    </>
  );
}
