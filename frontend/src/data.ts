// Shared mock data for the CIBOL lab system. Ported verbatim from the design
// handoff's _shared/data.js (was window.CIBOL_DATA).
export const DATA = (function () {
  const me = { name: "苏沐", role: "硕士二年级", id: "u-sumu" };
  // 当前学期（管理员可改）
  const semester = { name: "2026 春季学期", short: "2026 春", start: "2026-02-23", end: "2026-07-12" };
  // 组会固定安排（管理员可改）：周几 · 时间 · 地点
  const meetingDefault = { weekday: "周日", time: "14:00 – 16:00", place: "认知楼 3 楼 · 讨论室 A" };
  const members = [
    { name: "林知远", role: "博士三年级" },
    { name: "Wei Chen", role: "博士后" },
    { name: "苏沐", role: "硕士二年级" },
    { name: "顾长川", role: "博士一年级" },
    { name: "陈屿", role: "硕士一年级" },
    { name: "Mei Lin", role: "博士二年级" },
    { name: "周野", role: "研究助理" },
    { name: "沈书瑶", role: "博士四年级" },
    { name: "Hao Zhang", role: "博士后" },
    { name: "唐辒", role: "博士二年级" },
    { name: "罗一帆", role: "博士一年级" },
    { name: "Priya Nair", role: "访问学者" },
    { name: "钱牧之", role: "硕士二年级" },
    { name: "叶承", role: "硕士一年级" },
    { name: "白露", role: "硕士一年级" },
    { name: "Kenji Sato", role: "博士三年级" },
    { name: "卫青禾", role: "博士二年级" },
    { name: "孟繁", role: "研究助理" },
    { name: "陆鸢", role: "硕士二年级" },
    { name: "韩望舒", role: "博士一年级" },
  ];
  const nextMeeting = {
    date: "2026年6月14日 周日",
    time: "14:00 – 16:00",
    place: "认知楼 3 楼 · 讨论室 A",
    // 在线会议链接：系统默认自动创建。url 为 null 表示创建失败，需管理员设置。
    online: { url: "https://meet.cibol.lab/grp/0614-prefrontal", provider: "腾讯会议", id: "938 217 460", status: "ok" },
    presenters: [
      { name: "林知远", topic: "前额叶皮层在工作记忆中的门控机制", kind: "进展汇报", minutes: 40 },
      { name: "顾长川", topic: "扩散模型在 fMRI 解码中的应用综述", kind: "文献精读", minutes: 30 },
    ],
  };
  // month grid for 2026-06 (starts Monday col)
  const meetingDays: Record<number, string> = { 7: "文献", 14: "进展", 21: "文献", 28: "进展" };

  // 整学期组会排期（每周一次，从首场起轮转报告人）——供成员日历与首页共用
  const WD = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const seededTopics: Record<number, { name: string; topic: string }[]> = {
    // 下一场（6/21）轮到苏沐报告 —— 与「下周轮到你报告」提醒、「我的报告」一致。
    1: [{ name: "苏沐", topic: "基于扩散模型的神经表征解码" }],
    2: [{ name: "Mei Lin", topic: "生成式神经解码综述" }, { name: "顾长川", topic: "对比学习在 EEG 表征中的应用" }],
  };
  const schedule = (function () {
    const out: any[] = [];
    let d = new Date("2026-06-14T00:00:00");
    const end = new Date("2027-01-16T00:00:00");
    let ri = 0, n = 0;
    while (d <= end && out.length < 30) {
      const mo = d.getMonth(), day = d.getDate();
      const isProgress = n % 2 === 0;
      const per = n % 3 === 0 ? 2 : 1;
      let presenters: { name: string; topic: string }[] = [];
      for (let k = 0; k < per; k++) { presenters.push({ name: members[ri % members.length].name, topic: "" }); ri++; }
      if (seededTopics[n]) presenters = seededTopics[n];
      out.push({
        id: `${mo + 1}-${day}`,
        y: d.getFullYear(), mo, day,
        mdLabel: `${mo + 1}/${String(day).padStart(2, "0")}`,
        dateLabel: `${mo + 1}月${day}日 ${WD[d.getDay()]}`,
        type: isProgress ? "进展汇报" : "文献精读",
        tone: isProgress ? "accent" : "info",
        presenters,
        online: null as any,
      });
      d = new Date(d.getTime() + 7 * 86400000); n++;
    }
    // 首场 = 展示用的 nextMeeting（含在线会议链接与已定主题），即「今日刚结束的组会」
    if (out[0]) { out[0].presenters = nextMeeting.presenters.map((p) => ({ name: p.name, topic: p.topic })); out[0].type = "进展汇报"; out[0].tone = "accent"; out[0].online = nextMeeting.online; }
    // 下一场（6/21）也预生成在线会议链接，供首页「下一次组会」展示。
    if (out[1]) { out[1].online = { url: "https://meet.cibol.lab/grp/0621-decode", provider: "腾讯会议", id: "204 668 391", status: "ok" }; }
    return out;
  })();

  // 全员公告（管理员发布，首页展示）。schema 见 store.ts 顶部注释。
  const announcements = [
    { id: "a-seed-1", title: "暑期组会时间调整", body: "7 月起组会改为每周六上午 9:30 开始，地点不变（认知楼 3 楼讨论室 A）。请相互转告，并据此安排汇报准备。", level: "important", pinned: true, audience: "all", author: "管理员 · 周明", publishedAt: "2026-06-11T09:00:00.000Z", expiresAt: "2026-07-20" },
    { id: "a-seed-2", title: "GPU 服务器例行维护", body: "本周五 20:00–22:00 对 lab-gpu-03 停机维护，期间无法连接，请提前保存训练任务与检查点。", level: "urgent", pinned: false, audience: "all", author: "管理员 · 周明", publishedAt: "2026-06-10T15:00:00.000Z", expiresAt: "2026-06-14" },
    { id: "a-seed-3", title: "新版组会汇报模板已发布", body: "即日起组会统一使用新版汇报模板，可在「我的 · 资料」中下载。", level: "info", pinned: false, audience: "all", author: "管理员 · 周明", publishedAt: "2026-06-05T10:00:00.000Z", expiresAt: null },
  ];

  // 实验室服务器（管理员可增删改）。schema 见 store.ts 顶部注释。
  const servers = [
    { id: "srv-turing", name: "turing", ip: "10.12.0.11", gpu: "4× RTX A6000", status: "online", net: "intranet", desc: "通用训练主机，适合中等规模实验与交互式调试。无需报备，按需使用。" },
    { id: "srv-lecun", name: "lecun", ip: "10.12.0.12", gpu: "8× A100 80G", status: "online", net: "intranet", desc: "大显存集群，用于大模型预训练与多卡分布式任务。占用 4 卡以上请先在群里报备。" },
    { id: "srv-hinton", name: "hinton", ip: "10.12.0.13", gpu: "4× RTX 4090", status: "busy", net: "public", desc: "推理与微调主机，当前负载较高，建议错峰使用或先 nvidia-smi 查看空闲卡。" },
    { id: "srv-fodor", name: "fodor", ip: "10.12.0.14", gpu: "2× RTX 3090", status: "offline", net: "intranet", desc: "备用主机，硬件维护中暂不可用，恢复时间另行通知。" },
  ];

  // ── 评选期 / 组会统计 种子 ──
  // 本评选期内的历次组会（已结束，供管理员录入出勤+发言）。
  const evalPeriod = { name: "2026 春季 · 第二评选期", from: "2026-04-19", to: "2026-06-07", count: 8 };
  const pastReports = (function () {
    const out: any[] = [];
    let d = new Date("2026-04-19T00:00:00"); let ri = 5, n = 0;
    while (out.length < 8) {
      const mo = d.getMonth(), day = d.getDate();
      const per = n % 3 === 2 ? 2 : 1;
      const pres: string[] = [];
      for (let k = 0; k < per; k++) { pres.push(members[ri % members.length].name); ri += 3; }
      out.push({
        id: `r-${mo + 1}-${day}`, mo, day,
        dateLabel: `${mo + 1}月${day}日`, mdLabel: `${mo + 1}/${String(day).padStart(2, "0")}`,
        type: n % 2 === 0 ? "进展汇报" : "文献精读",
        tone: n % 2 === 0 ? "accent" : "info",
        presenters: pres,
      });
      d = new Date(d.getTime() + 7 * 86400000); n++;
    }
    return out;
  })();

  return { me, members, nextMeeting, meetingDays, semester, meetingDefault, schedule, announcements, servers, evalPeriod, pastReports };
})();

export type CibolData = typeof DATA;
