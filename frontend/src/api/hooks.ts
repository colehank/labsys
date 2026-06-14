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

export function useSaveConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Config) => unwrap(api.PUT("/api/config", { body })),
    onSuccess: (data) => {
      qc.setQueryData(["config"], data);
      qc.invalidateQueries({ queryKey: ["config"] });
      qc.invalidateQueries({ queryKey: ["meetings"] });
    },
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

// 管理员整体保存组会排期（端点未在 openapi schema 里，走原生 fetch）
export type ScheduleMeetingIn = {
  date: string; type: string; time: string; place: string;
  presenters: { name: string; topic: string; kind: string }[];
};
export function useSaveSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (meetings: ScheduleMeetingIn[]) => {
      const r = await fetch(`/api/meetings/schedule`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokens.access}` },
        body: JSON.stringify({ meetings }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.detail || "保存失败");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meetings"] }),
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

// 用户级 SSH 账密（与服务器解耦、可多条、跨服务器共用）。端点未在 openapi schema 里，走原生 fetch。
export type Cred = { id: string; username: string };
export type CredList = { feature: boolean; items: Cred[] };

// 单一查询键 ["credentials"]：服务器页与设置页共用、互相同步
export function useMyCredentials() {
  return useQuery({
    queryKey: ["credentials"],
    queryFn: async (): Promise<CredList> => {
      const r = await fetch(`/api/credentials`, { headers: { Authorization: `Bearer ${tokens.access}` } });
      if (!r.ok) throw new Error("账密查询失败");
      return r.json();
    },
  });
}

export function useSaveCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { username: string; password: string }) => {
      const r = await fetch(`/api/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokens.access}` },
        body: JSON.stringify(v),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.detail || "保存失败");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["credentials"] }),
  });
}

export function useDeleteCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (credId: string) => {
      await fetch(`/api/credentials/${credId}`, { method: "DELETE", headers: { Authorization: `Bearer ${tokens.access}` } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["credentials"] }),
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

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (notifId: string) =>
      unwrap(api.POST("/api/notifications/{notif_id}/read", { params: { path: { notif_id: notifId } } })),
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

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: components["schemas"]["UserCreate"]) => unwrap(api.POST("/api/users", { body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useAdminUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; patch: components["schemas"]["UserAdminUpdate"] }) =>
      unwrap(api.PATCH("/api/users/{user_id}", { params: { path: { user_id: vars.id } }, body: vars.patch })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE("/api/users/{user_id}", { params: { path: { user_id: id } } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
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
