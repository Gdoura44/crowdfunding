/**
 * Résolution de l’URL de base de l’API (voir `vite.config.js` et `server.proxy` en dev local).
 *
 * - Développement : par défaut "" → les requêtes vont vers le même origin que le serveur Vite
 *   (ex. :5173), et `/api` est proxy vers le backend Node. Aucun `.env` frontend n’est requis
 *   pour une configuration standard.
 * - Production : définir `VITE_API_URL` au build si l’API est sur un autre origin ; sinon ""
 *   suppose que l’API est servie sous le même hôte (ex. reverse proxy `/api` → backend).
 */
export function getApiBaseUrl() {
  // En dev, préférer le même origin + proxy Vite (`/api` → backend).
  // Évite les problèmes de cookies cross-site (SameSite) avec les sessions httpOnly.
  if (import.meta.env.DEV) return "";

  const explicit = import.meta.env.VITE_API_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }
  return "";
}
