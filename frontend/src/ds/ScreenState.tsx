import React from "react";
import { NodeSpinner } from "./NodeSpinner";
import { EmptyState } from "./EmptyState";
import { Button } from "./Button";

/**
 * CIBOL ScreenState — 统一的页面级数据态占位。
 * 加载中 → 节点 spinner；失败 → 提示 + 重试。替代各屏 `if (!data) return null`
 * 导致的空白页，让“加载中 / 加载失败 / 真空”三态可区分。
 */
export function ScreenState({ loading, error, onRetry, label = "加载中…", minHeight = 240, style = {} }: any) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight, padding: "40px 20px", ...style,
    }}>
      {loading ? (
        <NodeSpinner size={30} label={label} />
      ) : (
        <EmptyState
          compact
          title="加载失败"
          description="数据没能载入，请检查网络后重试。"
          action={onRetry ? <Button size="sm" variant="secondary" onClick={onRetry}>重试</Button> : null}
        />
      )}
    </div>
  );
}
