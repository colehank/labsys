import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// CIBOL lab system — single-page React app booted from index.html.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    // 开发代理：/api 与实时端点转发到 FastAPI（避免 CORS、同源 cookie）。
    proxy: {
      "/api": { target: "http://localhost:8000", changeOrigin: true },
      "/ws": { target: "ws://localhost:8000", ws: true },
      "/sse": { target: "http://localhost:8000", changeOrigin: true },
    },
  },
});
