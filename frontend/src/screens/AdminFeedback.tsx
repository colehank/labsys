import React from "react";
import * as NS from "../ds";
import { I, Icon } from "../lib/icons";
import { toast } from "../store";
import { useFeedback, useMarkFeedbackRead, useDeleteFeedback } from "../api/hooks";
import { useIsMobile } from "../lib/useIsMobile";

// AdminFeedback — 匿名意见: 管理员查看成员匿名提交的意见，可标记已读/删除。完全匿名，不含提交者身份。
  const { Card, Badge, IconButton, ScreenState, EmptyState, Dialog, Button } = NS;

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  function AdminFeedback() {
    const isMobile = useIsMobile();
    const q = useFeedback();
    const markRead = useMarkFeedbackRead();
    const deleteFb = useDeleteFeedback();
    const [deleteTarget, setDeleteTarget] = React.useState<string | null>(null);
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
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      {!f.read && (
                        <IconButton size="sm" icon={I("check")} label="标记已读"
                          disabled={markRead.isPending && (markRead.variables as any) === f.id}
                          onClick={() => markRead.mutate(f.id)} />
                      )}
                      <IconButton size="sm" icon={I("trash-2")} label="删除"
                        disabled={deleteFb.isPending && (deleteFb.variables as any) === f.id}
                        onClick={() => setDeleteTarget(f.id)} />
                    </div>
                  </div>
                ))}
              </div>
            )}
        </Card>

        <Dialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)}
          title="删除这条意见？" subtitle="删除后无法恢复，发送者不会收到任何通知。"
          tone="danger" icon={I("trash-2")} width={400}
          footer={<>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>取消</Button>
            <Button variant="primary" loading={deleteFb.isPending}
              onClick={() => deleteTarget && deleteFb.mutate(deleteTarget, {
                onSuccess: () => { toast("已删除"); setDeleteTarget(null); },
                onError: (e: any) => toast(e?.message || "删除失败", { tone: "error" }),
              })}>确认删除</Button>
          </>}>
          <p style={{ fontSize: 13.5, color: "var(--text-body)", lineHeight: 1.6 }}>该意见将被永久从系统中移除。</p>
        </Dialog>
      </div>
    );
  }

  export { AdminFeedback };
