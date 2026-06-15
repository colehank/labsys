import React from "react";
import * as NS from "../ds";
import { I, Icon } from "../lib/icons";
import { toast } from "../store";
import { useMyKeys, useMyRequests, useCreateRequest, useMyCredentials } from "../api/hooks";
import { useIsMobile } from "../lib/useIsMobile";

// API — 申请 + 我的密钥 + 用量
  const { Card, Button, Badge, Input, Textarea, StatTile, Dialog, IconButton } = NS;

  // 复制按钮：点击后图标变为 ✅ 并变绿，1.4s 后恢复。
  function CopyKeyButton({ value }: any) {
    const [done, setDone] = React.useState(false);
    const copy = () => {
      try { navigator.clipboard && navigator.clipboard.writeText(value); } catch (e) {}
      setDone(true);
      setTimeout(() => setDone(false), 1400);
    };
    return (
      <button type="button" onClick={copy} title={done ? "已复制" : "复制"} aria-label={done ? "已复制" : "复制"}
        style={{
          flexShrink: 0, width: 32, height: 32, display: "inline-flex", alignItems: "center", justifyContent: "center",
          border: "1px solid " + (done ? "var(--success)" : "var(--border-default)"),
          background: done ? "var(--success-soft)" : "var(--surface)",
          color: done ? "var(--success-text)" : "var(--text-muted)",
          borderRadius: "var(--radius-sm)", cursor: "pointer", transition: "all var(--dur-fast) var(--ease-out)",
        }}>
        <span style={{ width: 16, height: 16, display: "inline-flex" }}>{I(done ? "check" : "copy", { size: 16 })}</span>
      </button>
    );
  }

  // 服务器账号 —— 读用户真实保存的 SSH 账密（与「服务器」页、「我的 → 安全」同一份 ["credentials"]）。
  // 密码加密落库、后端不返回明文，故此处只展示账号名，密码不明示。
  function ServerAccountCard() {
    const { data: credData } = useMyCredentials();
    const items: any[] = credData?.items || [];
    const feature = !!credData?.feature;
    if (!feature) {
      return <p style={{ fontSize: 13, color: "var(--text-faint)", margin: 0 }}>后端未启用账密加密，暂不能保存服务器账号。</p>;
    }
    if (!items.length) {
      return (
        <div style={{ padding: "14px 15px", border: "1px dashed var(--border-default)", borderRadius: "var(--radius-md)", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
          还没有服务器账号。在「服务器」页连接时勾选「记住」，或到「我的 → 安全 → 服务器账密」添加，保存后会显示在这里。
        </div>
      );
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((c) => (
          <div key={c.id} style={{ padding: "14px 15px", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 30, height: 30, flexShrink: 0, borderRadius: "var(--radius-md)", background: "var(--surface-sunken)", color: "var(--text-muted)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{I("key-round", { size: 16 })}</span>
                <span className="cibol-mono" style={{ fontWeight: 600, color: "var(--text-strong)" }}>{c.username}</span>
              </span>
              <Badge tone="success" size="sm" dot>已保存</Badge>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: "8px 10px", marginTop: 12 }}>
              <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>账号</span>
              <code style={{ minWidth: 0, fontSize: 13, color: "var(--text-muted)", background: "var(--surface-sunken)", padding: "6px 10px", borderRadius: "var(--radius-sm)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.username}</code>
              <CopyKeyButton value={c.username} />
              <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>密码</span>
              <code style={{ minWidth: 0, fontSize: 13, color: "var(--text-faint)", background: "var(--surface-sunken)", padding: "6px 10px", borderRadius: "var(--radius-sm)" }}>已加密保存（不展示）</code>
              <span />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 12, fontSize: 12.5, color: "var(--text-muted)" }}>
              {I("info", { size: 13 })}
              <span>用于网页终端一键登录，一个账号通常可登录所有实验室服务器。改密码请去「服务器」页或「我的 → 安全」。</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function API() {
    const isMobile = useIsMobile();
    const [open, setOpen] = React.useState(false);
    const [nm, setNm] = React.useState("");
    const [rsn, setRsn] = React.useState("");
    const [amt, setAmt] = React.useState("");
    const { data: rawKeys = [] } = useMyKeys();
    const { data: myReqs = [] } = useMyRequests();
    const createReq = useCreateRequest();
    const keys = rawKeys
      .filter((k) => k.status === "active")
      .map((k) => ({ name: k.label, key: k.masked_key, used: k.used_rmb ?? 0, budget: k.budget }));
    // 待审批的 API 申请（与管理员「审批中心」同源）。
    const reqs = myReqs.filter((r) => !r.incoming && r.kind === "api" && r.status === "submitted");
    const submit = () => {
      if (!nm.trim()) return;
      createReq.mutate(
        { kind: "api", detail: `${nm.trim()}${amt ? " · 预算 ¥" + amt : ""}`, reason: rsn },
        { onSuccess: () => toast("已提交 · 等待管理员下发") },
      );
      setNm(""); setRsn(""); setAmt(""); setOpen(false);
    };
    return (
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: isMobile ? "16px 14px 32px" : "24px 32px 48px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card eyebrow="我的密钥" title="我的 API 密钥" action={<Button variant="primary" iconLeft={I("plus")} onClick={() => setOpen(true)}>申请密钥</Button>}>
            {/* 用量概览 —— 原顶部统计卡，现归并到此处 */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 28, padding: "2px 2px 14px", marginBottom: 14, borderBottom: "1px solid var(--border-subtle)" }}>
              {(() => {
                const used = keys.reduce((s, k) => s + (k.used || 0), 0);
                const budget = keys.reduce((s, k) => s + k.budget, 0);
                return [
                  ["已用额度", `¥${used.toFixed(2)}`, ""],
                  ["剩余预算", `¥${Math.max(0, budget - used).toFixed(2)}`, ""],
                  ["活跃密钥", `${keys.length} 个`, reqs.length ? `${reqs.length} 个申请待审批` : ""],
                ];
              })().map(([l, v, s]) => (
                <div key={l} style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "0.05em", color: "var(--text-faint)", textTransform: "uppercase" }}>{l}</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginTop: 5 }}>
                    <span className="cibol-numeral" style={{ fontSize: 23, fontWeight: 600, lineHeight: 1, color: "var(--text-strong)" }}>{v}</span>
                    {s && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{s}</span>}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {keys.map((k, i) => (
                <div key={i} style={{ padding: "13px 15px", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 600, color: "var(--text-strong)" }}>{k.name}</span>
                    <Badge tone="success" size="sm" dot>启用中</Badge>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "9px 0" }}>
                    <code style={{ flex: 1, fontSize: 13, color: "var(--text-muted)", background: "var(--surface-sunken)", padding: "6px 10px", borderRadius: "var(--radius-sm)" }}>{k.key}</code>
                    <CopyKeyButton value={k.key} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 6, background: "var(--surface-sunken)", borderRadius: 999, overflow: "hidden" }}>
                      <div style={{ width: `${k.budget > 0 ? Math.min(100, (k.used / k.budget) * 100) : 0}%`, height: "100%", background: "var(--accent)" }} />
                    </div>
                    <span className="cibol-mono" style={{ fontSize: 12, color: "var(--text-faint)" }}>¥{k.used} / {k.budget}</span>
                  </div>
                </div>
              ))}
              {reqs.map((r, i) => (
                <div key={r.id || i} style={{ padding: "13px 15px", border: "1px dashed var(--border-default)", borderRadius: "var(--radius-md)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--text-strong)" }}>{r.detail || r.reason}</div>
                    {r.reason && <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{r.reason}</div>}
                  </div>
                  <Badge tone="warning" dot>待审批</Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card eyebrow="我的账号" title="服务器账号" subtitle="你保存的服务器登录账号，网页终端一键登录用（与「服务器」页、「我的 → 安全」同步）">
            <ServerAccountCard />
          </Card>
        </div>

        <Dialog open={open} onClose={() => setOpen(false)} title="申请 API 密钥"
          subtitle="管理员通过后，密钥会出现在「我的」与此页面" icon={I("key-round")} tone="accent" width={480}
          footer={<><Button variant="ghost" onClick={() => setOpen(false)}>取消</Button><Button variant="primary" disabled={!nm.trim()} onClick={submit}>提交申请</Button></>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Input label="备注名" placeholder="例如：fMRI 预处理脚本" iconLeft={I("tag")} value={nm} onChange={(e) => setNm(e.target.value)} />
            <Textarea label="申请理由" placeholder="说明用途与预期调用量" rows={3} maxLength={200} value={rsn} onChange={(e) => setRsn(e.target.value)} />
            <Input label="预算金额" type="number" placeholder="100" suffix="¥" iconLeft={I("wallet")} value={amt} onChange={(e) => setAmt(e.target.value)} />
          </div>
        </Dialog>
      </div>
    );
  }

  export { API };
