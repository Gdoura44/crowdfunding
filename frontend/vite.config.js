/* global process */
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Dev: proxy `/api` → backend Node pour que le SPA utilise des URLs relatives (axios baseURL "").
 * Surcharge la cible avec `VITE_DEV_PROXY_TARGET` dans un `.env` local si ton port backend diffère.
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
    // `vite preview` ne réutilise pas automatiquement `server.proxy`, donc on le duplique.
    preview: {
      proxy,
    },
  };
});
