import React from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import * as NS from "../ds";
import { I, Icon } from "../lib/icons";
import { toast } from "../store";
import { useServers, useCreateRequest } from "../api/hooks";
import { useAccessToken } from "../auth";

// Server — 服务器：真实 WebSSH 终端。
// 设计：网页终端 = 用户本人的 SSH 会话，账号密码由用户自己输入，
// 后端只做 PTY↔WebSocket 透传，绝不持有 root 凭据（见 webssh.py）。
const { Button, Badge, Input, Dialog, Textarea } = NS;

const STATUS = {
  online: { c: "var(--success)", t: "在线" },
  busy: { c: "var(--warning)", t: "高负载" },
  offline: { c: "var(--stone-400)", t: "离线" },
};

const NET = {
  intranet: { tone: "info", label: "内网" },
  public: { tone: "accent", label: "公网" },
};

type Conn = "idle" | "connecting" | "connected" | "closed";

// 真实终端：xterm.js ↔ WebSocket(/ws/ssh/{id}) ↔ 后端 PTY。
function Terminal({ host, creds, token, onState }: any) {
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const fitRef = React.useRef<FitAddon | null>(null);
  const wsRef = React.useRef<WebSocket | null>(null);

  React.useEffect(() => {
    if (!wrapRef.current || !creds) return;
    const term = new XTerm({
      fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)",
      fontSize: 13.5,
      cursorBlink: true,
      theme: {
        background: "#1a1b1e",
        foreground: "#e6e6e6",
        cursor: "#7FB069",
      },
    });
    const fit = new FitAddon();
    fitRef.current = fit;
    term.loadAddon(fit);
    term.open(wrapRef.current);
    try { fit.fit(); } catch { /* container 尚未布局 */ }

    onState?.("connecting");
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/ws/ssh/${host.id}?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onopen = () => {
      // 首帧握手：把用户自己的账号密码 + 初始窗口大小发给后端
      ws.send(JSON.stringify({
        username: creds.username,
        password: creds.password,
        cols: term.cols,
        rows: term.rows,
      }));
    };
    ws.onmessage = (ev) => {
      if (typeof ev.data === "string") term.write(ev.data);
      else (ev.data as Blob).text().then((t) => term.write(t));
      onState?.("connected");
    };
    ws.onclose = () => {
      term.write("\r\n\x1b[2m[连接已关闭]\x1b[0m\r\n");
      onState?.("closed");
    };
    ws.onerror = () => onState?.("closed");

    // 键盘输入透传
    const onData = term.onData((d) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(d);
    });

    // 窗口大小变化 → fit + 通知后端
    const sendResize = () => {
      try { fit.fit(); } catch { /* noop */ }
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
      }
    };
    const ro = new ResizeObserver(() => sendResize());
    ro.observe(wrapRef.current);
    window.addEventListener("resize", sendResize);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sendResize);
      onData.dispose();
      ws.close();
      term.dispose();
    };
    // host.id/creds 变更（重连）时整体重挂
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host.id, creds]);

  return (
    <div style={{
      background: "#1a1b1e", borderRadius: "var(--radius-lg)", overflow: "hidden",
      border: "1px solid #000", boxShadow: "var(--shadow-lg)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "rgba(0,0,0,0.25)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <span style={{ display: "flex", gap: 7 }}>
          <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#E06C57" }} />
          <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#E0B04A" }} />
          <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#7FB069" }} />
        </span>
        <span className="cibol-mono" style={{ fontSize: 12.5, color: "rgba(230,230,230,0.6)", marginLeft: 6 }}>
          ssh {creds?.username}@{host.name} ({host.ip}:{host.ssh_port})
        </span>
      </div>
      <div ref={wrapRef} style={{ padding: "10px 12px", height: 420 }} />
    </div>
  );
}

// 服务器卡片：名+IP+重连。鼠标悬停弹出说明。点击卡片选中。
function HostCard({ hh, on, onSelect, onReconnect }: any) {
  const [hover, setHover] = React.useState(false);
  const [spin, setSpin] = React.useState(false);
  const s = STATUS[hh.status];
  const disabled = hh.status === "offline";
  const reconnect = (e) => {
    e.stopPropagation();
    if (disabled || spin) return;
    setSpin(true);
    onReconnect && onReconnect();
    setTimeout(() => setSpin(false), 850);
  };
  return (
    <div style={{ position: "relative", flex: "1 1 180px", minWidth: 180 }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div role="button" tabIndex={disabled ? -1 : 0} onClick={disabled ? undefined : onSelect}
        onKeyDown={disabled ? undefined : (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } }}
        style={{
          display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "13px 38px 13px 15px", textAlign: "left", boxSizing: "border-box",
          border: `1px solid ${on ? "var(--accent)" : "var(--border-subtle)"}`,
          background: on ? "var(--accent-soft)" : "var(--surface)",
          borderRadius: "var(--radius-md)", cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.55 : 1, transition: "all var(--dur-fast) var(--ease-out)",
        }}>
        <span style={{ width: 34, height: 34, flexShrink: 0, borderRadius: "var(--radius-md)", background: on ? "var(--surface)" : "var(--surface-sunken)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="server" style={{ width: 17, height: 17, color: on ? "var(--accent-text)" : "var(--text-muted)" }} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span className="cibol-mono" style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>{hh.name}</span>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.c, flexShrink: 0, boxShadow: hh.status === "online" ? `0 0 5px ${s.c}` : "none" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
            <span className="cibol-mono" style={{ fontSize: 12, color: "var(--text-faint)" }}>{hh.ip}</span>
            {NET[hh.net] && <Badge tone={NET[hh.net].tone} size="sm">{NET[hh.net].label}</Badge>}
          </div>
        </div>
        <style>{`@keyframes cibol-spin{to{transform:rotate(360deg)}}`}</style>
      </div>
      {!disabled && (
        <button type="button" onClick={reconnect} title="重连" aria-label={`重连 ${hh.name}`}
          style={{ position: "absolute", top: 8, right: 8, zIndex: 2, width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "none", background: "transparent", borderRadius: "var(--radius-sm)", cursor: "pointer", color: "var(--text-faint)" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-sunken)"; e.currentTarget.style.color = "var(--text-muted)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-faint)"; }}>
          <Icon name="rotate-cw" style={{ width: 15, height: 15, animation: spin ? "cibol-spin .85s linear" : "none" }} />
        </button>
      )}
      {hover && (
        <div style={{
          position: "absolute", top: "calc(100% + 7px)", left: 0, zIndex: 40, width: "max-content", minWidth: "100%", maxWidth: 300,
          background: "var(--surface-raised)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-lg)", padding: "13px 15px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 6 }}>
            <span className="cibol-mono" style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)" }}>{hh.name}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 600, color: s.c }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.c }} />{s.t}
            </span>
            {hh.gpu && <span className="cibol-mono" style={{ fontSize: 11.5, color: "var(--text-muted)", marginLeft: "auto" }}>{hh.gpu}</span>}
          </div>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6 }}>{hh.desc || "暂无说明。"}</p>
        </div>
      )}
    </div>
  );
}

function Server() {
  const { data: HOSTS = [] } = useServers();
  const token = useAccessToken();
  const createReq = useCreateRequest();

  const [hostName, setHostName] = React.useState<string | null>(null);
  // 账号持久化（localStorage），密码仅存内存（安全）。
  const [username, setUsername] = React.useState(() => localStorage.getItem("cibol.ssh.user") || "");
  const [password, setPassword] = React.useState("");
  const [creds, setCreds] = React.useState<{ username: string; password: string } | null>(null);
  const [credsOpen, setCredsOpen] = React.useState(false);
  const [reqOpen, setReqOpen] = React.useState(false);
  const [reqReason, setReqReason] = React.useState("");
  const [conn, setConn] = React.useState<Conn>("idle");
  const [nonce, setNonce] = React.useState(0); // 重连：强制重挂终端

  React.useEffect(() => {
    if (!hostName && HOSTS.length) setHostName((HOSTS.find((x) => x.status !== "offline") || HOSTS[0]).name);
  }, [HOSTS, hostName]);
  const host = HOSTS.find((x) => x.name === hostName) || HOSTS.find((x) => x.status !== "offline") || HOSTS[0];
  if (!HOSTS.length || !host) return null;

  const doConnect = () => {
    if (!username.trim()) { toast("请填写账号", { tone: "error" }); return; }
    localStorage.setItem("cibol.ssh.user", username.trim());
    setCreds({ username: username.trim(), password });
    setCredsOpen(false);
    setNonce((n) => n + 1);
  };

  const submitRequest = () => {
    createReq.mutate(
      { kind: "ssh", detail: `服务器：${host.name}（${host.ip}）`, reason: reqReason },
      {
        onSuccess: () => { toast("已提交开通申请"); setReqOpen(false); setReqReason(""); },
        onError: () => toast("提交失败", { tone: "error" }),
      },
    );
  };

  const connState = {
    idle: { c: "var(--text-faint)", t: "未连接" },
    connecting: { c: "var(--term-amber, #E0B04A)", t: "连接中…" },
    connected: { c: "var(--term-green, #7FB069)", t: "已连接" },
    closed: { c: "var(--danger, #E06C57)", t: "已断开" },
  }[conn];

  return (
    <div style={{ maxWidth: 1060, margin: "0 auto", padding: "24px 32px 48px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {HOSTS.map((hh) => (
            <HostCard key={hh.id || hh.name} hh={hh} on={hh.name === hostName}
              onSelect={() => { setHostName(hh.name); setCreds(null); setConn("idle"); }}
              onReconnect={() => { setHostName(hh.name); if (creds) setNonce((n) => n + 1); else setCredsOpen(true); }} />
          ))}
        </div>

        {/* 连接工具条 */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: connState.c }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: connState.c }} />{connState.t}
          </span>
          <span className="cibol-mono" style={{ fontSize: 12.5, color: "var(--text-faint)" }}>
            {host.name} · {host.ip}:{host.ssh_port}
          </span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <Button variant="ghost" onClick={() => setReqOpen(true)}>申请账号</Button>
            <Button variant="primary" onClick={() => setCredsOpen(true)}>
              {creds ? "重新连接" : "连接"}
            </Button>
          </div>
        </div>

        {/* 终端：填了凭据才挂载真实 WebSSH */}
        {creds
          ? <Terminal key={`${host.id}-${nonce}`} host={host} creds={creds} token={token} onState={setConn} />
          : (
            <div style={{
              background: "#1a1b1e", borderRadius: "var(--radius-lg)", border: "1px solid #000",
              minHeight: 420, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
              color: "rgba(230,230,230,0.5)",
            }}>
              <Icon name="terminal" style={{ width: 36, height: 36, color: "rgba(230,230,230,0.35)" }} />
              <p style={{ fontSize: 13.5 }}>用你在 <b style={{ color: "rgba(230,230,230,0.75)" }}>{host.name}</b> 的账号密码连接</p>
              <Button variant="primary" onClick={() => setCredsOpen(true)}>连接到 {host.name}</Button>
            </div>
          )}
      </div>

      {/* 输入自己的 SSH 账号密码 */}
      <Dialog open={credsOpen} onClose={() => setCredsOpen(false)}
        title={`连接 ${host.name}`} subtitle={`${host.ip}:${host.ssh_port} · 用你自己在该服务器的账号密码`} icon={I("key-round")} tone="accent" width={460}
        footer={<>
          <Button variant="ghost" onClick={() => setCredsOpen(false)}>取消</Button>
          <Button variant="primary" onClick={doConnect}>连接</Button>
        </>}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Input label="账号" placeholder="username" value={username} onChange={(e) => setUsername(e.target.value)} iconLeft={I("user")} />
          <Input label="密码" type="password" placeholder="仅本次会话使用，不会保存" value={password} onChange={(e) => setPassword(e.target.value)} iconLeft={I("lock")}
            onKeyDown={(e) => { if (e.key === "Enter") doConnect(); }} />
          <button onClick={() => { setCredsOpen(false); setReqOpen(true); }} style={{ border: "none", background: "none", color: "var(--accent-text)", fontSize: 13, cursor: "pointer", textAlign: "center" }}>
            还没有服务器账号？申请开通 →
          </button>
        </div>
      </Dialog>

      <Dialog open={reqOpen} onClose={() => setReqOpen(false)} title="申请服务器账号"
        subtitle="账号与密码由管理员统一分配，你只需说明用途" icon={I("server-cog")} tone="accent"
        footer={<><Button variant="ghost" onClick={() => setReqOpen(false)}>取消</Button><Button variant="primary" onClick={submitRequest} disabled={createReq.isPending}>提交申请</Button></>}>
        <Textarea label="申请理由" placeholder="你的申请理由" rows={4} maxLength={300} value={reqReason} onChange={(e) => setReqReason(e.target.value)} />
      </Dialog>
    </div>
  );
}

export { Server };
