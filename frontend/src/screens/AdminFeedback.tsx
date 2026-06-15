import React from "react";
import * as NS from "../ds";
import { I, Icon } from "../lib/icons";
import { useFeedback, useMarkFeedbackRead } from "../api/hooks";
import { useIsMobile } from "../lib/useIsMobile";

// AdminFeedback — 匿名意见: 管理员查看成员匿名提交的意见，可标记已读。完全匿名，不含提交者身份。
  const { Card, Badge, IconButton, ScreenState, EmptyState } = NS;

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  function AdminFeedback() {
    const isMobile = useIsMobile();
    const q = useFeedback();
    const markRead = useMarkFeedbackRead();
    const list = q.data ?? [];
    const unread = list.filter((f: any) => !f.read).length;

    return (
      <div style={{ maxWidth: 760, margin: "0 auto", padding: isMobile ? "16px 14px 48px" : "24px 32px 48px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-strong)" }}>匿名意见</h2>
          <p style={{ fontSize: 13.5, color: "var(--text-muted)", marginTop: 3 }}>成员匿名提交的想法，完全不含提交者身份信息。</p>
        </div>

        <Card eyebrow={`共 ${list.length} 条 · ${unread} 条未读`} title="意见列表" padding="md">
          {q.isLoading ? <ScreenState loading />
            : q.isError ? <ScreenState error onRetry={() => q.refetch()} />
            : list.length === 0 ? <EmptyState compact title="还没有收到意见" description="成员在「我的 · 匿名意见」提交后会显示在这里。" style={{ marginTop: 8 }} />
            : (
              <div style={{ marginTop: 2 }}>
                {list.map((f: any, i: number) => (
                  <div key={f.id} style={{ display: "flex", gap: 13, alignItems: "flex-start", padding: "15px 4px", borderBottom: i === list.length - 1 ? "none" : "1px solid var(--border-subtle)", opacity: f.read ? 0.62 : 1 }}>
                    <span style={{ width: 34, height: 34, flexShrink: 0, borderRadius: "var(--radius-md)", background: "var(--accent-soft)", color: "var(--accent-text)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon name="message-circle" style={{ width: 16, height: 16 }} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        {f.read ? <Badge tone="neutral" size="sm">已读</Badge> : <Badge tone="accent" size="sm" dot>未读</Badge>}
                        <span style={{ fontSize: 12, color: "var(--text-faint)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                          <Icon name="clock" style={{ width: 12, height: 12 }} />{fmtTime(f.created_at)}
                        </span>
                      </div>
                      <p style={{ fontSize: 14, color: "var(--text-body)", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{f.body}</p>
                    </div>
                    {!f.read && (
                      <IconButton size="sm" icon={I("check")} label="标记已读" onClick={() => markRead.mutate(f.id)} />
                    )}
                  </div>
                ))}
              </div>
            )}
        </Card>
      </div>
    );
  }

  export { AdminFeedback };
