import React from "react";
import * as NS from "../ds";
import { I } from "../lib/icons";
import { useAuditLogs } from "../api/hooks";
import { useIsMobile } from "../lib/useIsMobile";

const { Avatar, ScreenState, EmptyState } = NS;

// 动作 key → 中文标签 + 色调（语义色，非品牌强调色）
const ACTION: Record<string, { label: string; tone: string }> = {
  save_schedule: { label: "保存排期", tone: "var(--accent-text)" },
  publish_excellence: { label: "发布优秀", tone: "var(--amber-600, var(--accent-text))" },
  update_eval_config: { label: "评选标准", tone: "var(--text-muted)" },
  delete_vote: { label: "退回评分", tone: "var(--danger-text, #c0562f)" },
};

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getMonth() + 1}月${d.getDate()}日 ${p(d.getHours())}:${p(d.getMinutes())}`;
  } catch { return iso; }
}

function AuditLog() {
  const isMobile = useIsMobile();
  const q = useAuditLogs();
  const logs: any[] = (q.data as any) || [];

  if (q.isLoading) return <ScreenState loading />;
  if (q.isError) return <ScreenState error onRetry={() => q.refetch()} />;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: isMobile ? "16px 14px 48px" : "24px 32px 48px" }}>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-strong)" }}>操作日志</h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
          谁·何时·改了什么 —— 保存排期、发布优秀、评选标准、退回评分等关键管理操作留痕，便于追溯。
        </p>
      </div>

      {logs.length === 0 ? (
        <EmptyState title="暂无操作记录" description="管理员执行关键操作后会在此留痕。" style={{ marginTop: 32 }} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {logs.map((l) => {
            const a = ACTION[l.action] || { label: l.action, tone: "var(--text-muted)" };
            return (
              <div key={l.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px", borderRadius: "var(--radius-md)", borderBottom: "1px solid var(--border-subtle)" }}>
                <Avatar name={l.actor} size="sm" />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)" }}>{l.actor}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: a.tone, background: "var(--surface-sunken)", padding: "1px 8px", borderRadius: "var(--radius-pill)" }}>{a.label}</span>
                  </div>
                  <div style={{ fontSize: 13.5, color: "var(--text-body)", marginTop: 3 }}>{l.summary}</div>
                </div>
                <span className="cibol-mono" style={{ fontSize: 12, color: "var(--text-faint)", whiteSpace: "nowrap", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{fmtTime(l.createdAt)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export { AuditLog };
