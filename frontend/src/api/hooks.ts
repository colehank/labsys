// 业务数据 hooks —— 基于 react-query，消费后端各域端点。
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, tokens } from "./client";
import type { components } from "./schema";

export type Config = components["schemas"]["ConfigOut"];
export type Announcement = components["schemas"]["AnnouncementOut"];
export type Meeting = components["schemas"]["MeetingOut"];
export type Request = components["schemas"]["RequestOut"];

async function unwrap<T>(p: Promise<{ data?: T; error?: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error || data === undefined) throw error ?? new Error("请求失败");
  return data;
}

export function useConfig() {
  return useQuery({
    queryKey: ["config"],
    queryFn: () => unwrap(api.GET("/api/config")),
    staleTime: 5 * 60_000,
  });
}

export function useAnnouncements() {
  return useQuery({
    queryKey: ["announcements"],
    queryFn: () => unwrap(api.GET("/api/announcements")),
  });
}

export function useMeetings() {
  return useQuery({
    queryKey: ["meetings"],
    queryFn: () => unwrap(api.GET("/api/meetings")),
  });
}

// ── 请求（请假/对调/API/SSH）──
export function useMyRequests() {
  return useQuery({
    queryKey: ["requests", "mine"],
    queryFn: () => unwrap(api.GET("/api/requests/mine")),
  });
}

export function usePendingRequests(enabled = true) {
  return useQuery({
    queryKey: ["requests", "pending"],
    queryFn: () => unwrap(api.GET("/api/requests/pending")),
    enabled,
  });
}

export function useProcessedRequests(enabled = true) {
  return useQuery({
    queryKey: ["requests", "processed"],
    queryFn: () => unwrap(api.GET("/api/requests/processed")),
    enabled,
  });
}

// ── 服务器 ──
export type Server = components["schemas"]["ServerOut"];

export function useServers() {
  return useQuery({ queryKey: ["servers"], queryFn: () => unwrap(api.GET("/api/servers")) });
}

export function useCreateServer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: components["schemas"]["ServerCreate"]) => unwrap(api.POST("/api/servers", { body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["servers"] }),
  });
}

export function useUpdateServer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; patch: components["schemas"]["ServerUpdate"] }) =>
      unwrap(api.PATCH("/api/servers/{server_id}", { params: { path: { server_id: vars.id } }, body: vars.patch })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["servers"] }),
  });
}

export function useDeleteServer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE("/api/servers/{server_id}", { params: { path: { server_id: id } } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["servers"] }),
  });
}

// 保存的 SSH 凭据（端点未在 openapi schema 里，走原生 fetch）
export type CredStatus = { saved: boolean; username: string; feature: boolean };

export function useServerCredential(serverId?: string) {
  return useQuery({
    queryKey: ["server-credential", serverId],
    enabled: !!serverId,
    queryFn: async (): Promise<CredStatus> => {
      const r = await fetch(`/api/servers/${serverId}/credential`, {
        headers: { Authorization: `Bearer ${tokens.access}` },
      });
      if (!r.ok) throw new Error("凭据查询失败");
      return r.json();
    },
  });
}

export type CredItem = { server_id: string; server_name: string; username: string };

// 列出「我」已保存登录凭据的服务器（设置页用；与服务器页同一份存储）
export function useMyCredentials() {
  return useQuery({
    queryKey: ["my-credentials"],
    queryFn: async (): Promise<CredItem[]> => {
      const r = await fetch(`/api/servers/credentials`, { headers: { Authorization: `Bearer ${tokens.access}` } });
      if (!r.ok) throw new Error("凭据列表查询失败");
      return r.json();
    },
  });
}

// 失效两端查询（服务器页的单条状态 + 设置页的列表）→ 双向同步
function invalidateCreds(qc: ReturnType<typeof useQueryClient>, serverId: string) {
  qc.invalidateQueries({ queryKey: ["server-credential", serverId] });
  qc.invalidateQueries({ queryKey: ["my-credentials"] });
}

export function useSetServerCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { serverId: string; username: string; password: string }) => {
      const r = await fetch(`/api/servers/${v.serverId}/credential`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokens.access}` },
        body: JSON.stringify({ username: v.username, password: v.password }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.detail || "保存失败");
    },
    onSuccess: (_d, v) => invalidateCreds(qc, v.serverId),
  });
}

export function useDeleteServerCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (serverId: string) => {
      await fetch(`/api/servers/${serverId}/credential`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tokens.access}` },
      });
    },
    onSuccess: (_d, serverId) => invalidateCreds(qc, serverId),
  });
}

// ── 通知 ──
export function useNotifications() {
  return useQuery({ queryKey: ["notifications"], queryFn: () => unwrap(api.GET("/api/notifications")) });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.POST("/api/notifications/read-all")),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

// ── 公告（管理员）──
export function usePublishAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: components["schemas"]["AnnouncementCreate"]) => unwrap(api.POST("/api/announcements", { body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["announcements"] }),
  });
}

export function useTogglePin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.POST("/api/announcements/{ann_id}/toggle-pin", { params: { path: { ann_id: id } } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["announcements"] }),
  });
}

export function useRemoveAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE("/api/announcements/{ann_id}", { params: { path: { ann_id: id } } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["announcements"] }),
  });
}

// ── 成员名册 / 个人资料 ──
export type UserOut = components["schemas"]["UserOut"];

export function useUsers(enabled = true) {
  return useQuery({ queryKey: ["users"], queryFn: () => unwrap(api.GET("/api/users")), enabled });
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: components["schemas"]["UserSettingsUpdate"]) => unwrap(api.PATCH("/api/users/me", { body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });
}

// ── API 密钥（管理员签发/撤销）──
export function useIssueKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: components["schemas"]["ApiKeyIssue"]) => unwrap(api.POST("/api/apikeys", { body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["apikeys"] }),
  });
}

// ── API 密钥 ──
export function useMyKeys() {
  return useQuery({ queryKey: ["apikeys", "mine"], queryFn: () => unwrap(api.GET("/api/apikeys/mine")) });
}

// ── 评选 ──
export type EvalCompute = components["schemas"]["EvalComputeOut"];
export type EvalRow = components["schemas"]["EvalRowOut"];

export function useEvalCompute() {
  return useQuery({ queryKey: ["eval", "compute"], queryFn: () => unwrap(api.GET("/api/eval/compute")) });
}

export function useExcellence() {
  return useQuery({ queryKey: ["eval", "excellence"], queryFn: () => unwrap(api.GET("/api/eval/excellence")) });
}

export function useRankSeries(name: string, from: string, to: string, metric: string) {
  return useQuery({
    queryKey: ["eval", "rank-series", name, from, to, metric],
    queryFn: () => unwrap(api.GET("/api/eval/rank-series", {
      params: { query: { name, from_: from, to, metric } },
    })),
  });
}

export type EvalReport = components["schemas"]["ReportOut"];

export function useEvalReports() {
  return useQuery({ queryKey: ["eval", "reports"], queryFn: () => unwrap(api.GET("/api/eval/reports")) });
}

export function useSubmitRating() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { key: string; presenter: string; attitude: number; polish: number; top5: string[] }) =>
      unwrap(api.POST("/api/eval/reports/{key}/rating", {
        params: { path: { key: vars.key } },
        body: { presenter: vars.presenter, attitude: vars.attitude, polish: vars.polish, top5: vars.top5 },
      })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["eval"] }),
  });
}

export function useSetAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { key: string; name: string; status: string }) =>
      unwrap(api.POST("/api/eval/reports/{key}/attendance", {
        params: { path: { key: vars.key } },
        body: { name: vars.name, status: vars.status },
      })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["eval"] }),
  });
}

export function usePublishExcellence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (count: number) => unwrap(api.POST("/api/eval/excellence", { body: { count } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["eval"] }),
  });
}

export function useEvalConfig(enabled = true) {
  return useQuery({ queryKey: ["eval", "config"], queryFn: () => unwrap(api.GET("/api/eval/config")), enabled });
}

export function useUpdateEvalConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: components["schemas"]["EvalConfigIO"]) => unwrap(api.PUT("/api/eval/config", { body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["eval"] }),
  });
}

// ── 腾讯会议预约（管理员）──
export function useBookingSettings(enabled = true) {
  return useQuery({
    queryKey: ["booking", "settings"],
    queryFn: () => unwrap(api.GET("/api/booking/settings")),
    enabled,
  });
}

export function useUpdateBookingSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (auto_book: boolean) => unwrap(api.PUT("/api/booking/settings", { body: { auto_book } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["booking"] }),
  });
}

export function useBookMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (meetingId: string) =>
      unwrap(api.POST("/api/booking/meetings/{meeting_id}/book", { params: { path: { meeting_id: meetingId } } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meetings"] }),
  });
}

type CreateBody = components["schemas"]["CreateRequest"];

export function useCreateRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<CreateBody> & { kind: CreateBody["kind"] }) =>
      unwrap(api.POST("/api/requests", {
        body: { fromDate: "", toName: "", toDate: "", topic: "", detail: "", reason: "", note: "", ...body },
      })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["requests"] }),
  });
}

export function useAdvanceRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; next: string; note?: string }) =>
      unwrap(api.POST("/api/requests/{req_id}/advance", {
        params: { path: { req_id: vars.id } },
        body: { next: vars.next, note: vars.note ?? "" },
      })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["requests"] }),
  });
}
