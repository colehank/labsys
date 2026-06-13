// 认证状态 —— 基于 react-query，封装真实登录/登出与当前用户。
import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, tokens } from "./api/client";
import type { components } from "./api/schema";

export type Me = components["schemas"]["UserOut"];

// 订阅 token 变化 → token 写入/清除时驱动重渲染。
export function useAccessToken(): string | null {
  return React.useSyncExternalStore(
    tokens.subscribe,
    () => tokens.access,
    () => null,
  );
}

// 当前用户：有 token 才拉取；token 出现时（登录后）自动获取。
export function useMe() {
  const access = useAccessToken();
  return useQuery({
    queryKey: ["me"],
    enabled: !!access,
    retry: false,
    queryFn: async () => {
      const { data, error } = await api.GET("/api/auth/me");
      if (error) throw error;
      return data as Me;
    },
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { email: string; password: string }) => {
      const { data, error } = await api.POST("/api/auth/login", { body: vars });
      if (error || !data) throw new Error("邮箱或密码错误");
      tokens.set(data.access_token, data.refresh_token);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return React.useCallback(() => {
    tokens.clear();
    qc.clear();
  }, [qc]);
}

export const isAdmin = (me?: Me | null) => me?.role === "admin";
