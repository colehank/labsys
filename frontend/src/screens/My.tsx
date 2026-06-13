import React from "react";
import * as NS from "../ds";
import { I, Icon } from "../lib/icons";
import { toast } from "../store";
import type { Me } from "../auth";
import { useUpdateMe } from "../api/hooks";
import { useIsMobile } from "../lib/useIsMobile";

// My — 我的: a mature settings experience.
// Read-first / edit-on-demand: each setting shows its current state as a quiet
// row; the editor reveals only when invoked. Grouped under a left sub-nav.
  const { Card, Button, Badge, Input, Switch, Textarea, Avatar } = NS;

  const GROUPS = [
    { id: "account", label: "账户资料", icon: "user" },
    { id: "security", label: "安全", icon: "shield" },
    { id: "notify", label: "通知提醒", icon: "bell" },
    { id: "feedback", label: "匿名意见", icon: "message-square" },
  ];

  /* A settings row: label + current value on the left, action on the right,
     with an editor that expands inline below when opened. */
  function Row({ icon, label, value, valueNode, actionLabel = "更改", open, onToggle, children, last }: any) {
    return (
      <div style={{ borderBottom: last ? "none" : "1px solid var(--border-subtle)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 4px" }}>
          {icon && (
            <span style={{ width: 34, height: 34, flexShrink: 0, borderRadius: "var(--radius-md)", background: "var(--surface-sunken)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
              <span style={{ width: 17, height: 17, display: "inline-flex" }}>{I(icon, { size: 17 })}</span>
            </span>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>{label}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{valueNode || value}</div>
          </div>
          {onToggle && (
            <Button size="sm" variant={open ? "ghost" : "secondary"} onClick={onToggle}>
              {open ? "收起" : actionLabel}
            </Button>
          )}
        </div>
        {open && (
          <div style={{ padding: "4px 4px 22px 48px", animation: "cibol-fade var(--dur-base) var(--ease-out)" }}>
            {children}
          </div>
        )}
      </div>
    );
  }

  function Pane({ title, desc, embedded, children }: any) {
    return (
      <div>
        <div style={{ marginBottom: 6 }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-strong)" }}>{title}</h3>
          {desc && !embedded && <p style={{ fontSize: 13.5, color: "var(--text-muted)", marginTop: 3 }}>{desc}</p>}
        </div>
        <Card padding="md" style={{ marginTop: 16 }}>
          <div style={{ padding: "0 4px" }}>{children}</div>
        </Card>
      </div>
    );
  }

  function Account({ open, setOpen, me, embedded }: any) {
    const [name, setName] = React.useState(me.name);
    const updateMe = useUpdateMe();
    React.useEffect(() => { setName(me.name); }, [me.name]);
    const saveName = () => {
      updateMe.mutate({ name }, { onSuccess: () => { setOpen(null); toast("已保存"); } });
    };
    return (
      <Pane title="账户资料" desc="你的基本信息，组内可见。" embedded={embedded}>
        <Row icon="user" label="姓名" value={me.name} open={open === "name"} onToggle={() => setOpen(open === "name" ? null : "name")}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", maxWidth: 420 }}>
            <Input label="姓名" value={name} onChange={(e: any) => setName(e.target.value)} iconLeft={I("user")} />
            <Button variant="primary" onClick={saveName} disabled={updateMe.isPending}>保存</Button>
          </div>
        </Row>
        <Row icon="graduation-cap" label="身份" value={me.title} />
        <Row icon="at-sign" label="邮箱" value={me.email} last />
      </Pane>
    );
  }

  function Security({ open, setOpen, me, embedded }: any) {
    const [sshKey, setSshKey] = React.useState(me.ssh_pubkey || "");
    const updateMe = useUpdateMe();
    React.useEffect(() => { setSshKey(me.ssh_pubkey || ""); }, [me.ssh_pubkey]);
    const saveSsh = () => {
      updateMe.mutate({ ssh_pubkey: sshKey }, { onSuccess: () => { setOpen(null); toast("已保存"); } });
    };
    return (
      <Pane title="安全" desc="登录密码与服务器访问凭据。" embedded={embedded}>
        <Row icon="lock" label="登录密码" value="上次更新 · 30 天前" open={open === "pw"} onToggle={() => setOpen(open === "pw" ? null : "pw")}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 380 }}>
            <Input label="当前密码" type="password" />
            <Input label="新密码" type="password" hint="至少 8 位，再长一点更稳。" />
            <Button variant="primary" style={{ alignSelf: "flex-start" }} onClick={() => setOpen(null)}>更新密码</Button>
          </div>
        </Row>
        <Row icon="server" label="SSH 公钥"
          valueNode={me.ssh_pubkey
            ? <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><span className="cibol-mono">{String(me.ssh_pubkey).slice(0, 24)}…</span><Badge tone="success" size="sm" dot>已配置</Badge></span>
            : <span style={{ color: "var(--text-faint)" }}>未配置</span>}
          open={open === "ssh"} onToggle={() => setOpen(open === "ssh" ? null : "ssh")} last>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 380 }}>
            <Textarea label="SSH 公钥" value={sshKey} onChange={(e: any) => setSshKey(e.target.value)} rows={3} placeholder="ssh-ed25519 AAAA..." />
            <Button variant="primary" style={{ alignSelf: "flex-start" }} onClick={saveSsh} disabled={updateMe.isPending}>保存凭据</Button>
          </div>
        </Row>
      </Pane>
    );
  }

  // —— 通知提醒：分组的可展开设置 ——
  const NOTIFY_SECTIONS = [
    {
      id: "meeting", label: "组会提醒", icon: "presentation",
      items: [
        { id: "m-eve", title: "组会提醒", desc: "每场组会前几天提醒你参加", on: true, timing: ["前 1 天", "前 2 天", "前 3 天"], timingDefault: "前 1 天" },
        { id: "m-mine", title: "轮到我报告时提前提醒", desc: "需你汇报的组会前几天提醒你参加", on: true, timing: ["前 1 天", "前 3 天", "前 5 天"], timingDefault: "前 3 天" },
        { id: "m-rate", title: "评分窗口开放提醒", desc: "组会结束、评分开放时提醒你尽快完成评分", on: false },
      ],
    },
    {
      id: "task", label: "事务状态提醒", icon: "list-checks",
      items: [
        { id: "t-server", title: "服务器账号申请", desc: "开通或驳回时提醒你" , on: true },
        { id: "t-api", title: "API 密钥申请", desc: "通过或驳回时提醒你", on: true },
        { id: "t-leave", title: "请假与轮空状态", desc: "缺席 / 对调审批有结果时提醒", on: true },
        { id: "t-swap", title: "收到对调请求", desc: "有人请求与你对调报告时提醒", on: true },
      ],
    },
    {
      id: "announce", label: "实验室公告", icon: "megaphone",
      items: [
        { id: "a-all", title: "公告发布提醒", desc: "管理员发布全员公告时提醒你", on: true, scope: ["全部公告", "仅重要 / 紧急"], scopeDefault: "全部公告" },
      ],
    },
  ];

  function Seg({ value, onChange, options }: any) {
    return (
      <div style={{ display: "inline-flex", padding: 3, gap: 2, background: "var(--surface-sunken)", borderRadius: "var(--radius-md)" }}>
        {options.map((o) => (
          <button key={o} type="button" onClick={() => onChange(o)}
            style={{ padding: "5px 12px", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 600, borderRadius: "var(--radius-sm)",
              background: value === o ? "var(--surface-raised)" : "transparent",
              color: value === o ? "var(--accent-text)" : "var(--text-muted)",
              boxShadow: value === o ? "var(--shadow-xs)" : "none", transition: "all var(--dur-fast) var(--ease-out)" }}>{o}</button>
        ))}
      </div>
    );
  }

  function NotifyField({ label, children }: any) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: "var(--text-muted)", minWidth: 64 }}>{label}</span>
        {children}
      </div>
    );
  }

  function Notify({ me, embedded }: any) {
    const allItems: any[] = NOTIFY_SECTIONS.flatMap((s) => s.items);
    const saved = (me.settings && (me.settings as any).notify) || {};
    const updateMe = useUpdateMe();
    const [enabled, setEnabled] = React.useState(() => Object.fromEntries(allItems.map((it) => [it.id, saved[it.id]?.on ?? it.on])));
    const [openId, setOpenId] = React.useState(null);
    const [cfg, setCfg] = React.useState(() => Object.fromEntries(allItems.map((it) => [it.id, {
      channel: saved[it.id]?.channel ?? "站内",
      timing: saved[it.id]?.timing ?? (it.timingDefault || null),
      scope: saved[it.id]?.scope ?? (it.scopeDefault || null),
    }])));
    // 持久化：把当前开关 + 每项配置写入 settings.notify。
    const persist = (en: any, c: any) => {
      const notify = Object.fromEntries(allItems.map((it) => [it.id, { on: en[it.id], ...c[it.id] }]));
      updateMe.mutate({ settings: { ...(me.settings as any), notify } }, { onSuccess: () => toast("已保存") });
    };
    const setItemCfg = (id, patch) => setCfg((c) => {
      const next = { ...c, [id]: { ...c[id], ...patch } };
      persist(enabled, next);
      return next;
    });
    const toggleEnabled = (id: string) => setEnabled((e) => {
      const next = { ...e, [id]: !e[id] };
      persist(next, cfg);
      return next;
    });

    return (
      <Pane title="通知提醒" desc="设置本系统的所有提醒类型，按需展开调整每一种提醒。" embedded={embedded}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {NOTIFY_SECTIONS.map((sec, si) => (
            <div key={sec.id} style={{ paddingTop: si === 0 ? 4 : 18 }}>
              {/* 分组标题 */}
              <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 4px 8px" }}>
                <Icon name={sec.icon} style={{ width: 15, height: 15, color: "var(--accent)" }} />
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-faint)" }}>{sec.label}</span>
              </div>
              <div style={{ border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
                {sec.items.map((it, ii) => {
                  const open = openId === it.id;
                  const on = enabled[it.id];
                  const c = cfg[it.id];
                  return (
                    <div key={it.id} style={{ borderTop: ii > 0 ? "1px solid var(--border-subtle)" : "none", background: open ? "var(--surface-sunken)" : "transparent", transition: "background var(--dur-fast) var(--ease-out)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 14px" }}>
                        <button type="button" onClick={() => setOpenId(open ? null : it.id)} aria-label={open ? "收起" : "展开"}
                          style={{ flexShrink: 0, width: 24, height: 24, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "none", background: "transparent", cursor: "pointer", color: "var(--text-faint)" }}>
                          <Icon name={open ? "chevron-down" : "chevron-right"} style={{ width: 16, height: 16 }} />
                        </button>
                        <button type="button" onClick={() => setOpenId(open ? null : it.id)}
                          style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", cursor: "pointer", textAlign: "left", padding: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>{it.title}</div>
                          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>{it.desc}</div>
                        </button>
                        <Switch checked={on} onChange={() => toggleEnabled(it.id)} />
                      </div>
                      {open && (
                        <div style={{ padding: "2px 16px 18px 50px", display: "flex", flexDirection: "column", gap: 14, animation: "cibol-fade var(--dur-base) var(--ease-out)" }}>
                          <NotifyField label="提醒方式">
                            <Seg value={c.channel} onChange={(v) => setItemCfg(it.id, { channel: v })} options={["站内", "邮件", "站内 + 邮件"]} />
                          </NotifyField>
                          {it.timing && (
                            <NotifyField label="提前时间">
                              <Seg value={c.timing} onChange={(v) => setItemCfg(it.id, { timing: v })} options={it.timing} />
                            </NotifyField>
                          )}
                          {it.scope && (
                            <NotifyField label="范围">
                              <Seg value={c.scope} onChange={(v) => setItemCfg(it.id, { scope: v })} options={it.scope} />
                            </NotifyField>
                          )}
                          {!on && (
                            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--text-faint)" }}>
                              <Icon name="bell-off" style={{ width: 13, height: 13 }} />
                              <span>此提醒当前已关闭，打开右侧开关后以上设置才会生效。</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Pane>
    );
  }

  function Feedback({ embedded }: any) {
    return (
      <Pane title="匿名意见" desc="完全匿名，PI 看不到是谁提的。" embedded={embedded}>
        <div style={{ padding: "8px 0 4px" }}>
          <Textarea placeholder="对组会安排、实验室运行有什么想法？" rows={5} maxLength={500} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
            <span style={{ fontSize: 12.5, color: "var(--text-faint)", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Icon name="shield-check" style={{ width: 14, height: 14 }} />提交后不记录任何身份信息
            </span>
            <Button variant="primary" iconLeft={I("send")}>匿名提交</Button>
          </div>
        </div>
      </Pane>
    );
  }

  function My({ onNavigate, embedded, me }: { onNavigate: any; embedded?: boolean; me: Me }) {
    const isMobile = useIsMobile();
    const [group, setGroup] = React.useState("account");
    const [open, setOpen] = React.useState(null);
    const go = (g) => { setGroup(g); setOpen(null); };

    return (
      <div style={{ maxWidth: embedded ? "none" : 940, margin: "0 auto", padding: embedded ? (isMobile ? "16px 14px 24px" : "22px 24px 32px") : (isMobile ? "16px 14px 40px" : "24px 32px 56px") }}>
        {/* profile header — only on the standalone page, not the 设置 dialog */}
        {!embedded && (
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 28, flexWrap: "wrap" }}>
          <Avatar name={me.name} size="xl" presence="online" />
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 26, fontWeight: 600, color: "var(--text-strong)" }}>{me.name}</h2>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 2 }}>{me.title} · {me.email}</p>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 18 }}>
            <button onClick={() => onNavigate("meetings", { tab: "rank" })}
              style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 16px", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", background: "var(--surface)", cursor: "pointer" }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-faint)" }}>总分排名</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, justifyContent: "flex-end" }}>
                  <span className="cibol-numeral" style={{ fontSize: 24, fontWeight: 600, color: "var(--text-strong)" }}>3</span>
                  <span style={{ fontSize: 13, color: "var(--text-muted)" }}>/ 14</span>
                </div>
              </div>
              <Icon name="chevron-right" style={{ width: 16, height: 16, color: "var(--text-faint)" }} />
            </button>
          </div>
        </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "200px 1fr", gap: isMobile ? 18 : 28, alignItems: "start" }}>
          {/* left sub-nav */}
          <div style={{ display: "flex", flexDirection: "column", gap: 2, position: isMobile ? "static" : "sticky", top: 24 }}>
            {GROUPS.map((g) => {
              const on = g.id === group;
              return (
                <button key={g.id} onClick={() => go(g.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", border: "none",
                    borderRadius: "var(--radius-md)", cursor: "pointer", textAlign: "left",
                    background: on ? "var(--accent-soft)" : "transparent",
                    color: on ? "var(--accent-text)" : "var(--text-body)",
                    fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: on ? 600 : 500,
                    transition: "background var(--dur-fast) var(--ease-out)",
                  }}>
                  <Icon name={g.icon} style={{ width: 17, height: 17, color: on ? "var(--accent)" : "var(--text-muted)" }} />
                  {g.label}
                </button>
              );
            })}
            <div style={{ height: 1, background: "var(--border-subtle)", margin: "10px 12px", display: embedded ? "none" : "block" }} />
            {!embedded && <>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-faint)", padding: "4px 12px 6px" }}>快捷入口</div>
            {([["组会请假", "calendar-off", () => onNavigate("meetings")], ["我的 API 密钥", "key-round", () => onNavigate("api")], ["服务器终端", "terminal", () => onNavigate("server")]] as [string, string, () => void][]).map(([t, ic, fn], i) => (
              <button key={i} onClick={fn}
                style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 12px", border: "none", borderRadius: "var(--radius-md)", cursor: "pointer", textAlign: "left", background: "transparent", color: "var(--text-muted)", fontFamily: "var(--font-sans)", fontSize: 13.5 }}>
                <Icon name={ic} style={{ width: 16, height: 16, color: "var(--text-faint)" }} />
                <span style={{ flex: 1 }}>{t}</span>
                <Icon name="arrow-up-right" style={{ width: 14, height: 14, color: "var(--text-faint)" }} />
              </button>
            ))}
            </>}
          </div>

          {/* right content */}
          <div>
            {group === "account" && <Account open={open} setOpen={setOpen} me={me} embedded={embedded} />}
            {group === "security" && <Security open={open} setOpen={setOpen} me={me} embedded={embedded} />}
            {group === "notify" && <Notify me={me} embedded={embedded} />}
            {group === "feedback" && <Feedback embedded={embedded} />}
          </div>
        </div>
      </div>
    );
  }

  export { My };
