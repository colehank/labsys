import { useSyncExternalStore } from "react";

// 响应式断点：窄屏（手机/竖屏平板）走移动布局。内联样式盖不动 CSS 媒体查询，
// 故用此 hook 让组件按视口宽度条件化布局。
const QUERY = "(max-width: 768px)";

function subscribe(cb: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
