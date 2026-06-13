import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import "./styles/styles.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

// 启动容错：任一渲染异常都显示「重新加载」而非白屏。
class BootBoundary extends React.Component<{ children: React.ReactNode }, { err: Error | null }> {
  constructor(p: any) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(e: Error) { return { err: e }; }
  componentDidCatch(e: Error) { console.error(e); }
  render() {
    if (this.state.err) {
      return (
        <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 32, textAlign: "center", fontFamily: "var(--font-sans, system-ui)", color: "var(--text-strong, #2a2a28)", background: "var(--canvas, #FBFAF6)" }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>页面加载遇到问题</div>
          <div style={{ fontSize: 13, color: "var(--text-muted, #6b655c)", maxWidth: 360, lineHeight: 1.5 }}>编译脚本时出现异常，重新加载通常即可恢复。</div>
          <button onClick={() => location.reload()} style={{ marginTop: 4, padding: "9px 20px", border: "none", borderRadius: 10, background: "var(--accent, #BD5D3A)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>重新加载</button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <BootBoundary>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </BootBoundary>,
);
