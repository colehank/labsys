import React from "react";

// 极简零依赖 Markdown 渲染器。
// 支持：# ~ ###### 标题、段落、**粗体** *斜体* _斜体_ `行内代码`、[文字](链接)、
// - / * 无序列表、1. 有序列表、> 引用、``` 代码块、--- 分割线、| 表格 |。
// 设计目标：够用、稳定、无第三方依赖，让文档以 .md 维护即可。

// ── 行内解析：按最早出现的记号切分（代码 > 链接 > 粗体 > 斜体）──
function inline(text: string, kp: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let rest = text;
  let i = 0;
  // 每个模式：正则 + 渲染函数（用捕获组）
  const patterns: { re: RegExp; render: (m: RegExpExecArray, key: string) => React.ReactNode }[] = [
    { re: /`([^`]+)`/, render: (m, key) => <code key={key} className="md-code">{m[1]}</code> },
    {
      re: /\[([^\]]+)\]\(([^)\s]+)\)/,
      render: (m, key) => (
        <a key={key} href={m[2]} target={/^https?:/.test(m[2]) ? "_blank" : undefined} rel="noreferrer">{m[1]}</a>
      ),
    },
    { re: /\*\*([^*]+)\*\*/, render: (m, key) => <strong key={key}>{inline(m[1], key)}</strong> },
    { re: /(?:\*([^*\n]+)\*|_([^_\n]+)_)/, render: (m, key) => <em key={key}>{inline(m[1] ?? m[2], key)}</em> },
  ];
  // 反复找出「位置最靠前」的匹配
  while (rest) {
    let best: { idx: number; len: number; node: React.ReactNode; pat: RegExpExecArray } | null = null;
    for (const p of patterns) {
      const m = p.re.exec(rest);
      if (m && (best === null || m.index < best.idx)) {
        best = { idx: m.index, len: m[0].length, node: p.render(m, `${kp}-${i}`), pat: m };
      }
    }
    if (!best) { out.push(rest); break; }
    if (best.idx > 0) out.push(rest.slice(0, best.idx));
    out.push(best.node);
    rest = rest.slice(best.idx + best.len);
    i++;
  }
  return out;
}

type Block = React.ReactNode;

export function renderMarkdown(src: string): React.ReactNode[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  let key = 0;
  const k = () => `b${key++}`;

  while (i < lines.length) {
    let line = lines[i];

    // 空行
    if (/^\s*$/.test(line)) { i++; continue; }

    // 代码块 ```
    if (/^\s*```/.test(line)) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++; // 跳过收尾 ```
      blocks.push(<pre key={k()} className="md-pre"><code>{buf.join("\n")}</code></pre>);
      continue;
    }

    // 分割线
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push(<hr key={k()} className="md-hr" />);
      i++;
      continue;
    }

    // 标题 #..######
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const lvl = h[1].length;
      const Tag = (`h${lvl}` as unknown) as keyof JSX.IntrinsicElements;
      blocks.push(<Tag key={k()} className={`md-h md-h${lvl}`}>{inline(h[2].trim(), k())}</Tag>);
      i++;
      continue;
    }

    // 表格：当前行含 |，下一行是 |---| 分隔
    if (/\|/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) && /-/.test(lines[i + 1])) {
      const splitRow = (r: string) =>
        r.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
      const headers = splitRow(line);
      i += 2; // 跳过表头与分隔线
      const rows: string[][] = [];
      while (i < lines.length && /\|/.test(lines[i]) && !/^\s*$/.test(lines[i])) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      blocks.push(
        <div key={k()} className="md-table-wrap">
          <table className="md-table">
            <thead><tr>{headers.map((c, ci) => <th key={ci}>{inline(c, k())}</th>)}</tr></thead>
            <tbody>{rows.map((r, ri) => <tr key={ri}>{headers.map((_, ci) => <td key={ci}>{inline(r[ci] ?? "", k())}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }

    // 引用 >
    if (/^\s*>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      blocks.push(<blockquote key={k()} className="md-quote">{renderMarkdown(buf.join("\n"))}</blockquote>);
      continue;
    }

    // 无序列表
    if (/^\s*[-*]\s+/.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        const content = lines[i].replace(/^\s*[-*]\s+/, "");
        items.push(<li key={items.length}>{inline(content, k())}</li>);
        i++;
      }
      blocks.push(<ul key={k()} className="md-ul">{items}</ul>);
      continue;
    }

    // 有序列表
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        const content = lines[i].replace(/^\s*\d+\.\s+/, "");
        items.push(<li key={items.length}>{inline(content, k())}</li>);
        i++;
      }
      blocks.push(<ol key={k()} className="md-ol">{items}</ol>);
      continue;
    }

    // 段落：吸收连续非空、非块级起始的行
    const para: string[] = [line];
    i++;
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !/^\s*(#{1,6}\s|```|>|[-*]\s|\d+\.\s|-{3,}\s*$)/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(<p key={k()} className="md-p">{inline(para.join(" "), k())}</p>);
  }

  return blocks;
}

export function MarkdownView({ source }: { source: string }) {
  return <div className="cibol-md">{renderMarkdown(source)}</div>;
}

// 与系统 design token 对齐的排版样式，随 <MarkdownView> 一起注入一次即可。
export const MARKDOWN_CSS = `
.cibol-md { color: var(--text-body); font-size: 15px; line-height: 1.75; word-wrap: break-word; }
.cibol-md .md-h { color: var(--text-strong); font-weight: var(--fw-semibold); line-height: 1.3; scroll-margin-top: 80px; }
.cibol-md .md-h1 { font-size: 28px; margin: 4px 0 18px; letter-spacing: -0.01em; }
.cibol-md .md-h2 { font-size: 21px; margin: 34px 0 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border-subtle); }
.cibol-md .md-h3 { font-size: 17px; margin: 26px 0 10px; }
.cibol-md .md-h4 { font-size: 15px; margin: 20px 0 8px; color: var(--text-muted); }
.cibol-md .md-p { margin: 12px 0; }
.cibol-md a { color: var(--accent-text, var(--accent)); text-decoration: none; border-bottom: 1px solid color-mix(in srgb, var(--accent) 35%, transparent); }
.cibol-md a:hover { border-bottom-color: var(--accent); }
.cibol-md strong { color: var(--text-strong); font-weight: var(--fw-semibold); }
.cibol-md .md-code { font-family: var(--font-mono, ui-monospace, monospace); font-size: 0.88em; background: var(--surface-sunken); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 1.5px 6px; color: var(--text-strong); }
.cibol-md .md-pre { background: var(--surface-sunken); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 14px 16px; overflow-x: auto; margin: 16px 0; }
.cibol-md .md-pre code { font-family: var(--font-mono, ui-monospace, monospace); font-size: 13px; color: var(--text-body); line-height: 1.6; white-space: pre; }
.cibol-md .md-ul, .cibol-md .md-ol { margin: 12px 0; padding-left: 24px; }
.cibol-md .md-ul li, .cibol-md .md-ol li { margin: 6px 0; }
.cibol-md .md-ul { list-style: disc; }
.cibol-md .md-ol { list-style: decimal; }
.cibol-md .md-ul li::marker, .cibol-md .md-ol li::marker { color: var(--text-faint); }
.cibol-md .md-quote { margin: 16px 0; padding: 4px 16px; border-left: 3px solid var(--accent); background: var(--accent-soft, var(--surface-sunken)); border-radius: 0 var(--radius-sm) var(--radius-sm) 0; color: var(--text-muted); }
.cibol-md .md-quote .md-p { margin: 8px 0; }
.cibol-md .md-hr { border: none; border-top: 1px solid var(--border-subtle); margin: 28px 0; }
.cibol-md .md-table-wrap { overflow-x: auto; margin: 18px 0; }
.cibol-md .md-table { border-collapse: collapse; width: 100%; font-size: 14px; }
.cibol-md .md-table th, .cibol-md .md-table td { border: 1px solid var(--border-subtle); padding: 8px 12px; text-align: left; vertical-align: top; }
.cibol-md .md-table th { background: var(--surface-sunken); color: var(--text-strong); font-weight: var(--fw-semibold); white-space: nowrap; }
.cibol-md .md-table tbody tr:nth-child(even) { background: color-mix(in srgb, var(--surface-sunken) 45%, transparent); }
`;
