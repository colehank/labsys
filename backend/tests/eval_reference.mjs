// 评选引擎 JS 参照 —— 忠实复制 frontend/src/store.ts 的种子 + computeEval 逻辑。
// 供 test_eval.py 对拍 Python 移植。输出默认评选期的 rows / merged / total。
const MEMBERS = [
  "林知远", "Wei Chen", "苏沐", "顾长川", "陈屿", "Mei Lin", "周野", "沈书瑶",
  "Hao Zhang", "唐辒", "罗一帆", "Priya Nair", "钱牧之", "叶承", "白露",
  "Kenji Sato", "卫青禾", "孟繁", "陆鸢", "韩望舒",
];
const evalH = (s, salt) => { let x = salt >>> 0; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) >>> 0; return x; };

// data.ts pastReports
function buildPastReports() {
  const out = [];
  let d = new Date("2026-04-19T00:00:00"); let ri = 5, n = 0;
  while (out.length < 8) {
    const mo = d.getMonth(), day = d.getDate();
    const per = n % 3 === 2 ? 2 : 1;
    const pres = [];
    for (let k = 0; k < per; k++) { pres.push(MEMBERS[ri % MEMBERS.length]); ri += 3; }
    out.push({ id: `r-${mo + 1}-${day}`, mo, day, type: n % 2 === 0 ? "进展汇报" : "文献精读", presenters: pres });
    d = new Date(d.getTime() + 7 * 86400000); n++;
  }
  return out;
}

const reports = buildPastReports();
const attendance = {}, discussion = {}, ratings = {};
reports.forEach((r) => {
  attendance[r.id] = {}; discussion[r.id] = {}; ratings[r.id] = {};
  MEMBERS.forEach((name) => {
    const presenter = r.presenters.includes(name);
    const hv = evalH(name + r.id, 7) % 100;
    let stt = presenter ? "present" : (hv < 80 ? "present" : hv < 91 ? "leave" : "absent");
    attendance[r.id][name] = stt;
    let disc = stt === "present" ? (evalH(name + r.id, 13) % (presenter ? 3 : 5)) + (presenter ? 3 : 0) : 0;
    discussion[r.id][name] = disc;
  });
  r.presenters.forEach((pn) => {
    ratings[r.id][pn] = { attitude: 3 + (evalH(pn + r.id, 5) % 21) / 10, polish: 3 + (evalH(pn + r.id, 9) % 21) / 10, logic: 3 + (evalH(pn + r.id, 11) % 21) / 10, raters: 9 + (evalH(pn + r.id, 3) % 8) };
  });
});
const peerBaseline = {};
MEMBERS.forEach((name) => { peerBaseline[name] = { attitude: 3 + (evalH(name, 5) % 21) / 10, polish: 3 + (evalH(name, 9) % 21) / 10, logic: 3 + (evalH(name, 11) % 21) / 10 }; });

const weights = { attitude: 0.2, polish: 0.2, logic: 0.2, attendance: 0.2, discussion: 0.2 };
const filters = { attitudeMin: 0, polishMin: 0, logicMin: 0, attMin: 100, discMin: 4 };
const range = { from: "2026-04-19", to: "2026-06-07" };

function computeEval(rg) {
  const isoOf = (r) => `2026-${String(r.mo + 1).padStart(2, "0")}-${String(r.day).padStart(2, "0")}`;
  const rs = reports.filter((r) => (!rg.from || isoOf(r) >= rg.from) && (!rg.to || isoOf(r) <= rg.to));
  const total = rs.length || 1;
  const rows = MEMBERS.map((name) => {
    let present = 0, discuss = 0, aSum = 0, aN = 0, pSum = 0, pN = 0, lSum = 0, lN = 0;
    rs.forEach((r) => {
      if (attendance[r.id][name] === "present") present++;
      discuss += discussion[r.id][name] || 0;
      const rt = ratings[r.id][name];
      if (rt) { aSum += rt.attitude; aN++; pSum += rt.polish; pN++; lSum += (rt.logic || 0); lN++; }
    });
    const base = peerBaseline[name];
    const attitude = aN ? aSum / aN : base.attitude;
    const polish = pN ? pSum / pN : base.polish;
    const logic = lN ? lSum / lN : (base.logic || 0);
    return { name, attitude, polish, logic, attRate: Math.round((present / total) * 100), discuss, reported: aN };
  });
  const norm = (key, nk) => { const vals = rows.map((r) => r[key]); const mn = Math.min(...vals), mx = Math.max(...vals); rows.forEach((r) => { r[nk] = mx > mn ? ((r[key] - mn) / (mx - mn)) * 100 : 100; }); };
  norm("attitude", "nAttitude"); norm("polish", "nPolish"); norm("logic", "nLogic"); norm("attRate", "nAtt"); norm("discuss", "nDisc");
  const w = weights, sw = (w.attitude + w.polish + (w.logic || 0) + w.attendance + w.discussion) || 1;
  rows.forEach((r) => { r.meeting = (w.attitude * r.nAttitude + w.polish * r.nPolish + (w.logic || 0) * r.nLogic + w.attendance * r.nAtt + w.discussion * r.nDisc) / sw; });
  const byMeeting = [...rows].sort((a, b) => b.meeting - a.meeting);
  byMeeting.forEach((r, i) => { r.meetingRank = i + 1; });
  const f = filters;
  const survivors = byMeeting.filter((r) => r.attitude >= f.attitudeMin && r.polish >= f.polishMin && (r.logic >= (f.logicMin || 0)) && r.attRate >= f.attMin && r.discuss >= f.discMin);
  const survNames = survivors.map((r) => r.name);
  let order = survNames.slice();
  const progressRank = {}; order.forEach((n, i) => { progressRank[n] = i + 1; });
  const survByMeeting = [...survivors].sort((a, b) => a.meetingRank - b.meetingRank);
  const mRankAmong = {}; survByMeeting.forEach((r, i) => { mRankAmong[r.name] = i + 1; });
  const merged = survivors.map((r) => { const mR = mRankAmong[r.name], pR = progressRank[r.name]; return { name: r.name, mRank: mR, pRank: pR, score: (mR + pR) / 2 }; }).sort((a, b) => a.score - b.score || a.mRank - b.mRank);
  merged.forEach((m, i) => { m.finalRank = i + 1; });
  return { rows: byMeeting, merged, total };
}

const ev = computeEval(range);
const out = {
  total: ev.total,
  rows: ev.rows.map((r) => ({ name: r.name, attitude: r.attitude, polish: r.polish, attRate: r.attRate, discuss: r.discuss, meeting: r.meeting, meetingRank: r.meetingRank })),
  merged: ev.merged.map((m) => ({ name: m.name, mRank: m.mRank, pRank: m.pRank, score: m.score, finalRank: m.finalRank })),
};
console.log(JSON.stringify(out));
