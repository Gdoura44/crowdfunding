/* global process */
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Dev: proxy `/api` → Node backend so the SPA can use relative URLs (axios baseURL "").
 * Override target with env `VITE_DEV_PROXY_TARGET` in a local `.env` if your backend port differs.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiProxyTarget =
    env.VITE_DEV_PROXY_TARGET?.trim() || "http://localhost:3000";

  const proxy = {
    "/api": {
      target: apiProxyTarget,
      changeOrigin: true,
    },
  };

  return {
    plugins: [react()],
    server: {
      proxy,
    },
    // `vite preview` doesn't automatically reuse `server.proxy`, so we mirror it.
    preview: {
      proxy,
    },
  };
});
