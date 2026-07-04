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
  useConfig,
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

  function MiniBar({ pct, color, w = 36 }: any) {
    return (
      <div style={{ width: w, height: 5, background: "var(--surface-hover)", borderRadius: 999, overflow: "hidden", flexShrink: 0 }}>
        <div style={{ width: `${Math.max(3, Math.min(100, pct))}%`, height: "100%", background: color, borderRadius: 999 }} />
      </div>
    );
  }

  // 面板外壳：标题条 + 填充父容器、可选内部滚动的主体
  function Panel({ step, title, sub, right, children, scroll = true, style, collapsible = false, defaultOpen = true, open: openProp, onToggle }: any) {
    const [openState, setOpenState] = React.useState(defaultOpen);
    const open = openProp !== undefined ? openProp : openState;
    const toggle = () => (onToggle ? onToggle() : setOpenState((o: boolean) => !o));
    const collapsed = collapsible && !open;
    // 收起时退掉撑高（flex:1 / height:100%），只保留标题栏
    const rootStyle = collapsed ? { ...style, height: "auto", flex: "none", minHeight: 0 } : style;
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%", background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-xs)", overflow: "hidden", ...rootStyle }}>
        <div onClick={collapsible ? toggle : undefined}
          style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 14px", borderBottom: collapsed ? "none" : "1px solid var(--border-subtle)", flexShrink: 0, cursor: collapsible ? "pointer" : "default", userSelect: "none" }}>
          {step != null && <span style={{ width: 20, height: 20, flexShrink: 0, borderRadius: "var(--radius-sm)", background: "var(--accent-soft)", color: "var(--accent-text)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-serif)", fontSize: 12, fontWeight: 600 }}>{step}</span>}
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>{title}</span>
          {sub && <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{sub}</span>}
          {right && <div style={{ marginLeft: "auto" }} onClick={(e) => e.stopPropagation()}>{right}</div>}
          {collapsible && <span style={{ marginLeft: right ? 8 : "auto", display: "inline-flex", color: "var(--text-faint)", flexShrink: 0 }}>{I(open ? "chevron-up" : "chevron-down", { size: 17 })}</span>}
        </div>
        {!collapsed && <div style={{ flex: 1, minHeight: 0, overflowY: scroll ? "auto" : "hidden" }}>{children}</div>}
      </div>
    );
  }

  function WeightChip({ label, color, value, onChange }: any) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 11.5, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{label}</span>
        <input type="range" aria-label={label + '权重'} min="0" max="100" value={Math.round(value * 100)} onChange={(e) => onChange(+e.target.value / 100)}
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
          <input type="number" aria-label={label + '下限'} min={min} max={max} step={step} value={value} onChange={(e) => onChange(Math.max(min, Math.min(max, +e.target.value || 0)))}
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

  const fmtISO = (d: Date) => [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
  // 预设区间：优先读后端 cfg.semester.start；无数据时按月份动态推算兜底（不写死具体日期）。
  function presetRange(k: string, semesterStart?: string) {
    const now = new Date();
    const to = fmtISO(now);
    if (k === "recent") { const f = new Date(now); f.setDate(f.getDate() - 30); return { from: fmtISO(f), to }; }
    if (semesterStart) return { from: semesterStart, to };
    const m = now.getMonth(), yr = now.getFullYear();
    const start = (m >= 1 && m <= 6)
      ? new Date(yr, 1, 24)
      : new Date(m === 0 ? yr - 1 : yr, 8, 1);
    return { from: fmtISO(start), to };
  }

  function RangeControl({ range, onPreset, onFrom, onTo, onCustom }: any) {
    const ds = { height: 30, padding: "0 9px", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", background: "var(--surface)", color: "var(--text-strong)", fontFamily: "var(--font-mono)", fontSize: 12.5, colorScheme: "light dark" };
    const isCustom = !RANGE_PRESETS[range.preset];
    const segBtn = (on, label, onClick) => (
      <button type="button" key={label} onClick={onClick}
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
            <input type="date" aria-label="开始日期" value={range.from} onChange={(e) => onFrom(e.target.value)} style={ds} />
            <span style={{ color: "var(--text-faint)", fontSize: 12.5 }}>至</span>
            <input type="date" aria-label="结束日期" value={range.to} onChange={(e) => onTo(e.target.value)} style={ds} />
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
    const { data: semCfg } = useConfig(); // 学期起止日期，用于"本学期"预设区间
    const { data: excellence } = useExcellence();
    const updateConfig = useUpdateEvalConfig();
    const publishExc = usePublishExcellence();
    const [dragItem, setDragItem] = React.useState<string | null>(null);   // 正在拖拽的成员名
    const [liveOrder, setLiveOrder] = React.useState<string[] | null>(null); // 拖拽中的临时序列（实时挤压预览）
    // 组会权重 + 评选过滤收进「设置」弹窗（本次评选标准）
    const [settingsOpen, setSettingsOpen] = React.useState(false);
    // 右侧汇总表：默认只显示排名，点「明细」在后面展开各维得分
    const [detailOpen, setDetailOpen] = React.useState(false);
    const sumCols = isMobile ? "1fr" : (detailOpen ? "48px 1fr 52px 52px repeat(5, 1fr) 64px" : "48px 1fr 52px 52px");
    const [pubOpen, setPubOpen] = React.useState(false);
    // #7 手动确认名单：pubNames = 勾选的姓名集合（可剔除靠前、补选靠后）；pubNote = 调整原因。
    const [pubNames, setPubNames] = React.useState<Set<string>>(new Set());
    const [pubNote, setPubNote] = React.useState("");
    const [periodLocal, setPeriodLocal] = React.useState<string | null>(null);
    const periodTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    React.useEffect(() => {
      return () => { clearTimeout(periodTimerRef.current ?? undefined); };
    }, []);

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
      period: (cfg as any).period ?? "",
      ...patch,
    });
    const setEvalWeights = (patch: any) => updateConfig.mutate(nextConfig({ weights: { ...cfg.weights, ...patch } }));
    const setEvalFilters = (patch: any) => updateConfig.mutate(nextConfig({ filters: { ...cfg.filters, ...patch } }));
    const awardExcellence: number = (cfg as any).award_excellence ?? 1000;
    const awardAttendance: number = (cfg as any).award_attendance ?? 100;
    const setEvalRange = (patch: any) => updateConfig.mutate(nextConfig({ range: { ...cfg.range, ...patch } }));
    const semesterStart: string | undefined = (semCfg as any)?.semester?.start;
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
    const topRows = [
      ...ev.merged.map((m) => ({ ...rowByName[m.name], finalRank: m.finalRank, mRank: m.mRank, pRank: m.pRank, inSurv: true })),
      ...ev.rows.filter((r) => !survSet.has(r.name)).map((r) => ({ ...r, finalRank: null, mRank: null, pRank: null, inSurv: false })),
    ];

    // 拖拽中显示临时序列（实时挤压），未拖拽时用服务端计算的 order
    const displayOrder = liveOrder ?? ev.order;
    const onDragStartItem = (name: string) => { setDragItem(name); setLiveOrder(ev.order.slice()); };
    // 拖到第 j 行：把被拖项移动到 j，其余实时顺移让位
    const onDragEnterItem = (j: number) => {
      setLiveOrder((cur) => {
        if (!cur || dragItem == null) return cur;
        const from = cur.indexOf(dragItem);
        if (from === -1 || from === j) return cur;
        const arr = cur.slice();
        const [m] = arr.splice(from, 1);
        arr.splice(j, 0, m);
        return arr;
      });
    };
    const endDrag = () => { setDragItem(null); setLiveOrder(null); };
    const onDropItem = () => {
      const orderToSave = liveOrder;
      const itemToSave = dragItem;
      setDragItem(null);
      setLiveOrder(null);
      if (orderToSave && itemToSave != null) {
        updateConfig.mutate(nextConfig({ progress_order: orderToSave }), {
          onError: () => toast("进展排序保存失败", { tone: "error" }),
        });
      }
    };

    const latest = excellence && excellence.published ? excellence : null;
    // 勾选名单按 merged 终极排名顺序输出（排名仅决定展示顺序，不再是硬性入选约束）。
    const orderedPub = ev.merged.filter((m) => pubNames.has(m.name)).map((m) => m.name);
    const togglePub = (name: string) => setPubNames((s) => { const n = new Set(s); n.has(name) ? n.delete(name) : n.add(name); return n; });
    const openPublish = () => {
      const n = latest ? latest.count : Math.min(5, ev.merged.length);
      const init = latest?.names?.length ? latest.names : ev.merged.slice(0, n).map((m) => m.name);
      setPubNames(new Set(init));
      setPubNote(latest?.note || "");
      setPubOpen(true);
    };
    const doPublish = () => {
      if (publishExc.isPending) return;
      if (orderedPub.length === 0) { toast("请至少勾选 1 人", { tone: "error" }); return; }
      publishExc.mutate({ count: orderedPub.length, names: orderedPub, note: pubNote }, {
        onSuccess: () => { setPubOpen(false); toast("已发布 · 优秀名单 " + orderedPub.length + " 人"); },
        onError: (e: any) => toast("发布失败：" + (e?.detail || e?.message || "请重试"), { tone: "error" }),
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
            <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{excellence?.period ? `${excellence.period} · ` : ""}区间内 {ev.total} 次组会 · {ev.rows.length} 名成员</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <RangeControl range={range}
              onPreset={(k) => { const r = presetRange(k, semesterStart); setEvalRange({ preset: k, from: r.from, to: r.to }); }}
              onCustom={() => setEvalRange({ preset: "custom" })}
              onFrom={(v) => setEvalRange({ from: v, preset: "custom" })}
              onTo={(v) => setEvalRange({ to: v, preset: "custom" })} />
            <Button size="sm" variant="secondary" iconLeft={I("settings-2")} onClick={() => setSettingsOpen(true)}>设置标准</Button>
            <Button size="sm" variant="ghost" iconLeft={I("download")} onClick={exportCSV} disabled={topRows.length === 0}>导出</Button>
            <Button size="sm" variant="primary" iconLeft={I("award")} onClick={openPublish} disabled={ev.merged.length === 0}>发布优秀</Button>
          </div>
        </div>

        {/* 优秀发布后的名单在「表现记录」标签页集中呈现，此处不再重复显示。 */}

        {/* ── 主体：左 进展排序 · 右 总体排名 ── */}
        <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
          {/* 左：进展排序 —— 管理员拖拽主观排序 */}
          <Panel title="进展排序" sub="拖拽调整名次"
            right={progressOrder ? <Button size="sm" variant="ghost" iconLeft={I("rotate-ccw")} onClick={() => resetProgressOrder()}>重置</Button> : null}>
            <div style={{ padding: 8 }}>
              {displayOrder.length === 0 && (
                <div style={{ padding: "28px 18px", textAlign: "center", fontSize: 12.5, color: "var(--text-faint)" }}>当前过滤条件下无人入选，请放宽下限。</div>
              )}
              {displayOrder.map((name, i) => {
                const row = ev.survivors.find((s) => s.name === name);
                const me = !!meUser && name === meUser.name;
                const dragging = dragItem === name;
                return (
                  <div key={name} draggable
                    onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStartItem(name); }}
                    onDragEnter={() => onDragEnterItem(i)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); onDropItem(); }}
                    onDragEnd={endDrag}
                    style={{
                      display: "grid", gridTemplateColumns: "26px 1fr auto auto", gap: 10, alignItems: "center",
                      padding: "8px 10px", marginBottom: 4, borderRadius: "var(--radius-md)", cursor: "grab",
                      background: dragging ? "var(--accent-soft)" : me ? "var(--accent-soft)" : "var(--surface)",
                      border: `1px solid ${dragging ? "var(--accent)" : "var(--border-subtle)"}`,
                      boxShadow: dragging ? "var(--shadow-md)" : "none",
                      opacity: dragging ? 0.85 : 1, transition: "border-color var(--dur-fast), background var(--dur-fast), box-shadow var(--dur-fast)",
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
              {displayOrder.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 7, margin: "8px 2px 2px", fontSize: 11.5, color: "var(--text-faint)" }}>
                  <span style={{ width: 14, height: 14, display: "inline-flex" }}>{I("info", { size: 14 })}</span>
                  <span>拖拽排序决定进展名次；进展名次参与终极合并。</span>
                </div>
              )}
            </div>
          </Panel>

          {/* 右：总体排名。默认只显示排名，点「明细」在后面展开各维得分 */}
          <Panel title="总体排名" sub="终极排名" scroll={false} style={{ minHeight: 0 }}
            right={<Button size="sm" variant="ghost" iconLeft={I(detailOpen ? "chevron-left" : "list")} onClick={() => setDetailOpen((o) => !o)}>{detailOpen ? "收起明细" : "明细"}</Button>}>
            <div style={{ height: "100%", overflow: "auto" }}>
              <div style={{ minWidth: isMobile || !detailOpen ? "auto" : 540 }}>
                {/* 表头（sticky）*/}
                <div style={{ display: isMobile ? "none" : "grid", gridTemplateColumns: sumCols, gap: 8, padding: "8px 16px", borderBottom: "1px solid var(--border-subtle)", alignItems: "center", position: "sticky", top: 0, background: "var(--surface)", zIndex: 1 }}>
                  <span style={{ ...hCell, color: "var(--text-strong)" }} title="终极名次">总#</span>
                  <span style={hCell}>成员</span>
                  <span style={{ ...hCell, textAlign: "center" }} title="组会表现在入选者中的名次">组会#</span>
                  <span style={{ ...hCell, textAlign: "center" }} title="进展表现 rerank 名次">进展#</span>
                  {detailOpen && <>
                    {L1.map((m) => (
                      <span key={m.key} style={{ ...hCell, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: m.color, flexShrink: 0 }} />{m.short}
                      </span>
                    ))}
                    <span style={{ ...hCell, textAlign: "right" }}>组会表现</span>
                  </>}
                </div>
                {/* 表体 */}
                {topRows.map((r, i) => {
                  const me = !!meUser && r.name === meUser.name;
                  const top3 = r.inSurv && r.finalRank <= 3;
                  const medal = ["var(--amber-500)", "var(--slate-400)", "var(--terracotta-400)"][r.finalRank - 1];
                  return (
                    <div key={r.name} style={{ display: "grid", gridTemplateColumns: sumCols, gap: 8, padding: isMobile ? "8px 14px" : "5px 16px", alignItems: "center", borderBottom: i < topRows.length - 1 ? "1px solid var(--border-subtle)" : "none", background: me ? "var(--accent-soft)" : r.inSurv ? "transparent" : "var(--surface-sunken)", opacity: r.inSurv ? 1 : 0.55 }}>
                      {r.inSurv ? (
                        <span style={{ width: 22, height: 22, flexShrink: 0, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-serif)", fontSize: 12.5, fontWeight: 700, color: top3 ? "#fff" : "var(--text-muted)", background: top3 ? medal : "var(--surface-hover)", fontVariantNumeric: "tabular-nums" }}>{r.finalRank}</span>
                      ) : (
                        <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>未入选</span>
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                        <Avatar name={r.name} size="xs" />
                        <span style={{ fontSize: 12.5, fontWeight: me ? 600 : 500, color: "var(--text-strong)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
                      </div>
                      <span className="cibol-mono" style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>{r.inSurv ? "#" + r.mRank : "—"}</span>
                      <span className="cibol-mono" style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>{r.inSurv ? "#" + r.pRank : "—"}</span>
                      {detailOpen && <>
                        {L1.map((m) => (
                          <div key={m.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <MiniBar pct={r[m.nk]} color={m.color} />
                            <span className="cibol-mono" style={{ fontSize: 11, color: "var(--text-body)", width: 28, flexShrink: 0 }}>{m.raw(r)}</span>
                          </div>
                        ))}
                        <span className="cibol-mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{(r.meeting ?? 0).toFixed(1)}</span>
                      </>}
                    </div>
                  );
                })}
              </div>
            </div>
          </Panel>
        </div>

        {/* 设置本次评选标准：组会权重 + 评选过滤 */}
        <Dialog open={settingsOpen} onClose={() => { clearTimeout(periodTimerRef.current); setPeriodLocal(null); setSettingsOpen(false); }}
          title="本次评选标准" subtitle="组会权重与评选过滤 · 改动即时生效"
          icon={I("settings-2")} tone="accent" width={520}
          footer={<Button variant="primary" onClick={() => { clearTimeout(periodTimerRef.current); setPeriodLocal(null); setSettingsOpen(false); }}>完成</Button>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* 评选期名称 */}
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)", marginBottom: 6 }}>评选期名称</div>
              <input
                type="text"
                placeholder="如：2026 春季 · 第二评选期"
                value={periodLocal ?? ((cfg as any).period ?? "")}
                onChange={(e: any) => {
                  const v = e.target.value;
                  setPeriodLocal(v);
                  clearTimeout(periodTimerRef.current);
                  periodTimerRef.current = setTimeout(() => { updateConfig.mutate(nextConfig({ period: v })); setPeriodLocal(null); }, 500);
                }}
                style={{ width: "100%", boxSizing: "border-box", height: 34, padding: "0 10px", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", background: "var(--surface)", color: "var(--text-strong)", fontSize: 13.5, fontFamily: "var(--font-sans)", outline: "none" }}
              />
              <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>显示在表现统计及优秀名单中</div>
            </div>
            {/* 组会权重 */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)" }}>组会权重</span>
                <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>加权得组会表现分</span>
                <Button size="sm" variant="ghost" style={{ marginLeft: "auto" }} onClick={() => setEvalWeights({ attitude: 0.2, polish: 0.2, logic: 0.2, attendance: 0.2, discussion: 0.2 })}>等权</Button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {L1.map((m) => <WeightChip key={m.key} label={m.label} color={m.color} value={w[m.wk]} onChange={(v) => setEvalWeights({ [m.wk]: v })} />)}
              </div>
            </div>
            {/* 评选过滤 */}
            <div style={{ paddingTop: 16, borderTop: "1px solid var(--border-subtle)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)" }}>评选过滤</span>
                <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>筛出入选者</span>
                <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--accent-text)" }}>入选 <b className="cibol-mono">{ev.survivors.length}</b> 人</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <FilterField label="报告态度" color={L1[0].color} value={f.attitudeMin} suffix="分" max={5} step={0.5} onChange={(v) => setEvalFilters({ attitudeMin: v })} />
                <FilterField label="制作精良度" color={L1[1].color} value={f.polishMin} suffix="分" max={5} step={0.5} onChange={(v) => setEvalFilters({ polishMin: v })} />
                <FilterField label="逻辑清晰度" color={L1[2].color} value={f.logicMin ?? 0} suffix="分" max={5} step={0.5} onChange={(v) => setEvalFilters({ logicMin: v })} />
                <FilterField label="出勤率" color={L1[3].color} value={f.attMin} suffix="%" max={100} step={5} onChange={(v) => setEvalFilters({ attMin: v })} />
                <FilterField label="讨论参与" color={L1[4].color} value={f.discMin} suffix="次" onChange={(v) => setEvalFilters({ discMin: v })} />
              </div>
            </div>
            {/* 奖金设置 */}
            <div style={{ paddingTop: 16, borderTop: "1px solid var(--border-subtle)" }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)", marginBottom: 10 }}>奖金设置</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <FilterField label="全勤奖" color="var(--sage-500)" value={awardAttendance} suffix="元" min={0} step={50}
                  onChange={(v) => updateConfig.mutate(nextConfig({ award_attendance: v }))} />
                <FilterField label="优秀奖" color="var(--amber-500)" value={awardExcellence} suffix="元" min={0} step={100}
                  onChange={(v) => updateConfig.mutate(nextConfig({ award_excellence: v }))} />
              </div>
              <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 6 }}>发布时快照，修改不影响历史记录</div>
            </div>
          </div>
        </Dialog>

        {/* 发布优秀 — 手动确认名单（勾选/剔除/补选 + 原因），排名仅作参考（#7） */}
        <Dialog open={pubOpen} onClose={() => setPubOpen(false)}
          title="发布优秀评级" subtitle={`${range.from} → ${range.to} · 排名仅供参考，最终名单由你确认`}
          icon={I("award")} tone="warning" width={480}
          footer={<>
            <Button variant="ghost" onClick={() => setPubOpen(false)}>取消</Button>
            <Button variant="primary" iconLeft={I("award")} onClick={doPublish} disabled={orderedPub.length === 0 || publishExc.isPending}>发布 {orderedPub.length} 人</Button>
          </>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--text-faint)" }}>勾选获优秀成员 · 已选 {orderedPub.length}/{ev.merged.length}</span>
              <button type="button" onClick={() => setPubNames(new Set(ev.merged.slice(0, Math.min(5, ev.merged.length)).map((m) => m.name)))}
                style={{ fontSize: 12, color: "var(--accent-text)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>重置为前 5 名</button>
            </div>
            {/* 可勾选名单 —— 全部入选者，可剔除靠前 / 补选靠后 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 240, overflowY: "auto" }}>
              {ev.merged.map((m) => {
                const on = pubNames.has(m.name);
                return (
                  <button type="button" key={m.name} onClick={() => togglePub(m.name)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: "var(--radius-md)", border: "1px solid " + (on ? "var(--accent-soft-bd)" : "var(--border-subtle)"), background: on ? "var(--accent-soft)" : "var(--surface)", cursor: "pointer", textAlign: "left", width: "100%" }}>
                    <span style={{ width: 18, height: 18, flexShrink: 0, borderRadius: "var(--radius-sm)", border: "1.5px solid " + (on ? "var(--accent-text)" : "var(--border-default)"), background: on ? "var(--accent-text)" : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>{on ? I("check", { size: 12 }) : null}</span>
                    <span className="cibol-mono" style={{ width: 22, fontSize: 12, color: "var(--text-faint)", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>#{m.finalRank}</span>
                    <Avatar name={m.name} size="xs" />
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-strong)", flex: 1 }}>{m.name}</span>
                    <span className="cibol-mono" style={{ fontSize: 12, color: "var(--text-faint)" }}>合并分 {m.score.toFixed(1)}</span>
                  </button>
                );
              })}
            </div>
            {/* 调整原因 —— 手动增删名单时说明 */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--text-faint)", marginBottom: 6 }}>调整原因（可选）</div>
              <textarea value={pubNote} onChange={(e) => setPubNote(e.target.value)} rows={2} maxLength={255}
                placeholder="如：跳过第 2 名（长期缺席），补选第 6 名（进展突出）"
                style={{ width: "100%", boxSizing: "border-box", resize: "vertical", padding: "8px 10px", fontSize: 13, fontFamily: "var(--font-sans)", color: "var(--text-strong)", background: "var(--surface-sunken)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)" }} />
            </div>
          </div>
        </Dialog>
      </div>
    );
  }

  export { AdminStats };
