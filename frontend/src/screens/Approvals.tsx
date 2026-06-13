import React from "react";
import * as NS from "../ds";
import { I, Icon } from "../lib/icons";
import { toast } from "../store";
import { usePendingRequests, useProcessedRequests, useAdvanceRequest } from "../api/hooks";
import { useIsMobile } from "../lib/useIsMobile";

// Approvals — 管理员审批中心. 从 store 读取成员提交的申请，需管理员动作的项:
//  · 轮空请假 (approve/reject)
//  · API 密钥申请 — 填入密钥后通过
//  · 服务器账号申请 — 填入账号+密码后通过
// 处理结果回写 store，申请人在「消息 · 申请」里实时看到。对调为对方确认，不在此出现。
  const { Card, Button, Badge, Avatar, Tabs, Dialog, Input, Textarea, IconButton } = NS;

  // 请求 kind → 审批卡片展示。
  const KIND_UI = {
    absence: { type: "leave", icon: "calendar-x", tone: "danger", title: "轮空请假", detail: (r) => `${r.fromDate || ""} · ${r.reason || ""}` },
    api: { type: "api", icon: "key-round", tone: "info", title: "API 密钥申请", detail: (r) => r.detail || r.reason || "", budget: (r) => { const m = (r.detail || "").match(/¥\s*(\d+)/); return m ? +m[1] : 100; } },
    ssh: { type: "ssh", icon: "server-cog", tone: "warning", title: "服务器账号申请", detail: (r) => r.detail || r.reason || "", wantUser: (r) => { const m = (r.detail || "").match(/用户名\s*([A-Za-z0-9_]+)/); return m ? m[1] : ""; } },
  };
  const toCard = (r) => { const u = KIND_UI[r.kind]; return { id: r.id, reqId: r.id, type: u.type, who: r.from, icon: u.icon, tone: u.tone, title: u.title, detail: u.detail(r), budget: u.budget && u.budget(r), wantUser: u.wantUser && u.wantUser(r) }; };

  const randKey = () => "sk-cibol-" + Math.random().toString(36).slice(2, 10) + "…" + Math.random().toString(36).slice(2, 4);
  const randPw = () => Math.random().toString(36).slice(2, 11) + "A7";

  function ProvisionDialog({ item, onClose, onConfirm }: any) {
    const isApi = item && item.type === "api";
    const [key, setKey] = React.useState("");
    const [user, setUser] = React.useState(item && item.wantUser || "");
    const [host, setHost] = React.useState("lab-gpu-03.cibol.lab");
    const [pw, setPw] = React.useState("");
    React.useEffect(() => {
      if (!item) return;
      setKey(""); setPw(""); setUser(item.wantUser || ""); setHost("lab-gpu-03.cibol.lab");
    }, [item]);

    if (!item) return null;
    const ready = isApi ? key.trim().length > 4 : (user.trim() && pw.trim());

    return (
      <Dialog open={!!item} onClose={onClose}
        title={isApi ? "通过并下发密钥" : "通过并配置账号"}
        subtitle={`${item.who} · ${item.title}`}
        icon={I(isApi ? "key-round" : "server-cog")} tone="accent" width={480}
        footer={<>
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={!ready} onClick={() => onConfirm(item)}>确认通过</Button>
        </>}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {isApi ? (
            <>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-body)" }}>API 密钥</span>
                  <button onClick={() => setKey(randKey())} style={{ border: "none", background: "none", color: "var(--accent-text)", fontSize: 12.5, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    {I("sparkles", { size: 13 })}生成
                  </button>
                </div>
                <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="粘贴或生成密钥" iconLeft={I("key-round")} />
              </div>
              <Input label="预算上限" defaultValue={String(item.budget)} suffix="¥" iconLeft={I("wallet")} />
              <div style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "10px 12px", background: "var(--surface-sunken)", borderRadius: "var(--radius-md)" }}>
                {I("info", { size: 15, style: { color: "var(--text-muted)", marginTop: 1 } })}
                <span style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5 }}>通过后密钥会出现在 {item.who} 的「我的 · API 密钥」中。</span>
              </div>
            </>
          ) : (
            <>
              <Input label="主机" value={host} onChange={(e) => setHost(e.target.value)} iconLeft={I("server")} />
              <Input label="账号" value={user} onChange={(e) => setUser(e.target.value)} iconLeft={I("user")} />
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-body)" }}>初始密码</span>
                  <button onClick={() => setPw(randPw())} style={{ border: "none", background: "none", color: "var(--accent-text)", fontSize: 12.5, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    {I("sparkles", { size: 13 })}生成
                  </button>
                </div>
                <Input value={pw} onChange={(e) => setPw(e.target.value)} placeholder="设置初始密码" iconLeft={I("lock")} />
              </div>
              <div style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "10px 12px", background: "var(--surface-sunken)", borderRadius: "var(--radius-md)" }}>
                {I("info", { size: 15, style: { color: "var(--text-muted)", marginTop: 1 } })}
                <span style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5 }}>账密会写入 {item.who} 的「我的 · SSH 账密」，可直接连接终端。</span>
              </div>
            </>
          )}
        </div>
      </Dialog>
    );
  }

  function RejectDialog({ item, onClose, onConfirm }: any) {
    const [reason, setReason] = React.useState("");
    React.useEffect(() => { if (item) setReason(""); }, [item]);
    if (!item) return null;
    const QUICK = ["信息不足", "暂不需要", "预算超限", "重复申请"];
    return (
      <Dialog open={!!item} onClose={onClose}
        title="拒绝申请" subtitle={`${item.who} · ${item.title}`}
        icon={I("x")} tone="danger" width={460}
        footer={<>
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button variant="danger" iconLeft={I("x")} onClick={() => onConfirm(item)}>确认拒绝</Button>
        </>}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "10px 12px", background: "var(--surface-sunken)", borderRadius: "var(--radius-md)" }}>
            {I("info", { size: 15, style: { color: "var(--text-muted)", marginTop: 1 } })}
            <span style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5 }}>可直接拒绝。如填写理由，会随结果一并通知申请人。</span>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-body)", marginBottom: 8 }}>拒绝理由 <span style={{ color: "var(--text-faint)", fontWeight: 400 }}>· 可选</span></div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 10 }}>
              {QUICK.map((q) => {
                const on = reason === q;
                return (
                  <button key={q} onClick={() => setReason(on ? "" : q)}
                    style={{ height: 28, padding: "0 12px", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 500, borderRadius: "var(--radius-pill)", border: `1px solid ${on ? "var(--danger)" : "var(--border-default)"}`, background: on ? "var(--danger-soft)" : "transparent", color: on ? "var(--danger-text)" : "var(--text-muted)", transition: "all var(--dur-fast) var(--ease-out)" }}>{q}</button>
                );
              })}
            </div>
            <Textarea placeholder="补充说明（可留空）" rows={3} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
      </Dialog>
    );
  }

  // 简单通过确认弹窗（无需填写内容）——用于请假等
  function ApproveDialog({ item, onClose, onConfirm }: any) {
    if (!item) return null;
    return (
      <Dialog open={!!item} onClose={onClose}
        title="通过申请" subtitle={`${item.who} · ${item.title}`}
        icon={I("check")} tone="success" width={440}
        footer={<>
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button variant="primary" iconLeft={I("check")} onClick={() => onConfirm(item)}>确认通过</Button>
        </>}>
        <div style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "10px 12px", background: "var(--surface-sunken)", borderRadius: "var(--radius-md)" }}>
          {I("info", { size: 15, style: { color: "var(--text-muted)", marginTop: 1 } })}
          <span style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5 }}>通过后，{item.who} 的本次请假将被记录，报告轮空，并通知申请人。</span>
        </div>
      </Dialog>
    );
  }

  // 已归档的历史审批种子（更早、不在 store 中的归档件）。
  const HISTORY_SEED = [
    { who: "苏沐", icon: "key-round", tone: "info", title: "API 密钥申请", detail: "情感分类基线 · 预算 ¥50", state: "approve", when: "6月5日" },
    { who: "林知远", icon: "calendar-x", tone: "danger", title: "轮空请假", detail: "5/31 组会 · 理由：身体不适", state: "approve", when: "5月30日" },
    { who: "周野", icon: "server-cog", tone: "warning", title: "服务器账号申请", detail: "希望用户名 zhouy · 重复申请", state: "reject", when: "5月22日" },
  ];

  // 单条审批卡：actions=true 显示通过/拒绝按钮；否则显示结果徽标 + 处理时间
  function ApprovalCard({ q, state, when, onAccept, onReject }: any) {
    return (
      <Card padding="md" style={state ? { opacity: 0.72 } : {}}>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <span style={{ width: 40, height: 40, flexShrink: 0, borderRadius: "var(--radius-md)", background: `var(--${q.tone}-soft)`, color: `var(--${q.tone}-text)`, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            {I(q.icon, { size: 19 })}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 3, flexWrap: "wrap" }}>
              <Avatar name={q.who} size="xs" />
              <span style={{ fontWeight: 600, color: "var(--text-strong)" }}>{q.who}</span>
              <span style={{ color: "var(--text-faint)", fontSize: 13 }}>·</span>
              <span style={{ fontSize: 14, color: "var(--text-body)" }}>{q.title}</span>
              {when && <span style={{ fontSize: 12, color: "var(--text-faint)" }}>· {when}处理</span>}
            </div>
            <p style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.5 }}>{q.detail}</p>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
            {state ? (
              <Badge tone={state === "approve" ? "success" : "danger"} dot>{state === "approve" ? "已通过" : "已拒绝"}</Badge>
            ) : (
              <>
                {/* 接受 — 左侧，绿色 ✓（点击后弹窗，api/ssh 需填写内容） */}
                <button type="button" title={q.type === "leave" ? "通过" : "填写并通过"} aria-label="通过"
                  onClick={onAccept}
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, padding: 0, border: "none", borderRadius: "var(--radius-md)", background: "var(--success)", color: "#fff", cursor: "pointer" }}>
                  {I("check", { size: 18 })}
                </button>
                {/* 拒绝 — 右侧，✕（点击后弹窗） */}
                <IconButton size="md" variant="solid" icon={I("x")} label="拒绝" onClick={onReject} />
              </>
            )}
          </div>
        </div>
      </Card>
    );
  }

  function EmptyState({ icon, text }: any) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "56px 20px", color: "var(--text-faint)" }}>
        <span style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--surface-sunken)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{I(icon, { size: 20 })}</span>
        <span style={{ fontSize: 13.5 }}>{text}</span>
      </div>
    );
  }

  function Approvals() {
    const isMobile = useIsMobile();
    const { data: pending = [] } = usePendingRequests();
    const { data: processed = [] } = useProcessedRequests();
    const advance = useAdvanceRequest();
    const [tab, setTab] = React.useState("pending");
    const [prov, setProv] = React.useState(null); // 填写式通过 (api/ssh)
    const [confirm, setConfirm] = React.useState(null); // 简单通过 (leave)
    const [reject, setReject] = React.useState(null);

    const onAccept = (card) => { if (card.type === "leave") setConfirm(card); else setProv(card); };
    const approve = (card) => { advance.mutate({ id: card.reqId, next: "approved", note: "管理员已通过" }, { onSuccess: () => toast("已通过 · " + card.who + " 的" + card.title) }); };
    const doReject = (card) => { advance.mutate({ id: card.reqId, next: "rejected", note: "管理员已驳回" }, { onSuccess: () => toast("已拒绝 · " + card.who + " 的" + card.title) }); };

    // 真实数据：待审批 = /requests/pending；历史 = /requests/processed + 归档种子。
    const fmtWhen = (r) => { const h = r.history[r.history.length - 1]; const x = new Date(h.at); return `${x.getMonth() + 1}月${x.getDate()}日`; };
    const pendingItems = pending.map(toCard);
    const resolved = processed.map((r) => ({ q: toCard(r), state: r.status === "approved" ? "approve" : "reject", when: fmtWhen(r) }));
    const historyItems = [...resolved, ...HISTORY_SEED.map((q) => ({ q, state: q.state, when: q.when }))];

    return (
      <div style={{ maxWidth: 880, margin: "0 auto", padding: isMobile ? "16px 14px 32px" : "20px 32px 48px" }}>
        <Tabs active={tab} onChange={setTab} style={{ marginBottom: 18 }}
          tabs={[{ id: "pending", label: "待审批", badge: pendingItems.length || undefined }, { id: "history", label: "历史", badge: historyItems.length }]} />

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {tab === "pending" && (
            pendingItems.length === 0
              ? <EmptyState icon="check-check" text="没有待审批的申请，都处理完了。" />
              : pendingItems.map((card) => (
                  <ApprovalCard key={card.id} q={card} onAccept={() => onAccept(card)} onReject={() => setReject(card)} />
                ))
          )}
          {tab === "history" && (
            historyItems.length === 0
              ? <EmptyState icon="history" text="暂无历史记录。" />
              : historyItems.map((h, k) => (
                  <ApprovalCard key={"h" + k} q={h.q} state={h.state} when={h.when} />
                ))
          )}
        </div>

        <ApproveDialog item={confirm} onClose={() => setConfirm(null)}
          onConfirm={(item) => { approve(item); setConfirm(null); }} />

        <ProvisionDialog item={prov} onClose={() => setProv(null)}
          onConfirm={(item) => { approve(item); setProv(null); }} />

        <RejectDialog item={reject} onClose={() => setReject(null)}
          onConfirm={(item) => { doReject(item); setReject(null); }} />
      </div>
    );
  }

  export { Approvals };
