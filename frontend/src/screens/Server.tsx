import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import * as NS from "../ds";
import { I, Icon } from "../lib/icons";
import { toast } from "../store";
import { useServers, useCreateRequest, useMyCredentials } from "../api/hooks";
import { useAccessToken } from "../auth";
import { useIsMobile } from "../lib/useIsMobile";

// Server — 服务器：真实 WebSSH 终端。
// 设计：网页终端 = 用户本人的 SSH 会话，账号密码由用户自己输入，
// 后端只做 PTY↔WebSocket 透传，绝不持有 root 凭据（见 webssh.py）。
const { Button, Badge, Input, Dialog, Textarea, ScreenState, EmptyState } = NS;

const NET = {
  intranet: { tone: "info", label: "内网" },
  public: { tone: "accent", label: "公网" },
};

// 连接状态：服务器卡片状态点据此实时呈现（不再由管理员手设）。
type Conn = "idle" | "connecting" | "connected" | "closed" | "failed";

// 卡片状态点颜色：connected→绿；connecting/failed（连不上）→黄；其余（未连/已断开）→灰
const connDot = (conn?: Conn) =>
  conn === "connected" ? "var(--term-green, #7FB069)"
    : conn === "connecting" || conn === "failed" ? "var(--term-amber, #E0B04A)"
      : "var(--text-faint)";

// 真实终端：xterm.js ↔ WebSocket(/ws/ssh/{id}) ↔ 后端 PTY。
function Terminal({ host, creds, token, onState, active }: any) {
  const isMobile = useIsMobile();
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const fitRef = React.useRef<FitAddon | null>(null);
  const wsRef = React.useRef<WebSocket | null>(null);
  const termRef = React.useRef<XTerm | null>(null);
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  const toggleFullscreen = React.useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  // 全屏状态同步 → 过渡完成后重新 fit
  React.useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      setTimeout(() => {
        try { fitRef.current?.fit(); } catch {}
        const term = termRef.current, ws = wsRef.current;
        if (term && ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
        }
      }, 80);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // 浏览器标签页重新激活时重新 fit + refocus，避免切回后终端失响
  React.useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible" || !active) return;
      setTimeout(() => {
        try { fitRef.current?.fit(); } catch {}
        const term = termRef.current, ws = wsRef.current;
        if (term && ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
        }
        termRef.current?.focus();
      }, 50);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [active]);

  // 服务器切换：从隐藏切回显示时重新 fit
  React.useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => {
      try { fitRef.current?.fit(); } catch {}
      const term = termRef.current, ws = wsRef.current;
      if (term && ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
      }
      termRef.current?.focus();
    }, 30);
    return () => clearTimeout(t);
  }, [active]);

  React.useEffect(() => {
    if (!wrapRef.current || !creds) return;
    const term = new XTerm({
      fontFamily: '"JetBrainsMono Nerd Font Mono", "JetBrainsMono Nerd Font", "Symbols Nerd Font Mono", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: isMobile ? 12 : 13.5,
      cursorBlink: true,
      scrollback: 5000,
      theme: {
        background: "#1a1b1e",
        foreground: "#e6e6e6",
        cursor: "#7FB069",
      },
    });
    termRef.current = term;
    const fit = new FitAddon();
    fitRef.current = fit;
    term.loadAddon(fit);
    term.open(wrapRef.current);
    try { fit.fit(); } catch {}

    onState?.("connecting");
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/ws/ssh/${host.id}?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify(
        creds.useSaved
          ? { use_saved: true, cred_id: creds.credId, cols: term.cols, rows: term.rows }
          : { username: creds.username, password: creds.password, remember: !!creds.remember, cols: term.cols, rows: term.rows },
      ));
    };
    let connectedOnce = false;
    ws.onmessage = (ev) => {
      if (typeof ev.data === "string") term.write(ev.data);
      else (ev.data as Blob).text().then((t) => term.write(t));
      if (!connectedOnce) { connectedOnce = true; onState?.("connected"); }
    };
    ws.onclose = () => {
      term.write("\r\n\x1b[2m[连接已关闭]\x1b[0m\r\n");
      onState?.(connectedOnce ? "closed" : "failed");
    };
    ws.onerror = () => onState?.("failed");

    const onData = term.onData((d) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(d);
    });

    const sendResize = () => {
      try { fit.fit(); } catch {}
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
      }
    };
    const ro = new ResizeObserver(() => sendResize());
    ro.observe(wrapRef.current);

    return () => {
      ro.disconnect();
      onData.dispose();
      ws.close();
      term.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host.id, creds]);

  const TITLE_H = 40;
  const termH: string | number = isFullscreen ? `calc(100vh - ${TITLE_H}px)` : (isMobile ? 320 : 420);

  return (
    // 不用 overflow:hidden，避免圆角裁剪终端字符（内外背景色相同，视觉无差异）
    <div ref={containerRef} style={{
      background: "#1a1b1e",
      border: isFullscreen ? "none" : "1px solid rgba(0,0,0,0.65)",
      borderRadius: isFullscreen ? 0 : "var(--radius-lg)",
      boxShadow: isFullscreen ? "none" : "0 4px 28px rgba(0,0,0,0.45)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: TITLE_H, padding: "0 14px",
        background: "rgba(0,0,0,0.28)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        borderTopLeftRadius: isFullscreen ? 0 : "var(--radius-lg)",
        borderTopRightRadius: isFullscreen ? 0 : "var(--radius-lg)",
      }}>
        <span className="cibol-mono" style={{
          fontSize: 12.5, color: "rgba(230,230,230,0.5)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {creds?.username}@{host.name} · {host.ip}:{host.ssh_port}
        </span>
        <button
          type="button"
          onClick={toggleFullscreen}
          title={isFullscreen ? "退出全屏 (Esc)" : "全屏"}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = "rgba(230,230,230,0.85)";
            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.09)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = "rgba(230,230,230,0.38)";
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
          style={{
            flexShrink: 0, marginLeft: 10,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 28, height: 28, border: "none",
            background: "transparent", borderRadius: "var(--radius-sm)",
            cursor: "pointer", color: "rgba(230,230,230,0.38)",
            transition: "color 0.15s, background 0.15s",
          }}
        >
          <Icon name={isFullscreen ? "minimize-2" : "maximize-2"} style={{ width: 14, height: 14 }} />
        </button>
      </div>
      <div ref={wrapRef} style={{ padding: "10px 12px", height: termH }} />
    </div>
  );
}

// 服务器卡片：名+IP+重连。鼠标悬停弹出说明。点击卡片选中。
function HostCard({ hh, on, conn, onSelect, onReconnect }: any) {
  const isMobile = useIsMobile();
  const [hover, setHover] = React.useState(false);
  const [spin, setSpin] = React.useState(false);
  const dot = connDot(conn);
  const connText = conn === "connected" ? "已连接" : conn === "connecting" ? "连接中…" : conn === "failed" ? "连不上" : "未连接";
  const disabled = false;  // 状态不再禁用卡片：任何服务器都可尝试连接
  const reconnect = (e) => {
    e.stopPropagation();
    if (disabled || spin) return;
    setSpin(true);
    onReconnect && onReconnect();
    setTimeout(() => setSpin(false), 850);
  };
  return (
    <div style={{ position: "relative", flex: isMobile ? "1 1 140px" : "1 1 180px", minWidth: isMobile ? 140 : 180 }}
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
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot, flexShrink: 0, boxShadow: conn === "connected" ? `0 0 5px ${dot}` : "none" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
            <span className="cibol-mono" style={{ fontSize: 12, color: "var(--text-faint)" }}>{hh.ip}</span>
            {NET[hh.net] && <Badge tone={NET[hh.net].tone} size="sm">{NET[hh.net].label}</Badge>}
          </div>
        </div>
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
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 600, color: dot }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot }} />{connText}
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
  const isMobile = useIsMobile();
  const serversQ = useServers();
  const HOSTS = serversQ.data ?? [];
  const token = useAccessToken();
  const createReq = useCreateRequest();

  const [hostName, setHostName] = React.useState<string | null>(null);
  // 账号持久化（localStorage 兜底），密码仅存内存；勾选「记住」则加密存后端。
  const [username, setUsername] = React.useState(() => localStorage.getItem("cibol.ssh.user") || "");
  const [password, setPassword] = React.useState("");
  const [remember, setRemember] = React.useState(true);
  // 每台连过的主机各自一个常驻会话（隐藏非当前的、不卸载 → 切换主机不断连）。
  type Sess = { username: string; password: string; useSaved?: boolean; remember?: boolean; credId?: string; nonce: number };
  const [sessions, setSessions] = React.useState<Record<string, Sess>>({});
  const [connByHost, setConnByHost] = React.useState<Record<string, Conn>>({});
  const suppressAuto = React.useRef<Set<string>>(new Set()); // 用户主动断开过的 host，不再自动连
  const [credsOpen, setCredsOpen] = React.useState(false);
  const [reqOpen, setReqOpen] = React.useState(false);
  const [reqReason, setReqReason] = React.useState("");
  const qc = useQueryClient();

  // 用户级账密（与服务器解耦、可多条、跨服务器共用）。activeCredId = 当前用哪条连。
  const { data: credData } = useMyCredentials();
  const creds = credData?.items || [];
  const feature = !!credData?.feature;
  const [activeCredId, setActiveCredId] = React.useState<string>(() => localStorage.getItem("cibol.ssh.cred") || "");
  const activeCred = creds.find((c) => c.id === activeCredId) || creds[0];
  React.useEffect(() => {
    if (activeCred && activeCred.id !== activeCredId) setActiveCredId(activeCred.id);
  }, [activeCred?.id]);

  const startSession = (hid: string, c: { username: string; password: string; useSaved?: boolean; remember?: boolean; credId?: string }) => {
    suppressAuto.current.delete(hid);
    setSessions((s) => ({ ...s, [hid]: { ...c, nonce: (s[hid]?.nonce || 0) + 1 } }));
  };
  const endSession = (hid: string) => {
    suppressAuto.current.add(hid);
    setSessions((s) => { const n = { ...s }; delete n[hid]; return n; });
    setConnByHost((c) => { const n = { ...c }; delete n[hid]; return n; });
  };
  const connectSaved = (hid: string, c: { id: string; username: string }) => {
    localStorage.setItem("cibol.ssh.cred", c.id); setActiveCredId(c.id);
    startSession(hid, { username: c.username, password: "", useSaved: true, credId: c.id });
  };

  React.useEffect(() => {
    if (!hostName && HOSTS.length) setHostName(HOSTS[0].name);
  }, [HOSTS, hostName]);
  const host = HOSTS.find((x) => x.name === hostName) || HOSTS[0];

  // 有账密 → 自动用当前账号连接（当前主机无会话、且未被主动断开过时）
  React.useEffect(() => {
    if (host && activeCred && !sessions[host.id] && !suppressAuto.current.has(host.id)) {
      startSession(host.id, { username: activeCred.username, password: "", useSaved: true, credId: activeCred.id });
    }
  }, [host?.id, activeCred?.id, !!sessions[host?.id]]);

  // 勾「记住」连上后刷新账密列表（新账号出现在选择器/设置页 → 与设置页同步）
  React.useEffect(() => {
    if (host && connByHost[host.id] === "connected" && sessions[host.id]?.remember) {
      qc.invalidateQueries({ queryKey: ["credentials"] });
    }
  }, [host?.id, connByHost]);

  // 加载中 / 失败 / 真空三态 —— 不再以 return null 渲染空白页。
  if (serversQ.isLoading) return <ScreenState loading />;
  if (serversQ.isError) return <ScreenState error onRetry={() => serversQ.refetch()} />;
  if (!HOSTS.length || !host) {
    return (
      <div style={{ maxWidth: 1060, margin: "0 auto", padding: isMobile ? "16px 14px 32px" : "24px 32px 48px" }}>
        <EmptyState title="暂无服务器" description="管理员还没有登记任何服务器，登记后即可在此连接。" />
      </div>
    );
  }

  const doConnect = () => {
    if (!username.trim()) { toast("请填写账号", { tone: "error" }); return; }
    if (!host) return;
    localStorage.setItem("cibol.ssh.user", username.trim());
    startSession(host.id, { username: username.trim(), password, remember: remember && feature });
    setCredsOpen(false);
  };

  const disconnect = () => { if (host) endSession(host.id); };

  const submitRequest = () => {
    createReq.mutate(
      { kind: "ssh", detail: `服务器：${host.name}（${host.ip}）`, reason: reqReason },
      {
        onSuccess: () => { toast("已提交开通申请"); setReqOpen(false); setReqReason(""); },
        onError: () => toast("提交失败", { tone: "error" }),
      },
    );
  };

  const conn: Conn = (host && connByHost[host.id]) || "idle";
  const hasSession = !!(host && sessions[host.id]);
  const connState = {
    idle: { c: "var(--text-faint)", t: "未连接" },
    connecting: { c: "var(--term-amber, #E0B04A)", t: "连接中…" },
    connected: { c: "var(--term-green, #7FB069)", t: "已连接" },
    closed: { c: "var(--text-faint)", t: "已断开" },
    failed: { c: "var(--term-amber, #E0B04A)", t: "连接失败" },
  }[conn];

  return (
    <div style={{ maxWidth: 1060, margin: "0 auto", padding: isMobile ? "16px 14px 32px" : "24px 32px 48px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {HOSTS.map((hh) => (
            <HostCard key={hh.id || hh.name} hh={hh} on={hh.name === hostName} conn={connByHost[hh.id]}
              onSelect={() => setHostName(hh.name)}
              onReconnect={() => { setHostName(hh.name); const s = sessions[hh.id]; if (s) startSession(hh.id, s); else if (activeCred) connectSaved(hh.id, activeCred); else setCredsOpen(true); }} />
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
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            {/* 有账密：显示当前账号(多条可下拉切换)；账号增删改去「设置 → 安全」 */}
            {activeCred && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--success-text)" }}>
                {I("lock", { size: 13 })}
                {creds.length > 1
                  ? <select value={activeCred.id}
                      onChange={(e) => { const c = creds.find((x) => x.id === e.target.value); if (c && host) connectSaved(host.id, c); }}
                      style={{ border: "1px solid var(--border-default)", borderRadius: 6, padding: "2px 6px", fontSize: 12.5, background: "var(--surface)", color: "var(--text-body)", cursor: "pointer" }}>
                      {creds.map((c) => <option key={c.id} value={c.id}>{c.username}</option>)}
                    </select>
                  : <span>{activeCred.username}</span>}
              </span>
            )}
            {hasSession && <Button variant="ghost" onClick={disconnect}>断开</Button>}
            {activeCred
              ? (!hasSession && <Button variant="primary" onClick={() => host && connectSaved(host.id, activeCred)}>连接</Button>)
              : (<>
                  <Button variant="ghost" onClick={() => setReqOpen(true)}>申请账号</Button>
                  <Button variant="primary" onClick={() => setCredsOpen(true)}>连接</Button>
                </>)}
          </div>
        </div>

        {/* 终端：每台连过的主机各自常驻会话，仅显示当前主机；切换不卸载 → 会话不断 */}
        <div>
          {HOSTS.filter((h) => sessions[h.id]).map((h) => {
            const sess = sessions[h.id];
            return (
              <div key={h.id} style={{ display: h.id === host.id ? "block" : "none" }}>
                <Terminal key={`${h.id}-${sess.nonce}`} host={h} active={h.id === host.id}
                  creds={sess} token={token}
                  onState={(s: Conn) => setConnByHost((c) => ({ ...c, [h.id]: s }))} />
              </div>
            );
          })}
          {!hasSession && (
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
          <Input label="密码" type="password" placeholder={remember && feature ? "连接成功后会加密记住" : "仅本次会话使用"} value={password} onChange={(e) => setPassword(e.target.value)} iconLeft={I("lock")}
            onKeyDown={(e) => { if (e.key === "Enter") doConnect(); }} />
          {feature && (
            <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "var(--text-body)", cursor: "pointer", userSelect: "none" }}>
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--accent)", cursor: "pointer" }} />
              <span>记住账号密码（加密保存，下次自动连接，跨设备）</span>
            </label>
          )}
          <button type="button" onClick={() => { setCredsOpen(false); setReqOpen(true); }} style={{ border: "none", background: "none", color: "var(--accent-text)", fontSize: 13, cursor: "pointer", textAlign: "center" }}>
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
