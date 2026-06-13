import React from "react";
import * as NS from "../ds";
import { I, Icon } from "../lib/icons";
import { STORE, toast } from "../store";
import { DATA } from "../data";
import { useConfig, useMeetings, useEvalCompute, useExcellence, useRankSeries, useCreateRequest, useEvalReports, useSubmitRating, useBookMeeting, useBookingSettings, type Meeting } from "../api/hooks";
import { useIsMobile } from "../lib/useIsMobile";
import type { Me } from "../auth";

// Meetings — 组会: schedule (unified panel: recent + month calendar + leave),
// rating, rank (date-range). 对调 = peer handshake (no admin); 缺席 = needs admin.
  const { Card, Button, Badge, Avatar, Tabs, Dialog, Input, Select, Textarea, ScoreDots, RankRow, IconButton } = NS;

  const WEEK = ["一", "二", "三", "四", "五", "六", "日"];

  // 在线会议卡片：链接已设置 → 可点击打开；设置失败 → 提醒管理员设置。
  function OnlineMeetingCard({ online, admin }: any) {
    const [hover, setHover] = React.useState(false);
    const ok = online && online.url;

    if (!ok) {
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 15px", marginBottom: 16, background: "var(--warning-soft)", border: "1px solid var(--warning)", borderRadius: "var(--radius-md)" }}>
          {I("video-off", { size: 20, style: { color: "var(--warning-text)" } })}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>在线会议链接未生成</div>
            <div style={{ fontSize: 12.5, color: "var(--warning-text)", marginTop: 1 }}>系统自动创建失败，{admin ? "请手动设置会议链接。" : "已提醒管理员设置。"}</div>
          </div>
          {admin && <Button size="sm" variant="secondary" iconLeft={I("settings")}>设置链接</Button>}
        </div>
      );
    }

    return (
      <a href={online.url} target="_blank" rel="noopener noreferrer"
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        style={{
          display: "flex", alignItems: "center", gap: 13, padding: "13px 15px", marginBottom: 16,
          background: hover ? "var(--accent)" : "var(--accent-soft)",
          border: `1px solid ${hover ? "var(--accent)" : "var(--accent-soft-bd)"}`,
          borderRadius: "var(--radius-md)", textDecoration: "none",
          transition: "background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)",
        }}>
        <span style={{ width: 38, height: 38, flexShrink: 0, borderRadius: "var(--radius-md)", background: hover ? "rgba(255,255,255,0.18)" : "var(--surface)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          {I("video", { size: 19, style: { color: hover ? "#fff" : "var(--accent-text)" } })}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: hover ? "#fff" : "var(--text-strong)" }}>加入在线会议</div>
          <div className="cibol-mono" style={{ fontSize: 12.5, color: hover ? "rgba(255,255,255,0.85)" : "var(--text-muted)", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{online.provider} · 会议号 {online.id}</div>
        </div>
        {I("arrow-up-right", { size: 18, style: { color: hover ? "#fff" : "var(--accent-text)" } })}
      </a>
    );
  }

  // Fallback: build the full-semester schedule if shared data.js is stale/cached.
  function buildSchedule(d) {
    const WD = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    const members = (d.members || []).length ? d.members : [{ name: "成员" }];
    const seeded = { 1: [{ name: "陈屿", topic: "海马体记忆重放的计算模型" }], 2: [{ name: "Mei Lin", topic: "生成式神经解码综述" }, { name: "顾长川", topic: "" }] };
    const out = [];
    let dt = new Date(2026, 5, 14), n = 0, ri = 0;
    const end = new Date(2027, 0, 16);
    while (dt <= end && out.length < 30) {
      const mo = dt.getMonth(), day = dt.getDate(), isP = n % 2 === 0, per = n % 3 === 0 ? 2 : 1;
      let presenters = [];
      for (let k = 0; k < per; k++) { presenters.push({ name: members[ri % members.length].name, topic: "" }); ri++; }
      if (seeded[n]) presenters = seeded[n];
      out.push({ id: `${mo + 1}-${day}`, y: dt.getFullYear(), mo, day, mdLabel: `${mo + 1}/${String(day).padStart(2, "0")}`, dateLabel: `${mo + 1}月${day}日 ${WD[dt.getDay()]}`, type: isP ? "进展汇报" : "文献精读", tone: isP ? "accent" : "info", presenters, online: null });
      dt = new Date(dt.getTime() + 7 * 86400000); n++;
    }
    if (out[0] && d.nextMeeting) { out[0].presenters = d.nextMeeting.presenters.map((p) => ({ name: p.name, topic: p.topic })); out[0].online = d.nextMeeting.online; }
    return out;
  }

  function Schedule({ onLeave, admin, me }: any) {
    const isMobile = useIsMobile();
    STORE.use();
    const { data: cfg } = useConfig();
    const { data: meetings = [] } = useMeetings();
    const bookMeeting = useBookMeeting();
    const { data: booking } = useBookingSettings(admin); // 仅管理员查
    const md = cfg?.meetingDefault;

    const doBook = (id: string) => {
      if (!booking?.enabled) { toast("未配置腾讯会议预约凭据（联系系统管理员）", { tone: "error" }); return; }
      toast("正在预约腾讯会议…门户审批约需 1–3 分钟，请保持页面打开", { tone: "info" });
      bookMeeting.mutate(id, {
        onSuccess: () => toast("已预约腾讯会议", { tone: "success" }),
        onError: (e: any) => toast(`预约失败：${e?.message || "请稍后重试"}`, { tone: "error" }),
      });
    };

    // 整学期排期（真实数据）—— 每场是一个 月/日 块。
    const MEETINGS = meetings;
    const [selId, setSelId] = React.useState<string | null>(null);
    React.useEffect(() => { if (!selId && MEETINGS[0]) setSelId(MEETINGS[0].id); }, [MEETINGS]);
    const sel = MEETINGS.find((x) => x.id === selId) || MEETINGS[0] || null;

    // 距今还有几天（学期内“今天”锰定为下一场前两天，与首页“还有 2 天”一致）
    const TODAY = new Date(2026, 5, 14);
    const dateOf = (mt) => {
      if (mt.y != null && mt.mo != null && mt.day != null) return new Date(mt.y, mt.mo, mt.day);
      const [mm, dd] = (mt.mdLabel || "").split("/").map(Number);
      return new Date(mm >= 6 ? 2026 : 2027, (mm || 1) - 1, dd || 1);
    };
    const daysLabel = (mt) => { const n = Math.round((+dateOf(mt) - +TODAY) / 86400000); return n <= 0 ? "今天" : n === 1 ? "明天" : n + "天后"; };

    if (!md || !MEETINGS.length) return null;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* 组会日历 + 我的本学期报告 */}
        <Card padding="none">
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.1fr 1fr" }}>
            {/* LEFT — meeting-date blocks; click a block to reveal its detail */}
            <div style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div className="cibol-eyebrow">组会日历</div>
                <span style={{ fontSize: 12, color: "var(--text-faint)" }}>本学期共 {MEETINGS.length} 次</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, maxHeight: 240, overflowY: "auto", paddingRight: 4 }}>
                {MEETINGS.map((mt) => {
                  const on = mt.id === selId;
                  return (
                    <button key={mt.id} onClick={() => setSelId(mt.id)}
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
                        width: 64, height: 60, padding: 0, cursor: "pointer", flexShrink: 0,
                        border: `1px solid ${on ? "var(--accent)" : "var(--border-default)"}`,
                        background: on ? "var(--accent)" : "var(--surface)",
                        borderRadius: "var(--radius-md)",
                        transition: "all var(--dur-fast) var(--ease-out)",
                      }}>
                      <span className="cibol-numeral" style={{ fontSize: 17, fontWeight: 600, lineHeight: 1, color: on ? "#fff" : "var(--text-strong)" }}>{mt.mdLabel}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, whiteSpace: "nowrap", color: on ? "rgba(255,255,255,0.82)" : "var(--text-faint)" }}>{daysLabel(mt)}</span>
                    </button>
                  );
                })}
              </div>

              {sel && (() => {
                const myReq = STORE.requestForDate(sel.dateLabel);
                const reqActive = myReq && ["pending", "submitted"].includes(myReq.status);
                const iPresent = sel.presenters.some((p) => p.name === me.name);
                return (
                <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid var(--border-subtle)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div className="cibol-eyebrow">{sel.dateLabel}</div>
                    {iPresent && !reqActive && <Button size="sm" variant="secondary" iconLeft={I("calendar-off")} onClick={() => onLeave(sel)}>申请请假</Button>}
                    <div style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 8 }}>
                      {sel.online && sel.online.url
                        ? <>
                            <IconButton size="sm" variant="solid" icon={I("video")} label="在线会议" onClick={() => window.open(sel.online.url, "_blank")} />
                            {admin && <Button size="sm" variant="ghost" iconLeft={I("rotate-cw")} loading={bookMeeting.isPending} onClick={() => doBook(sel.id)}>{bookMeeting.isPending ? "预约中…" : "重新预约"}</Button>}
                          </>
                        : admin
                          ? <Button size="sm" variant="primary" iconLeft={I("video")} loading={bookMeeting.isPending}
                              onClick={() => doBook(sel.id)}>{bookMeeting.isPending ? "预约中…" : "预约腾讯会议"}</Button>
                          : <Badge tone="warning" size="sm" dot>在线会议待设置</Badge>}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 16, color: "var(--text-muted)", fontSize: 13, marginBottom: 14 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{I("clock", { size: 14 })}{md.time}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{I("map-pin", { size: 14 })}{md.place}</span>
                  </div>
                  {sel.presenters.map((p, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 11, padding: "8px 0" }}>
                      <Avatar name={p.name} size="sm" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-strong)" }}>{p.name}</div>
                        <div style={{ fontSize: 12, color: "var(--text-faint)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.topic || "主题待定"}</div>
                      </div>
                    </div>
                  ))}
                  {reqActive && (
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 14, fontSize: 12.5, color: "var(--text-muted)" }}>
                      {I("info", { size: 13, style: { color: "var(--text-faint)" } })}
                      <span>本场已有{myReq.kind === "swap" ? "对调" : "请假"}申请，进度可在「消息 · 申请」查看。</span>
                    </div>
                  )}
                </div>
                );
              })()}
            </div>

            {/* RIGHT — 我的本学期报告 (replaces the old day-detail panel) */}
            <div style={{ padding: 20, borderLeft: isMobile ? "none" : "1px solid var(--border-subtle)", borderTop: isMobile ? "1px solid var(--border-subtle)" : "none" }}>
              <div className="cibol-eyebrow" style={{ marginBottom: 4 }}>我的报告</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-strong)", marginBottom: 4 }}>我的本学期报告</div>
              <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 14 }}>点击设置汇报主题</p>
              <MyReportsList meetings={MEETINGS} me={me} />
            </div>
          </div>
        </Card>
      </div>
    );
  }

  function MyReportsList({ meetings, me }: { meetings: Meeting[]; me: Me }) {
    const KEY = "cibol_my_topics";
    // 从排期表派生：我作为报告人的场次（与「组会日历」同源，不再写死）。
    const REPORTS = (meetings || [])
      .filter((s) => s.presenters.some((p) => p.name === me.name))
      .slice(0, 3)
      .map((s) => ({ id: s.id, date: s.dateLabel, kind: s.type }));
    const [topics, setTopics] = React.useState(() => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } });
    const [editId, setEditId] = React.useState(null);
    const [draft, setDraft] = React.useState("");
    const begin = (id) => { setDraft(topics[id] || ""); setEditId(id); };
    const save = (id) => { const next = { ...topics, [id]: draft }; setTopics(next); try { localStorage.setItem(KEY, JSON.stringify(next)); } catch (e) {} toast("已保存 · 报告主题"); setEditId(null); };
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {REPORTS.length === 0 && (
          <div style={{ padding: "22px 12px", textAlign: "center", fontSize: 12.5, color: "var(--text-faint)", border: "1px dashed var(--border-default)", borderRadius: "var(--radius-md)" }}>本学期暂无你的报告安排</div>
        )}
        {REPORTS.map((r) => (
          <div key={r.id} style={{ display: "flex", flexDirection: "column", gap: 10, padding: "12px 14px", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <span style={{ width: 30, height: 30, flexShrink: 0, borderRadius: "var(--radius-md)", background: "var(--accent-soft)", color: "var(--accent-text)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                {I("mic", { size: 15 })}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)" }}>{r.date}</div>
                <div style={{ fontSize: 12, color: "var(--text-faint)" }}>{topics[r.id] ? "已设置主题" : "未设置主题"}</div>
              </div>
            </div>
            {editId === r.id ? (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <div style={{ flex: 1 }}><Input size="sm" placeholder="例如：基于扩散模型的神经表征解码" value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus /></div>
                <Button size="sm" variant="primary" iconLeft={I("check")} onClick={() => save(r.id)}>保存</Button>
              </div>
            ) : (
              <button onClick={() => begin(r.id)} style={{ display: "flex", alignItems: "center", gap: 8, border: "1px dashed var(--border-default)", background: "none", cursor: "pointer", padding: "8px 10px", borderRadius: "var(--radius-sm)", textAlign: "left" }}>
                <span style={{ flex: 1, fontSize: 13, color: topics[r.id] ? "var(--text-body)" : "var(--text-faint)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{topics[r.id] || "未设置主题 · 点击填写"}</span>
                {I("pencil", { size: 14, style: { color: "var(--text-faint)" } })}
              </button>
            )}
          </div>
        ))}
      </div>
    );
  }

  function ReportRating({ index, presenter, candidates, onSubmit }: any) {
    const isMobile = useIsMobile();
    const [att, setAtt] = React.useState(0);
    const [pol, setPol] = React.useState(0);
    const [confirm, setConfirm] = React.useState(false);
    // discussion Top5 for THIS report — ordered slots, pick from candidates
    const [top5, setTop5] = React.useState([null, null, null, null, null]);
    const [picking, setPicking] = React.useState(null); // slot index being filled
    const chosen = top5.filter(Boolean);
    const setSlot = (i, name) => setTop5((t) => t.map((v, j) => (j === i ? name : v)));
    const clearSlot = (i) => setTop5((t) => t.map((v, j) => (j === i ? null : v)));
    const move = (i, dir) => setTop5((t) => {
      const j = i + dir; if (j < 0 || j >= t.length) return t;
      const a = [...t]; [a[i], a[j]] = [a[j], a[i]]; return a;
    });
    const done = att > 0 && pol > 0 && chosen.length === 5;

    return (
      <Card padding="none" style={{ overflow: "visible" }}>
        {/* report header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
          <span className="cibol-numeral" style={{ fontSize: 22, color: "var(--text-faint)", width: 24, flexShrink: 0 }}>{index + 1}</span>
          <Avatar name={presenter.name} size="md" />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-strong)" }}>{presenter.name}</div>
            <div style={{ fontSize: 13, color: "var(--text-faint)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{presenter.topic}</div>
          </div>
          {done
            ? <Badge tone="success" size="sm" dot>已评</Badge>
            : <Badge tone="warning" size="sm" dot>待评</Badge>}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1.1fr" }}>
          {/* left — the two 5-point scores, filling the column height */}
          <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column" }}>
            <div className="cibol-eyebrow" style={{ marginBottom: 2 }}>报告评分</div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 10, padding: "16px 0" }}>
                <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-strong)" }}>报告态度</span>
                <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>内容准备是否充分、讲解是否认真</span>
                <ScoreDots value={att} onChange={setAtt} />
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 10, padding: "16px 0", borderTop: "1px solid var(--border-subtle)" }}>
                <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-strong)" }}>制作精良</span>
                <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>幻灯片与材料的完成度</span>
                <ScoreDots value={pol} onChange={setPol} />
              </div>
            </div>
          </div>

          {/* right — this report's discussion Top 5 */}
          <div style={{ padding: "18px 20px", borderLeft: isMobile ? "none" : "1px solid var(--border-subtle)", borderTop: isMobile ? "1px solid var(--border-subtle)" : "none", background: "var(--surface-sunken)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span className="cibol-eyebrow">讨论贡献 Top 5</span>
              <span style={{ fontSize: 12, color: "var(--text-faint)" }}>{chosen.length}/5</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {top5.map((name, i) => (
                <div key={i} style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", background: name ? "var(--surface)" : "transparent" }}>
                  <span className="cibol-numeral" style={{ fontSize: 15, color: name ? "var(--accent-text)" : "var(--text-faint)", width: 14, flexShrink: 0 }}>{i + 1}</span>
                  {name ? (
                    <>
                      <button onClick={() => setPicking(picking === i ? null : i)}
                        style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 9, border: "none", background: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
                        <Avatar name={name} size="xs" />
                        <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 500, color: "var(--text-strong)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
                      </button>
                      <div style={{ display: "flex", flexDirection: "column", gap: 0, flexShrink: 0 }}>
                        <button onClick={() => move(i, -1)} disabled={i === 0} style={{ border: "none", background: "none", cursor: i === 0 ? "default" : "pointer", color: i === 0 ? "var(--border-default)" : "var(--text-faint)", padding: 0, lineHeight: 0 }}>
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
                        </button>
                        <button onClick={() => move(i, 1)} disabled={i === chosen.length - 1 || !top5[i + 1]} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-faint)", padding: 0, lineHeight: 0 }}>
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                        </button>
                      </div>
                      <button onClick={() => clearSlot(i)} aria-label="移除" style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-faint)", padding: 0, lineHeight: 0, flexShrink: 0 }}>
                        {I("x", { size: 14 })}
                      </button>
                    </>
                  ) : (
                    <button onClick={() => setPicking(picking === i ? null : i)}
                      style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, border: "none", background: "none", cursor: "pointer", padding: "2px 0", textAlign: "left", color: "var(--text-faint)", fontSize: 13 }}>
                      {I("plus", { size: 14 })}选择第 {i + 1} 名
                    </button>
                  )}
                  {picking === i && (
                    <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 30, maxHeight: 184, overflowY: "auto", background: "var(--surface-raised)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-lg)", padding: 5 }}>
                      {candidates.filter((c) => !chosen.includes(c) || c === name).map((c) => (
                        <button key={c} onClick={() => { setSlot(i, c); setPicking(null); }}
                          style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "7px 9px", border: "none", background: c === name ? "var(--accent-soft)" : "transparent", cursor: "pointer", textAlign: "left", borderRadius: "var(--radius-sm)", fontFamily: "var(--font-sans)", fontSize: 13.5, color: c === name ? "var(--accent-text)" : "var(--text-body)" }}
                          onMouseEnter={(e) => { if (c !== name) e.currentTarget.style.background = "var(--surface-hover)"; }}
                          onMouseLeave={(e) => { if (c !== name) e.currentTarget.style.background = "transparent"; }}>
                          <Avatar name={c} size="xs" />{c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* footer — per-report submit */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 20px", borderTop: "1px solid var(--border-subtle)" }}>
          <span style={{ flex: 1, fontSize: 12.5, color: "var(--text-faint)" }}>
            {done ? "评分匿名提交，报告人看不到具体打分人。" : "完成两项评分并选满讨论 Top 5 后可提交。"}
          </span>
          <Button size="sm" variant="primary" iconLeft={I("check")} disabled={!done} onClick={() => setConfirm(true)}>提交本报告评分</Button>
        </div>

        <Dialog open={confirm} onClose={() => setConfirm(false)}
          title="提交该报告评分" subtitle={`${presenter.name} · 提交后不可修改`}
          icon={I("check")} tone="accent" width={420}
          footer={<>
            <Button variant="ghost" onClick={() => setConfirm(false)}>再看看</Button>
            <Button variant="primary" onClick={() => { setConfirm(false); onSubmit({ attitude: att, polish: pol, top5: chosen }); }}>确认提交</Button>
          </>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13.5, color: "var(--text-body)" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text-muted)" }}>报告态度</span><ScoreDots value={att} readOnly showValue /></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text-muted)" }}>制作精良</span><ScoreDots value={pol} readOnly showValue /></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text-muted)" }}>讨论 Top 5</span><span style={{ fontWeight: 600 }}>已选 {chosen.length} 人</span></div>
          </div>
        </Dialog>
      </Card>
    );
  }

  function Rating() {
    const { data: reports = [] } = useEvalReports();
    const { data: ev } = useEvalCompute();
    const submitRating = useSubmitRating();
    const [submitted, setSubmitted] = React.useState<number[]>([]);
    // 评分对象 = 评选期内最近一场组会。
    const meeting = reports.length ? reports[reports.length - 1] : null;
    const presenters = (meeting?.presenters || []).map((name) => ({ name, topic: "" }));
    const allNames = (ev?.rows || []).map((r) => r.name);
    const pending = presenters.map((p, i) => ({ p, i })).filter(({ i }) => !submitted.includes(i));
    if (!meeting) return null;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", background: "var(--accent-soft)", border: "1px solid var(--accent-soft-bd)", borderRadius: "var(--radius-md)" }}>
          {I("clock", { size: 16, style: { color: "var(--accent-text)" } })}
          <span style={{ fontSize: 13.5, color: "var(--accent-text)" }}>今日组会·{meeting.dateLabel} · 评分 <strong>6 小时后关闭</strong></span>
        </div>

        {pending.map(({ p, i }) => (
          <ReportRating key={i} index={i} presenter={p}
            candidates={allNames.filter((n) => n !== p.name)}
            onSubmit={(vals) => { submitRating.mutate({ key: meeting.key, presenter: p.name, attitude: vals.attitude, polish: vals.polish, top5: vals.top5 }, { onSuccess: () => { toast("已提交 · 评分已计入表现统计"); setSubmitted((s) => [...s, i]); } }); }} />
        ))}

        {pending.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: "56px 20px", textAlign: "center" }}>
            <span style={{ width: 48, height: 48, borderRadius: "var(--radius-lg)", background: "var(--success-soft)", color: "var(--success-text)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              {I("check-check", { size: 24 })}
            </span>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-strong)" }}>本次组会评分已全部提交</div>
            <p style={{ fontSize: 13.5, color: "var(--text-muted)" }}>感谢参与，结果将在窗口关闭后统计。</p>
          </div>
        )}
      </div>
    );
  }

  function RangeControl({ from, to, onFrom, onTo, onPreset, preset }: any) {
    const dateStyle = {
      height: 36, padding: "0 11px", border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-md)", background: "var(--surface)", color: "var(--text-strong)",
      fontFamily: "var(--font-sans)", fontSize: 13, colorScheme: "light dark",
    };
    const presets = [["month", "近一个月"], ["term", "本学期"], ["year", "本年度"]];
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="date" value={from} onChange={(e) => onFrom(e.target.value)} style={dateStyle} />
          <span style={{ color: "var(--text-faint)", fontSize: 13 }}>至</span>
          <input type="date" value={to} onChange={(e) => onTo(e.target.value)} style={dateStyle} />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {presets.map(([v, t]) => (
            <button key={v} onClick={() => onPreset(v)}
              style={{
                height: 30, padding: "0 12px", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13,
                fontWeight: 500, borderRadius: "var(--radius-pill)",
                border: `1px solid ${preset === v ? "var(--accent)" : "var(--border-default)"}`,
                background: preset === v ? "var(--accent-soft)" : "transparent",
                color: preset === v ? "var(--accent-text)" : "var(--text-muted)",
                transition: "all var(--dur-fast) var(--ease-out)",
              }}>{t}</button>
          ))}
        </div>
      </div>
    );
  }

  // ——— 我的排行走势：只统计当前用户(苏沐)在所选区间内的名次变化，折线呈现 ———
  const rankHash = (s, salt) => { let h = salt >>> 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };

  // 在 [from,to] 内生成均匀的组会时间点（4–9 个），返回 {label} 列表。
  function buildTimePoints(fromISO, toISO) {
    const a = new Date(fromISO + "T00:00:00"), b = new Date(toISO + "T00:00:00");
    if (isNaN(+a) || isNaN(+b) || b <= a) return [{ label: "—" }];
    const spanDays = (+b - +a) / 86400000;
    const count = Math.max(4, Math.min(9, Math.round(spanDays / 14) + 1));
    const pts = [];
    for (let i = 0; i < count; i++) {
      const dt = new Date(a.getTime() + (spanDays * i / (count - 1)) * 86400000);
      pts.push({ label: `${dt.getMonth() + 1}/${String(dt.getDate()).padStart(2, "0")}` });
    }
    return pts;
  }

  // 确定性名次游走（1 = 最好）。salt 区分维度，使三条线各不相同。
  function buildRankSeries(salt, count, total) {
    let r = 4 + (rankHash("苏沐", salt) % 7); // 起点 4–10
    const out = [];
    for (let i = 0; i < count; i++) {
      const delta = (rankHash("苏沐|" + salt + "|" + i, 91) % 5) - 2; // -2..+2
      r = Math.max(1, Math.min(total, r + delta));
      out.push(r);
    }
    return out;
  }

  // 区间内前 5 名：按成员 + 维度 + 区间确定性打分，降序取 5。
  function buildTop5(salt, max, fromISO, toISO) {
    const roster = DATA.members;
    return roster
      .map((m): [string, number] => [m.name, 20 + (rankHash(m.name + "|" + fromISO + "|" + toISO, salt) % (max - 19))])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }

  function MetricToggle({ value, onChange }: any) {
    const opts = [{ value: "total", label: "总分" }, { value: "report", label: "报告" }, { value: "discuss", label: "讨论" }];
    return (
      <div style={{ display: "inline-flex", padding: 3, gap: 2, background: "var(--surface-sunken)", borderRadius: "var(--radius-md)" }}>
        {opts.map((o) => (
          <button key={o.value} onClick={() => onChange(o.value)}
            style={{ padding: "6px 14px", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600, borderRadius: "var(--radius-sm)",
              background: value === o.value ? "var(--surface-raised)" : "transparent",
              color: value === o.value ? "var(--accent-text)" : "var(--text-muted)",
              boxShadow: value === o.value ? "var(--shadow-xs)" : "none",
              transition: "all var(--dur-fast) var(--ease-out)" }}>{o.label}</button>
        ))}
      </div>
    );
  }

  function StatTileMini({ label, value, sub, tone }: any) {
    return (
      <div style={{ flex: 1, minWidth: 0, padding: "14px 16px", background: "var(--surface-sunken)", borderRadius: "var(--radius-md)" }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "0.05em", color: "var(--text-faint)", textTransform: "uppercase" }}>{label}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 6 }}>
          <span className="cibol-numeral" style={{ fontSize: 26, fontWeight: 600, lineHeight: 1, color: tone || "var(--text-strong)" }}>{value}</span>
          {sub && <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{sub}</span>}
        </div>
      </div>
    );
  }

  function RankLineChart({ labels, ranks, total }: any) {
    const W = 760, H = 290, padL = 38, padR = 30, padT = 26, padB = 38;
    const iw = W - padL - padR, ih = H - padT - padB;
    const n = ranks.length;
    const [hover, setHover] = React.useState(null);
    const X = (i) => padL + (n <= 1 ? iw / 2 : (iw * i) / (n - 1));
    const Y = (r) => padT + ((r - 1) / Math.max(1, total - 1)) * ih; // rank 1 在顶部
    const ticks = Array.from(new Set([1, Math.round(total * 0.25), Math.round(total * 0.5), Math.round(total * 0.75), total])).filter((t) => t >= 1);
    const line = ranks.map((r, i) => `${i ? "L" : "M"} ${X(i).toFixed(1)} ${Y(r).toFixed(1)}`).join(" ");
    const area = `${line} L ${X(n - 1).toFixed(1)} ${(padT + ih).toFixed(1)} L ${X(0).toFixed(1)} ${(padT + ih).toFixed(1)} Z`;
    const gid = "rankgrad";
    const last = n - 1;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.20" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* gridlines + rank ticks */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} y1={Y(t)} x2={padL + iw} y2={Y(t)} stroke="var(--border-subtle)" strokeWidth="1" strokeDasharray={t === 1 ? "0" : "3 4"} />
            <text x={padL - 8} y={Y(t) + 4} textAnchor="end" fontSize="11" fill="var(--text-faint)" fontFamily="var(--font-mono)">{t}</text>
          </g>
        ))}
        {/* area + line */}
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* points (hover a point to see that meeting's rank) */}
        {ranks.map((r, i) => {
          const hl = i === hover;
          const big = hl || i === last;
          return (
            <g key={i}>
              <circle cx={X(i)} cy={Y(r)} r={big ? 6 : 4} fill={hl ? "var(--accent)" : "var(--surface)"} stroke="var(--accent)" strokeWidth={big ? 3 : 2} />
              <text x={X(i)} y={H - padB + 22} textAnchor="middle" fontSize="11.5" fill={big ? "var(--text-body)" : "var(--text-faint)"} fontFamily="var(--font-mono)" fontWeight={big ? 600 : 400}>{labels[i] ? labels[i].label : ""}</text>
              <circle cx={X(i)} cy={Y(r)} r={16} fill="transparent" style={{ cursor: "pointer" }} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover((h) => (h === i ? null : h))} />
            </g>
          );
        })}
        {/* current rank callout (hidden while hovering a point) */}
        {hover == null && (
        <g transform={`translate(${X(last)}, ${Y(ranks[last])})`}>
          <rect x={X(last) > W - 90 ? -78 : 12} y={-15} width="66" height="30" rx="6" fill="var(--accent)" />
          <text x={X(last) > W - 90 ? -45 : 45} y={4} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff" fontFamily="var(--font-sans)">第 {ranks[last]} 名</text>
        </g>
        )}
        {/* hover tooltip — date + rank for that meeting */}
        {hover != null && (() => {
          const r = ranks[hover], cx = X(hover), cy = Y(r), bw = 98, bh = 40;
          const bx = Math.max(2, Math.min(W - bw - 2, cx - bw / 2));
          const by = cy - bh - 12 < 2 ? cy + 14 : cy - bh - 12;
          return (
            <g style={{ pointerEvents: "none" }}>
              <rect x={bx} y={by} width={bw} height={bh} rx="7" fill="var(--text-strong)" />
              <text x={bx + bw / 2} y={by + 16} textAnchor="middle" fontSize="11" fill="var(--surface)" fontFamily="var(--font-mono)" opacity="0.8">{labels[hover] ? labels[hover].label : ""}</text>
              <text x={bx + bw / 2} y={by + 31} textAnchor="middle" fontSize="13.5" fontWeight="700" fill="var(--surface)" fontFamily="var(--font-sans)">第 {r} 名</text>
            </g>
          );
        })()}
      </svg>
    );
  }

  // 我的得分 —— 与「表现统计」同源（store.computeEval），点击展开计算明细。
  function MyScores({ me }: { me: Me }) {
    const isMobile = useIsMobile();
    const { data: ev } = useEvalCompute();
    const [open, setOpen] = React.useState(false);
    const row = ev?.rows.find((r) => r.name === me.name) || ev?.rows[0];
    if (!ev || !row) return null;
    const w: any = ev.weights;
    const wSum = (w.attitude + w.polish + w.attendance + w.discussion) || 1;
    const subs = [
      { label: "汇报态度", raw: row.attitude.toFixed(1), unit: "/ 5", norm: row.nAttitude, weight: w.attitude, color: "var(--terracotta-500)" },
      { label: "汇报精良", raw: row.polish.toFixed(1), unit: "/ 5", norm: row.nPolish, weight: w.polish, color: "var(--amber-500)" },
      { label: "讨论", raw: String(row.discuss), unit: "次", norm: row.nDisc, weight: w.discussion, color: "var(--slate-500)" },
      { label: "出勤", raw: row.attRate + "%", unit: "", norm: row.nAtt, weight: w.attendance, color: "var(--sage-500)" },
    ];
    return (
      <div style={{ padding: "16px 20px" }}>
        <button onClick={() => setOpen((o) => !o)}
          style={{ width: "100%", display: "flex", alignItems: "stretch", gap: 10, padding: 0, border: "none", background: "none", cursor: "pointer", textAlign: "left" }}>
          {/* 总分 */}
          <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", width: 96, padding: "10px 0", background: "var(--accent-soft)", borderRadius: "var(--radius-md)" }}>
            <span className="cibol-mono" style={{ fontSize: 26, fontWeight: 700, color: "var(--accent-text)", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{row.meeting.toFixed(1)}</span>
            <span style={{ fontSize: 11.5, color: "var(--accent-text)", marginTop: 4 }}>组会总分</span>
          </div>
          {/* 四子分 */}
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "7px 16px", alignContent: "center", minWidth: 0 }}>
            {subs.map((s) => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{s.label}</span>
                <div style={{ flex: 1, height: 5, background: "var(--surface-hover)", borderRadius: 999, overflow: "hidden", minWidth: 16 }}>
                  <div style={{ width: `${Math.max(3, Math.min(100, s.norm))}%`, height: "100%", background: s.color }} />
                </div>
                <span className="cibol-mono" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-strong)", width: 30, textAlign: "right", flexShrink: 0 }}>{Math.round(s.norm)}</span>
              </div>
            ))}
          </div>
          <span style={{ flexShrink: 0, alignSelf: "center", width: 16, height: 16, display: "inline-flex", color: "var(--text-faint)" }}>{I(open ? "chevron-up" : "chevron-down", { size: 16 })}</span>
        </button>

        {/* 点击查看：计算明细 */}
        {open && (
          <div style={{ marginTop: 12, padding: "12px 14px", background: "var(--surface-sunken)", borderRadius: "var(--radius-md)" }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--text-faint)", marginBottom: 8 }}>计算明细 · 与表现统计同源</div>
            {subs.map((s) => (
              <div key={s.label} style={{ display: "grid", gridTemplateColumns: isMobile ? "64px 1fr auto" : "72px 1fr 64px 56px", gap: 10, alignItems: "center", padding: "5px 0", borderTop: "1px solid var(--border-subtle)" }}>
                <span style={{ fontSize: 12.5, color: "var(--text-body)", display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: s.color, flexShrink: 0 }} />{s.label}</span>
                <span style={{ fontSize: 12, color: "var(--text-faint)" }}>原始 <b className="cibol-mono" style={{ color: "var(--text-muted)", fontWeight: 600 }}>{s.raw}{s.unit ? " " + s.unit : ""}</b></span>
                <span style={{ fontSize: 12, color: "var(--text-faint)", textAlign: "right" }}>归一 <b className="cibol-mono" style={{ color: "var(--text-strong)", fontWeight: 600 }}>{Math.round(s.norm)}</b></span>
                <span style={{ fontSize: 12, color: "var(--text-faint)", textAlign: "right" }}>×{Math.round((s.weight / wSum) * 100)}%</span>
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, paddingTop: 9, borderTop: "1px dashed var(--border-strong)" }}>
              <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>加权平均 = 组会总分</span>
              <span className="cibol-mono" style={{ fontSize: 15, fontWeight: 700, color: "var(--accent-text)" }}>{row.meeting.toFixed(1)}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  function Rank({ me }: { me: Me }) {
    const isMobile = useIsMobile();
    const PRESETS: Record<string, string[]> = {
      month: ["2026-05-12", "2026-06-12"],
      term: ["2026-02-24", "2026-06-12"],
      year: ["2026-01-01", "2026-06-12"],
    };
    const META: Record<string, string> = { total: "总分", report: "报告", discuss: "讨论" };
    const [preset, setPreset] = React.useState("month");
    const [from, setFrom] = React.useState(PRESETS.month[0]);
    const [to, setTo] = React.useState(PRESETS.month[1]);
    const [metric, setMetric] = React.useState("total");
    const applyPreset = (p) => { setPreset(p); setFrom(PRESETS[p][0]); setTo(PRESETS[p][1]); };

    // 真实评选数据：来自后端引擎（与 demo 对拍一致）。
    const { data: ev } = useEvalCompute();
    const { data: exc } = useExcellence();
    const { data: series } = useRankSeries(me.name, from, to, metric);
    const total = ev?.rows.length ?? 20;
    const hasData = !!series && series.ranks.length > 0;
    const points = hasData ? series!.points : [{ label: "—" }];
    const ranks = hasData ? series!.ranks : [total];
    const evByName: any = {}; (ev?.rows || []).forEach((r) => { evByName[r.name] = r; });
    const mergedByName: any = {}; (ev?.merged || []).forEach((m) => { mergedByName[m.name] = m; });
    const awardRows = (exc?.names || []).map((n) => evByName[n]).filter(Boolean);
    if (!ev || !exc) return null;

    const current = ranks[ranks.length - 1];
    const start = ranks[0];
    const best = Math.min(...ranks);
    const moved = start - current; // 正 = 名次上升（数字变小）
    const pct = Math.round(((total - current) / Math.max(1, total - 1)) * 100);

    return (
      <div>
        <Card padding="none">
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "stretch" }}>
            {/* LEFT — 我的排名走势（含区间筛选：仅作用于本走势）*/}
            <div style={{ flex: isMobile ? "1 1 100%" : "1 1 360px", minWidth: 0, display: "flex", flexDirection: "column", borderRight: isMobile ? "none" : "1px solid var(--border-subtle)", borderBottom: isMobile ? "1px solid var(--border-subtle)" : "none" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)" }}
                data-comment-anchor="e9b8b6aba1-div-555-11">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                    <Avatar name={me.name} size="sm" />
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-strong)" }}>我的{META[metric]}排名走势</div>
                      <div style={{ fontSize: 12.5, color: "var(--text-faint)" }}>全组 {total} 人 · 数字越小越靠前</div>
                    </div>
                  </div>
                  <MetricToggle value={metric} onChange={setMetric} />
                </div>
                <RangeControl from={from} to={to} preset={preset}
                  onFrom={(v) => { setFrom(v); setPreset(null); }}
                  onTo={(v) => { setTo(v); setPreset(null); }}
                  onPreset={applyPreset} />
              </div>

              <MyScores me={me} />

              <div style={{ padding: "0 14px 22px", marginTop: "auto" }}>
                <RankLineChart labels={points} ranks={ranks} total={total} />
              </div>
            </div>

            {/* RIGHT — 上次优秀名单（管理员发布的优秀奖） */}
            <div style={{ flex: isMobile ? "1 1 100%" : "1 1 360px", minWidth: 0, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
                <div>
                  <div className="cibol-eyebrow">{exc.published ? "管理员发布" : "本区间预览"}</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-strong)", marginTop: 3 }}>上次优秀名单</div>
                  <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 2 }}>{exc.from} → {exc.to} · 综合表现（组会 + 进展）前 {exc.names.length} 名</div>
                </div>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 999, background: "var(--warning-soft)", border: "1px solid var(--warning)", color: "var(--warning-text)", fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}>
                  {I("award", { size: 13 })}优秀奖
                </span>
              </div>
              <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 2 }}>
                {awardRows.length === 0 ? (
                  <div style={{ padding: "28px 12px", textAlign: "center", fontSize: 12.5, color: "var(--text-faint)" }}>管理员尚未发布优秀名单</div>
                ) : awardRows.map((r, i) => {
                  const m = mergedByName[r.name];
                  return (
                    <RankRow key={r.name} rank={i + 1} name={r.name}
                      subtitle={m ? `组会 #${m.mRank} · 进展 #${m.pRank}` : "综合排名"}
                      score={Math.round(r.meeting)} maxScore={100} unit="分" barTone="accent" medals highlight={r.name === me.name} />
                  );
                })}
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  function LeaveDialog({ open, onClose, session, me }: any) {
    const isMobile = useIsMobile();
    const [kind, setKind] = React.useState("");
    const [swapId, setSwapId] = React.useState("");
    const [reason, setReason] = React.useState("");
    const createReq = useCreateRequest();
    const { data: meetingsData = [] } = useMeetings();
    const meName = me.name;
    const mine = (session && session.dateLabel) || "";
    // peer sessions = everyone else's upcoming reports (from real schedule)
    const peerSessions = meetingsData
      .filter((s) => s.presenters.some((p) => p.name !== meName))
      .flatMap((s) => s.presenters.filter((p) => p.name !== meName).map((p) => ({
        id: `${s.id}__${p.name}`, date: s.dateLabel, mdLabel: s.mdLabel, type: s.type, name: p.name,
        topic: p.topic || "主题待定",
      })))
      .slice(0, 12);
    const picked = peerSessions.find((p) => p.id === swapId);
    React.useEffect(() => { if (!open) { setKind(""); setSwapId(""); setReason(""); } }, [open]);
    const submit = () => {
      if (kind === "swap") {
        if (!picked) return;
        createReq.mutate({ kind: "swap", fromDate: mine, toName: picked.name, toDate: picked.date, topic: picked.topic, reason, note: `已向 ${picked.name} 发送对调请求` }, { onSuccess: () => toast("已发送对调请求") });
      } else if (kind === "absence") {
        createReq.mutate({ kind: "absence", fromDate: mine, reason, note: "已提交轮空请假，等待管理员审批" }, { onSuccess: () => toast("已提交请假申请") });
      } else return;
      onClose();
    };
    return (
      <Dialog open={open} onClose={onClose} title="申请请假" subtitle={`${mine} · 你是本次报告人之一`}
        icon={I("calendar-off")} tone="accent" width={480}
        footer={<>
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={!kind || (kind === "swap" && !swapId)} onClick={submit}>{kind === "absence" ? "提交申请（待审批）" : kind === "swap" ? "发送对调请求" : "提交"}</Button>
        </>}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-body)", marginBottom: 8 }}>请假方式</div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
              {[["absence", "轮空请假", "本次报告轮空 · 记为未出勤", "calendar-x"], ["swap", "对调请假", "与他人对调顺序 · 记为未出勤", "repeat"]].map(([v, t, sub, ic]) => (
                <button key={v} onClick={() => setKind(v)}
                  style={{ textAlign: "left", padding: "12px 14px", cursor: "pointer",
                    border: `1.5px solid ${kind === v ? "var(--accent)" : "var(--border-default)"}`,
                    background: kind === v ? "var(--accent-soft)" : "var(--surface)",
                    borderRadius: "var(--radius-md)" }}>
                  {I(ic, { size: 18, style: { color: kind === v ? "var(--accent-text)" : "var(--text-muted)" } })}
                  <div style={{ fontWeight: 600, color: "var(--text-strong)", marginTop: 8 }}>{t}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{sub}</div>
                </button>
              ))}
            </div>
          </div>
          {kind === "swap" && (
            <>
              <Select label="与哪一场报告对调" placeholder="选择对方的报告场次" value={swapId}
                onChange={(e) => setSwapId(e.target.value)}
                options={peerSessions.map((p) => ({ value: p.id, label: `${p.mdLabel} · ${p.name}` }))} />
              {picked && (
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--accent-soft)", border: "1px solid var(--accent-soft-bd)", borderRadius: "var(--radius-md)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", color: "var(--text-faint)", marginBottom: 2 }}>你的报告</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>{mine}</div>
                  </div>
                  {I("repeat", { size: 18, style: { color: "var(--accent-text)" } })}
                  <div style={{ flex: 1, minWidth: 0, textAlign: "right" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", color: "var(--text-faint)", marginBottom: 2 }}>{picked.name} 的报告</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>{picked.date}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{picked.topic}</div>
                  </div>
                </div>
              )}
              <div style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "10px 12px", background: "var(--info-soft)", borderRadius: "var(--radius-md)" }}>
                {I("info", { size: 16, style: { color: "var(--info-text)", marginTop: 1 } })}
                <span style={{ fontSize: 12.5, color: "var(--info-text)", lineHeight: 1.5 }}>你们将互换报告日期。对调只需<strong>对方确认</strong>，无需管理员审批；本场仍记为未出勤。</span>
              </div>
            </>
          )}
          {kind === "absence" && (
            <div style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "10px 12px", background: "var(--warning-soft)", borderRadius: "var(--radius-md)" }}>
              {I("shield-alert", { size: 16, style: { color: "var(--warning-text)", marginTop: 1 } })}
              <span style={{ fontSize: 12.5, color: "var(--warning-text)", lineHeight: 1.5 }}>轮空会跳过本次报告，记为<strong>未出勤</strong>，需要管理员审批。</span>
            </div>
          )}
          <Textarea label="理由" placeholder="简单说明原因，方便安排对调" rows={3} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </Dialog>
    );
  }

  function Meetings({ initialTab, admin, me }: any) {
    const isMobile = useIsMobile();
    const [tab, setTab] = React.useState(initialTab || "schedule");
    const [leave, setLeave] = React.useState(null);
    return (
      <div style={{ maxWidth: 1140, margin: "0 auto", padding: isMobile ? "16px 14px 28px" : "20px 32px 48px" }}>
        <Tabs active={tab} onChange={setTab} style={{ marginBottom: 24 }}
          tabs={[{ id: "schedule", label: "安排" }, { id: "rating", label: "评分" }, { id: "rank", label: "表现" }]} />
        {tab === "schedule" && <Schedule onLeave={(s) => setLeave(s)} admin={admin} me={me} />}
        {tab === "rating" && <Rating />}
        {tab === "rank" && <Rank me={me} />}
        <LeaveDialog open={!!leave} session={leave} onClose={() => setLeave(null)} me={me} />
      </div>
    );
  }

  export { Meetings };
  // 复用：我的申请页用同一张状态卡片渲染全部申请。
