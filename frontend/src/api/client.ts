// 类型化 API client —— openapi-fetch + 自动鉴权中间件。
// 类型来自 schema.ts（openapi-typescript 由后端 OpenAPI 生成，勿手改）。
import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "./schema";

// dev 走 Vite 代理（见 vite.config.ts）；prod 同源 /api。
const BASE_URL = "/";

const ACCESS = "cibol.access";
const REFRESH = "cibol.refresh";

// token 作为可观察源：变更时通知订阅者，驱动 React 重渲染（useSyncExternalStore）。
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const tokens = {
  get access() { return localStorage.getItem(ACCESS); },
  get refresh() { return localStorage.getItem(REFRESH); },
  set(access: string, refresh?: string) {
    localStorage.setItem(ACCESS, access);
    if (refresh) localStorage.setItem(REFRESH, refresh);
    emit();
  },
  clear() { localStorage.removeItem(ACCESS); localStorage.removeItem(REFRESH); emit(); },
  subscribe(cb: () => void) { listeners.add(cb); return () => listeners.delete(cb); },
};

// 刷新去重：并发 401 只触发一次刷新。
let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const rt = tokens.refresh;
  if (!rt) return false;
  if (!refreshing) {
    refreshing = fetch(`${BASE_URL}api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: rt }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.access_token) { tokens.set(d.access_token); return true; } return false; })
      .catch(() => false)
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

const authMiddleware: Middleware = {
  async onRequest({ request }) {
    const at = tokens.access;
    if (at) request.headers.set("Authorization", `Bearer ${at}`);
    return request;
  },
  async onResponse({ request, response }) {
    // 401 → 尝试刷新一次并重放原请求。
    if (response.status === 401 && !request.url.includes("/auth/")) {
      if (await tryRefresh()) {
        const retry = new Request(request, {});
        retry.headers.set("Authorization", `Bearer ${tokens.access}`);
        return fetch(retry);
      }
      tokens.clear();
    }
    return response;
  },
};

export const api = createClient<paths>({ baseUrl: BASE_URL });
api.use(authMiddleware);
