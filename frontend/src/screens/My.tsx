import React from "react";
import * as NS from "../ds";
import { I, Icon } from "../lib/icons";
import { toast } from "../store";
import type { Me } from "../auth";
import { useUpdateMe, useMyCredentials, useSaveCredential, useDeleteCredential, useEvalCompute, useChangePassword, useSubmitFeedback } from "../api/hooks";
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
      if (updateMe.isPending) return;
      if (!name.trim()) { toast("姓名不能为空", { tone: "error" }); return; }
      updateMe.mutate({ name: name.trim() }, { onSuccess: () => { setOpen(null); toast("已保存"); } });
    };
    return (
      <Pane title="账户资料" desc="你的基本信息，组内可见。" embedded={embedded}>
        <Row icon="user" label="姓名" value={me.name} open={open === "name"} onToggle={() => setOpen(open === "name" ? null : "name")}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", maxWidth: 420 }}>
            <Input label="姓名" value={name} onChange={(e: any) => setName(e.target.value)} iconLeft={I("user")} onKeyDown={(e: any) => { if (e.key === "Enter") saveName(); }} />
            <Button variant="primary" onClick={saveName} disabled={updateMe.isPending}>保存</Button>
          </div>
        </Row>
        <Row icon="graduation-cap" label="身份" value={me.title} />
        <Row icon="at-sign" label="邮箱" value={me.email} last />
      </Pane>
    );
  }

  // 服务器账密：用户级账号+密码（与服务器解耦、可多条、跨服务器共用），加密保存。
  // 与「服务器」页同一份存储（["credentials"] 查询键）→ 自动同步。
  function ServerCredsList() {
    const { data: credData } = useMyCredentials();
    const items: any[] = credData?.items || [];
    const feature = !!credData?.feature;
    const saveCred = useSaveCredential();
    const delCred = useDeleteCredential();
    const [adding, setAdding] = React.useState(false);
    const [editId, setEditId] = React.useState<string | null>(null);
    const [u, setU] = React.useState("");
    const [p, setP] = React.useState("");
    const reset = () => { setAdding(false); setEditId(null); setU(""); setP(""); };
    const save = () => {
      if (!u.trim()) { toast("请填写账号", { tone: "error" }); return; }
      if (!p) { toast("请填写密码", { tone: "error" }); return; }
      if (p.length < 6) { toast("密码至少 6 位", { tone: "error" }); return; }
      saveCred.mutate({ username: u.trim(), password: p },
        { onSuccess: () => { reset(); toast("已保存"); }, onError: (e: any) => toast(e?.message || "保存失败", { tone: "error" }) });
    };
    const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | null>(null);
    const del = (id: string) => delCred.mutate(id, {
      onSuccess: () => { setDeleteConfirmId(null); toast("已删除"); },
      onError: (e: any) => toast(e?.message || "删除失败", { tone: "error" }),
    });
    if (!feature) return <p style={{ fontSize: 13, color: "var(--text-faint)" }}>后端未启用账密加密，暂不能保存。</p>;
    const fieldBox = { display: "flex", flexDirection: "column" as const, gap: 10, maxWidth: 380 };
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((c) => {
          const isEdit = editId === c.id;
          return (
            <div key={c.id} style={{ border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "11px 13px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span className="cibol-mono" style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)" }}>{c.username}</span>
                <Badge tone="success" size="sm" dot>已保存</Badge>
                <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                  {deleteConfirmId === c.id ? (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setDeleteConfirmId(null)}>取消</Button>
                      <Button size="sm" variant="primary" onClick={() => del(c.id)} disabled={delCred.isPending}>确认删除</Button>
                    </>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setDeleteConfirmId(c.id)} disabled={delCred.isPending && deleteConfirmId === c.id}>删除</Button>
                  )}
                  <Button size="sm" variant={isEdit ? "ghost" : "secondary"} onClick={() => { if (isEdit) reset(); else { setAdding(false); setEditId(c.id); setU(c.username); setP(""); } }}>{isEdit ? "收起" : "改密码"}</Button>
                </div>
              </div>
              {isEdit && (
                <div style={{ ...fieldBox, marginTop: 11 }}>
                  <Input label="新密码" type="password" value={p} onChange={(e: any) => setP(e.target.value)} iconLeft={I("lock")} placeholder="加密保存" onKeyDown={(e: any) => { if (e.key === "Enter") save(); }} />
                  <Button variant="primary" style={{ alignSelf: "flex-start" }} onClick={save} disabled={saveCred.isPending}>保存</Button>
                </div>
              )}
            </div>
          );
        })}
        {adding ? (
          <div style={{ border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "11px 13px", ...fieldBox }}>
            <Input label="账号" value={u} onChange={(e: any) => setU(e.target.value)} iconLeft={I("user")} placeholder="username" />
            <Input label="密码" type="password" value={p} onChange={(e: any) => setP(e.target.value)} iconLeft={I("lock")} placeholder="加密保存，用于网页终端一键登录" onKeyDown={(e: any) => { if (e.key === "Enter") save(); }} />
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="primary" onClick={save} disabled={saveCred.isPending}>保存</Button>
              <Button variant="ghost" onClick={reset}>取消</Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="secondary" style={{ alignSelf: "flex-start" }} onClick={() => { reset(); setAdding(true); }}>+ 添加账号</Button>
        )}
        {!items.length && !adding && <p style={{ fontSize: 12.5, color: "var(--text-faint)", margin: 0 }}>还没有账号。添加后即可在服务器页一键登录（一个账号通常通所有机器）。</p>}
      </div>
    );
  }

  function Security({ open, setOpen, embedded }: any) {
    const { data: credData } = useMyCredentials();
    const n = credData?.items?.length || 0;
    const changePw = useChangePassword();
    const [oldPw, setOldPw] = React.useState("");
    const [newPw, setNewPw] = React.useState("");
    const [confirmPw, setConfirmPw] = React.useState("");
    const pwMismatch = confirmPw.length > 0 && newPw !== confirmPw;
    const canSubmit = oldPw.length > 0 && newPw.length >= 6 && newPw === confirmPw && !changePw.isPending;
    const submitPw = () => {
      if (!canSubmit) return;
      changePw.mutate({ old_password: oldPw, new_password: newPw }, {
        onSuccess: () => { toast("登录密码已更新"); setOldPw(""); setNewPw(""); setConfirmPw(""); setOpen(null); },
        onError: (e: any) => toast(e?.message || "密码修改失败", { tone: "error" }),
      });
    };
    return (
      <Pane title="安全" desc="登录密码与服务器账密。" embedded={embedded}>
        <Row icon="lock" label="登录密码" value="点击修改" open={open === "pw"} onToggle={() => setOpen(open === "pw" ? null : "pw")}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 380 }}>
            <Input label="当前密码" type="password" autoComplete="current-password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} />
            <Input label="新密码" type="password" autoComplete="new-password" hint="至少 6 位，再长一点更稳。" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
            <Input label="确认新密码" type="password" autoComplete="new-password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)}
              hint={pwMismatch ? "两次输入不一致" : undefined} />
            <Button variant="primary" style={{ alignSelf: "flex-start" }} disabled={!canSubmit} onClick={submitPw}>{changePw.isPending ? "更新中…" : "更新密码"}</Button>
          </div>
        </Row>
        <Row icon="server" label="服务器账密"
          valueNode={n
            ? <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Badge tone="success" size="sm" dot>{n} 个账号</Badge></span>
            : <span style={{ color: "var(--text-faint)" }}>服务器账号密码，用于网页终端一键登录</span>}
          open={open === "ssh"} onToggle={() => setOpen(open === "ssh" ? null : "ssh")} last>
          <ServerCredsList />
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
    const toggleEnabled = (id: string) => {
      const prevEnabled = enabled;
      const nextEnabled = { ...enabled, [id]: !enabled[id] };
      setEnabled(nextEnabled);
      const notify = Object.fromEntries(allItems.map((it) => [it.id, { on: nextEnabled[it.id], ...cfg[it.id] }]));
      updateMe.mutate(
        { settings: { ...(me.settings as any), notify } },
        {
          onSuccess: () => toast("已保存"),
          onError: () => { setEnabled(prevEnabled); toast("保存失败", { tone: "error" }); },
        },
      );
    };
    const setItemCfg = (id: string, patch: any) => {
      const prevCfg = cfg;
      const nextCfg = { ...cfg, [id]: { ...cfg[id], ...patch } };
      setCfg(nextCfg);
      const notify = Object.fromEntries(allItems.map((it) => [it.id, { on: enabled[it.id], ...nextCfg[it.id] }]));
      updateMe.mutate(
        { settings: { ...(me.settings as any), notify } },
        {
          onSuccess: () => toast("已保存"),
          onError: () => { setCfg(prevCfg); toast("保存失败", { tone: "error" }); },
        },
      );
    };

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
                        <Switch checked={on} onChange={() => toggleEnabled(it.id)} disabled={updateMe.isPending} />
                      </div>
                      {open && (
                        <div style={{ padding: "2px 16px 18px 50px", display: "flex", flexDirection: "column", gap: 14, animation: "cibol-fade var(--dur-base) var(--ease-out)" }}>
                          <NotifyField label="提醒方式">
                            <Seg value={c.channel} onChange={(v) => setItemCfg(it.id, { channel: v })} options={["站内", "邮件", "站内 + 邮件"]} disabled={updateMe.isPending} />
                          </NotifyField>
                          {it.timing && (
                            <NotifyField label="提前时间">
                              <Seg value={c.timing} onChange={(v) => setItemCfg(it.id, { timing: v })} options={it.timing} disabled={updateMe.isPending} />
                            </NotifyField>
                          )}
                          {it.scope && (
                            <NotifyField label="范围">
                              <Seg value={c.scope} onChange={(v) => setItemCfg(it.id, { scope: v })} options={it.scope} disabled={updateMe.isPending} />
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
    const [text, setText] = React.useState("");
    const submitFb = useSubmitFeedback();
    const send = () => {
      const body = text.trim();
      if (!body || submitFb.isPending) return;
      submitFb.mutate(body, {
        onSuccess: () => { toast("已匿名提交，谢谢你的反馈"); setText(""); },
        onError: () => toast("提交失败，请重试", { tone: "error" }),
      });
    };
    return (
      <Pane title="匿名意见" desc="完全匿名，PI 看不到是谁提的。" embedded={embedded}>
        <div style={{ padding: "8px 0 4px" }}>
          <Textarea placeholder="对组会安排、实验室运行有什么想法？" rows={5} maxLength={500} value={text} onChange={(e: any) => setText(e.target.value)} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
            <span style={{ fontSize: 12.5, color: "var(--text-faint)", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Icon name="shield-check" style={{ width: 14, height: 14 }} />提交后不记录任何身份信息
            </span>
            <Button variant="primary" iconLeft={I("send")} disabled={!text.trim() || submitFb.isPending} onClick={send}>匿名提交</Button>
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
    // 终极排名：来自后端 Borda 合并结果（merged.finalRank），不是单项组会排名。
    const { data: ev } = useEvalCompute();
    const myMerged = ev?.merged?.find((m: any) => m.name === me.name);
    const myRank = myMerged?.finalRank ?? 0;
    const rankTotal = ev?.rows?.length ?? 0;

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
          {myRank > 0 && (
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 18 }}>
            <button type="button" onClick={() => onNavigate("meetings", { tab: "rank" })}
              style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 16px", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", background: "var(--surface)", cursor: "pointer" }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-faint)" }}>总分排名</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, justifyContent: "flex-end" }}>
                  <span className="cibol-numeral" style={{ fontSize: 24, fontWeight: 600, color: "var(--text-strong)" }}>{myRank}</span>
                  <span style={{ fontSize: 13, color: "var(--text-muted)" }}>/ {rankTotal}</span>
                </div>
              </div>
              <Icon name="chevron-right" style={{ width: 16, height: 16, color: "var(--text-faint)" }} />
            </button>
          </div>
          )}
        </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "200px 1fr", gap: isMobile ? 18 : 28, alignItems: "start" }}>
          {/* left sub-nav */}
          <div style={{ display: "flex", flexDirection: "column", gap: 2, position: isMobile ? "static" : "sticky", top: 24 }}>
            {GROUPS.map((g) => {
              const on = g.id === group;
              return (
                <button type="button" key={g.id} onClick={() => go(g.id)}
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
            {([["组会请假", "calendar-off", () => onNavigate("meetings")], ["我的 API 密钥", "key-round", () => onNavigate("api")], ["服务器终端", "terminal", () => onNavigate("server")]] as [string, string, () => void][]).map(([t, ic, fn]) => (
              <button key={t} type="button" onClick={fn}
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
