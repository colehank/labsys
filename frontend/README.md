# CIBOL · 实验室系统

A Vite + React + TypeScript implementation of the **CIBOL lab platform**, built
from the `CIBOL Design System` handoff (Claude Design). One app, seven member
surfaces plus the admin surfaces, composed entirely from the design-system
components — a faithful, pixel-level recreation of the prototype in
`ui_kits/app/index.html`.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
```

You land on the **登录** screen → 进入系统 → the app shell. The collapsible left
rail switches surfaces; the rail's **成员视图 / 管理员视图** toggle reveals the
admin surfaces (审批中心 / 组会中心 / 人员管理 / 服务器管理 / 通知公告); the
sun/moon button toggles light/dark. The bottom-right slider button (界面气质)
opens the "feel" panel to change accent / 格调 / 质感 live.

```bash
npm run build      # production build → dist/
npm run typecheck  # tsc --noEmit (clean)
npm run preview    # serve the production build
```

## Surfaces

| 中文 | File | Highlights |
|---|---|---|
| 登录 | `src/screens/Login.tsx` | Brand entry with the neural-constellation backdrop + mark draw-in. |
| 首页 | `src/screens/Home.tsx` | Greeting, announcements carousel, next meeting, pending swaps/ratings. |
| 组会 | `src/screens/Meetings.tsx` | 安排 (calendar + my reports + leave/swap dialog), 评分 (ScoreDots + discussion Top-5), 表现 (rank trend chart + excellence list). |
| 服务器 | `src/screens/Server.tsx` | WebSSH terminal (always dark) + the no-credentials gate and access-request flow. |
| 密钥管理 | `src/screens/API.tsx` | Key request dialog, my keys + usage bars, server account card. |
| 我的 / 消息 | `src/screens/My.tsx`, `Inbox.tsx` | Settings (account / security / notifications / feedback) and the message center — both also open as panel dialogs. |
| 审批中心 | `src/screens/Approvals.tsx` | Admin queue: leave-swaps, API, SSH provisioning. |
| 组会中心 | `src/screens/Admin*.tsx` | 排期 → 数据录入 → 表现评选 → 表现记录 pipeline, plus 人员/服务器/公告 admin. |

## Architecture

- `src/ds/` — the 20 design-system components (Button, Card, Dialog, RankRow,
  ScoreDots, Sidebar …), exposed via the `src/ds/index.ts` barrel.
- `src/data.ts` — mock data (members, schedule, servers, announcements).
- `src/store.ts` — the reactive lab store: requests state-machine, announcements,
  servers, and the full evaluation pipeline (`computeEval` / `rankSeriesFor`).
  Subscribe in a component with `STORE.use()`.
- `src/feel.tsx` — `useFeel` applies the default accent/vibe/surface tokens (the
  warm serif + floating-card look); `FeelTweaks` is the live reshaper panel.
- `src/lib/icons.tsx` — `I()` / `<Icon>` over `lucide-react`, matching the
  prototype's icon semantics.
- `src/shell/AppShell.tsx` — the collapsible sidebar chrome, theme + role toggles.
- `src/styles/` — the CIBOL design tokens (colors, type, spacing, base reset).

## Notes on the port

- **Feel panel trigger.** The prototype's tweaks panel was opened by the Claude
  Design host; here a small bottom-right button toggles it. This is the only
  intentional addition — everything else mirrors the prototype 1:1.
- **Icons.** `src/lib/icons.tsx` resolves lucide glyphs dynamically by name so
  every icon used in the design renders; this imports lucide's full icon map, so
  the JS bundle is larger than a tree-shaken named-import set would be.
- This is a cosmetic recreation: data is faked, flows are illustrative, no backend.
