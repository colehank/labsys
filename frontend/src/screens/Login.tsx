import React from "react";
import * as NS from "../ds";
import { I, Icon } from "../lib/icons";
import { toast } from "../store";
import { useLogin } from "../auth";

// Login — 登录: 极简品牌入口。神经星座背景 + 标识描绘动效 + 逐层入场。
  const { Button, Input, Checkbox } = NS;

  // 注入一次登录页样式（动效 + 主题适配的品牌方块）。
  function ensureStyle() {
    if (document.getElementById("cibol-login-style")) return;
    const s = document.createElement("style");
    s.id = "cibol-login-style";
    s.textContent = `
    .cibol-login { position: fixed; inset: 0; overflow: hidden; background: var(--canvas);
      display: flex; align-items: center; justify-content: center; padding: 32px; }
    /* neural constellation — gentle float + staggered breathing glow（丝滑不眩晕） */
    .cibol-net { position: absolute; inset: 0; width: 100%; height: 100%;
      pointer-events: none; opacity: 0; animation: netIn 2.4s var(--ease-out) .2s forwards;
      -webkit-mask: radial-gradient(closest-side at 50% 44%, transparent 24%, #000 82%);
      mask: radial-gradient(closest-side at 50% 44%, transparent 24%, #000 82%); }
    /* 整体极轻漂移：仅平移、无缩放，幅度极小、周期很长 → 几乎察觉不到的灵动 */
    .cibol-net g { animation: netFloat 50s cubic-bezier(.45,0,.55,1) infinite alternate; }
    .cibol-net .edge { stroke: var(--accent); stroke-width: .16; opacity: .14;
      animation: edgeBreath 8s ease-in-out infinite; }
    .cibol-net .node { fill: var(--accent); animation: nodeGlow 5s ease-in-out infinite; }
    .cibol-net .node.dim { fill: var(--stone-400); }
    @keyframes netIn { to { opacity: .82; } }
    @keyframes netFloat { from { transform: translate(-0.8%, -0.6%); } to { transform: translate(0.8%, 0.6%); } }
    @keyframes nodeGlow { 0%, 100% { opacity: .30; } 50% { opacity: .9; } }
    @keyframes edgeBreath { 0%, 100% { opacity: .07; } 50% { opacity: .24; } }

    .cibol-login-inner { position: relative; width: 100%; max-width: 350px;
      display: flex; flex-direction: column; align-items: center; }

    /* brand tile — theme adaptive, mark uses currentColor */
    .cibol-login-tile { width: 62px; height: 62px; border-radius: 17px; margin-bottom: 20px;
      display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
      background: var(--stone-900); color: var(--cream);
      box-shadow: 0 10px 30px -12px color-mix(in oklch, var(--stone-900) 55%, transparent);
      opacity: 0; transform: scale(.86); animation: tileIn .8s var(--ease-spring) .15s forwards; }
    [data-theme="dark"] .cibol-login-tile { background: var(--cream); color: var(--stone-900);
      box-shadow: 0 10px 30px -14px rgba(0,0,0,.6); }
    .cibol-login-tile .arc { stroke-dasharray: 132; stroke-dashoffset: 132;
      animation: arcDraw 1.5s var(--ease-out) .5s forwards; }
    .cibol-login-tile .dot { opacity: 0; animation: dotIn .5s var(--ease-spring) forwards; }
    @keyframes tileIn { to { opacity: 1; transform: scale(1); } }
    @keyframes arcDraw { to { stroke-dashoffset: 0; } }
    @keyframes dotIn { to { opacity: 1; } }

    .cibol-rise { opacity: 0; transform: translateY(13px); animation: rise .7s var(--ease-out) forwards; }
    @keyframes rise { to { opacity: 1; transform: translateY(0); } }

    .cibol-login-cta button { transition: transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-base) var(--ease-out), background var(--dur-fast) var(--ease-out) !important; }
    .cibol-login-cta:hover button { transform: translateY(-1px); box-shadow: 0 8px 20px -8px var(--accent); }
    .cibol-login-cta:active button { transform: translateY(0); }

    @media (prefers-reduced-motion: reduce) {
      .cibol-net, .cibol-net g, .cibol-net .edge, .cibol-net .node, .cibol-login-tile, .cibol-login-tile .arc, .cibol-login-tile .dot, .cibol-rise { animation: none !important; }
      .cibol-net { opacity: 1; } .cibol-login-tile { opacity: 1; transform: none; }
      .cibol-login-tile .arc { stroke-dashoffset: 0; } .cibol-login-tile .dot { opacity: 1; }
      .cibol-rise { opacity: 1; transform: none; }
    }`;
    document.head.appendChild(s);
  }

  // 背景星座节点（呼应品牌神经 C 弧）。坐标在 0–100 视图内。
  const NODES = [
    [50, 18], [69, 24], [78, 41], [74, 60], [60, 72], [42, 74], [27, 63], [22, 44], [30, 27], [44, 36],
    [58, 44], [50, 56], [86, 33], [16, 55], [64, 12], [38, 88],
  ];
  const EDGES = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 0], [9, 10], [10, 11], [9, 0], [11, 4], [2, 12], [7, 13], [0, 14], [5, 15]];

  function Constellation() {
    return (
      <svg className="cibol-net" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <g>
          {EDGES.map(([a, b], i) => (
            <line key={i} className="edge" x1={NODES[a][0]} y1={NODES[a][1]} x2={NODES[b][0]} y2={NODES[b][1]}
              style={{ animationDelay: (i * 0.7).toFixed(2) + "s" }} />
          ))}
          {NODES.map(([x, y], i) => (
            <circle key={i} className={"node" + (i % 3 === 0 ? " dim" : "")}
              cx={x} cy={y} r={i % 4 === 0 ? 0.7 : 0.48}
              style={{ animationDelay: (i * 0.53).toFixed(2) + "s" }} />
          ))}
        </g>
      </svg>
    );
  }

  function Mark() {
    // 内联品牌神经标识，currentColor 取自方块（主题适配），弧线描绘入场。
    return (
      <svg width="38" height="38" viewBox="0 0 72 72" aria-label="CIBOL" style={{ overflow: "visible" }}>
        <path className="arc" d="M 58,10 A 28,28 0 1,0 58,62" fill="none" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" />
        <path d="M 52,20 A 16,16 0 1,0 52,52" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.28" />
        <circle className="dot" cx="58" cy="10" r="4.5" fill="currentColor" style={{ animationDelay: "1.5s" }} />
        <circle className="dot" cx="58" cy="62" r="4.5" fill="currentColor" style={{ animationDelay: "1.7s" }} />
        <circle className="dot" cx="36" cy="36" r="3" fill="currentColor" opacity="0.5" style={{ animationDelay: "1.9s" }} />
      </svg>
    );
  }

  function Login(_: any) {
    ensureStyle();
    const login = useLogin();
    const [email, setEmail] = React.useState("");
    const [password, setPassword] = React.useState("");

    const submit = (e?: any) => {
      if (e) e.preventDefault();
      if (login.isPending) return;
      login.mutate(
        { email: email.trim(), password },
        {
          onSuccess: () => toast("欢迎回来"),
          onError: () => toast("邮箱或密码错误", { tone: "error" }),
        },
      );
    };

    return (
      <div className="cibol-login">
        <Constellation />
        <form className="cibol-login-inner" onSubmit={submit}>
          <span className="cibol-login-tile"><Mark /></span>

          <div className="cibol-rise" style={{ animationDelay: ".5s", textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 31, fontWeight: 600, color: "var(--text-strong)", letterSpacing: "0.05em" }}>CIBOL</div>
            <div style={{ fontSize: 12.5, color: "var(--text-faint)", letterSpacing: "0.14em", marginTop: 6 }}>认知神经科学实验室</div>
          </div>

          <div className="cibol-rise" style={{ animationDelay: ".64s", width: "100%", display: "flex", flexDirection: "column", gap: 13, marginTop: 32 }}>
            <Input label="邮箱" type="email" placeholder="name@example.com" value={email} onChange={(e: any) => setEmail(e.target.value)} iconLeft={I("at-sign")} autoComplete="username" />
            <Input label="密码" type="password" placeholder="请输入密码" value={password} onChange={(e: any) => setPassword(e.target.value)} iconLeft={I("lock")} autoComplete="current-password" error={login.isError ? "邮箱或密码错误" : undefined} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
              <Checkbox label="记住此设备" defaultChecked />
              <a href="#" onClick={(e) => e.preventDefault()} style={{ fontSize: 13 }}>忘记密码</a>
            </div>
            <div className="cibol-login-cta" style={{ marginTop: 8 }}>
              <Button type="submit" variant="primary" fullWidth size="lg" iconRight={I("arrow-right")} disabled={login.isPending || !email.trim() || !password} onClick={submit}>{login.isPending ? "登录中…" : "进入系统"}</Button>
            </div>
          </div>

          <p className="cibol-rise" style={{ animationDelay: ".82s", fontSize: 12, color: "var(--text-faint)", marginTop: 26, textAlign: "center" }}>
            需要账号？联系实验室管理员
          </p>
        </form>
      </div>
    );
  }

  export { Login };
