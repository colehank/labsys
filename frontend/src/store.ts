// STORE — a tiny reactive store for lab-wide state the admin can edit:
// 当前学期 · 默认组会时间地点 · 全员公告(通知). Screens subscribe via use().
// Ported from the design handoff's _shared/store.js (was window.CIBOL_STORE).
//
// ─────────────────────────────────────────────────────────────────────────
// 通知 / 公告 Schema  (Announcement)
//   { id, title, body, level:"info"|"important"|"urgent", pinned, audience:"all"|"students",
//     author, publishedAt(ISO), expiresAt(ISO date)|null }
//   排序规则：pinned 优先 → level 权重(urgent>important>info) → publishedAt 倒序。
// ─────────────────────────────────────────────────────────────────────────
// 服务器 Schema  (Server) —— 管理员维护，用户端只读展示。
//   { id, name, ip, gpu, status:"online"|"busy"|"offline", desc }
// ─────────────────────────────────────────────────────────────────────────
// 请假/对调请求 状态机  (Request) —— 用户发起，状态对用户可见。
//   swap:    pending  → accepted | declined | cancelled
//   absence: submitted → approved | rejected | cancelled
// ─────────────────────────────────────────────────────────────────────────
import React from "react";
import { DATA } from "./data";
import { REQ_FLOW } from "./lib/reqFlow";

const d = DATA;

const nowISO = () => new Date().toISOString();

// ── 评选 / 组会统计 种子构建 ──
const evalH = (s: string, salt: number) => { let x = salt; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) >>> 0; return x; };
const evalMembers = (d.members || []).map((m) => m.name);
const evalReports = (d.pastReports || []).map((r) => ({ ...r }));
const seedAttendance: any = {}, seedDiscussion: any = {}, seedRatings: any = {};
evalReports.forEach((r: any) => {
  seedAttendance[r.id] = {}; seedDiscussion[r.id] = {}; seedRatings[r.id] = {};
  evalMembers.forEach((name) => {
    const presenter = r.presenters.includes(name);
    const hv = evalH(name + r.id, 7) % 100;
    let stt = presenter ? "present" : (hv < 80 ? "present" : hv < 91 ? "leave" : "absent");
    seedAttendance[r.id][name] = stt;
    let disc = stt === "present" ? (evalH(name + r.id, 13) % (presenter ? 3 : 5)) + (presenter ? 3 : 0) : 0;
    seedDiscussion[r.id][name] = disc;
  });
  r.presenters.forEach((pn: string) => {
    seedRatings[r.id][pn] = { attitude: 3 + (evalH(pn + r.id, 5) % 21) / 10, polish: 3 + (evalH(pn + r.id, 9) % 21) / 10, raters: 9 + (evalH(pn + r.id, 3) % 8) };
  });
});
const seedPeerBaseline: any = {};
evalMembers.forEach((name) => {
  seedPeerBaseline[name] = { attitude: 3 + (evalH(name, 5) % 21) / 10, polish: 3 + (evalH(name, 9) % 21) / 10 };
});

const state: any = {
  semester: { ...d.semester },
  meetingDefault: { ...d.meetingDefault },
  announcements: (d.announcements || []).map((a) => ({ ...a })),
  servers: (d.servers || []).map((s) => ({ ...s })),
  requests: [
    { id: "req-in-1", kind: "swap", incoming: true, from: "林知远", toName: "苏沐", fromDate: "6月14日 周日", toDate: "6月21日 周日", topic: "前额叶皮层在工作记忆中的门控机制", reason: "当周出差参会，时间冲突。", status: "pending", createdAt: "2026-06-13T02:10:00.000Z", history: [{ status: "pending", at: "2026-06-13T02:10:00.000Z", note: "林知远 向你发起对调请求" }] },
    { id: "req-seed-3", kind: "api", from: "苏沐", detail: "多模态对齐实验 · 预算 ¥200", reason: "调用脑电特征模型做对齐评测。", status: "submitted", createdAt: "2026-06-12T02:40:00.000Z", history: [{ status: "submitted", at: "2026-06-12T02:40:00.000Z", note: "已提交 API 密钥申请，等待管理员下发" }] },
    { id: "req-seed-4", kind: "ssh", from: "苏沐", detail: "用户名 sumu · lab-gpu-03", reason: "跑行为数据预处理。", status: "approved", createdAt: "2026-06-09T06:00:00.000Z", history: [{ status: "submitted", at: "2026-06-09T06:00:00.000Z", note: "已提交服务器账号申请" }, { status: "approved", at: "2026-06-10T03:20:00.000Z", note: "管理员已开通 sumu@lab-gpu-03" }] },
    { id: "req-cy-1", kind: "absence", from: "陈屿", fromDate: "7月5日 周日", reason: "学术会议，本次报告轮空。", status: "submitted", createdAt: "2026-06-12T09:00:00.000Z", history: [{ status: "submitted", at: "2026-06-12T09:00:00.000Z", note: "已提交轮空请假，等待管理员审批" }] },
    { id: "req-ml-1", kind: "api", from: "Mei Lin", detail: "脑电特征提取 · 预算 ¥80", reason: "调用脑电特征模型。", status: "submitted", createdAt: "2026-06-12T07:30:00.000Z", history: [{ status: "submitted", at: "2026-06-12T07:30:00.000Z", note: "已提交 API 密钥申请，等待管理员下发" }] },
    { id: "req-zy-1", kind: "ssh", from: "周野", detail: "希望用户名 zhouye · 行为数据预处理", reason: "跑行为数据预处理。", status: "submitted", createdAt: "2026-06-11T11:00:00.000Z", history: [{ status: "submitted", at: "2026-06-11T11:00:00.000Z", note: "已提交服务器账号申请" }] },
  ],
  evalPeriod: { ...(d.evalPeriod || {}) },
  evalMembers,
  evalReports,
  attendance: seedAttendance,
  discussion: seedDiscussion,
  ratings: seedRatings,
  peerBaseline: seedPeerBaseline,
  evalWeights: { attitude: 0.25, polish: 0.25, attendance: 0.25, discussion: 0.25 },
  evalFilters: { attitudeMin: 0, polishMin: 0, attMin: 100, discMin: 4 },
  evalRange: { from: (d.evalPeriod && d.evalPeriod.from) || "2026-04-19", to: (d.evalPeriod && d.evalPeriod.to) || "2026-06-07", preset: "period" },
  progressOrder: null,
  excellence: [],
  cancelledMeetings: [],
};
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());

const LEVEL_WEIGHT: Record<string, number> = { urgent: 3, important: 2, info: 1 };
const sortAnn = (list: any[]) =>
  [...list].sort((a, b) =>
    (Number(b.pinned) - Number(a.pinned)) ||
    (LEVEL_WEIGHT[b.level] - LEVEL_WEIGHT[a.level]) ||
    String(b.publishedAt).localeCompare(String(a.publishedAt))
  );

let UID = 1;
export const STORE = {
  REQ_FLOW,
  get: () => state,
  set(patch: any) {
    if (patch.semester) Object.assign(state.semester, patch.semester);
    if (patch.meetingDefault) Object.assign(state.meetingDefault, patch.meetingDefault);
    notify();
  },

  // —— 公告 ——
  publishAnnouncement(a: any) {
    const now = new Date();
    state.announcements = sortAnn([
      {
        id: "a" + Date.now() + "-" + (UID++),
        title: (a.title || "").trim(),
        body: (a.body || "").trim(),
        level: a.level || "info",
        pinned: !!a.pinned,
        audience: a.audience || "all",
        author: a.author || "管理员",
        publishedAt: now.toISOString(),
        expiresAt: a.expiresAt || null,
      },
      ...state.announcements,
    ]);
    notify();
  },
  removeAnnouncement(id: string) {
    state.announcements = state.announcements.filter((x: any) => x.id !== id);
    notify();
  },
  toggleAnnouncementPin(id: string) {
    state.announcements = sortAnn(state.announcements.map((x: any) => (x.id === id ? { ...x, pinned: !x.pinned } : x)));
    notify();
  },
  activeAnnouncements() {
    const today = new Date().toISOString().slice(0, 10);
    return sortAnn(state.announcements.filter((a: any) => !a.expiresAt || a.expiresAt >= today));
  },
  allAnnouncements: () => sortAnn(state.announcements),

  // —— 服务器 ——
  addServer(s: any) {
    state.servers = [
      ...state.servers,
      { id: "srv-" + Date.now() + "-" + (UID++), name: (s.name || "").trim(), ip: (s.ip || "").trim(), gpu: (s.gpu || "").trim(), status: s.status || "online", net: s.net || "intranet", desc: (s.desc || "").trim() },
    ];
    notify();
  },
  updateServer(id: string, patch: any) {
    state.servers = state.servers.map((s: any) => (s.id === id ? { ...s, ...patch } : s));
    notify();
  },
  removeServer(id: string) {
    state.servers = state.servers.filter((s: any) => s.id !== id);
    notify();
  },

  // —— 请假/对调请求（状态机） ——
  createRequest(r: any) {
    const flow = REQ_FLOW[r.kind] || REQ_FLOW.swap;
    const at = nowISO();
    const req = {
      id: "req-" + Date.now() + "-" + (UID++),
      kind: r.kind, from: r.from || "苏沐",
      fromDate: r.fromDate || "", toName: r.toName || "", toDate: r.toDate || "",
      topic: r.topic || "", reason: r.reason || "", detail: r.detail || "",
      status: flow.initial, createdAt: at,
      history: [{ status: flow.initial, at, note: r.note || "已发送" }],
    };
    state.requests = [req, ...state.requests];
    notify();
    return req.id;
  },
  canTransition(kind: string, from: string, to: string) {
    const flow = REQ_FLOW[kind] || REQ_FLOW.swap;
    return (flow.transitions[from] || []).includes(to);
  },
  advanceRequest(id: string, next: string, note?: string) {
    state.requests = state.requests.map((q: any) => {
      if (q.id !== id) return q;
      const allowed = (REQ_FLOW[q.kind] || REQ_FLOW.swap).transitions[q.status] || [];
      if (!allowed.includes(next)) return q;
      return { ...q, status: next, history: [...q.history, { status: next, at: nowISO(), note: note || "" }] };
    });
    notify();
  },
  cancelRequest(id: string) {
    this.advanceRequest(id, "cancelled", "已撤回");
  },
  myRequests: () => state.requests,
  requestForDate(fromDate: string) {
    return state.requests.find((q: any) => !q.incoming && q.fromDate === fromDate) || null;
  },
  incomingRequests: () => state.requests.filter((q: any) => q.incoming && q.status === "pending"),

  // —— 评选 / 组会统计 ——
  setAttendance(reportId: string, name: string, status: string) {
    if (!state.attendance[reportId]) state.attendance[reportId] = {};
    state.attendance[reportId][name] = status;
    if (status !== "present" && state.discussion[reportId]) state.discussion[reportId][name] = 0;
    notify();
  },
  submitRating(reportId: string, presenter: string, r: any) {
    if (!state.ratings[reportId]) state.ratings[reportId] = {};
    const prev = state.ratings[reportId][presenter] || { attitude: 0, polish: 0, raters: 0 };
    const n = prev.raters + 1;
    state.ratings[reportId][presenter] = {
      attitude: (prev.attitude * prev.raters + (r.attitude || 0)) / n,
      polish: (prev.polish * prev.raters + (r.polish || 0)) / n,
      raters: n,
    };
    if (!state.discussion[reportId]) state.discussion[reportId] = {};
    (r.top5 || []).forEach((name: string, i: number) => { if (name) state.discussion[reportId][name] = (state.discussion[reportId][name] || 0) + (5 - i); });
    notify();
  },
  setEvalWeights(patch: any) { Object.assign(state.evalWeights, patch); notify(); },
  setEvalFilters(patch: any) { Object.assign(state.evalFilters, patch); notify(); },
  setEvalRange(patch: any) { Object.assign(state.evalRange, patch); notify(); },
  setProgressOrder(arr: string[] | null) { state.progressOrder = arr ? [...arr] : null; notify(); },
  resetProgressOrder() { state.progressOrder = null; notify(); },

  publishExcellence(count: number) {
    const ev = this.computeEval();
    const names = ev.merged.slice(0, Math.max(1, count | 0)).map((m: any) => m.name);
    const rg = state.evalRange || {};
    state.excellence = [
      { id: "exc-" + Date.now(), period: state.evalPeriod.name, from: rg.from, to: rg.to, count: names.length, names, at: nowISO() },
      ...state.excellence,
    ];
    notify();
    return state.excellence[0];
  },
  revokeExcellence(id: string) { state.excellence = state.excellence.filter((e: any) => e.id !== id); notify(); },
  latestExcellence: () => state.excellence[0] || null,

  cancelMeeting(id: string) { if (!state.cancelledMeetings.includes(id)) { state.cancelledMeetings = [...state.cancelledMeetings, id]; notify(); } },
  restoreMeeting(id: string) { state.cancelledMeetings = state.cancelledMeetings.filter((x: string) => x !== id); notify(); },
  isMeetingCancelled(id: string) { return state.cancelledMeetings.includes(id); },

  computeEval(rangeOverride?: any): any {
    const rg = rangeOverride || state.evalRange || {};
    const cancelled = new Set(state.cancelledMeetings || []);
    const isoOf = (r: any) => `2026-${String(r.mo + 1).padStart(2, "0")}-${String(r.day).padStart(2, "0")}`;
    const reports = state.evalReports.filter((r: any) => {
      if (cancelled.has(r.id)) return false;
      const iso = isoOf(r);
      return (!rg.from || iso >= rg.from) && (!rg.to || iso <= rg.to);
    });
    const total = reports.length || 1;
    const rows = state.evalMembers.map((name: string) => {
      let present = 0, discuss = 0, aSum = 0, aN = 0, pSum = 0, pN = 0;
      reports.forEach((r: any) => {
        if (state.attendance[r.id] && state.attendance[r.id][name] === "present") present++;
        discuss += (state.discussion[r.id] && state.discussion[r.id][name]) || 0;
        const rt = state.ratings[r.id] && state.ratings[r.id][name];
        if (rt) { aSum += rt.attitude; aN++; pSum += rt.polish; pN++; }
      });
      const base = state.peerBaseline[name] || { attitude: 0, polish: 0 };
      const attitude = aN ? aSum / aN : base.attitude;
      const polish = pN ? pSum / pN : base.polish;
      return { name, attitude, polish, attRate: Math.round((present / total) * 100), discuss, reported: aN } as any;
    });
    const norm = (key: string, nk: string) => {
      const vals = rows.map((r: any) => r[key]);
      const mn = Math.min(...vals), mx = Math.max(...vals);
      rows.forEach((r: any) => { r[nk] = mx > mn ? ((r[key] - mn) / (mx - mn)) * 100 : 100; });
    };
    norm("attitude", "nAttitude"); norm("polish", "nPolish");
    norm("attRate", "nAtt"); norm("discuss", "nDisc");
    const w = state.evalWeights, sw = (w.attitude + w.polish + w.attendance + w.discussion) || 1;
    rows.forEach((r: any) => { r.meeting = (w.attitude * r.nAttitude + w.polish * r.nPolish + w.attendance * r.nAtt + w.discussion * r.nDisc) / sw; });
    const byMeeting = [...rows].sort((a: any, b: any) => b.meeting - a.meeting);
    byMeeting.forEach((r: any, i: number) => { r.meetingRank = i + 1; });
    const f = state.evalFilters;
    const survivors = byMeeting.filter((r: any) => r.attitude >= f.attitudeMin && r.polish >= f.polishMin && r.attRate >= f.attMin && r.discuss >= f.discMin);
    const survNames = survivors.map((r: any) => r.name);
    let order = state.progressOrder;
    if (!order || !order.length) order = survNames.slice();
    else { order = order.filter((n: string) => survNames.includes(n)); survNames.forEach((n: string) => { if (!order.includes(n)) order.push(n); }); }
    const progressRank: any = {}; order.forEach((n: string, i: number) => { progressRank[n] = i + 1; });
    const survByMeeting = [...survivors].sort((a: any, b: any) => a.meetingRank - b.meetingRank);
    const mRankAmong: any = {}; survByMeeting.forEach((r: any, i: number) => { mRankAmong[r.name] = i + 1; });
    const merged = survivors.map((r: any) => {
      const mR = mRankAmong[r.name], pR = progressRank[r.name];
      return { name: r.name, row: r, mRank: mR, pRank: pR, score: (mR + pR) / 2 };
    }).sort((a: any, b: any) => a.score - b.score || a.mRank - b.mRank);
    merged.forEach((m: any, i: number) => { m.finalRank = i + 1; });
    return { rows: byMeeting, survivors, order, progressRank, mRankAmong, merged, total };
  },

  rankSeriesFor(name: string, fromISO: string, toISO: string, metric: string): any {
    const cancelled = new Set(state.cancelledMeetings || []);
    const isoOf = (r: any) => `2026-${String(r.mo + 1).padStart(2, "0")}-${String(r.day).padStart(2, "0")}`;
    const reps = state.evalReports.filter((r: any) => !cancelled.has(r.id)).map((r: any) => ({ r, iso: isoOf(r) }))
      .filter((x: any) => (!fromISO || x.iso >= fromISO) && (!toISO || x.iso <= toISO))
      .sort((a: any, b: any) => a.iso.localeCompare(b.iso));
    const total = state.evalMembers.length;
    const pts: any[] = [];
    reps.forEach(({ r, iso }: any) => {
      const ev = this.computeEval({ from: fromISO, to: iso });
      let arr = ev.rows;
      if (metric === "discuss") arr = [...ev.rows].sort((a: any, b: any) => b.discuss - a.discuss || b.meeting - a.meeting);
      else if (metric === "report") arr = [...ev.rows].sort((a: any, b: any) => (b.nAttitude + b.nPolish) - (a.nAttitude + a.nPolish) || b.meeting - a.meeting);
      const idx = arr.findIndex((x: any) => x.name === name);
      pts.push({ label: `${r.mo + 1}/${String(r.day).padStart(2, "0")}`, rank: idx >= 0 ? idx + 1 : total });
    });
    return { points: pts.map((p) => ({ label: p.label })), ranks: pts.map((p) => p.rank), total };
  },

  currentExcellence(): any {
    const latest = state.excellence[0];
    if (latest) return { ...latest, published: true };
    const ev = this.computeEval();
    const names = ev.merged.slice(0, 5).map((m: any) => m.name);
    const rg = state.evalRange || {};
    return { id: "exc-fallback", period: state.evalPeriod.name, from: rg.from, to: rg.to, count: names.length, names, at: null, published: false };
  },

  // React hook: re-renders the caller whenever the store changes.
  use() {
    const [, force] = React.useReducer((x) => x + 1, 0);
    React.useEffect(() => {
      subs.add(force);
      return () => { subs.delete(force); };
    }, []);
    return state;
  },
};

// 全局轻量成功提示：任意界面保存后调用 toast("已保存") 给出明确反馈。
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

// 种子：上一评选期管理员已发布的优秀名单（取终极排名前 5），
// 让「组会 · 区间排名」默认即展示「上次优秀名单」。
(function seedExcellence() {
  try {
    const ev = STORE.computeEval();
    const names = ev.merged.slice(0, 5).map((m: any) => m.name);
    const roster = (DATA.members || []).map((m) => m.name);
    const pick = (idxs: number[]) => idxs.map((i) => roster[i % roster.length]).filter(Boolean);
    const hist = [
      { id: "exc-h1", period: "2026 春季 · 第一评选期", from: "2026-02-24", to: "2026-04-12", count: 5, names: pick([1, 0, 19, 17, 10]), at: "2026-04-13T01:00:00.000Z" },
      { id: "exc-h2", period: "2025 秋季 · 第三评选期", from: "2025-12-29", to: "2026-02-08", count: 5, names: pick([0, 7, 15, 1, 19]), at: "2026-02-09T01:00:00.000Z" },
    ];
    const head = names.length ? [{
      id: "exc-seed", period: state.evalPeriod.name,
      from: (state.evalRange || {}).from, to: (state.evalRange || {}).to, count: names.length, names,
      at: "2026-06-08T01:00:00.000Z",
    }] : [];
    state.excellence = [...head, ...hist];
  } catch (e) { /* computeEval 不可用时静默跳过 */ }
})();
