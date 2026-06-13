import React from "react";
import * as NS from "../ds";
import { I, Icon } from "../lib/icons";
import { toast } from "../store";
import { useServers, useCreateServer, useUpdateServer, useDeleteServer, type Server } from "../api/hooks";

// AdminServers — 服务器管理: 管理员维护实验室服务器清单（名称/IP/硬件/状态/说明）。
// 用户端「服务器」页只读展示，点击卡片显示说明。schema 见 ui_kits/_shared/store.js。
  const { Card, Button, Badge, Input, Textarea, Select, IconButton, Dialog } = NS;

  const STATUS = {
    online: { tone: "success", label: "在线" },
    busy: { tone: "warning", label: "高负载" },
    offline: { tone: "neutral", label: "离线" },
  };

  const NET = {
    intranet: { tone: "info", label: "内网" },
    public: { tone: "accent", label: "公网" },
  };

  function ServerDialog({ open, initial, onClose }: any) {
    const blank = { name: "", ip: "", ssh_port: 22, gpu: "", status: "online", net: "intranet", desc: "" };
    const [f, setF] = React.useState(blank);
    React.useEffect(() => { if (open) setF(initial ? { ...initial } : blank); }, [open, initial]);
    const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
    const valid = f.name.trim() && f.ip.trim();
    const editing = !!(initial && initial.id);
    const createServer = useCreateServer();
    const updateServer = useUpdateServer();
    const save = () => {
      if (!valid) return;
      if (editing) {
        updateServer.mutate(
          { id: initial.id, patch: { name: f.name.trim(), ip: f.ip.trim(), ssh_port: Number(f.ssh_port) || 22, gpu: f.gpu.trim(), status: f.status as Server["status"], net: f.net as Server["net"], desc: f.desc.trim() } },
          { onSuccess: () => toast("已保存修改") },
        );
      } else {
        createServer.mutate(
          { name: f.name.trim(), ip: f.ip.trim(), ssh_port: Number(f.ssh_port) || 22, gpu: f.gpu.trim(), status: f.status as Server["status"], net: f.net as Server["net"], desc: f.desc.trim() },
          { onSuccess: () => toast("已添加服务器") },
        );
      }
      onClose();
    };
    return (
      <Dialog open={open} onClose={onClose} title={editing ? "编辑服务器" : "添加服务器"}
        subtitle={editing ? f.name : "新增一台实验室主机"} icon={I("server-cog")} tone="accent" width={500}
        footer={<><Button variant="ghost" onClick={onClose}>取消</Button><Button variant="primary" disabled={!valid} onClick={save}>{editing ? "保存修改" : "添加"}</Button></>}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1.4fr 0.7fr", gap: 12 }}>
            <Input label="主机名" placeholder="例如 turing" value={f.name} onChange={(e) => set("name", e.target.value)} iconLeft={I("server")} />
            <Input label="内网 IP" placeholder="172.16.x.x" value={f.ip} onChange={(e) => set("ip", e.target.value)} iconLeft={I("network")} />
            <Input label="SSH 端口" placeholder="22" value={String(f.ssh_port)} onChange={(e) => set("ssh_port", e.target.value)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 12 }}>
            <Input label="硬件" placeholder="例如 8× A100 80G" value={f.gpu} onChange={(e) => set("gpu", e.target.value)} iconLeft={I("cpu")} />
            <Select label="网络" value={f.net} onChange={(e) => set("net", e.target.value)}
              options={Object.entries(NET).map(([value, m]) => ({ value, label: m.label }))} />
            <Select label="状态" value={f.status} onChange={(e) => set("status", e.target.value)}
              options={Object.entries(STATUS).map(([value, m]) => ({ value, label: m.label }))} />
          </div>
          <Textarea label="说明" placeholder="用途、使用规范、注意事项 —— 用户点击该服务器卡片时会看到。" rows={3} maxLength={200} value={f.desc} onChange={(e) => set("desc", e.target.value)} />
        </div>
      </Dialog>
    );
  }

  function ServerRow({ s, last }: any) {
    const m = STATUS[s.status] || STATUS.online;
    const [confirm, setConfirm] = React.useState(false);
    const [edit, setEdit] = React.useState(false);
    const deleteServer = useDeleteServer();
    return (
      <div style={{ display: "flex", gap: 13, alignItems: "flex-start", padding: "15px 4px", borderBottom: last ? "none" : "1px solid var(--border-subtle)" }}>
        <span style={{ width: 36, height: 36, flexShrink: 0, borderRadius: "var(--radius-md)", background: "var(--surface-sunken)", color: "var(--text-muted)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="server" style={{ width: 17, height: 17 }} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 3 }}>
            <span className="cibol-mono" style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-strong)" }}>{s.name}</span>
            <span className="cibol-mono" style={{ fontSize: 12.5, color: "var(--text-faint)" }}>{s.ip}</span>
            <Badge tone={m.tone} size="sm" dot>{m.label}</Badge>
            {NET[s.net] && <Badge tone={NET[s.net].tone} size="sm">{NET[s.net].label}</Badge>}
            {s.gpu && <span className="cibol-mono" style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.gpu}</span>}
          </div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.55 }}>{s.desc || "暂无说明。"}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <IconButton size="sm" icon={I("pencil")} label="编辑" onClick={() => setEdit(true)} />
          <IconButton size="sm" icon={I("trash-2")} label="删除" onClick={() => setConfirm(true)} />
        </div>
        <ServerDialog open={edit} initial={s} onClose={() => setEdit(false)} />
        <Dialog open={confirm} onClose={() => setConfirm(false)} title="删除服务器" subtitle={s.name}
          icon={I("trash-2")} tone="danger" width={400}
          footer={<><Button variant="ghost" onClick={() => setConfirm(false)}>取消</Button><Button variant="primary" onClick={() => { deleteServer.mutate(s.id, { onSuccess: () => toast("已删除服务器") }); setConfirm(false); }}>确认删除</Button></>}>
          <p style={{ fontSize: 13.5, color: "var(--text-body)", lineHeight: 1.6 }}>删除后该服务器将从用户端「服务器」页移除，且无法恢复。</p>
        </Dialog>
      </div>
    );
  }

  function AdminServers() {
    const { data: servers = [] } = useServers();
    const [add, setAdd] = React.useState(false);
    const online = servers.filter((s) => s.status === "online").length;

    return (
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 32px 48px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-strong)" }}>服务器管理</h2>
            <p style={{ fontSize: 13.5, color: "var(--text-muted)", marginTop: 3 }}>维护实验室主机清单与说明，用户在「服务器」页点击卡片即可查看说明。</p>
          </div>
          <Button size="sm" variant="primary" iconLeft={I("plus")} onClick={() => setAdd(true)}>添加服务器</Button>
        </div>
        <ServerDialog open={add} initial={null} onClose={() => setAdd(false)} />

        <Card eyebrow={`共 ${servers.length} 台 · ${online} 台在线`} title="服务器清单" padding="md">
          {servers.length ? (
            <div style={{ marginTop: 2 }}>
              {servers.map((s, i) => <ServerRow key={s.id} s={s} last={i === servers.length - 1} />)}
            </div>
          ) : (
            <div style={{ padding: "32px 0", textAlign: "center", fontSize: 13.5, color: "var(--text-faint)" }}>还没有服务器，点击右上角「添加服务器」。</div>
          )}
        </Card>
      </div>
    );
  }

  export { AdminServers };
