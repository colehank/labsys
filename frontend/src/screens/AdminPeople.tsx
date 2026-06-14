import React from "react";
import * as NS from "../ds";
import { I, Icon } from "../lib/icons";
import { toast } from "../store";
import { useUsers, useCreateUser, useAdminUpdateUser, useDeleteUser } from "../api/hooks";
import { useMe } from "../auth";
import { useIsMobile } from "../lib/useIsMobile";

// AdminPeople — 人员管理：真实用户名册（来自 /api/users），管理员可增 / 删 / 改用户。
  const { Card, Button, Badge, Avatar, Input, Select, IconButton, Dialog } = NS;

  const ROLES = ["老师", "科研助理", "博士生", "硕士生", "本科生"]; // 身份（title）建议项

  // 后端 HTTPException 的 {detail} 经 openapi-fetch 落在 error 对象上（非 Error 实例），
  // 直接 e?.message 取不到——这里优先取 detail，让用户看到真实原因。
  function errMsg(e: any, fallback: string) {
    const d = e?.detail;
    if (typeof d === "string") return d;
    return e?.message || fallback;
  }

  // 权限选择（用户 / 管理员）。值对齐后端 Role：member / admin。
  function PermPicker({ perm, setPerm }: any) {
    return (
      <div>
        <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 500, color: "var(--text-body)" }}>权限</label>
        <div style={{ display: "flex", gap: 8 }}>
          {[["member", "用户"], ["admin", "管理员"]].map(([v, t]) => (
            <button key={v} type="button" onClick={() => setPerm(v)}
              style={{
                flex: 1, height: 40, cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600,
                borderRadius: "var(--radius-md)",
                border: `1px solid ${perm === v ? "var(--accent)" : "var(--border-default)"}`,
                background: perm === v ? "var(--accent-soft)" : "var(--surface)",
                color: perm === v ? "var(--accent-text)" : "var(--text-muted)",
                transition: "all var(--dur-fast) var(--ease-out)",
              }}>{t}</button>
          ))}
        </div>
      </div>
    );
  }

  function AddUserDialog({ open, onClose }: any) {
    const create = useCreateUser();
    const [name, setName] = React.useState("");
    const [email, setEmail] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [title, setTitle] = React.useState("");
    const [perm, setPerm] = React.useState("member");
    React.useEffect(() => { if (open) { setName(""); setEmail(""); setPassword(""); setTitle(""); setPerm("member"); } }, [open]);
    const submit = () => {
      if (!name.trim() || !email.trim() || !password) { toast("请填写姓名、邮箱、密码", { tone: "error" }); return; }
      create.mutate(
        { name: name.trim(), email: email.trim(), password, title: title.trim(), role: perm as any },
        {
          onSuccess: () => { toast("已添加用户 · " + name.trim(), { tone: "success" }); onClose(); },
          onError: (e: any) => toast(e?.message || "添加失败", { tone: "error" }),
        },
      );
    };
    return (
      <Dialog open={open} onClose={onClose} title="添加用户" subtitle="设置登录邮箱与初始密码（邮箱不限域名）"
        icon={I("user-plus")} tone="accent" width={460}
        footer={<><Button variant="ghost" onClick={onClose}>取消</Button><Button variant="primary" loading={create.isPending} onClick={submit}>添加</Button></>}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Input label="姓名" placeholder="例如：周野" value={name} onChange={(e: any) => setName(e.target.value)} iconLeft={I("user")} />
          <Input label="邮箱（登录账号）" placeholder="name@example.com" value={email} onChange={(e: any) => setEmail(e.target.value)} iconLeft={I("at-sign")} autoComplete="off" />
          <Input label="初始密码" type="password" placeholder="设置登录密码" value={password} onChange={(e: any) => setPassword(e.target.value)} iconLeft={I("lock")} autoComplete="new-password" />
          <Select label="身份" placeholder="选择或留空" value={title} onChange={(e: any) => setTitle(e.target.value)} options={ROLES} />
          <PermPicker perm={perm} setPerm={setPerm} />
        </div>
      </Dialog>
    );
  }

  function EditUserDialog({ member, onClose }: any) {
    const update = useAdminUpdateUser();
    const [name, setName] = React.useState("");
    const [email, setEmail] = React.useState("");
    const [title, setTitle] = React.useState("");
    const [perm, setPerm] = React.useState("member");
    const [password, setPassword] = React.useState("");
    React.useEffect(() => {
      if (!member) return;
      setName(member.name); setEmail(member.email); setTitle(member.title || ""); setPerm(member.role); setPassword("");
    }, [member]);
    if (!member) return null;
    const submit = () => {
      if (!name.trim() || !email.trim()) { toast("姓名、邮箱必填", { tone: "error" }); return; }
      const patch: any = { name: name.trim(), email: email.trim(), title: title.trim(), role: perm };
      if (password) patch.password = password;
      update.mutate({ id: member.id, patch }, {
        onSuccess: () => { toast("已保存 · " + name.trim(), { tone: "success" }); onClose(); },
        onError: (e: any) => toast(e?.message || "保存失败", { tone: "error" }),
      });
    };
    return (
      <Dialog open={!!member} onClose={onClose} title="编辑用户" subtitle={`${member.name} · 改资料 / 权限 / 密码`}
        icon={I("user-pen")} tone="accent" width={460}
        footer={<><Button variant="ghost" onClick={onClose}>取消</Button><Button variant="primary" loading={update.isPending} onClick={submit}>保存</Button></>}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Input label="姓名" value={name} onChange={(e: any) => setName(e.target.value)} iconLeft={I("user")} />
          <Input label="邮箱（登录账号）" value={email} onChange={(e: any) => setEmail(e.target.value)} iconLeft={I("at-sign")} autoComplete="off" />
          <Select label="身份" placeholder="选择或留空" value={title} onChange={(e: any) => setTitle(e.target.value)} options={ROLES} />
          <PermPicker perm={perm} setPerm={setPerm} />
          <Input label="重置密码" type="password" placeholder="留空则不修改密码" value={password} onChange={(e: any) => setPassword(e.target.value)} iconLeft={I("lock")} autoComplete="new-password" />
        </div>
      </Dialog>
    );
  }

  function AdminPeople() {
    const isMobile = useIsMobile();
    const { data: users = [] } = useUsers();
    const { data: me } = useMe();
    const del = useDeleteUser();
    const update = useAdminUpdateUser();
    const [q, setQ] = React.useState("");
    const [adding, setAdding] = React.useState(false);
    const [editing, setEditing] = React.useState<any>(null);
    const [confirm, setConfirm] = React.useState<any>(null);

    const list = users.filter((u: any) =>
      u.name.toLowerCase().includes(q.toLowerCase())
      || (u.title || "").includes(q)
      || u.email.toLowerCase().includes(q.toLowerCase()));
    const peopleCols = isMobile ? "1fr auto" : "2.4fr 1.4fr 1fr 96px";

    const onDelete = (u: any) => {
      del.mutate(u.id, {
        onSuccess: (res: any) => {
          // res.action: "deleted"（纯净账号物理删除）| "disabled"（有历史→停用）
          toast(res?.detail || "已删除 · " + u.name, { tone: res?.action === "disabled" ? "warning" : "success" });
          setConfirm(null);
        },
        onError: (e: any) => { toast(errMsg(e, "删除失败"), { tone: "error" }); setConfirm(null); },
      });
    };

    const onRestore = (u: any) => {
      update.mutate({ id: u.id, patch: { disabled: false } }, {
        onSuccess: () => toast("已恢复 · " + u.name, { tone: "success" }),
        onError: (e: any) => toast(errMsg(e, "恢复失败"), { tone: "error" }),
      });
    };

    return (
      <div style={{ maxWidth: 940, margin: "0 auto", padding: isMobile ? "16px 14px 48px" : "24px 32px 48px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-strong)" }}>人员管理</h2>
            <p style={{ fontSize: 13.5, color: "var(--text-muted)", marginTop: 3 }}>共 {users.length} 名成员</p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ width: isMobile ? "100%" : 220 }}><Input placeholder="搜索姓名 / 身份 / 邮箱" iconLeft={I("search")} value={q} onChange={(e: any) => setQ(e.target.value)} /></div>
            <Button variant="primary" iconLeft={I("user-plus")} onClick={() => setAdding(true)}>添加用户</Button>
          </div>
        </div>

        <Card padding="none">
          <div style={{ display: isMobile ? "none" : "grid", gridTemplateColumns: peopleCols, gap: 12, padding: "12px 20px", borderBottom: "1px solid var(--border-subtle)", background: "var(--surface-sunken)" }}>
            {["成员", "身份", "权限", "操作"].map((h) => (
              <span key={h} style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-faint)" }}>{h}</span>
            ))}
          </div>
          {list.map((u: any, i: number) => {
            const adminRow = u.role === "admin";
            const isMe = !!(me && u.id === me.id);
            const off = !!u.disabled;
            return (
              <div key={u.id} style={{ display: "grid", gridTemplateColumns: peopleCols, gap: isMobile ? 8 : 12, padding: "12px 20px", alignItems: "center", borderBottom: i < list.length - 1 ? "1px solid var(--border-subtle)" : "none", opacity: off ? 0.5 : 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                  <Avatar name={u.name} size="sm" />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)", whiteSpace: "nowrap", textDecoration: off ? "line-through" : "none" }}>{u.name}</span>
                      {isMe && <Badge tone="neutral" size="sm">我</Badge>}
                      {off && <Badge tone="warning" size="sm">已停用</Badge>}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-faint)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.email}</div>
                  </div>
                </div>
                <span style={{ fontSize: 13.5, color: "var(--text-body)" }}>{u.title || "—"}</span>
                <span>{adminRow ? <Badge tone="accent" size="sm" dot>管理员</Badge> : <Badge tone="neutral" size="sm">用户</Badge>}</span>
                <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                  <IconButton icon={I("user-pen")} label="编辑" size="sm" onClick={() => setEditing(u)} />
                  {off ? (
                    <IconButton icon={I("rotate-ccw")} label="恢复账号" size="sm" onClick={() => onRestore(u)} />
                  ) : (
                    <IconButton icon={I("trash-2")} label={isMe ? "不能删除自己" : "删除"} size="sm" disabled={isMe} onClick={() => !isMe && setConfirm(u)} />
                  )}
                </div>
              </div>
            );
          })}
        </Card>

        <AddUserDialog open={adding} onClose={() => setAdding(false)} />
        <EditUserDialog member={editing} onClose={() => setEditing(null)} />
        <Dialog open={!!confirm} onClose={() => setConfirm(null)} title="删除用户" subtitle={confirm?.name}
          icon={I("trash-2")} tone="danger" width={400}
          footer={<><Button variant="ghost" onClick={() => setConfirm(null)}>取消</Button><Button variant="primary" loading={del.isPending} onClick={() => confirm && onDelete(confirm)}>确认删除</Button></>}>
          <p style={{ fontSize: 13.5, color: "var(--text-body)", lineHeight: 1.6 }}>
            从未产生任何数据的账号将被<b>彻底删除</b>；若该用户有历史记录（组会报告 / 评分 / 申请 / 通知等），
            为保留这些记录会自动转为<b>停用</b>——无法登录、名册标灰，之后可随时「恢复」。
          </p>
        </Dialog>
      </div>
    );
  }

  export { AdminPeople };
