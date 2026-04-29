/**
 * API base URL resolution (see `vite.config.js` server.proxy for local dev).
 *
 * - Development: default "" → requests go to the same origin as the Vite dev
 *   server (e.g. :5173), and `/api` is proxied to the Node backend. No
 *   frontend `.env` required for a standard setup.
 * - Production: set `VITE_API_URL` at build time if the API is on another
 *   origin; otherwise "" assumes the API is served under the same host
 *   (e.g. reverse proxy `/api` → backend).
 */
export function getApiBaseUrl() {
  // In dev, always prefer same-origin + Vite proxy (`/api` → backend).
  // Évite les problèmes de cookies cross-site (SameSite) avec les sessions httpOnly.
  if (import.meta.env.DEV) return "";

  const explicit = import.meta.env.VITE_API_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }
  return "";
}
