import React from "react";
import * as NS from "../ds";
import { I, Icon } from "../lib/icons";
import { toast } from "../store";
import { useEvalCompute, useBookingSettings, useUpdateBookingSettings, useSaveSchedule, useConfig, useSaveConfig, useMeetings } from "../api/hooks";
import { useIsMobile } from "../lib/useIsMobile";

// AdminMeetings — 组会管理: frequency-based auto-scheduler + manual ordering,
// per-presenter 调换/轮空 (read-first), topic assignment.
  const { Card, Button, Badge, Avatar, Input, Select, IconButton, Dialog, Tabs } = NS;

  const WD = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const fmt = (d) => `${d.getMonth() + 1}月${String(d.getDate()).padStart(2, "0")}日 ${WD[d.getDay()]}`;
  // 本地日期 → YYYY-MM-DD（不能用 toISOString：它转 UTC，在东八区会回退一天，导致存库日期偏移）
  const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  let UID = 1000;

  // 排期模型：日期槽(slots) 与 报告人队列(groups) 解耦。
  // 取消某个日期 → 该日期不再开会，报告人队列顺延到后续日期（必要时在末尾追加补开日期）。
  function genSchedule(startISO, intervalDays, perSession, endISO, roster, weekday = null) {
    const slots = [], groups = [];
    if (!roster || !roster.length) return { slots, groups };  // 无成员时不生成，避免 idx % 0 = NaN 崩溃
    let d = new Date(startISO + "T00:00:00");
    // 指定了周几（每周/每两周模式）→ 把起始日对齐到 ≥ start 的第一个该周几，
    // 之后按 interval（7/14 的倍数）累加，所有场次都落在同一周几。
    if (weekday != null) {
      const diff = ((weekday - d.getDay()) % 7 + 7) % 7;
      d = new Date(d.getTime() + diff * 86400000);
    }
    const end = new Date(endISO + "T00:00:00");
    let idx = 0, r = 0;
    while (d <= end && slots.length < 60) {
      const presenters = [];
      for (let k = 0; k < perSession; k++) { presenters.push({ name: roster[idx % roster.length].name, topic: "", skipped: false }); idx++; }
      slots.push({ id: "s" + r, iso: isoLocal(d), date: fmt(d), cancelled: false });
      groups.push({ id: "g" + (r++), presenters });
      d = new Date(d.getTime() + intervalDays * 86400000);
    }
    return { slots, groups };
  }

  // 把后端已保存的组会排期（与日历同源）还原成排期表的 slots/groups，供管理员精调。
  function meetingsToSchedule(meetings) {
    const sorted = [...meetings].sort((a, b) => (a.y - b.y) || (a.mo - b.mo) || (a.day - b.day));
    const slots = [], groups = [];
    sorted.forEach((m) => {
      const iso = `${m.y}-${String(m.mo + 1).padStart(2, "0")}-${String(m.day).padStart(2, "0")}`;
      slots.push({ id: "s" + (UID++), iso, date: m.dateLabel || fmt(new Date(iso + "T00:00:00")), cancelled: m.status === "cancelled" });
      groups.push({
        id: "g" + (UID++), time: m.time || "", place: m.place || "", type: m.type || "", host: m.host || "",
        presenters: (m.presenters || []).map((p) => ({ name: p.name, topic: p.topic || "", skipped: false })),
      });
    });
    return { slots, groups };
  }

  const isoAfter = (iso, days) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + days); return isoLocal(d); };

  // 平衡：保证「未取消日期数 == 报告人队列长度」。不足则在末尾追加补开日期，多余则移除尾部补开日期。
  function rebalance(slots, groupCount, interval) {
    let s = slots.map((x) => ({ ...x }));
    const activeCount = () => s.filter((x) => !x.cancelled).length;
    let guard = 0;
    while (activeCount() > groupCount && guard++ < 80) {
      let idx = -1;
      for (let i = s.length - 1; i >= 0; i--) { if (s[i].makeup && !s[i].cancelled) { idx = i; break; } }
      if (idx < 0) break;
      s.splice(idx, 1);
    }
    guard = 0;
    while (activeCount() < groupCount && guard++ < 80) {
      const lastIso = s.length ? s[s.length - 1].iso : isoLocal(new Date());
      const ni = isoAfter(lastIso, interval);
      s.push({ id: "m" + (UID++), iso: ni, date: fmt(new Date(ni + "T00:00:00")), cancelled: false, makeup: true });
    }
    return s;
  }

  // 把报告人队列映射到未取消日期，得到按时间排序的时间线（会议 + 已取消占位）。
  function buildTimeline(slots, groups) {
    const active = slots.filter((s) => !s.cancelled);
    const cards = groups.map((g, i) => ({ type: "meeting", group: g, slot: active[i] || { id: "pending", iso: "9999", date: "待定", pending: true } }));
    const stubs = slots.filter((s) => s.cancelled).map((s) => ({ type: "cancelled", slot: s }));
    return [...cards, ...stubs].sort((a, b) => (a.slot.iso || "").localeCompare(b.slot.iso || ""));
  }

  function Segmented({ value, onChange, options }: any) {
    return (
      <div style={{ display: "inline-flex", padding: 3, gap: 2, background: "var(--surface-sunken)", borderRadius: "var(--radius-md)" }}>
        {options.map((o) => (
          <button type="button" key={o.value} onClick={() => onChange(o.value)}
            style={{
              padding: "6px 12px", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13,
              fontWeight: 600, borderRadius: "var(--radius-sm)",
              background: value === o.value ? "var(--surface-raised)" : "transparent",
              color: value === o.value ? "var(--accent-text)" : "var(--text-muted)",
              boxShadow: value === o.value ? "var(--shadow-xs)" : "none",
              transition: "all var(--dur-fast) var(--ease-out)",
            }}>{o.label}</button>
        ))}
      </div>
    );
  }

  // Read-first presenter row: topic & swap show as text, reveal editors on click.
  function PresenterRow({ p, idx, total, roster, onTopic, onSkip, onSwap, onRemove, onMove }: any) {
    const [editTopic, setEditTopic] = React.useState(false);
    const [editSwap, setEditSwap] = React.useState(false);
    const [draft, setDraft] = React.useState(p.topic);
    React.useEffect(() => { setDraft(p.topic); }, [p.topic]);
    const saveTopic = () => { onTopic(draft); setEditTopic(false); };

    return (
      <div style={{ padding: "11px 0", borderTop: idx > 0 ? "1px solid var(--border-subtle)" : "none", opacity: p.skipped ? 0.55 : 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* order controls */}
          <div style={{ display: "flex", flexDirection: "column", gap: 1, flexShrink: 0 }}>
            <button type="button" onClick={() => onMove(-1)} disabled={idx === 0} title="上移" style={{ border: "none", background: "none", cursor: idx === 0 ? "default" : "pointer", color: idx === 0 ? "var(--border-default)" : "var(--text-faint)", padding: 0, lineHeight: 0 }}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
            </button>
            <button type="button" onClick={() => onMove(1)} disabled={idx === total - 1} title="下移" style={{ border: "none", background: "none", cursor: idx === total - 1 ? "default" : "pointer", color: idx === total - 1 ? "var(--border-default)" : "var(--text-faint)", padding: 0, lineHeight: 0 }}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
            </button>
          </div>
          <span className="cibol-numeral" style={{ fontSize: 15, color: "var(--text-faint)", width: 16, textAlign: "center", flexShrink: 0 }}>{idx + 1}</span>
          <Avatar name={p.name} size="sm" />
          <span style={{ width: 90, flexShrink: 0, fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)", textDecoration: p.skipped ? "line-through" : "none" }}>{p.name}</span>

          {/* topic — read first */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {editTopic ? (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <Input size="sm" placeholder="汇报主题" value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
                <IconButton size="sm" icon={I("check")} label="保存" onClick={saveTopic} />
                <IconButton size="sm" icon={I("x")} label="取消" onClick={() => { setDraft(p.topic); setEditTopic(false); }} />
              </div>
            ) : (
              <button type="button" onClick={() => !p.skipped && setEditTopic(true)} disabled={p.skipped}
                style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", border: "none", background: "none", cursor: p.skipped ? "default" : "pointer", padding: "4px 0", textAlign: "left" }}>
                <span style={{ fontSize: 13, color: p.topic ? "var(--text-body)" : "var(--text-faint)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
                  {p.topic || "未设置主题 · 由成员自填"}
                </span>
                {!p.skipped && <Icon name="pencil" style={{ width: 13, height: 13, color: "var(--text-faint)", flexShrink: 0 }} />}
              </button>
            )}
          </div>

          {/* actions — swap read first */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            {editSwap ? (
              <div style={{ width: 132 }}>
                <Select size="sm" placeholder="调换为…" value="" autoFocus
                  onChange={(e) => { if (e.target.value) { onSwap(e.target.value); setEditSwap(false); } }}
                  options={roster.filter((m) => m.name !== p.name).map((m) => ({ value: m.name, label: m.name }))} />
              </div>
            ) : (
              <IconButton size="sm" icon={I("repeat")} label="调换" onClick={() => setEditSwap(true)} />
            )}
            <IconButton size="sm" icon={I(p.skipped ? "rotate-ccw" : "circle-slash")} label={p.skipped ? "恢复" : "轮空"} active={p.skipped} onClick={onSkip} />
            <IconButton size="sm" icon={I("trash-2")} label="移除" onClick={onRemove} />
          </div>
        </div>
      </div>
    );
  }

  // 「?」帮助按钮 —— 放在「排期设置」标题旁，点击弹出「如何排期」说明。
  function HowToHelp() {
    const isMobile = useIsMobile();
    const [open, setOpen] = React.useState(false);
    const items = [
      ["wand-sparkles", "自动排期", "设好频率与人数，一键按花名册顺序自动轮转生成整学期。"],
      ["list-ordered", "手动调序", "展开任一场，用 ↑↓ 调整报告顺序，或手动添加 / 移除报告人、追加组会。"],
      ["circle-slash", "轮空", "让某人本次不报告，名额顺延。"],
      ["repeat", "调换", "把某位报告人替换成其他成员。"],
      ["pencil", "主题", "可预先指定主题，留空则由成员自行填写。"],
    ];
    return (
      <>
        <IconButton size="sm" icon={I("circle-help")} label="如何排期" onClick={() => setOpen(true)} />
        <Dialog open={open} onClose={() => setOpen(false)} title="如何排期" subtitle="自动排期与手动调整说明"
          icon={I("circle-help")} tone="accent" width={520}
          footer={<Button variant="primary" onClick={() => setOpen(false)}>知道了</Button>}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
            {items.map(([ic, t, d], i) => (
              <div key={ic} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ width: 16, height: 16, color: "var(--accent)", flexShrink: 0, marginTop: 2, display: "inline-flex" }}>{I(ic)}</span>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)" }}>{t}</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5, marginTop: 1 }}>{d}</div>
                </div>
              </div>
            ))}
          </div>
        </Dialog>
      </>
    );
  }

  // 腾讯会议自动预约开关 —— 开启后调度器在组会前自动建会。
  function BookingAutoCard() {
    const { data: bk } = useBookingSettings();
    const update = useUpdateBookingSettings();
    const on = !!bk?.auto_book;
    const enabled = !!bk?.enabled;
    return (
      <Card eyebrow="腾讯会议" title="自动预约">
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontSize: 13.5, color: "var(--text-body)" }}>
              开启后，系统在每场组会前 <b>{bk?.days_ahead ?? 3}</b> 天自动在校园门户预约腾讯会议并回填链接。
            </div>
            {!enabled && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 12.5, color: "var(--warning-text)" }}>
                {I("triangle-alert", { size: 13 })}
                <span>尚未配置预约凭据（CIBOL_BOOKING_ACCOUNT / PASSWORD），开启后不会生效。</span>
              </div>
            )}
          </div>
          <Segmented value={on ? "on" : "off"}
            onChange={(v) => {
              if (v === "on" && !enabled) { toast("请先在服务器配置预约凭据再开启", { tone: "error" }); return; }
              update.mutate(v === "on", {
                onSuccess: () => toast(v === "on" ? "已开启自动预约" : "已关闭自动预约"),
                onError: (e: any) => toast(e?.detail || "操作失败", { tone: "error" }),
              });
            }}
            options={[{ value: "off", label: "关闭" }, { value: "on", label: "开启" }]} />
        </div>
      </Card>
    );
  }

  function SemesterDialog({ open, onClose }: any) {
    const isMobile = useIsMobile();
    const { data: cfg } = useConfig();
    const saveCfg = useSaveConfig();
    const [sem, setSem] = React.useState<any>({ name: "", short: "", start: "", end: "" });
    const [md, setMd] = React.useState<any>({ weekday: "周日", time: "", place: "" });
    React.useEffect(() => {
      if (open && cfg) {
        setSem({ ...cfg.semester });
        setMd({ ...cfg.meetingDefault });
      }
    }, [open, cfg]);
    const ds = { height: 38, padding: "0 11px", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", background: "var(--surface)", color: "var(--text-strong)", fontFamily: "var(--font-sans)", fontSize: 14, colorScheme: "light dark", width: "100%" };
    const save = () => {
      saveCfg.mutate(
        { semester: sem, meetingDefault: { weekday: md.weekday || "周日", time: md.time || "", place: md.place || "" } },
        {
          onSuccess: () => {
            toast("学期与地点已保存", { tone: "success" });
            onClose();
          },
          onError: (e: any) => toast(e?.detail || e?.message || "保存失败", { tone: "error" }),
        },
      );
    };
    return (
      <Dialog open={open} onClose={onClose} title="学期与地点" subtitle="设置当前学期范围与默认组会时间、地点（频率在上方排期设置）"
        icon={I("settings")} tone="accent" width={500}
        footer={<><Button variant="ghost" onClick={onClose}>取消</Button><Button variant="primary" loading={saveCfg.isPending} onClick={save}>保存设置</Button></>}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Input label="学期名称" value={sem.name} onChange={(e) => setSem({ ...sem, name: e.target.value, short: e.target.value.replace(/季?学期$/, "").trim() })} iconLeft={I("graduation-cap")} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-body)", marginBottom: 6 }}>学期范围</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input type="date" value={sem.start} onChange={(e) => setSem({ ...sem, start: e.target.value })} style={ds} />
              <span style={{ color: "var(--text-faint)", fontSize: 13, flexShrink: 0 }}>至</span>
              <input type="date" value={sem.end} onChange={(e) => setSem({ ...sem, end: e.target.value })} style={ds} />
            </div>
          </div>
          <div style={{ height: 1, background: "var(--border-subtle)" }} />
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
            <Input label="默认时间" value={md.time} onChange={(e) => setMd({ ...md, time: e.target.value })} iconLeft={I("clock")} />
            <Input label="默认地点" value={md.place} onChange={(e) => setMd({ ...md, place: e.target.value })} iconLeft={I("map-pin")} />
          </div>
        </div>
      </Dialog>
    );
  }

  function AdminMeetings() {
    const isMobile = useIsMobile();
    const { data: cfg } = useConfig();
    const { data: compute } = useEvalCompute();
    const { data: meetings = [] } = useMeetings();
    const roster = React.useMemo(() => (compute?.rows ?? []).map((row) => ({ name: row.name, role: "" })), [compute]);
    const [semOpen, setSemOpen] = React.useState(false);
    const [tab, setTab] = React.useState("schedule");
    const [freq, setFreq] = React.useState("7");
    const [customDays, setCustomDays] = React.useState(10);
    const [countMode, setCountMode] = React.useState("2");
    const [customCount, setCustomCount] = React.useState(4);
    const [start, setStart] = React.useState("");
    const [end, setEnd] = React.useState("");
    React.useEffect(() => {
      if (cfg?.semester?.start) setStart((s) => s || cfg.semester.start);
      if (cfg?.semester?.end) setEnd((e) => e || cfg.semester.end);
    }, [cfg]);
    const [weekday, setWeekday] = React.useState(0); // 加载后从 cfg.semester.start 更新
    const interval = freq === "custom" ? Math.max(1, Number(customDays)) : Number(freq);
    const perSession = countMode === "custom" ? Math.max(1, Number(customCount)) : Number(countMode);

    const [slots, setSlots] = React.useState<any[]>([]);
    const [groups, setGroups] = React.useState<any[]>([]);
    const [openId, setOpenId] = React.useState<any>(null);
    const [newDate, setNewDate] = React.useState("");
    const [addOpen, setAddOpen] = React.useState(false);
    const seededFromReal = React.useRef(false);

    // 排期表数据源 = 已保存的真实排期（与组会日历同源）；只有在一场都没有时（学期初），
    // 才用默认参数生成一份草稿供管理员在「排期设置」里调整后保存。
    // seededFromReal 只在有真实排期时置 true，roster 先到时生成草稿但不阻塞真实排期加载。
    React.useEffect(() => {
      if (cfg?.semester?.start) {
        setWeekday(new Date(cfg.semester.start + "T00:00:00").getDay());
      }
      if (meetings.length) {
        // 真实排期到达：总是覆盖（无论之前是否已用草稿填充）
        seededFromReal.current = true;
        const g = meetingsToSchedule(meetings);
        setSlots(g.slots); setGroups(g.groups); setOpenId(g.groups[0] && g.groups[0].id);
      } else if (!seededFromReal.current && roster.length && cfg) {
        // 无真实排期（学期初）且尚未从真实数据初始化过：生成草稿
        const s = cfg.semester?.start || isoLocal(new Date());
        const e = cfg.semester?.end || (() => { const d = new Date(); d.setMonth(d.getMonth() + 6); return isoLocal(d); })();
        const wd = s ? new Date(s + "T00:00:00").getDay() : 0;
        const g = genSchedule(s, 7, 2, e, roster, wd);
        setSlots(g.slots); setGroups(g.groups); setOpenId(g.groups[0] && g.groups[0].id);
      }
    }, [meetings, roster, cfg]);

    const regenerate = () => {
      if (!roster.length) { toast("暂无成员，无法生成排期", { tone: "error" }); return; }
      if (!start || !end) { toast("请先配置学期起止日期再生成排期", { tone: "error" }); return; }
      const g = genSchedule(start, interval, perSession, end, roster, freq === "custom" ? null : weekday);
      setSlots(g.slots); setGroups(g.groups); setOpenId(g.groups[0] && g.groups[0].id);
    };
    const patchGroup = (gid, fn) => setGroups((gs) => gs.map((g) => (g.id === gid ? fn(g) : g)));
    const setTopic = (gid, pi, v) => patchGroup(gid, (g) => ({ ...g, presenters: g.presenters.map((p, i) => (i === pi ? { ...p, topic: v } : p)) }));
    const toggleSkip = (gid, pi) => patchGroup(gid, (g) => ({ ...g, presenters: g.presenters.map((p, i) => (i === pi ? { ...p, skipped: !p.skipped } : p)) }));
    const swap = (gid, pi, name) => patchGroup(gid, (g) => ({ ...g, presenters: g.presenters.map((p, i) => (i === pi ? { ...p, name, skipped: false } : p)) }));
    const removeP = (gid, pi) => patchGroup(gid, (g) => ({ ...g, presenters: g.presenters.filter((_, i) => i !== pi) }));
    const moveP = (gid, pi, dir) => patchGroup(gid, (g) => {
      const arr = [...g.presenters]; const j = pi + dir;
      if (j < 0 || j >= arr.length) return g;
      [arr[pi], arr[j]] = [arr[j], arr[pi]];
      return { ...g, presenters: arr };
    });
    const addP = (gid, name) => patchGroup(gid, (g) => ({ ...g, presenters: [...g.presenters, { name, topic: "", skipped: false }] }));
    const setMeta = (gid, key, v) => patchGroup(gid, (g) => ({ ...g, [key]: v }));
    // 取消 / 恢复某个日期 → 报告人队列顺延，必要时末尾追加补开日期。
    const cancelSlot = (slotId) => setSlots((s) => rebalance(s.map((x) => (x.id === slotId ? { ...x, cancelled: true } : x)), groups.length, interval));
    const restoreSlot = (slotId) => setSlots((s) => rebalance(s.map((x) => (x.id === slotId ? { ...x, cancelled: false } : x)), groups.length, interval));
    const addSession = () => {
      if (!newDate) return;
      const d = new Date(newDate + "T00:00:00");
      const newSlot = { id: "s" + (UID++), iso: newDate, date: fmt(d), cancelled: false };
      const merged = [...slots, newSlot].sort((a, b) => (a.iso || "").localeCompare(b.iso || ""));
      const active = merged.filter((x) => !x.cancelled);
      const k = active.findIndex((x) => x.id === newSlot.id);
      const ng = [...groups]; ng.splice(k < 0 ? ng.length : k, 0, { id: "g" + (UID++), presenters: [] });
      setSlots(rebalance(merged, ng.length, interval));
      setGroups(ng);
      setNewDate("");
    };

    const saveSchedule = useSaveSchedule();
    // 把当前排期（时间线里真实日期的会议）整理成后端要的格式并保存
    const onSaveSchedule = () => {
      const meetings = timeline
        .filter((c: any) => c.type === "meeting" && c.slot && !c.slot.pending && c.slot.iso && c.slot.iso !== "9999")
        .map((c: any, idx: number) => {
          // 优先沿用该场已有类型；仅新建草稿（无 type）才按时间线奇偶兜底，避免重排后类型乱跳。
          const kind = c.group.type || (idx % 2 === 0 ? "进展汇报" : "文献精读");
          return {
            date: c.slot.iso,
            type: kind,
            host: c.group.host || "",
            time: c.group.time || "",   // 空 = 沿用全局默认（成员端回退渲染）
            place: c.group.place || "",
            presenters: (c.group.presenters || [])
              .filter((p: any) => !p.skipped)
              .map((p: any) => ({ name: p.name, topic: p.topic || "", kind })),
          };
        });
      if (!meetings.length) { toast("排期为空，先生成排期再保存", { tone: "error" }); return; }
      saveSchedule.mutate(meetings, {
        onSuccess: () => {
          seededFromReal.current = false;
          toast(`排期已保存并更新（${meetings.length} 场组会）`, { tone: "success" });
        },
        onError: (e: any) => toast(e?.message || "保存失败", { tone: "error" }),
      });
    };

    const dateStyle = { height: 38, padding: "0 11px", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", background: "var(--surface)", color: "var(--text-strong)", fontFamily: "var(--font-sans)", fontSize: 14, colorScheme: "light dark" };
    const meetingCount = groups.length;
    const cancelledCount = slots.filter((s) => s.cancelled).length;
    const totalSlots = groups.reduce((a, g) => a + g.presenters.filter((p) => !p.skipped).length, 0);
    const skipCount = groups.reduce((a, g) => a + g.presenters.filter((p) => p.skipped).length, 0);
    const timeline = buildTimeline(slots, groups);

    return (
      <div style={{ maxWidth: 860, margin: "0 auto", padding: isMobile ? "16px 14px 48px" : "24px 32px 48px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-strong)" }}>组会管理</h2>
            <p style={{ fontSize: 13.5, color: "var(--text-muted)", marginTop: 3 }}>自动排期，可手动调整顺序与主题</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
            <Button size="sm" variant="secondary" iconLeft={I("settings")} onClick={() => setSemOpen(true)}>学期与地点</Button>
            <Button size="sm" variant="primary" iconLeft={I("check")} loading={saveSchedule.isPending} onClick={onSaveSchedule}>保存排期</Button>
          </div>
        </div>
        <SemesterDialog open={semOpen} onClose={() => setSemOpen(false)} />

        <Tabs active={tab} onChange={setTab}
          tabs={[{ id: "schedule", label: "排期表", badge: meetingCount }, { id: "settings", label: "排期设置" }]} />

        {tab === "settings" && (
        <>
        <BookingAutoCard />
        <Card eyebrow="自动排期" title="排期设置" action={<HowToHelp />}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13.5, color: "var(--text-body)", width: 72 }}>开会频率</span>
              <Segmented value={freq} onChange={setFreq} options={[{ value: "7", label: "每周" }, { value: "14", label: "每两周" }, { value: "custom", label: "自定义" }]} />
              {freq === "custom" && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13.5, color: "var(--text-muted)" }}>每</span>
                  <div style={{ width: 64 }}><Input size="sm" type="number" value={customDays} onChange={(e) => setCustomDays(e.target.value)} /></div>
                  <span style={{ fontSize: 13.5, color: "var(--text-muted)" }}>天</span>
                </span>
              )}
            </div>
            {freq !== "custom" && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13.5, color: "var(--text-body)", width: 72 }}>开会星期</span>
                <div style={{ width: 120 }}>
                  <Select size="sm" value={String(weekday)} onChange={(e) => setWeekday(Number(e.target.value))}
                    options={WD.map((w, i) => ({ value: String(i), label: w }))} />
                </div>
                <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>每{freq === "7" ? "周" : "两周"}的{WD[weekday]}开会</span>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13.5, color: "var(--text-body)", width: 72 }}>每次人数</span>
              <Segmented value={countMode} onChange={setCountMode} options={[{ value: "1", label: "1 人" }, { value: "2", label: "2 人" }, { value: "3", label: "3 人" }, { value: "custom", label: "自定义" }]} />
              {countMode === "custom" && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 64 }}><Input size="sm" type="number" value={customCount} onChange={(e) => setCustomCount(e.target.value)} /></div>
                  <span style={{ fontSize: 13.5, color: "var(--text-muted)" }}>人</span>
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13.5, color: "var(--text-body)", width: 72 }}>日期范围</span>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={dateStyle} />
              <span style={{ fontSize: 13, color: "var(--text-faint)" }}>至</span>
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={dateStyle} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 14, borderTop: "1px solid var(--border-subtle)" }}>
              <Button variant="primary" iconLeft={I("wand-sparkles")} onClick={regenerate}>自动生成排期</Button>
              <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>覆盖现有排期 · 按花名册顺序轮转</span>
            </div>

            {/* 排期概览 — inside same card */}
            <div style={{ display: "flex", gap: 10, paddingTop: 14, borderTop: "1px solid var(--border-subtle)", flexWrap: isMobile ? "wrap" : "nowrap" }}>
              {[["共安排", meetingCount, "calendar-check", "var(--accent)"], ["报告人次", totalSlots, "users", "var(--success)"], ["轮空", skipCount, "circle-slash", "var(--warning)"], ["已取消", cancelledCount, "calendar-x", "var(--danger)"]].map(([l, n, ic, c]) => (
                <div key={l} style={{ flex: isMobile ? "1 1 calc(50% - 5px)" : 1, display: "flex", alignItems: "center", gap: 11, padding: "12px 14px", background: "var(--surface-sunken)", borderRadius: "var(--radius-md)" }}>
                  <span style={{ width: 30, height: 30, borderRadius: "var(--radius-sm)", background: "var(--surface)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon name={ic} style={{ width: 15, height: 15, color: c }} />
                  </span>
                  <div>
                    <div className="cibol-numeral" style={{ fontSize: 19, fontWeight: 600, color: "var(--text-strong)", lineHeight: 1 }}>{n}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 2 }}>{l}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
        </>
        )}

        {tab === "schedule" && (
        <Card eyebrow={`排期表 · 共 ${meetingCount} 次${cancelledCount ? ` · ${cancelledCount} 已取消` : ""}`} title="组会安排"
          action={<Button size="sm" variant="secondary" iconLeft={I("calendar-plus")} onClick={() => { setNewDate(""); setAddOpen(true); }}>添加一场</Button>}>
          <Dialog open={addOpen} onClose={() => setAddOpen(false)} title="添加一场组会"
            subtitle="选择组会日期，添加后可展开设置报告人与主题" icon={I("calendar-plus")} tone="accent" width={420}
            footer={<><Button variant="ghost" onClick={() => setAddOpen(false)}>取消</Button><Button variant="primary" disabled={!newDate} onClick={() => { addSession(); setAddOpen(false); }}>添加</Button></>}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-body)", marginBottom: 6 }}>组会日期</div>
              <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} style={{ ...dateStyle, width: "100%" }} />
            </div>
          </Dialog>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {timeline.map((item) => {
              if (item.type === "cancelled") {
                const s = item.slot;
                return (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 14px", border: "1px dashed var(--border-default)", borderRadius: "var(--radius-md)", background: "var(--surface-sunken)" }}>
                    <div style={{ width: 96, flexShrink: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-faint)", textDecoration: "line-through" }}>{s.date.split(" ")[0]}</div>
                      <div style={{ fontSize: 12, color: "var(--text-faint)" }}>{s.date.split(" ")[1]}</div>
                    </div>
                    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                      <span style={{ width: 15, height: 15, display: "inline-flex", color: "var(--danger)" }}>{I("calendar-x", { size: 15 })}</span>
                      <span style={{ fontSize: 13, color: "var(--danger-text)", fontWeight: 600 }}>已取消</span>
                      <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>· 汇报顺延至后续组会</span>
                    </div>
                    <Button size="sm" variant="ghost" iconLeft={I("rotate-ccw")} onClick={() => restoreSlot(s.id)}>恢复</Button>
                  </div>
                );
              }
              const g = item.group, slot = item.slot;
              const open = openId === g.id;
              const active = g.presenters.filter((p) => !p.skipped);
              return (
                <div key={g.id} style={{ border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", cursor: "pointer", background: open ? "var(--surface-sunken)" : "transparent" }}
                    onClick={() => setOpenId(open ? null : g.id)}>
                    <div style={{ width: 96, flexShrink: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: slot.pending ? "var(--warning-text)" : "var(--text-strong)" }}>{slot.pending ? "待定" : slot.date.split(" ")[0]}</span>
                        {slot.makeup && <span title="补开日期" style={{ fontSize: 10.5, fontWeight: 600, color: "var(--accent-text)", background: "var(--accent-soft)", padding: "1px 5px", borderRadius: "var(--radius-pill)" }}>补</span>}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-faint)" }}>{slot.pending ? "顺延待排" : slot.date.split(" ")[1]}</div>
                    </div>
                    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
                      {active.length
                        ? active.map((p) => (
                          <span key={p.name} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <Avatar name={p.name} size="xs" />
                            <span style={{ fontSize: 13, color: "var(--text-body)" }}>{p.name}</span>
                          </span>
                        ))
                        : g.type && !["进展汇报", "文献精读"].includes(g.type)
                          ? <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)" }}>{g.type}</span>
                          : <span style={{ fontSize: 13, color: "var(--warning-text)" }}>待安排报告人</span>}
                      {g.host && (
                        <span title="主持人" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 600, color: "var(--accent-text)", background: "var(--accent-soft)", padding: "2px 7px", borderRadius: "var(--radius-pill)" }}>
                          {I("mic", { size: 11 })}主持 {g.host}
                        </span>
                      )}
                    </div>
                    {!slot.pending && (
                      <IconButton size="sm" icon={I("calendar-x")} label="取消组会" onClick={(e) => { e.stopPropagation(); cancelSlot(slot.id); }} />
                    )}
                    <Icon name={open ? "chevron-up" : "chevron-down"} style={{ width: 17, height: 17, color: "var(--text-faint)" }} />
                  </div>
                  {open && (
                    <div style={{ padding: "2px 14px 12px", borderTop: "1px solid var(--border-subtle)" }}>
                      {g.presenters.map((p, pi) => (
                        <PresenterRow key={`${g.id}-${pi}`} p={p} idx={pi} total={g.presenters.length} roster={roster}
                          onTopic={(v) => setTopic(g.id, pi, v)} onSkip={() => toggleSkip(g.id, pi)}
                          onSwap={(name) => swap(g.id, pi, name)} onRemove={() => removeP(g.id, pi)}
                          onMove={(dir) => moveP(g.id, pi, dir)} />
                      ))}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 12, marginTop: 4, borderTop: "1px solid var(--border-subtle)", flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>添加报告人</span>
                        <div style={{ width: 180 }}>
                          <Select size="sm" placeholder="选择成员…" value=""
                            onChange={(e) => { if (e.target.value) addP(g.id, e.target.value); }}
                            options={roster.filter((m) => !g.presenters.some((p) => p.name === m.name)).map((m) => ({ value: m.name, label: m.role ? `${m.name} · ${m.role}` : m.name }))} />
                        </div>
                        <span style={{ fontSize: 12.5, color: "var(--text-muted)", marginLeft: 8 }}>主持人</span>
                        <div style={{ width: 180 }}>
                          <Select size="sm" placeholder="未指定" value={g.host || ""}
                            onChange={(e) => setMeta(g.id, "host", e.target.value)}
                            options={[{ value: "", label: "未指定" }, ...roster.map((m) => ({ value: m.name, label: m.role ? `${m.name} · ${m.role}` : m.name }))]} />
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 10, paddingTop: 12, marginTop: 8, borderTop: "1px solid var(--border-subtle)" }}>
                        <Input size="sm" label="类型（可自定义）" value={g.type || ""} placeholder="进展汇报 / 文献精读 / 团建…" iconLeft={I("tag")} list={`mtypes-${g.id}`}
                          onChange={(e) => setMeta(g.id, "type", e.target.value)} />
                        <Input size="sm" label="本场时间（留空 = 默认）" value={g.time || ""} placeholder={cfg?.meetingDefault?.time || "全局默认"} iconLeft={I("clock")}
                          onChange={(e) => setMeta(g.id, "time", e.target.value)} />
                        <Input size="sm" label="本场地点（留空 = 默认）" value={g.place || ""} placeholder={cfg?.meetingDefault?.place || "全局默认"} iconLeft={I("map-pin")}
                          onChange={(e) => setMeta(g.id, "place", e.target.value)} />
                        <datalist id={`mtypes-${g.id}`}>
                          {["进展汇报", "文献精读", "团建", "AI Agent工作坊", "工作坊"].map((t) => <option key={t} value={t} />)}
                        </datalist>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
        )}
      </div>
    );
  }

  export { AdminMeetings };
