import React from "react";
import * as NS from "../ds";
import { I, Icon } from "../lib/icons";
import { toast } from "../store";
import { useConfig, useAnnouncements, useMeetings, useMyRequests, useAdvanceRequest } from "../api/hooks";
import { useIsMobile } from "../lib/useIsMobile";
import type { Me } from "../auth";

// Home dashboard — personal overview. Exports to window.CIBOL_Screens.Home
  const { Card, Button, Badge, Avatar, ScoreDots } = NS;

  const ANN_LEVELS = {
    info: { label: "通知", tone: "info", icon: "info" },
    important: { label: "重要", tone: "accent", icon: "megaphone" },
    urgent: { label: "紧急", tone: "danger", icon: "triangle-alert" },
  };
  const annTime = (iso) => { const d = new Date(iso); return `${d.getMonth() + 1}月${d.getDate()}日`; };
  const DISMISS_KEY = "cibol_dismissed_ann";

  // 全员公告横幅 —— 显示在所有用户首页顶部。多条时自动轮播，鼠标悬停暂停。
  function Announcements() {
    const { data: all = [] } = useAnnouncements();
    const [dismissed, setDismissed] = React.useState(() => { try { return JSON.parse(localStorage.getItem(DISMISS_KEY) || "[]"); } catch (e) { return []; } });
    const drop = (id) => { const next = [...new Set([...dismissed, id])]; setDismissed(next); try { localStorage.setItem(DISMISS_KEY, JSON.stringify(next)); } catch (e) {} };
    const list = all.filter((a) => a.pinned || !dismissed.includes(a.id));

    const [idx, setIdx] = React.useState(0);
    const n = list.length;
    const cur = Math.min(idx, Math.max(0, n - 1));
    const go = (i) => setIdx(((i % n) + n) % n);
    // keep index valid as the list shrinks (dismiss)
    React.useEffect(() => { if (idx > n - 1) setIdx(Math.max(0, n - 1)); }, [n]);
    if (!n) return null;

    const item = list[cur];
    const mm = ANN_LEVELS[item.level] || ANN_LEVELS.info;
    const multi = n > 1;

    return (
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Icon name="megaphone" style={{ width: 15, height: 15, color: "var(--accent)" }} />
          <span className="cibol-eyebrow">公告</span>
          <span style={{ minWidth: 18, height: 18, padding: "0 5px", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--surface-sunken)", color: "var(--text-muted)", fontSize: 11, fontWeight: 700, borderRadius: "var(--radius-pill)" }}>{n}</span>
          {multi && (
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 9 }}>
              {/* dot indicators */}
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                {list.map((x, i) => (
                  <button key={x.id} onClick={() => go(i)} aria-label={`第 ${i + 1} 条`}
                    style={{ width: i === cur ? 16 : 6, height: 6, padding: 0, border: "none", cursor: "pointer", borderRadius: "var(--radius-pill)", background: i === cur ? "var(--accent)" : "var(--border-strong)", transition: "all var(--dur-fast) var(--ease-out)" }} />
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                <button onClick={() => go(cur - 1)} aria-label="上一条" style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-faint)", padding: 2, lineHeight: 0 }}>
                  <Icon name="chevron-left" style={{ width: 16, height: 16 }} />
                </button>
                <button onClick={() => go(cur + 1)} aria-label="下一条" style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-faint)", padding: 2, lineHeight: 0 }}>
                  <Icon name="chevron-right" style={{ width: 16, height: 16 }} />
                </button>
              </div>
            </div>
          )}
        </div>
        {/* fixed-height banner — click the card to advance (no auto-rotate, no animation) */}
        <div
          onClick={multi ? () => go(cur + 1) : undefined}
          title={multi ? "点击查看下一条" : undefined}
          style={{ height: 116, display: "flex", gap: 13, alignItems: "flex-start", padding: "14px 16px", background: "var(--surface)", border: "1px solid var(--border-subtle)", borderLeft: `3px solid var(--${mm.tone})`, borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-xs)", cursor: multi ? "pointer" : "default", boxSizing: "border-box", overflow: "hidden" }}>
          <span style={{ width: 34, height: 34, flexShrink: 0, borderRadius: "var(--radius-md)", background: `var(--${mm.tone}-soft)`, color: `var(--${mm.tone}-text)`, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name={mm.icon} style={{ width: 17, height: 17 }} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 2 }}>
              <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-strong)" }}>{item.title}</span>
              <Badge tone={mm.tone} size="sm">{mm.label}</Badge>
              {item.pinned && <Badge tone="neutral" size="sm" dot>置顶</Badge>}
            </div>
            <p style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.body}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, fontSize: 12, color: "var(--text-faint)", whiteSpace: "nowrap" }}>
              <span>{item.author}</span><span>·</span><span>{annTime(item.publishedAt)}</span>
            </div>
          </div>
          {!item.pinned && (
            <button onClick={(e) => { e.stopPropagation(); drop(item.id); }} aria-label="忽略" style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-faint)", padding: 4, lineHeight: 0, flexShrink: 0 }}>
              <Icon name="x" style={{ width: 15, height: 15 }} />
            </button>
          )}
        </div>
      </div>
    );
  }

  function Home({ onNavigate, me }: { onNavigate: any; me: Me }) {
    const isMobile = useIsMobile();
    const { data: cfg } = useConfig();
    const { data: meetings = [] } = useMeetings();
    // 取真实今天（归一化到 0 点）→ 首页展示下一场即将到来的组会。
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const up = meetings.find((s) => new Date(s.y, s.mo, s.day) >= today)
      || meetings[meetings.length - 1];
    const m = up && cfg
      ? { date: up.dateLabel, time: up.time || cfg.meetingDefault.time, place: up.place || cfg.meetingDefault.place, online: up.online, presenters: up.presenters }
      : null;
    const iPresentNext = !!up && up.presenters.some((p) => p.name === me.name);
    const { data: myReqs = [] } = useMyRequests();
    const advance = useAdvanceRequest();
    const incoming = myReqs.find((r) => r.incoming && r.kind === "swap" && r.status === "pending");
    if (!cfg || !m) return null;
    return (
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: isMobile ? "16px 14px 28px" : "28px 32px 48px" }}>
        {/* greeting */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <Badge tone="accent" dot>{cfg.semester.short}</Badge>
          </div>
          <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 30, fontWeight: 600, color: "var(--text-strong)", letterSpacing: "-0.01em" }}>
            {me.name}，下午好
          </h2>
          <p style={{ color: "var(--text-muted)", marginTop: 6, fontSize: 15 }}>
            今天的组会已结束。{iPresentNext
              ? <>下周轮到你<strong style={{ color: "var(--accent-text)", fontWeight: 600 }}>报告</strong>，记得提前准备。</>
              : <>记得在窗口关闭前完成本次评分。</>}
          </p>
        </div>

        <Announcements />

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(280px,1fr))", gap: 20, alignItems: "stretch" }}>
          {/* next meeting */}
          <Card eyebrow="NEXT MEETING" title={m.date}
            style={{ height: "100%", display: "flex", flexDirection: "column" }}
            bodyStyle={{ flex: 1, minHeight: 0, maxHeight: 460, overflowY: "auto" }}
            action={<Button size="sm" variant="secondary" onClick={() => onNavigate("meetings")}>查看组会</Button>}>
            <div style={{ display: "flex", gap: 18, color: "var(--text-muted)", fontSize: 14, marginBottom: 16 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="clock" style={{ width: 15, height: 15 }} />{m.time}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="map-pin" style={{ width: 15, height: 15 }} />{m.place}</span>
            </div>
            {m.online && m.online.url && (
              <a href={m.online.url} target="_blank" rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 13px", marginBottom: 18, background: "var(--accent-soft)", border: "1px solid var(--accent-soft-bd)", borderRadius: "var(--radius-pill)", textDecoration: "none" }}>
                <Icon name="video" style={{ width: 15, height: 15, color: "var(--accent-text)" }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-text)" }}>加入在线会议</span>
                <Icon name="arrow-up-right" style={{ width: 14, height: 14, color: "var(--accent-text)" }} />
              </a>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {m.presenters.map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 13, padding: "12px 14px", background: "var(--surface-sunken)", borderRadius: "var(--radius-md)" }}>
                  <Avatar name={p.name} size="md" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 600, color: "var(--text-strong)" }}>{p.name}</span>
                    </div>
                    <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.topic}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* todo / pending */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20, height: "100%" }}>
            <Card eyebrow="TODO" title="需要你的回应"
              style={{ height: "100%", display: "flex", flexDirection: "column" }}
              bodyStyle={{ flex: 1, minHeight: 0, maxHeight: 460, overflowY: "auto" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {incoming && (
                <div style={{ display: "flex", gap: 11, alignItems: "flex-start", padding: "11px 12px", border: "1px solid var(--accent-soft-bd)", background: "var(--accent-soft)", borderRadius: "var(--radius-md)" }}>
                  <Icon name="repeat" style={{ width: 17, height: 17, color: "var(--accent-text)", marginTop: 1 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, color: "var(--text-strong)", fontWeight: 500 }}>{incoming.from}想和你对调报告</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "2px 0 8px" }}>{incoming.fromDate} ⇄ {incoming.toDate}</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Button size="sm" variant="primary" onClick={() => advance.mutate({ id: incoming.id, next: "accepted", note: `已接受 ${incoming.from} 的对调` }, { onSuccess: () => toast("已接受对调") })}>接受</Button>
                      <Button size="sm" variant="ghost" onClick={() => advance.mutate({ id: incoming.id, next: "declined", note: `已拒绝 ${incoming.from} 的对调` }, { onSuccess: () => toast("已拒绝对调") })}>拒绝</Button>
                    </div>
                  </div>
                </div>
                )}
                <div style={{ display: "flex", gap: 11, alignItems: "center", padding: "11px 12px", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)" }}>
                  <Icon name="star" style={{ width: 17, height: 17, color: "var(--text-muted)" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, color: "var(--text-strong)", fontWeight: 500 }}>为今日组会评分</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 1 }}>窗口 6 小时后关闭</div>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => onNavigate("meetings", { tab: "rating" })}>去评分</Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  export { Home };
