import React from "react";
import * as NS from "../ds";
import { I, Icon } from "../lib/icons";
import { toast } from "../store";
import { useUsers } from "../api/hooks";

// AdminPeople — 人员管理: member roster with role, permission, add-member dialog.
  const { Card, Button, Badge, Avatar, Input, Select, IconButton, Dialog } = NS;

  const ROLES = ["老师", "科研助理", "博士生", "硕士生", "本科生"];

  function AddMemberDialog({ open, onClose, onAdd }: any) {
    const [name, setName] = React.useState("");
    const [role, setRole] = React.useState("");
    const [perm, setPerm] = React.useState("user");
    React.useEffect(() => { if (open) { setName(""); setRole(""); setPerm("user"); } }, [open]);
    const submit = () => { if (!name.trim() || !role) return; onAdd({ name: name.trim(), role, admin: perm === "admin" }); onClose(); };
    return (
      <Dialog open={open} onClose={onClose} title="添加成员" subtitle="填写姓名、身份与权限即可加入实验室"
        icon={I("user-plus")} tone="accent" width={460}
        footer={<><Button variant="ghost" onClick={onClose}>取消</Button><Button variant="primary" onClick={submit}>添加</Button></>}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Input label="姓名" placeholder="例如：周野" value={name} onChange={(e) => setName(e.target.value)} iconLeft={I("user")} />
          <Select label="身份" placeholder="选择身份" value={role} onChange={(e) => setRole(e.target.value)} options={ROLES} />
          <div>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 500, color: "var(--text-body)" }}>权限</label>
            <div style={{ display: "flex", gap: 8 }}>
              {[["user", "用户"], ["admin", "管理员"]].map(([v, t]) => (
                <button key={v} onClick={() => setPerm(v)}
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
        </div>
      </Dialog>
    );
  }

  // 编辑成员信息：姓名、身份、权限、账号、密码
  function EditMemberDialog({ member, onClose, onSave }: any) {
    const [name, setName] = React.useState("");
    const [role, setRole] = React.useState("");
    const [perm, setPerm] = React.useState("user");
    const [account, setAccount] = React.useState("");
    const [password, setPassword] = React.useState("");
    React.useEffect(() => {
      if (!member) return;
      setName(member.name); setRole(member.role); setPerm(member.admin ? "admin" : "user");
      setAccount(member.account); setPassword("");
    }, [member]);
    if (!member) return null;
    const submit = () => { if (!name.trim() || !role) return; onSave({ name: name.trim(), role, admin: perm === "admin", account: account.trim(), password }); };
    return (
      <Dialog open={!!member} onClose={onClose} title="编辑成员信息" subtitle={`${member.name} · 修改身份、权限与账号`}
        icon={I("user-pen")} tone="accent" width={460}
        footer={<><Button variant="ghost" onClick={onClose}>取消</Button><Button variant="primary" onClick={submit}>保存</Button></>}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Input label="姓名" placeholder="成员姓名" value={name} onChange={(e) => setName(e.target.value)} iconLeft={I("user")} />
          <Select label="身份" placeholder="选择身份" value={role} onChange={(e) => setRole(e.target.value)} options={ROLES} />
          <div>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 500, color: "var(--text-body)" }}>权限</label>
            <div style={{ display: "flex", gap: 8 }}>
              {[["user", "用户"], ["admin", "管理员"]].map(([v, t]) => (
                <button key={v} onClick={() => setPerm(v)}
                  style={{ flex: 1, height: 40, cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600, borderRadius: "var(--radius-md)", border: `1px solid ${perm === v ? "var(--accent)" : "var(--border-default)"}`, background: perm === v ? "var(--accent-soft)" : "var(--surface)", color: perm === v ? "var(--accent-text)" : "var(--text-muted)", transition: "all var(--dur-fast) var(--ease-out)" }}>{t}</button>
              ))}
            </div>
          </div>
          <Input label="账号" placeholder="登录账号" value={account} onChange={(e) => setAccount(e.target.value)} iconLeft={I("at-sign")} suffix="@cibol.lab" />
          <Input label="密码" type="password" placeholder="留空则不修改密码" value={password} onChange={(e) => setPassword(e.target.value)} iconLeft={I("lock")} />
        </div>
      </Dialog>
    );
  }

  function AdminPeople() {
    const { data: members = [] } = useUsers();
    const base = members.map((u) => ({ name: u.name, role: u.title }));
    const [extra, setExtra] = React.useState([]);
    const [q, setQ] = React.useState("");
    const [admins, setAdmins] = React.useState({ "林知远": true });
    const [over, setOver] = React.useState({}); // 按原姓名覆盖 name/role/account
    const [adding, setAdding] = React.useState(false);
    const [editing, setEditing] = React.useState(null);

    const roster = [...base, ...extra];
    const username = (n) => n === "苏沐" ? "sumu" : n.toLowerCase().replace(/\s/g, "");
    const acctOf = (m) => (over[m.name] && over[m.name].account) || username(m.name);
    const dispOf = (m) => ({ ...m, ...(over[m.name] || {}) });
    const list = roster.filter((m) => m.name.toLowerCase().includes(q.toLowerCase()) || m.role.includes(q));
    const isAdminOf = (m) => (m.admin != null ? m.admin : false) || !!admins[m.name];
    const onAdd = (m) => { setExtra((e) => [...e, m]); if (m.admin) setAdmins((s) => ({ ...s, [m.name]: true })); toast("已添加成员 · " + m.name); };
    const onSaveEdit = (patch) => {
      const orig = editing._orig;
      setOver((s) => ({ ...s, [orig]: { name: patch.name, role: patch.role, account: patch.account } }));
      setAdmins((s) => ({ ...s, [orig]: patch.admin }));
      toast("已保存 · 成员信息");
      setEditing(null);
    };

    return (
      <div style={{ maxWidth: 940, margin: "0 auto", padding: "24px 32px 48px" }} data-comment-anchor="155c0c10bc-div-19-7">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-strong)" }}>人员管理</h2>
            <p style={{ fontSize: 13.5, color: "var(--text-muted)", marginTop: 3 }}>共 {roster.length} 名成员</p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ width: 220 }}><Input placeholder="搜索姓名或身份" iconLeft={I("search")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <Button variant="primary" iconLeft={I("user-plus")} onClick={() => setAdding(true)}>添加成员</Button>
          </div>
        </div>

        <Card padding="none">
          {/* header */}
          <div style={{ display: "grid", gridTemplateColumns: "2.4fr 1.4fr 1fr 88px", gap: 12, padding: "12px 20px", borderBottom: "1px solid var(--border-subtle)", background: "var(--surface-sunken)" }}>
            {["成员", "身份", "权限", "操作"].map((h) => (
              <span key={h} style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-faint)" }}>{h}</span>
            ))}
          </div>
          {list.map((m, i) => {
            const adminRow = isAdminOf(m);
            const d = dispOf(m);
            const isMe = m.name === "苏沐";
            return (
              <div key={m.name} style={{ display: "grid", gridTemplateColumns: "2.4fr 1.4fr 1fr 88px", gap: 12, padding: "12px 20px", alignItems: "center", borderBottom: i < list.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                  <Avatar name={m.name} size="sm" />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)", whiteSpace: "nowrap" }}>{d.name}</span>
                      {isMe && <Badge tone="neutral" size="sm">我</Badge>}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-faint)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{acctOf(m)}@cibol.lab</div>
                  </div>
                </div>
                <span style={{ fontSize: 13.5, color: "var(--text-body)" }}>{d.role}</span>
                <span>{adminRow ? <Badge tone="accent" size="sm" dot>管理员</Badge> : <Badge tone="neutral" size="sm">用户</Badge>}</span>
                <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                  <IconButton icon={I("ellipsis")} label="编辑信息" size="sm" onClick={() => setEditing({ ...m, name: d.name, role: d.role, account: acctOf(m), admin: adminRow, _orig: m.name })} />
                </div>
              </div>
            );
          })}
        </Card>

        <AddMemberDialog open={adding} onClose={() => setAdding(false)} onAdd={onAdd} />
        <EditMemberDialog member={editing} onClose={() => setEditing(null)} onSave={onSaveEdit} />
      </div>
    );
  }

  export { AdminPeople };
