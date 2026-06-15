import React from "react";
import * as NS from "../ds";
import { I, Icon } from "../lib/icons";
import { toast } from "../store";
import { useAnnouncements, usePublishAnnouncement, useTogglePin, useRemoveAnnouncement } from "../api/hooks";
import { useIsMobile } from "../lib/useIsMobile";

// AdminAnnounce — 通知公告: 管理员撰写并发布面向全员的公告，发布后显示在所有用户首页。
// 公告 schema 见 ui_kits/_shared/store.js 顶部。
  const { Card, Button, Badge, Input, Textarea, Select, Switch, IconButton, Dialog } = NS;

  const LEVELS = {
    info: { label: "通知", tone: "info", icon: "info" },
    important: { label: "重要", tone: "accent", icon: "megaphone" },
    urgent: { label: "紧急", tone: "danger", icon: "triangle-alert" },
  };
  const AUDIENCE = { all: "全体成员", students: "仅在读学生" };

  const fmtTime = (iso) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  const isExpired = (a) => a.expiresAt && a.expiresAt < new Date().toISOString().slice(0, 10);

  function Compose({ onPublish }: any) {
    const isMobile = useIsMobile();
    const empty = { title: "", body: "", level: "info", pinned: false, audience: "all", expiresAt: "" };
    const [f, setF] = React.useState(empty);
    const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
    const valid = f.title.trim() && f.body.trim();
    const publish = usePublishAnnouncement();
    const ds = { height: 38, padding: "0 11px", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", background: "var(--surface)", color: "var(--text-strong)", fontFamily: "var(--font-sans)", fontSize: 14, colorScheme: "light dark", width: "100%" };

    const submit = () => {
      if (!valid || publish.isPending) return;
      // author 留空 —— 后端按当前登录管理员真实姓名填充（管理员 · {name}），不写死。
      publish.mutate(
        { title: f.title, body: f.body, level: f.level as "info" | "important" | "urgent", pinned: f.pinned, audience: f.audience, author: "", expiresAt: f.expiresAt || null },
        {
          onSuccess: () => { toast("已发布"); setF(empty); onPublish && onPublish(); },
          onError: () => toast("发布失败，请重试", { tone: "error" }),
        },
      );
    };

    return (
      <Card eyebrow="撰写公告" title="发布新通知">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Input label="标题" placeholder="例如：暑期组会时间调整" value={f.title} onChange={(e) => set("title", e.target.value)} iconLeft={I("type")} maxLength={40} />
          <Textarea label="正文" placeholder="写清公告详情，将原样显示在成员首页。" rows={4} maxLength={300} value={f.body} onChange={(e) => set("body", e.target.value)} />

          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-body)", marginBottom: 8 }}>级别</div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 10 }}>
              {Object.entries(LEVELS).map(([v, m]) => {
                const on = f.level === v;
                return (
                  <button key={v} onClick={() => set("level", v)}
                    style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 13px", cursor: "pointer",
                      border: `1.5px solid ${on ? `var(--${m.tone})` : "var(--border-default)"}`,
                      background: on ? `var(--${m.tone}-soft)` : "var(--surface)", borderRadius: "var(--radius-md)" }}>
                    <Icon name={m.icon} style={{ width: 17, height: 17, color: on ? `var(--${m.tone}-text)` : "var(--text-muted)" }} />
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: on ? `var(--${m.tone}-text)` : "var(--text-body)" }}>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
            <Select label="受众" value={f.audience} onChange={(e) => set("audience", e.target.value)}
              options={Object.entries(AUDIENCE).map(([value, label]) => ({ value, label }))} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-body)", marginBottom: 6 }}>失效时间（可选）</div>
              <input type="date" value={f.expiresAt} onChange={(e) => set("expiresAt", e.target.value)} style={ds} />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 14, borderTop: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Switch checked={f.pinned} onChange={(v) => set("pinned", v)} />
              <span style={{ fontSize: 13.5, color: "var(--text-body)" }}>置顶展示</span>
            </div>
            <Button variant="primary" iconLeft={I("send")} disabled={!valid || publish.isPending} onClick={submit}>发布到全员首页</Button>
          </div>
        </div>
      </Card>
    );
  }

  function PublishedRow({ a, last }: any) {
    const m = LEVELS[a.level] || LEVELS.info;
    const expired = isExpired(a);
    const [confirm, setConfirm] = React.useState(false);
    const togglePin = useTogglePin();
    const remove = useRemoveAnnouncement();
    return (
      <div style={{ display: "flex", gap: 13, alignItems: "flex-start", padding: "15px 4px", borderBottom: last ? "none" : "1px solid var(--border-subtle)", opacity: expired ? 0.6 : 1 }}>
        <span style={{ width: 34, height: 34, flexShrink: 0, borderRadius: "var(--radius-md)", background: `var(--${m.tone}-soft)`, color: `var(--${m.tone}-text)`, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name={m.icon} style={{ width: 16, height: 16 }} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>{a.title}</span>
            <Badge tone={m.tone} size="sm">{m.label}</Badge>
            {a.pinned && <Badge tone="neutral" size="sm" dot>置顶</Badge>}
            {expired ? <Badge tone="neutral" size="sm">已失效</Badge> : <Badge tone="success" size="sm" dot>展示中</Badge>}
          </div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>{a.body}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 7, fontSize: 12, color: "var(--text-faint)", flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}><Icon name="user" style={{ width: 12, height: 12 }} />{a.author}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}><Icon name="clock" style={{ width: 12, height: 12 }} />{fmtTime(a.publishedAt)}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}><Icon name="users" style={{ width: 12, height: 12 }} />{AUDIENCE[a.audience] || "全体成员"}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}><Icon name="calendar-x" style={{ width: 12, height: 12 }} />{a.expiresAt ? `${a.expiresAt} 失效` : "长期有效"}</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <IconButton size="sm" icon={I("pin")} label={a.pinned ? "取消置顶" : "置顶"} active={a.pinned} onClick={() => togglePin.mutate(a.id, { onSuccess: () => toast(a.pinned ? "已取消置顶" : "已置顶") })} />
          <IconButton size="sm" icon={I("trash-2")} label="下线" onClick={() => setConfirm(true)} />
        </div>
        <Dialog open={confirm} onClose={() => setConfirm(false)} title="下线该公告" subtitle={a.title}
          icon={I("trash-2")} tone="danger" width={400}
          footer={<>
            <Button variant="ghost" onClick={() => setConfirm(false)}>取消</Button>
            <Button variant="primary" onClick={() => { remove.mutate(a.id, { onSuccess: () => toast("已下线") }); setConfirm(false); }}>确认下线</Button>
          </>}>
          <p style={{ fontSize: 13.5, color: "var(--text-body)", lineHeight: 1.6 }}>下线后该公告将立即从所有成员首页移除，且无法恢复。</p>
        </Dialog>
      </div>
    );
  }

  function AdminAnnounce() {
    const isMobile = useIsMobile();
    const { data: list = [] } = useAnnouncements();
    const liveCount = list.filter((a) => !isExpired(a)).length;

    return (
      <div style={{ maxWidth: 860, margin: "0 auto", padding: isMobile ? "16px 14px 48px" : "24px 32px 48px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-strong)" }}>通知公告</h2>
          <p style={{ fontSize: 13.5, color: "var(--text-muted)", marginTop: 3 }}>发布的公告会显示在所有成员的首页，可设级别、置顶与失效时间。</p>
        </div>

        <Compose />

        <Card eyebrow={`已发布 · ${liveCount} 条展示中`} title="公告列表" padding="md">
          {list.length ? (
            <div style={{ marginTop: 2 }}>
              {list.map((a, i) => <PublishedRow key={a.id} a={a} last={i === list.length - 1} />)}
            </div>
          ) : (
            <div style={{ padding: "32px 0", textAlign: "center", fontSize: 13.5, color: "var(--text-faint)" }}>还没有发布任何公告。</div>
          )}
        </Card>
      </div>
    );
  }

  export { AdminAnnounce };
