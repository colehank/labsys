import React from "react";
import * as NS from "../ds";
import { I, Icon } from "../lib/icons";
import { toast } from "../store";
import {
  useEvalCompute,
  useEvalConfig,
  useUpdateEvalConfig,
  usePublishExcellence,
  useExcellence,
} from "../api/hooks";

// AdminStats — 表现统计: 本评选期的排名工作台。
//   三个板块（管理员的操作流程）:
//     最上方「最终表现」— 调整①汇总权重 → 实时呈现终极排名与组会表现明细（结果落点）
//     左下「②过滤下限」— 四项 Layer-1 指标各自的下限，筛出入选者
//     右下「③进展表现」— 管理员对入选者拖拽主观排序，进展名次由顺序得出
//   计算: 组会表现 = 四项归一分的加权平均；终极排名 = 组会表现名次 与 进展名次 的 Borda 平均合并。
//   每个面板固定高度、内部滚动，整页一屏可览。
  const { Card, Button, Avatar, Badge, Dialog } = NS;

  const L1 = [
    { key: "attitude", nk: "nAttitude", wk: "attitude", label: "报告态度", short: "报告态度", color: "var(--terracotta-500)", raw: (r) => r.attitude.toFixed(1) },
    { key: "polish", nk: "nPolish", wk: "polish", label: "制作精良度", short: "制作精良", color: "var(--amber-500)", raw: (r) => r.polish.toFixed(1) },
    { key: "attRate", nk: "nAtt", wk: "attendance", label: "出勤率", short: "出勤率", color: "var(--sage-500)", raw: (r) => r.attRate + "%" },
    { key: "discuss", nk: "nDisc", wk: "discussion", label: "讨论参与", short: "讨论参与", color: "var(--slate-500)", raw: (r) => String(r.discuss) },
  ];

  const hCell = { fontSize: 10.5, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-faint)" };
  const TABLE_COLS = "54px 102px repeat(4, 1fr) 64px 50px 50px";

  function MiniBar({ pct, color, w = 36 }: any) {
    return (
      <div style={{ width: w, height: 5, background: "var(--surface-hover)", borderRadius: 999, overflow: "hidden", flexShrink: 0 }}>
        <div style={{ width: `${Math.max(3, Math.min(100, pct))}%`, height: "100%", background: color, borderRadius: 999 }} />
      </div>
    );
  }

  // 面板外壳：标题条 + 填充父容器、可选内部滚动的主体
  function Panel({ step, title, sub, right, children, scroll = true, style }: any) {
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%", background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-xs)", overflow: "hidden", ...style }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 14px", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0 }}>
          {step != null && <span style={{ width: 20, height: 20, flexShrink: 0, borderRadius: "var(--radius-sm)", background: "var(--accent-soft)", color: "var(--accent-text)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-serif)", fontSize: 12, fontWeight: 600 }}>{step}</span>}
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>{title}</span>
          {sub && <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{sub}</span>}
          {right && <div style={{ marginLeft: "auto" }}>{right}</div>}
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: scroll ? "auto" : "hidden" }}>{children}</div>
      </div>
    );
  }

  function WeightChip({ label, color, value, onChange }: any) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 11.5, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{label}</span>
        <input type="range" min="0" max="100" value={Math.round(value * 100)} onChange={(e) => onChange(+e.target.value / 100)}
          style={{ flex: 1, minWidth: 40, accentColor: "var(--accent)", height: 3 }} />
        <span className="cibol-mono" style={{ fontSize: 11, color: "var(--text-faint)", width: 30, textAlign: "right" }}>{Math.round(value * 100)}%</span>
      </div>
    );
  }

  function FilterField({ label, value, onChange, suffix, min = 0, max = 999, step = 1, color, hint }: any) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 12.5, color: "var(--text-body)", display: "inline-flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
          {color && <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />}
          <span style={{ whiteSpace: "nowrap" }}>{label}</span>
          {hint && <span style={{ fontSize: 10.5, color: "var(--text-faint)" }}>{hint}</span>}
        </span>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "0 9px", height: 32, border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", background: "var(--surface)", flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: "var(--text-faint)" }}>≥</span>
          <input type="number" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Math.max(min, Math.min(max, +e.target.value || 0)))}
            style={{ width: 44, border: "none", background: "transparent", color: "var(--text-strong)", fontFamily: "var(--font-mono)", fontSize: 13.5, fontWeight: 600, outline: "none", textAlign: "right", MozAppearance: "textfield" }} />
          {suffix && <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{suffix}</span>}
        </div>
      </div>
    );
  }

  const RANGE_PRESETS = {
    recent: { label: "近一个月", from: "2026-05-10", to: "2026-06-07" },
    term: { label: "本学期", from: "2026-02-24", to: "2026-06-07" },
  };

  function RangeControl({ range, onPreset, onFrom, onTo, onCustom }: any) {
    const ds = { height: 30, padding: "0 9px", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", background: "var(--surface)", color: "var(--text-strong)", fontFamily: "var(--font-mono)", fontSize: 12.5, colorScheme: "light dark" };
    const isCustom = !RANGE_PRESETS[range.preset];
    const segBtn = (on, label, onClick) => (
      <button key={label} onClick={onClick}
        style={{ padding: "5px 12px", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 600, borderRadius: "var(--radius-sm)", background: on ? "var(--surface)" : "transparent", color: on ? "var(--accent-text)" : "var(--text-muted)", boxShadow: on ? "var(--shadow-xs)" : "none", transition: "all var(--dur-fast) var(--ease-out)" }}>{label}</button>
    );
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", padding: 3, gap: 2, background: "var(--surface-hover)", borderRadius: "var(--radius-md)" }}>
          {Object.entries(RANGE_PRESETS).map(([k, p]) => segBtn(range.preset === k, p.label, () => onPreset(k)))}
          {segBtn(isCustom, "自定义", onCustom)}
        </div>
        {isCustom && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <input type="date" value={range.from} onChange={(e) => onFrom(e.target.value)} style={ds} />
            <span style={{ color: "var(--text-faint)", fontSize: 12.5 }}>至</span>
            <input type="date" value={range.to} onChange={(e) => onTo(e.target.value)} style={ds} />
          </div>
        )}
      </div>
    );
  }

  function AdminStats() {
    const { data: evData } = useEvalCompute();
    const { data: cfg } = useEvalConfig();
    const { data: excellence } = useExcellence();
    const updateConfig = useUpdateEvalConfig();
    const publishExc = usePublishExcellence();
    const [drag, setDrag] = React.useState(null);
    const [pubOpen, setPubOpen] = React.useState(false);
    const [pubCount, setPubCount] = React.useState(5);
    const [justPublished, setJustPublished] = React.useState(false);

    if (!evData || !cfg) return null;

    const w = cfg.weights as Record<string, number>;
    const f = cfg.filters as Record<string, number>;
    const range = cfg.range as Record<string, string>;
    const progressOrder = cfg.progress_order;

    // —— config 局部更新：合并 patch 到完整配置后整体提交 ——
    const nextConfig = (patch: any) => ({
      weights: cfg.weights,
      filters: cfg.filters,
      range: cfg.range,
      progress_order: cfg.progress_order,
      ...patch,
    });
    const setEvalWeights = (patch: any) => updateConfig.mutate(nextConfig({ weights: { ...cfg.weights, ...patch } }));
    const setEvalFilters = (patch: any) => updateConfig.mutate(nextConfig({ filters: { ...cfg.filters, ...patch } }));
    const setEvalRange = (patch: any) => updateConfig.mutate(nextConfig({ range: { ...cfg.range, ...patch } }));
    const setProgressOrder = (arr: string[] | null) => updateConfig.mutate(nextConfig({ progress_order: arr }));
    const resetProgressOrder = () => updateConfig.mutate(nextConfig({ progress_order: null }));

    // —— 从后端 rows / merged 派生 survivors / order / mRankAmong（与本地计算等价）——
    const rowByName: Record<string, any> = {};
    evData.rows.forEach((r) => { rowByName[r.name] = r; });
    const survivors = evData.merged
      .map((m) => rowByName[m.name])
      .filter(Boolean);
    const order = [...evData.merged].sort((a, b) => a.pRank - b.pRank).map((m) => m.name);
    const mRankAmong: Record<string, number> = {};
    evData.merged.forEach((m) => { mRankAmong[m.name] = m.mRank; });
    const ev = { rows: evData.rows, merged: evData.merged, total: evData.total, survivors, order, mRankAmong };

    // —— 最终表现表：入选者按终极名次在前，其余按组会表现在后（淡化）——
    const survSet = new Set(ev.survivors.map((s) => s.name));
    const finalByName = {}; ev.merged.forEach((m) => { finalByName[m.name] = m.finalRank; });
    const topRows = [
      ...ev.merged.map((m) => ({ ...rowByName[m.name], finalRank: m.finalRank, mRank: m.mRank, pRank: m.pRank, inSurv: true })),
      ...ev.rows.filter((r) => !survSet.has(r.name)).map((r) => ({ ...r, finalRank: null, mRank: null, pRank: null, inSurv: false })),
    ];

    const onDrop = (target) => {
      if (drag == null || drag === target) { setDrag(null); return; }
      const newOrder = ev.order.slice();
      const [moved] = newOrder.splice(drag, 1);
      newOrder.splice(target, 0, moved);
      setProgressOrder(newOrder);
      setDrag(null);
    };

    const latest = excellence && excellence.published ? excellence : null;
    const pubN = Math.max(1, Math.min(pubCount | 0, ev.merged.length));
    const pubPreview = ev.merged.slice(0, pubN);
    const doPublish = () => {
      publishExc.mutate(pubN);
      setPubOpen(false);
      setJustPublished(true);
      toast("已发布 · 优秀名单前 " + pubN + " 名");
      setTimeout(() => setJustPublished(false), 2600);
    };

    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "16px 28px 20px", boxSizing: "border-box", gap: 12, maxWidth: 1200, margin: "0 auto", minHeight: 0 }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <h2 style={{ fontSize: 19, fontWeight: 600, color: "var(--text-strong)" }}>表现统计</h2>
            <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{excellence?.period} · 区间内 {ev.total} 次组会 · {ev.rows.length} 名成员</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <RangeControl range={range}
              onPreset={(k) => setEvalRange({ preset: k, from: RANGE_PRESETS[k].from, to: RANGE_PRESETS[k].to })}
              onCustom={() => setEvalRange({ preset: "custom" })}
              onFrom={(v) => setEvalRange({ from: v, preset: "custom" })}
              onTo={(v) => setEvalRange({ to: v, preset: "custom" })} />
            <Button size="sm" variant="ghost" iconLeft={I("download")}>导出</Button>
            <Button size="sm" variant="primary" iconLeft={I("award")} onClick={() => { setPubCount(latest ? latest.count : 5); setPubOpen(true); }} disabled={ev.merged.length === 0}>发布优秀</Button>
          </div>
        </div>

        {/* 优秀发布后的名单在「表现记录」标签页集中呈现，此处不再重复显示。 */}

        {/* ── 最上方：最终表现（① 汇总权重 + 终极排名/组会表现明细）── */}
        <Panel title="最终表现" sub="终极排名" scroll={false}
          right={<Button size="sm" variant="ghost" onClick={() => setEvalWeights({ attitude: 0.25, polish: 0.25, attendance: 0.25, discussion: 0.25 })}>等权</Button>}
          style={{ flex: 1, minHeight: 200 }}>
          <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
            {/* ① 汇总权重 */}
            <div style={{ flexShrink: 0, background: "var(--surface-sunken)", borderBottom: "1px solid var(--border-subtle)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px 0" }}>
                <span style={{ width: 18, height: 18, flexShrink: 0, borderRadius: "var(--radius-sm)", background: "var(--accent-soft)", color: "var(--accent-text)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-serif)", fontSize: 11, fontWeight: 600 }}>1</span>
                <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--text-faint)" }}>汇总权重</span>
                <span style={{ fontSize: 11, color: "var(--text-faint)" }}>加权得组会表现分</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px 22px", padding: "8px 16px 10px" }}>
                {L1.map((m) => <WeightChip key={m.key} label={m.label} color={m.color} value={w[m.wk]} onChange={(v) => setEvalWeights({ [m.wk]: v })} />)}
              </div>
            </div>
            {/* 表头 */}
            <div style={{ display: "grid", gridTemplateColumns: TABLE_COLS, gap: 8, padding: "6px 16px", borderBottom: "1px solid var(--border-subtle)", alignItems: "center", flexShrink: 0 }}>
              <span style={{ ...hCell, color: "var(--text-strong)" }}>终极名次</span>
              <span style={hCell}>成员</span>
              {L1.map((m) => (
                <span key={m.key} style={{ ...hCell, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: m.color, flexShrink: 0 }} />{m.short}
                </span>
              ))}
              <span style={{ ...hCell, textAlign: "right" }}>组会表现</span>
              <span style={{ ...hCell, textAlign: "center" }} title="组会表现在入选者中的名次">组会#</span>
              <span style={{ ...hCell, textAlign: "center" }} title="进展表现 rerank 名次">进展#</span>
            </div>
            {/* 表体（滚动）*/}
            <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
              {topRows.map((r, i) => {
                const me = r.name === "苏沐";
                const top3 = r.inSurv && r.finalRank <= 3;
                const medal = ["var(--amber-500)", "var(--slate-400)", "var(--terracotta-400)"][r.finalRank - 1];
                return (
                  <div key={r.name} style={{ display: "grid", gridTemplateColumns: TABLE_COLS, gap: 8, padding: "4px 16px", alignItems: "center", borderBottom: i < topRows.length - 1 ? "1px solid var(--border-subtle)" : "none", background: me ? "var(--accent-soft)" : r.inSurv ? "transparent" : "var(--surface-sunken)", opacity: r.inSurv ? 1 : 0.55 }}>
                    {/* 终极名次 */}
                    {r.inSurv ? (
                      <span style={{ width: 22, height: 22, flexShrink: 0, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-serif)", fontSize: 12.5, fontWeight: 700, color: top3 ? "#fff" : "var(--text-muted)", background: top3 ? medal : "var(--surface-hover)", fontVariantNumeric: "tabular-nums" }}>{r.finalRank}</span>
                    ) : (
                      <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>未入选</span>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                      <Avatar name={r.name} size="xs" />
                      <span style={{ fontSize: 12.5, fontWeight: me ? 600 : 500, color: "var(--text-strong)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
                    </div>
                    {L1.map((m) => (
                      <div key={m.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <MiniBar pct={r[m.nk]} color={m.color} />
                        <span className="cibol-mono" style={{ fontSize: 11, color: "var(--text-body)", width: 28, flexShrink: 0 }}>{m.raw(r)}</span>
                      </div>
                    ))}
                    <span className="cibol-mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{r.meeting.toFixed(1)}</span>
                    <span className="cibol-mono" style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>{r.inSurv ? "#" + r.mRank : "—"}</span>
                    <span className="cibol-mono" style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>{r.inSurv ? "#" + r.pRank : "—"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Panel>

        {/* ── 底部两栏：② 过滤下限 + ③ 进展表现 ── */}
        <div style={{ display: "grid", gridTemplateColumns: "0.85fr 1fr", gap: 12, height: 256, flexShrink: 0 }}>
          {/* ② 过滤下限 */}
          <Panel step="2" title="过滤下限" sub="筛出入选者"
            right={<div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 11px", background: "var(--accent-soft)", borderRadius: "var(--radius-pill)", whiteSpace: "nowrap", flexShrink: 0 }}>
              <span style={{ width: 13, height: 13, display: "inline-flex", color: "var(--accent-text)" }}>{I("users-round", { size: 13 })}</span>
              <span style={{ fontSize: 12, color: "var(--accent-text)" }}>入选 <b className="cibol-mono">{ev.survivors.length}</b> 人</span>
            </div>}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "14px 16px" }}>
              <FilterField label="报告态度" color={L1[0].color} value={f.attitudeMin} suffix="分" max={5} step={0.5} onChange={(v) => setEvalFilters({ attitudeMin: v })} />
              <FilterField label="制作精良度" color={L1[1].color} value={f.polishMin} suffix="分" max={5} step={0.5} onChange={(v) => setEvalFilters({ polishMin: v })} />
              <FilterField label="出勤率" color={L1[2].color} value={f.attMin} suffix="%" max={100} step={5} onChange={(v) => setEvalFilters({ attMin: v })} />
              <FilterField label="讨论参与" color={L1[3].color} value={f.discMin} suffix="次" onChange={(v) => setEvalFilters({ discMin: v })} />
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 2, paddingTop: 11, borderTop: "1px dashed var(--border-subtle)", fontSize: 11.5, color: "var(--text-faint)" }}>
                <span style={{ width: 14, height: 14, display: "inline-flex" }}>{I("info", { size: 14 })}</span>
                <span>达标者进入进展排序</span>
              </div>
            </div>
          </Panel>

          {/* ③ 进展表现 —— 管理员拖拽主观排序 */}
          <Panel step="3" title="进展表现" sub="拖拽调整名次"
            right={progressOrder ? <Button size="sm" variant="ghost" iconLeft={I("rotate-ccw")} onClick={() => resetProgressOrder()}>重置</Button> : null}>
            <div style={{ padding: 8 }}>
              {ev.order.length === 0 && (
                <div style={{ padding: "28px 18px", textAlign: "center", fontSize: 12.5, color: "var(--text-faint)" }}>当前过滤条件下无人入选，请放宽下限。</div>
              )}
              {ev.order.map((name, i) => {
                const row = ev.survivors.find((s) => s.name === name);
                const me = name === "苏沐";
                const dragging = drag === i;
                return (
                  <div key={name} draggable
                    onDragStart={() => setDrag(i)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => onDrop(i)}
                    onDragEnd={() => setDrag(null)}
                    style={{
                      display: "grid", gridTemplateColumns: "26px 1fr auto auto", gap: 10, alignItems: "center",
                      padding: "8px 10px", marginBottom: 4, borderRadius: "var(--radius-md)", cursor: "grab",
                      background: dragging ? "var(--accent-soft)" : me ? "var(--accent-soft)" : "var(--surface)",
                      border: `1px solid ${dragging ? "var(--accent)" : "var(--border-subtle)"}`,
                      opacity: dragging ? 0.5 : 1, transition: "border-color var(--dur-fast), background var(--dur-fast)",
                    }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                      <span style={{ width: 13, height: 13, display: "inline-flex", color: "var(--text-faint)" }}>{I("grip-vertical", { size: 13 })}</span>
                      <span style={{ fontFamily: "var(--font-serif)", fontSize: 13, fontWeight: 600, color: "var(--accent-text)", fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <Avatar name={name} size="xs" />
                      <span style={{ fontSize: 13, fontWeight: me ? 600 : 500, color: "var(--text-strong)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
                    </div>
                    <span style={{ fontSize: 11, color: "var(--text-faint)", whiteSpace: "nowrap" }}>组会 <b className="cibol-mono" style={{ color: "var(--text-muted)" }}>#{ev.mRankAmong[name]}</b></span>
                    <span className="cibol-mono" style={{ fontSize: 12, color: "var(--text-muted)", width: 36, textAlign: "right" }}>{row ? row.meeting.toFixed(1) : ""}</span>
                  </div>
                );
              })}
              {ev.order.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 7, margin: "8px 2px 2px", fontSize: 11.5, color: "var(--text-faint)" }}>
                  <span style={{ width: 14, height: 14, display: "inline-flex" }}>{I("info", { size: 14 })}</span>
                  <span>拖拽排序决定进展名次；进展名次参与终极合并。</span>
                </div>
              )}
            </div>
          </Panel>
        </div>

        {/* 发布优秀 — filter 几人 + 预览 */}
        <Dialog open={pubOpen} onClose={() => setPubOpen(false)}
          title="发布优秀评级" subtitle={`${range.from} → ${range.to} · 取终极排名前 N 名`}
          icon={I("award")} tone="warning" width={460}
          footer={<>
            <Button variant="ghost" onClick={() => setPubOpen(false)}>取消</Button>
            <Button variant="primary" iconLeft={I("award")} onClick={doPublish}>发布前 {pubN} 名</Button>
          </>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* 发布几人 filter */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "12px 14px", background: "var(--surface-sunken)", borderRadius: "var(--radius-md)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)" }}>发布人数</span>
                <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>从终极排名第 1 名起取前 N 名</span>
              </div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <button onClick={() => setPubCount(Math.max(1, pubN - 1))} disabled={pubN <= 1} aria-label="减"
                  style={{ width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border-default)", background: "var(--surface)", borderRadius: "var(--radius-sm)", cursor: pubN <= 1 ? "not-allowed" : "pointer", color: "var(--text-muted)", opacity: pubN <= 1 ? 0.5 : 1 }}>{I("minus", { size: 15 })}</button>
                <span className="cibol-mono" style={{ minWidth: 28, textAlign: "center", fontSize: 18, fontWeight: 700, color: "var(--text-strong)", fontVariantNumeric: "tabular-nums" }}>{pubN}</span>
                <button onClick={() => setPubCount(Math.min(ev.merged.length, pubN + 1))} disabled={pubN >= ev.merged.length} aria-label="加"
                  style={{ width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border-default)", background: "var(--surface)", borderRadius: "var(--radius-sm)", cursor: pubN >= ev.merged.length ? "not-allowed" : "pointer", color: "var(--text-muted)", opacity: pubN >= ev.merged.length ? 0.5 : 1 }}>{I("plus", { size: 15 })}</button>
                <span style={{ fontSize: 12.5, color: "var(--text-faint)", marginLeft: 2 }}>/ {ev.merged.length} 入选</span>
              </div>
            </div>
            {/* 预览将发布名单 */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--text-faint)", marginBottom: 8 }}>将获优秀</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 200, overflowY: "auto" }}>
                {pubPreview.map((m, i) => (
                  <div key={m.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", borderRadius: "var(--radius-md)", background: i < 3 ? "var(--amber-soft, var(--accent-soft))" : "var(--surface-sunken)" }}>
                    <span style={{ width: 22, height: 22, flexShrink: 0, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-serif)", fontSize: 12, fontWeight: 700, color: i < 3 ? "#fff" : "var(--text-muted)", background: i < 3 ? ["var(--amber-500)", "var(--slate-400)", "var(--terracotta-400)"][i] : "var(--surface-hover)", fontVariantNumeric: "tabular-nums" }}>{m.finalRank}</span>
                    <Avatar name={m.name} size="xs" />
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-strong)", flex: 1 }}>{m.name}</span>
                    <span className="cibol-mono" style={{ fontSize: 12, color: "var(--text-faint)" }}>合并分 {m.score.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Dialog>
      </div>
    );
  }

  export { AdminStats };
