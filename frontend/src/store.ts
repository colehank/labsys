// 全局轻量成功/错误提示：任意界面保存后调用 toast("已保存") 给出明确反馈。
//
// 注：本系统所有业务数据均经由 api/hooks.ts 的 react-query 层与后端同源，
// 历史上用于前端 mock 的 STORE/DATA 已随真实后端接入而全部移除，仅保留此 toast 工具。
export function toast(msg: string, opts: { tone?: string; duration?: number } = {}) {
  let host = document.getElementById("cibol-toast-host");
  if (!host) {
    host = document.createElement("div");
    host.id = "cibol-toast-host";
    host.style.cssText = "position:fixed;left:50%;bottom:30px;transform:translateX(-50%);z-index:99999;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none";
    document.body.appendChild(host);
  }
  const ok = opts.tone !== "error";
  const el = document.createElement("div");
  el.style.cssText = "display:flex;align-items:center;gap:9px;padding:11px 17px;border-radius:12px;background:var(--surface);border:1px solid var(--border-default);box-shadow:var(--shadow-lg,0 10px 30px rgba(0,0,0,0.14));font-family:var(--font-sans);font-size:13.5px;font-weight:500;color:var(--text-strong);opacity:0;transform:translateY(10px);transition:opacity .2s var(--ease-out),transform .2s var(--ease-out)";
  const badge = "display:inline-flex;width:19px;height:19px;flex-shrink:0;border-radius:50%;align-items:center;justify-content:center;font-size:12px;color:#fff;background:" + (ok ? "var(--success)" : "var(--danger)");
  el.innerHTML = '<span style="' + badge + '">' + (ok ? "✓" : "!") + "</span><span></span>";
  (el.lastChild as HTMLElement).textContent = msg;
  host.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = "1"; el.style.transform = "translateY(0)"; });
  setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translateY(10px)"; setTimeout(() => el.remove(), 240); }, opts.duration || 1900);
}
