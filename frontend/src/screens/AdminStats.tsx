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
import { useMe } from "../auth";
import { useIsMobile } from "../lib/useIsMobile";

// AdminStats — 表现统计: 本评选期的排名工作台。
//   三个板块（管理员的操作流程）:
//     最上方「最终表现」— 调整①汇总权重 → 实时呈现终极排名与组会表现明细（结果落点）
//     左下「②过滤下限」— 四项 Layer-1 指标各自的下限，筛出入选者
//     右下「③进展表现」— 管理员对入选者拖拽主观排序，进展名次由顺序得出
//   计算: 组会表现 = 四项归一分的加权平均；终极排名 = 组会表现名次 与 进展名次 的 Borda 平均合并。
//   每个面板固定高度、内部滚动，整页一屏可览。
  const { Card, Button, Avatar, Badge, Dialog, ScreenState } = NS;

  const L1 = [
    { key: "attitude", nk: "nAttitude", wk: "attitude", label: "报告态度", short: "报告态度", color: "var(--terracotta-500)", raw: (r) => r.attitude.toFixed(1) },
    { key: "polish", nk: "nPolish", wk: "polish", label: "制作精良度", short: "制作精良", color: "var(--amber-500)", raw: (r) => r.polish.toFixed(1) },
    { key: "logic", nk: "nLogic", wk: "logic", label: "逻辑清晰度", short: "逻辑清晰", color: "var(--terracotta-400)", raw: (r) => (r.logic ?? 0).toFixed(1) },
    { key: "attRate", nk: "nAtt", wk: "attendance", label: "出勤率", short: "出勤率", color: "var(--sage-500)", raw: (r) => r.attRate + "%" },
    { key: "discuss", nk: "nDisc", wk: "discussion", label: "讨论参与", short: "讨论参与", color: "var(--slate-500)", raw: (r) => String(r.discuss) },
  ];

  const hCell = { fontSize: 10.5, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-faint)" };
  const TABLE_COLS = "54px 102px repeat(5, 1fr) 64px 50px 50px";

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
    recent: { label: "近一个月" },
    term: { label: "本学期" },
  };

  // 预设区间按“今天”动态推导，避免写死过期日期。
  const fmtISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  function presetRange(k: string) {
    const now = new Date();
    const to = fmtISO(now);
    if (k === "recent") { const f = new Date(now); f.setDate(f.getDate() - 30); return { from: fmtISO(f), to }; }
    // 本学期起始：春季学期(2–7 月)≈2/24；秋季学期(8 月–次年 1 月)≈9/1
    const m = now.getMonth();
    const start = (m >= 1 && m <= 6)
      ? new Date(now.getFullYear(), 1, 24)
      : new Date(m === 0 ? now.getFullYear() - 1 : now.getFullYear(), 8, 1);
    return { from: fmtISO(start), to };
  }

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
    const isMobile = useIsMobile();
    const evQ = useEvalCompute();
    const cfgQ = useEvalConfig();
    const { data: evData } = evQ;
    const { data: meUser } = useMe();
    const { data: cfg } = cfgQ;
    const { data: excellence } = useExcellence();
    const updateConfig = useUpdateEvalConfig();
    const publishExc = usePublishExcellence();
    const [drag, setDrag] = React.useState(null);
    const [pubOpen, setPubOpen] = React.useState(false);
    const [pubCount, setPubCount] = React.useState(5);
    const [justPublished, setJustPublished] = React.useState(false);

    if (evQ.isLoading || cfgQ.isLoading) return <ScreenState loading />;
    if (evQ.isError || cfgQ.isError) return <ScreenState error onRetry={() => { evQ.refetch(); cfgQ.refetch(); }} />;
    if (!evData || !cfg) return <ScreenState error onRetry={() => { evQ.refetch(); cfgQ.refetch(); }} />;

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
    const tableCols = isMobile ? "1fr" : TABLE_COLS;

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
      if (publishExc.isPending) return;
      publishExc.mutate(pubN, {
        onSuccess: () => {
          setPubOpen(false);
          setJustPublished(true);
          toast("已发布 · 优秀名单前 " + pubN + " 名");
          setTimeout(() => setJustPublished(false), 2600);
        },
        onError: () => toast("发布失败，请重试", { tone: "error" }),
      });
    };

    // 导出当前区间表现排名为 CSV（与表格同源，BOM 头保证 Excel 中文不乱码）。
    const exportCSV = () => {
      const header = ["终极名次", "成员", "报告态度", "制作精良", "逻辑清晰", "出勤率", "讨论参与", "组会名次", "是否入选"];
      const lines = [header.join(",")];
      topRows.forEach((r: any) => {
        lines.push([
          r.finalRank ?? "—", r.name,
          (r.attitude ?? 0).toFixed(1), (r.polish ?? 0).toFixed(1), (r.logic ?? 0).toFixed(1),
          (r.attRate ?? 0) + "%", r.discuss ?? 0,
          r.inSurv ? "#" + r.mRank : "—", r.inSurv ? "是" : "否",
        ].join(","));
      });
      const csv = "﻿" + lines.join("\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
      const a = document.createElement("a");
      a.href = url; a.download = `表现统计_${range.from}_${range.to}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast("已导出 CSV");
    };

    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: isMobile ? "16px 14px 20px" : "16px 28px 20px", boxSizing: "border-box", gap: 12, maxWidth: 1200, margin: "0 auto", minHeight: 0 }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <h2 style={{ fontSize: 19, fontWeight: 600, color: "var(--text-strong)" }}>表现统计</h2>
            <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{excellence?.period} · 区间内 {ev.total} 次组会 · {ev.rows.length} 名成员</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <RangeControl range={range}
              onPreset={(k) => { const r = presetRange(k); setEvalRange({ preset: k, from: r.from, to: r.to }); }}
              onCustom={() => setEvalRange({ preset: "custom" })}
              onFrom={(v) => setEvalRange({ from: v, preset: "custom" })}
              onTo={(v) => setEvalRange({ to: v, preset: "custom" })} />
            <Button size="sm" variant="ghost" iconLeft={I("download")} onClick={exportCSV} disabled={topRows.length === 0}>导出</Button>
            <Button size="sm" variant="primary" iconLeft={I("award")} onClick={() => { setPubCount(latest ? latest.count : 5); setPubOpen(true); }} disabled={ev.merged.length === 0}>发布优秀</Button>
          </div>
        </div>

        {/* 优秀发布后的名单在「表现记录」标签页集中呈现，此处不再重复显示。 */}

        {/* ── 主体：左右两区。左区[ (step1上/step2下) | step3整列 ]，右区汇总排序 ── */}
        <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
          {/* 左区 */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, minHeight: 0 }}>
            {/* 左-左列：step1 组会权重（上） + step2 评优过滤（下） */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
              {/* step1 组会权重 */}
              <Panel step="1" title="组会权重" sub="加权得组会表现分"
                right={<Button size="sm" variant="ghost" onClick={() => setEvalWeights({ attitude: 0.2, polish: 0.2, logic: 0.2, attendance: 0.2, discussion: 0.2 })}>等权</Button>}
                style={{ height: "auto", flexShrink: 0 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "12px 16px" }}>
                  {L1.map((m) => <WeightChip key={m.key} label={m.label} color={m.color} value={w[m.wk]} onChange={(v) => setEvalWeights({ [m.wk]: v })} />)}
                </div>
              </Panel>
              {/* step2 评优过滤 */}
              <Panel step="2" title="评优过滤" sub="筛出入选者"
                style={{ flex: 1, minHeight: 0 }}
                right={<div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 11px", background: "var(--accent-soft)", borderRadius: "var(--radius-pill)", whiteSpace: "nowrap", flexShrink: 0 }}>
                  <span style={{ width: 13, height: 13, display: "inline-flex", color: "var(--accent-text)" }}>{I("users-round", { size: 13 })}</span>
                  <span style={{ fontSize: 12, color: "var(--accent-text)" }}>入选 <b className="cibol-mono">{ev.survivors.length}</b> 人</span>
                </div>}>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "14px 16px" }}>
                  <FilterField label="报告态度" color={L1[0].color} value={f.attitudeMin} suffix="分" max={5} step={0.5} onChange={(v) => setEvalFilters({ attitudeMin: v })} />
                  <FilterField label="制作精良度" color={L1[1].color} value={f.polishMin} suffix="分" max={5} step={0.5} onChange={(v) => setEvalFilters({ polishMin: v })} />
                  <FilterField label="逻辑清晰度" color={L1[2].color} value={f.logicMin ?? 0} suffix="分" max={5} step={0.5} onChange={(v) => setEvalFilters({ logicMin: v })} />
                  <FilterField label="出勤率" color={L1[3].color} value={f.attMin} suffix="%" max={100} step={5} onChange={(v) => setEvalFilters({ attMin: v })} />
                  <FilterField label="讨论参与" color={L1[4].color} value={f.discMin} suffix="次" onChange={(v) => setEvalFilters({ discMin: v })} />
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 2, paddingTop: 11, borderTop: "1px dashed var(--border-subtle)", fontSize: 11.5, color: "var(--text-faint)" }}>
                    <span style={{ width: 14, height: 14, display: "inline-flex" }}>{I("info", { size: 14 })}</span>
                    <span>达标者进入进展排序</span>
                  </div>
                </div>
              </Panel>
            </div>

            {/* 左-右列：step3 进展排序（整列）—— 管理员拖拽主观排序 */}
            <Panel step="3" title="进展排序" sub="拖拽调整名次"
              right={progressOrder ? <Button size="sm" variant="ghost" iconLeft={I("rotate-ccw")} onClick={() => resetProgressOrder()}>重置</Button> : null}>
            <div style={{ padding: 8 }}>
              {ev.order.length === 0 && (
                <div style={{ padding: "28px 18px", textAlign: "center", fontSize: 12.5, color: "var(--text-faint)" }}>当前过滤条件下无人入选，请放宽下限。</div>
              )}
              {ev.order.map((name, i) => {
                const row = ev.survivors.find((s) => s.name === name);
                const me = !!meUser && name === meUser.name;
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

          {/* 右区：汇总评分排序（终极排名 + 组会表现各维明细）*/}
          <Panel title="汇总评分排序" sub="终极排名" scroll={false} style={{ minHeight: 0 }}>
            <div style={{ height: "100%", overflow: "auto" }}>
              <div style={{ minWidth: isMobile ? "auto" : 540 }}>
                {/* 表头（sticky）*/}
                <div style={{ display: isMobile ? "none" : "grid", gridTemplateColumns: tableCols, gap: 8, padding: "8px 16px", borderBottom: "1px solid var(--border-subtle)", alignItems: "center", position: "sticky", top: 0, background: "var(--surface)", zIndex: 1 }}>
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
                {/* 表体 */}
                {topRows.map((r, i) => {
                  const me = !!meUser && r.name === meUser.name;
                  const top3 = r.inSurv && r.finalRank <= 3;
                  const medal = ["var(--amber-500)", "var(--slate-400)", "var(--terracotta-400)"][r.finalRank - 1];
                  return (
                    <div key={r.name} style={{ display: "grid", gridTemplateColumns: tableCols, gap: 8, padding: isMobile ? "8px 14px" : "4px 16px", alignItems: "center", borderBottom: i < topRows.length - 1 ? "1px solid var(--border-subtle)" : "none", background: me ? "var(--accent-soft)" : r.inSurv ? "transparent" : "var(--surface-sunken)", opacity: r.inSurv ? 1 : 0.55 }}>
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
