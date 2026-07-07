import React from "react";
import * as NS from "../ds";
import { I, Icon } from "../lib/icons";
import { toast } from "../store";
import { useConfig, useMeetings, useEvalCompute, useExcellence, useRankSeries, useCreateRequest, useEvalReports, useSubmitRating, useBookMeeting, useBookingSettings, useMyRequests, useSetMyTopic, type Meeting } from "../api/hooks";
import { useIsMobile } from "../lib/useIsMobile";
import type { Me } from "../auth";

// Meetings — 组会: schedule (unified panel: recent + month calendar + leave),
// rating, rank (date-range). 对调 = peer handshake (no admin); 缺席 = needs admin.
  const { Card, Button, Badge, Avatar, Tabs, Dialog, Input, Select, Textarea, ScoreDots, RankRow, IconButton, ScreenState, EmptyState } = NS;

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

  function Schedule({ onLeave, admin, me }: any) {
    const isMobile = useIsMobile();
    const { data: myRequests = [] } = useMyRequests();
    const cfgQ = useConfig();
    const meetingsQ = useMeetings();
    const cfg = cfgQ.data;
    const meetings = meetingsQ.data ?? [];
    const bookMeeting = useBookMeeting();
    const { data: booking } = useBookingSettings(admin); // 仅管理员查
    const md = cfg?.meetingDefault;

    const doBook = (id: string) => {
      if (!booking?.enabled) { toast("未配置腾讯会议预约凭据（联系系统管理员）", { tone: "error" }); return; }
      toast("正在预约腾讯会议…门户审批约需 1–3 分钟，请保持页面打开", { tone: "info" });
      bookMeeting.mutate(id, {
        onSuccess: () => toast("已预约腾讯会议", { tone: "success" }),
        onError: (e: any) => toast(`预约失败：${e?.detail || e?.message || "请稍后重试"}`, { tone: "error" }),
      });
    };

    // 整学期排期（真实数据）—— 每场是一个 月/日 块。
    // “今天”取真实当前日期（归零到 0 点）；过去/未来与距今天数据此判定。
    const TODAY = (() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); })();
    const dateOf = (mt: any) => {
      if (mt.y != null && mt.mo != null && mt.day != null) return new Date(mt.y, mt.mo, mt.day);
      const [mm, dd] = (mt.mdLabel || "").split("/").map(Number);
      const now = new Date(), yr = now.getFullYear();
      return new Date(mm < (now.getMonth() + 1) ? yr + 1 : yr, (mm || 1) - 1, dd || 1);
    };
    const dayDiff = (mt: any) => Math.round((+dateOf(mt) - +TODAY) / 86400000);
    const isPast = (mt: any) => dayDiff(mt) < 0;
    const daysLabel = (mt: any) => {
      const n = dayDiff(mt);
      if (n === 0) return "今天";
      if (n === 1) return "明天";
      if (n > 1) return n + "天后";
      if (n === -1) return "昨天";
      return -n + "天前";
    };
    // 按“离今天的距离”排序：今天与未来在前（升序）；已开过的排其后（离今天近的在前）。
    const MEETINGS = React.useMemo(() => {
      return [...meetings].sort((a, b) => {
        const da = dayDiff(a), db = dayDiff(b);
        const fa = da >= 0, fb = db >= 0;
        if (fa !== fb) return fa ? -1 : 1;
        return fa ? da - db : db - da;
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [meetings]);
    const [selId, setSelId] = React.useState<string | null>(null);
    React.useEffect(() => {
      if (!MEETINGS.length) return;
      if (!selId || !MEETINGS.find(x => x.id === selId)) {
        setSelId(MEETINGS[0].id);
      }
    }, [MEETINGS]);
    const sel = MEETINGS.find((x) => x.id === selId) || MEETINGS[0] || null;

    if (cfgQ.isLoading || meetingsQ.isLoading) return <ScreenState loading />;
    if (cfgQ.isError || meetingsQ.isError) return <ScreenState error onRetry={() => { cfgQ.refetch(); meetingsQ.refetch(); }} />;
    if (!md || !MEETINGS.length) return <EmptyState title="本学期暂无排期" description="管理员在“组会中心”完成排期后，这里会显示组会日历与你的报告安排。" style={{ padding: "64px 20px" }} />;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, flex: 1, minHeight: 0 }}>
        {/* 组会日历 + 我的本学期报告 */}
        <Card padding="none" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1.1fr) minmax(0, 1fr)", gridTemplateRows: "1fr" }}>
            {/* LEFT — meeting-date blocks; click a block to reveal its detail */}
            <div style={{ padding: 20, minWidth: 0, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div className="cibol-eyebrow">组会日历</div>
                <span style={{ fontSize: 12, color: "var(--text-faint)" }}>本学期共 {MEETINGS.length} 次</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, maxHeight: 240, overflowY: "auto", paddingRight: 4 }}>
                {MEETINGS.map((mt) => {
                  const on = mt.id === selId;
                  const past = isPast(mt) && !on;   // 已开过且非当前选中 → 灰显
                  const mine = mt.presenters.some((p) => p.name === me.name);  // 我是本场报告人 → 日历标注提醒
                  return (
                    <button type="button" key={mt.id} onClick={() => setSelId(mt.id)}
                      title={mine ? "你在本场有汇报" : undefined}
                      style={{
                        position: "relative",
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
                        width: 64, height: 60, padding: 0, cursor: "pointer", flexShrink: 0,
                        border: `1px solid ${on ? "var(--accent)" : mine ? "var(--accent-soft-bd)" : "var(--border-default)"}`,
                        background: on ? "var(--accent)" : past ? "var(--surface-sunken)" : mine ? "var(--accent-soft)" : "var(--surface)",
                        borderRadius: "var(--radius-md)",
                        opacity: past ? 0.5 : 1,
                        transition: "all var(--dur-fast) var(--ease-out)",
                      }}>
                      {mine && (
                        <span aria-hidden style={{ position: "absolute", top: 5, right: 5, width: 14, height: 14, borderRadius: "50%", background: on ? "rgba(255,255,255,0.22)" : "var(--accent)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                          {I("mic", { size: 9 })}
                        </span>
                      )}
                      <span className="cibol-numeral" style={{ fontSize: 17, fontWeight: 600, lineHeight: 1, color: on ? "#fff" : past ? "var(--text-faint)" : "var(--text-strong)" }}>{mt.mdLabel}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, whiteSpace: "nowrap", color: on ? "rgba(255,255,255,0.82)" : mine ? "var(--accent-text)" : "var(--text-faint)" }}>{daysLabel(mt)}</span>
                    </button>
                  );
                })}
              </div>

              {sel && (() => {
                const myReq = (myRequests as any[]).find((r) => r.fromMeetingId === sel.id || r.fromDate === sel.dateLabel) || null;
                const reqActive = myReq && ["pending", "submitted"].includes(myReq.status);
                const iPresent = sel.presenters.some((p) => p.name === me.name);
                return (
                <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid var(--border-subtle)", flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-start" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div className="cibol-eyebrow">{sel.dateLabel}</div>
                    {iPresent && !reqActive && <Button size="sm" variant="secondary" iconLeft={I("calendar-off")} onClick={() => onLeave(sel)}>申请请假</Button>}
                    <div style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 8 }}>
                      {sel.online && sel.online.url
                        ? <>
                            <IconButton size="sm" variant="solid" icon={I("video")} label="在线会议" onClick={() => window.open(sel.online.url, "_blank")} />
                            {admin && <Button size="sm" variant="ghost" iconLeft={I("rotate-cw")} loading={bookMeeting.isPending} disabled={bookMeeting.isPending} onClick={() => doBook(sel.id)}>{bookMeeting.isPending ? "预约中…" : "重新预约"}</Button>}
                          </>
                        : admin
                          ? <Button size="sm" variant="primary" iconLeft={I("video")} loading={bookMeeting.isPending}
                              onClick={() => doBook(sel.id)}>{bookMeeting.isPending ? "预约中…" : "预约腾讯会议"}</Button>
                          : <Badge tone="warning" size="sm" dot>在线会议待设置</Badge>}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 16, color: "var(--text-muted)", fontSize: 13, marginBottom: 14, flexWrap: "wrap" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{I("clock", { size: 14 })}{sel.time || md.time}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{I("map-pin", { size: 14 })}{sel.place || md.place}</span>
                    {sel.host && <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{I("mic", { size: 14 })}主持 {sel.host}</span>}
                  </div>
                  {sel.presenters.map((p) => (
                    <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 11, padding: "8px 0" }}>
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
            <div style={{ padding: 20, minWidth: 0, minHeight: 0, borderLeft: isMobile ? "none" : "1px solid var(--border-subtle)", borderTop: isMobile ? "1px solid var(--border-subtle)" : "none", display: "flex", flexDirection: "column" }}>
              {sel && sel.presenters.some((p) => p.name === me.name) ? (
                <div style={{ flex: 1, overflow: "auto" }}><MyTopicEditor meeting={sel} me={me} /></div>
              ) : (
                <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
                  <div className="cibol-eyebrow" style={{ marginBottom: 4 }}>我的报告</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-strong)", marginBottom: 4 }}>我的本学期报告</div>
                  <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 14 }}>点击日历中带标记的日子，设置该场汇报主题</p>
                  <MyReportsList meetings={MEETINGS} me={me} />
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    );
  }

  function MyReportsList({ meetings, me }: { meetings: Meeting[]; me: Me }) {
    // 从排期表派生：我作为报告人的场次，topic 直接取后端字段（单一数据源）。
    const REPORTS = (meetings || [])
      .filter((s) => s.presenters.some((p) => p.name === me.name))
      .map((s) => {
        const presenter = s.presenters.find((p) => p.name === me.name);
        return { id: s.id, date: s.dateLabel, kind: s.type, topic: presenter?.topic || "" };
      });
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
                <div style={{ fontSize: 12, color: "var(--text-faint)" }}>{r.topic ? "已设置主题" : "主题待定"}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "var(--surface-sunken)", borderRadius: "var(--radius-sm)" }}>
              <span style={{ flex: 1, fontSize: 13, color: r.topic ? "var(--text-body)" : "var(--text-faint)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {r.topic || "未设置主题 · 点日历中该场设置"}
              </span>
              {r.topic && I("check", { size: 14, style: { color: "var(--success)", flexShrink: 0 } })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // 单场汇报主题设置 —— 选中「我是报告人」的那场时展示，组员自行填写/修改本场主题。
  function MyTopicEditor({ meeting, me }: { meeting: Meeting; me: Me }) {
    const mine = meeting.presenters.find((p) => p.name === me.name);
    const saved = mine?.topic || "";
    const [topic, setTopic] = React.useState(saved);
    const setMyTopic = useSetMyTopic();
    React.useEffect(() => { setTopic(mine?.topic || ""); }, [meeting.id]); // eslint-disable-line react-hooks/exhaustive-deps
    const dirty = topic.trim() !== saved.trim();
    const save = () => setMyTopic.mutate(
      { meetingId: meeting.id, topic: topic.trim() },
      {
        onSuccess: () => toast("已保存汇报主题", { tone: "success" }),
        onError: (e: any) => toast(`保存失败：${e?.message || "请稍后重试"}`, { tone: "error" }),
      },
    );
    return (
      <div>
        <div className="cibol-eyebrow" style={{ marginBottom: 4 }}>我的汇报</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-strong)", marginBottom: 4 }}>设置本场汇报主题</div>
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 14 }}>{meeting.dateLabel} · 仅影响你自己这一场</p>
        <Textarea label="汇报主题" placeholder="填写你的汇报主题 / 文献标题（可含 DOI，较长亦可）" rows={4} maxLength={500} value={topic} onChange={(e) => setTopic(e.target.value)} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
          {saved
            ? <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--success-text)" }}>{I("check", { size: 14 })}已设置主题</span>
            : <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>尚未设置主题</span>}
          <div style={{ marginLeft: "auto" }}>
            <Button size="sm" variant="primary" iconLeft={I("check")} disabled={!dirty || setMyTopic.isPending} loading={setMyTopic.isPending} onClick={save}>{setMyTopic.isPending ? "保存中…" : "保存主题"}</Button>
          </div>
        </div>
      </div>
    );
  }

  function ReportRating({ index, presenter, candidates, onSubmit, isPending }: any) {
    const isMobile = useIsMobile();
    const [att, setAtt] = React.useState(0);
    const [pol, setPol] = React.useState(0);
    const [log, setLog] = React.useState(0);
    const [confirm, setConfirm] = React.useState(false);
    // discussion Top5 for THIS report — ordered slots, pick from candidates
    const [top5, setTop5] = React.useState([null, null, null, null, null]);
    const [picking, setPicking] = React.useState(null); // slot index being filled
    const chosen = top5.filter(Boolean);
    const setSlot = (i, name) => setTop5((t) => t.map((v, j) => (j === i ? name : v)));
    // clearSlot：移除该位置后将后续元素前移，保持列表无空洞
    const clearSlot = (i) => setTop5((t) => {
      const filled = t.filter(Boolean);
      filled.splice(i, 1);
      return [...filled, ...Array(5 - filled.length).fill(null)];
    });
    const move = (i, dir) => setTop5((t) => {
      const j = i + dir; if (j < 0 || j >= t.length) return t;
      const a = [...t]; [a[i], a[j]] = [a[j], a[i]]; return a;
    });
    // 提交门槛只要求三项报告评分完成；讨论 Top 5 可留空、可不选满（反馈 #3/#11：
    // 原先强制选满 min(5, 候选数)，候选不足或不想选满时按钮永久置灰 → 「无法提交打分结果」）。
    const missing = [att > 0 ? null : "报告态度", pol > 0 ? null : "制作精良", log > 0 ? null : "逻辑清晰"].filter(Boolean);
    const done = missing.length === 0;

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
              <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 10, padding: "16px 0", borderTop: "1px solid var(--border-subtle)" }}>
                <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-strong)" }}>逻辑清晰</span>
                <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>报告条理是否清楚、论证是否连贯</span>
                <ScoreDots value={log} onChange={setLog} />
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
                <div key={name ?? `slot-${i}`} style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", background: name ? "var(--surface)" : "transparent" }}>
                  <span className="cibol-numeral" style={{ fontSize: 15, color: name ? "var(--accent-text)" : "var(--text-faint)", width: 14, flexShrink: 0 }}>{i + 1}</span>
                  {name ? (
                    <>
                      <button type="button" onClick={() => setPicking(picking === i ? null : i)}
                        style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 9, border: "none", background: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
                        <Avatar name={name} size="xs" />
                        <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 500, color: "var(--text-strong)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
                      </button>
                      <div style={{ display: "flex", flexDirection: "column", gap: 0, flexShrink: 0 }}>
                        <button type="button" onClick={() => move(i, -1)} disabled={i === 0} style={{ border: "none", background: "none", cursor: i === 0 ? "default" : "pointer", color: i === 0 ? "var(--border-default)" : "var(--text-faint)", padding: 0, lineHeight: 0 }}>
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
                        </button>
                        <button type="button" onClick={() => move(i, 1)} disabled={i >= chosen.length - 1} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-faint)", padding: 0, lineHeight: 0 }}>
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                        </button>
                      </div>
                      <button type="button" onClick={() => clearSlot(i)} aria-label="移除" style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-faint)", padding: 0, lineHeight: 0, flexShrink: 0 }}>
                        {I("x", { size: 14 })}
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setPicking(picking === i ? null : i)}
                      style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, border: "none", background: "none", cursor: "pointer", padding: "2px 0", textAlign: "left", color: "var(--text-faint)", fontSize: 13 }}>
                      {I("plus", { size: 14 })}选择第 {i + 1} 名
                    </button>
                  )}
                  {picking === i && (
                    <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 30, maxHeight: 184, overflowY: "auto", background: "var(--surface-raised)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-lg)", padding: 5 }}>
                      {candidates.filter((c) => !chosen.includes(c) || c === name).map((c) => (
                        <button type="button" key={c} onClick={() => { setSlot(i, c); setPicking(null); }}
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
            {done ? "三项评分已完成，讨论 Top 5 可选填。评分匿名提交，报告人看不到具体打分人。" : `还需完成：${missing.join("、")}。讨论 Top 5 可留空，不必选满。`}
          </span>
          <Button size="sm" variant="primary" iconLeft={I("check")} disabled={!done} onClick={() => setConfirm(true)}>提交本报告评分</Button>
        </div>

        <Dialog open={confirm} onClose={() => setConfirm(false)}
          title="提交该报告评分" subtitle={`${presenter.name} · 提交后不可修改`}
          icon={I("check")} tone="accent" width={420}
          footer={<>
            <Button variant="ghost" onClick={() => setConfirm(false)}>再看看</Button>
            <Button variant="primary" disabled={isPending} onClick={() => { setConfirm(false); onSubmit({ attitude: att, polish: pol, logic: log, top5: chosen }); }}>确认提交</Button>
          </>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13.5, color: "var(--text-body)" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text-muted)" }}>报告态度</span><ScoreDots value={att} readOnly showValue /></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text-muted)" }}>制作精良</span><ScoreDots value={pol} readOnly showValue /></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text-muted)" }}>逻辑清晰</span><ScoreDots value={log} readOnly showValue /></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text-muted)" }}>讨论 Top 5</span><span style={{ fontWeight: 600 }}>已选 {chosen.length} 人</span></div>
          </div>
        </Dialog>
      </Card>
    );
  }

  function Rating() {
    const reportsQ = useEvalReports();
    const reports = reportsQ.data ?? [];
    const evQ = useEvalCompute();
    const ev = evQ.data;
    const { data: meetingsData = [] } = useMeetings();
    const submitRating = useSubmitRating();
    const [submitted, setSubmitted] = React.useState<Set<string>>(new Set());
    // 数据加载完成后，用后端返回的 rated_by 初始化 submitted，使刷新后已评状态持久化。
    React.useEffect(() => {
      if (!reportsQ.data) return;
      const preloaded = new Set<string>();
      for (const r of reportsQ.data) {
        for (const presenter of (r.rated_by ?? [])) {
          preloaded.add(`${r.key}__${presenter}`);
        }
      }
      setSubmitted(preloaded);
    }, [reportsQ.data]);
    // 评分对象 = 今天或最近已发生、且有报告人的那场（排除团建/工作坊/取消等空场）；
    // 都还没发生则取最近一场即将到来的，避免误把评选期最后一场当「今日组会」。
    const today = new Date(); today.setHours(0, 0, 0, 0);
    // 仅「参与评分」且有报告人的场进入评分入口；工作坊/团建/仅考勤（scored=false）不评分（#8）。
    const ratable = reports.filter((r: any) => (r.presenters || []).length > 0 && r.scored !== false);
    const ts = (r: any) => new Date(r.y, r.mo, r.day).getTime();
    const past = ratable.filter((r: any) => ts(r) <= today.getTime());
    const meeting: any = past.length
      ? past[past.length - 1]
      : (ratable.length ? ratable[0] : null);
    const isToday = !!meeting && ts(meeting) === today.getTime();
    // #2：今天若有组会但不是当前评分场（非评分活动 / 尚无报告人），说明「为什么不是今天」，
    // 避免首页「今天有组会」与评分页「最近组会」不一致造成困惑。
    const todayM = (meetingsData as Meeting[]).find((m) => m.y === today.getFullYear() && m.mo === today.getMonth() && m.day === today.getDate());
    const todayHint = todayM && todayM.id !== meeting?.key
      ? `今天的「${todayM.type}」${todayM.scored === false ? "不参与评分" : "暂无报告人或未开放评分"}，先为最近一场评分。`
      : "";
    const mtg = (meetingsData as Meeting[]).find((m) => m.id === meeting?.key);
    const presenters = (meeting?.presenters || []).map((name: string) => ({
      name,
      topic: mtg?.presenters?.find((p) => p.name === name)?.topic || "",
    }));
    const allNames = (ev?.rows || []).map((r) => r.name);
    // 过滤掉本场请假/缺席成员：他们未参与讨论，不应出现在 Top5 候选中
    const meetingAtt = (meeting?.attendance || {}) as Record<string, string>;
    const presentNames = allNames.filter((n) => !meetingAtt[n] || meetingAtt[n] === "present");
    const pending = presenters.map((p, i) => ({ p, i })).filter(({ p }) => !submitted.has(`${meeting?.key}__${p.name}`));
    // #11 提交后可改：已提交的报告人单列出来，点「修改」移回待评、重评会覆盖上次提交。
    const donePresenters = presenters.map((p, i) => ({ p, i })).filter(({ p }) => submitted.has(`${meeting?.key}__${p.name}`));
    const reopen = (name: string) => setSubmitted((s) => { const n = new Set(s); n.delete(`${meeting?.key}__${name}`); return n; });
    if (reportsQ.isLoading || evQ.isLoading) return <ScreenState loading />;
    if (reportsQ.isError) return <ScreenState error onRetry={() => reportsQ.refetch()} />;
    if (!meeting) {
      return <EmptyState title="暂无可评分的组会" description="评选期内还没有已结束的组会，组会结束后即可在此为报告人打分。" />;
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 16px", background: "var(--accent-soft)", border: "1px solid var(--accent-soft-bd)", borderRadius: "var(--radius-md)" }}>
          {I("clock", { size: 16, style: { color: "var(--accent-text)", marginTop: 1, flexShrink: 0 } })}
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 13.5, color: "var(--accent-text)" }}>{isToday ? "今日组会" : "最近组会"}·{meeting.dateLabel} · 为本场报告人评分</span>
            {todayHint && <span style={{ fontSize: 12, color: "var(--accent-text)", opacity: 0.8 }}>{todayHint}</span>}
          </div>
        </div>

        {pending.map(({ p, i }) => (
          <ReportRating key={p.name} index={i} presenter={p}
            candidates={presentNames.filter((n) => n !== p.name)}
            isPending={submitRating.isPending}
            onSubmit={(vals) => { submitRating.mutate({ key: meeting.key, presenter: p.name, attitude: vals.attitude, polish: vals.polish, logic: vals.logic, top5: vals.top5 }, { onSuccess: () => { toast("已提交 · 评分已计入表现统计"); setSubmitted((s) => new Set([...s, `${meeting.key}__${p.name}`])); }, onError: (e: any) => toast(`提交失败：${e?.detail || e?.message || "请稍后重试"}`, { tone: "error" }) }); }} />
        ))}

        {pending.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: "40px 20px 24px", textAlign: "center" }}>
            <span style={{ width: 48, height: 48, borderRadius: "var(--radius-lg)", background: "var(--success-soft)", color: "var(--success-text)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              {I("check-check", { size: 24 })}
            </span>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-strong)" }}>本次组会评分已全部提交</div>
            <p style={{ fontSize: 13.5, color: "var(--text-muted)" }}>如需更正，可在下方点「修改」重新评分（会覆盖上次）。</p>
          </div>
        )}

        {/* #11 已提交（可修改）*/}
        {donePresenters.length > 0 && (
          <div>
            <div className="cibol-eyebrow" style={{ marginBottom: 8 }}>已提交 · 可修改</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {donePresenters.map(({ p }) => (
                <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: "var(--radius-md)", background: "var(--surface-sunken)", border: "1px solid var(--border-subtle)" }}>
                  <Avatar name={p.name} size="xs" />
                  <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500, color: "var(--text-strong)" }}>{p.name}</span>
                  <Badge tone="success" size="sm" dot>已评</Badge>
                  <Button size="xs" variant="ghost" iconLeft={I("pencil")} onClick={() => reopen(p.name)}>修改</Button>
                </div>
              ))}
            </div>
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
            <button type="button" key={v} onClick={() => onPreset(v)}
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

  function MetricToggle({ value, onChange }: any) {
    const opts = [{ value: "total", label: "总分" }, { value: "report", label: "报告" }, { value: "discuss", label: "讨论" }];
    return (
      <div style={{ display: "inline-flex", padding: 3, gap: 2, background: "var(--surface-sunken)", borderRadius: "var(--radius-md)" }}>
        {opts.map((o) => (
          <button type="button" key={o.value} onClick={() => onChange(o.value)}
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
    // 仅取「我」本人的行；找不到（未纳入本期评分名册）则不展示，绝不回退到他人数据冒充。
    const row = ev?.rows.find((r) => r.name === me.name);
    if (!ev || !row) return null;
    const w: any = ev.weights;
    const wSum = (w.attitude + w.polish + (w.logic || 0) + w.attendance + w.discussion) || 1;
    const subs = [
      { label: "汇报态度", raw: row.attitude.toFixed(1), unit: "/ 5", norm: row.nAttitude, weight: w.attitude, color: "var(--terracotta-500)" },
      { label: "汇报精良", raw: row.polish.toFixed(1), unit: "/ 5", norm: row.nPolish, weight: w.polish, color: "var(--amber-500)" },
      { label: "逻辑清晰", raw: (row.logic ?? 0).toFixed(1), unit: "/ 5", norm: row.nLogic, weight: w.logic || 0, color: "var(--terracotta-400)" },
      { label: "讨论", raw: String(row.discuss), unit: "次", norm: row.nDisc, weight: w.discussion, color: "var(--slate-500)" },
      { label: "出勤", raw: row.attRate + "%", unit: "", norm: row.nAtt, weight: w.attendance, color: "var(--sage-500)" },
    ];
    return (
      <div style={{ padding: "16px 20px" }}>
        <button type="button" onClick={() => setOpen((o) => !o)}
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
    const cfgQ = useConfig(); // 学期起止日期
    const cfg = cfgQ.data;
    const fmtISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    const today = fmtISO(new Date());
    const getPreset = React.useCallback((p: string): [string, string] => {
      const now = new Date();
      const t = fmtISO(now);
      if (p === "month") { const f = new Date(now); f.setDate(f.getDate() - 30); return [fmtISO(f), t]; }
      if (p === "term") {
        const start = (cfg as any)?.semester?.start || (() => {
          const m = now.getMonth(), yr = now.getFullYear();
          return (m >= 1 && m <= 6) ? `${yr}-02-24` : `${m >= 8 ? yr : yr - 1}-09-01`;
        })();
        return [start, t];
      }
      if (p === "year") return [`${now.getFullYear()}-01-01`, t];
      return [t, t];
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [(cfg as any)?.semester?.start]);
    const META: Record<string, string> = { total: "总分", report: "报告", discuss: "讨论" };
    const [preset, setPreset] = React.useState("month");
    const [from, setFrom] = React.useState(() => getPreset("month")[0]);
    const [to, setTo] = React.useState(today);
    const [metric, setMetric] = React.useState("total");
    // cfg 加载后刷新"本学期"预设的起始日期
    React.useEffect(() => {
      if ((cfg as any)?.semester?.start && preset === "term") {
        const [f, t] = getPreset("term");
        setFrom(f); setTo(t);
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [(cfg as any)?.semester?.start]);
    const applyPreset = (p: string) => { const [f, t] = getPreset(p); setPreset(p); setFrom(f); setTo(t); };

    // 真实评选数据：来自后端引擎（与 demo 对拍一致）。
    const evQ = useEvalCompute();
    const excQ = useExcellence();
    const ev = evQ.data;
    const exc = excQ.data;
    const { data: series } = useRankSeries(me.name, from, to, metric);
    const total = ev?.rows.length ?? 0;
    const hasData = !!series && series.ranks.length > 0;
    const points = hasData ? series!.points : [{ label: "—" }];
    const ranks = hasData ? series!.ranks : [total];
    const evByName: any = {}; (ev?.rows || []).forEach((r) => { evByName[r.name] = r; });
    const mergedByName: any = {}; (ev?.merged || []).forEach((m) => { mergedByName[m.name] = m; });
    const awardRows = (exc?.names || []).map((n) => evByName[n]).filter(Boolean);
    if (evQ.isLoading || excQ.isLoading) return <ScreenState loading />;
    if (evQ.isError || excQ.isError) return <ScreenState error onRetry={() => { evQ.refetch(); excQ.refetch(); }} />;
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
        id: `${s.id}__${p.name}`, meetingId: s.id, date: s.dateLabel, mdLabel: s.mdLabel, type: s.type, name: p.name,
        topic: p.topic || "主题待定",
      })))
      .slice(0, 12);
    const picked = peerSessions.find((p) => p.id === swapId);
    React.useEffect(() => { if (!open) { setKind(""); setSwapId(""); setReason(""); } }, [open]);
    const submit = () => {
      if (kind === "swap") {
        if (!picked) return;
        createReq.mutate({ kind: "swap", fromDate: mine, toName: picked.name, toDate: picked.date, topic: picked.topic, reason, note: `已向 ${picked.name} 发送对调请求`, fromMeetingId: (session && session.id) || null, toMeetingId: picked.meetingId }, { onSuccess: () => { toast("已发送对调请求"); onClose(); }, onError: () => toast("发送失败，请重试", { tone: "error" }) });
      } else if (kind === "absence") {
        createReq.mutate({ kind: "absence", fromDate: mine, reason, note: "已提交轮空请假，等待管理员审批" }, { onSuccess: () => { toast("已提交请假申请"); onClose(); }, onError: () => toast("提交失败，请重试", { tone: "error" }) });
      } else return;
    };
    return (
      <Dialog open={open} onClose={onClose} title="申请请假" subtitle={`${mine} · 你是本次报告人之一`}
        icon={I("calendar-off")} tone="accent" width={480}
        footer={<>
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={!kind || (kind === "swap" && !swapId) || createReq.isPending} onClick={submit}>{createReq.isPending ? "提交中…" : kind === "absence" ? "提交申请（待审批）" : kind === "swap" ? "发送对调请求" : "提交"}</Button>
        </>}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-body)", marginBottom: 8 }}>请假方式</div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
              {[["absence", "轮空请假", "本次报告轮空 · 记为未出勤", "calendar-x"], ["swap", "对调请假", "与他人对调顺序 · 记为未出勤", "repeat"]].map(([v, t, sub, ic]) => (
                <button type="button" key={v} onClick={() => setKind(v)}
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
      <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, maxWidth: 1140, margin: "0 auto", padding: isMobile ? "16px 14px 28px" : "20px 32px 48px" }}>
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
