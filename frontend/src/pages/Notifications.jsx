import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { notificationsApi } from "../api/notifications";
import { projectsApi } from "../api/projects";
import PageHeader from "../components/ui/PageHeader.jsx";
import PageLoader from "../components/ui/PageLoader.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { extractApiError } from "../utils/apiError";
import { useAuth } from "../hooks/useAuth";
import { emitNotificationsChanged } from "../utils/notificationsEvents";
import { labelNotificationType } from "../utils/notificationLabels";
import Alert from "../components/ui/Alert.jsx";

export default function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [projectTitleCache, setProjectTitleCache] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const enrichProjectTitles = useCallback(async (notifs) => {
    const missing = (notifs || []).filter((n) => {
      const isProject = String(n.relatedEntityType || "").toUpperCase() === "PROJECT";
      const id = String(n.relatedEntityId || "");
      if (!isProject || !id) return false;
      if (projectTitleCache[id]) return false;
      const t = String(n.title || "");
      // Si le backend inclut déjà "— <titre>", ne rien faire.
      if (t.includes("—")) return false;
      return true;
    });
    if (missing.length === 0) return;

    const pairs = await Promise.all(
      missing.map(async (n) => {
        const id = String(n.relatedEntityId || "");
        try {
          const { data } = await projectsApi.byId(id);
          const title = String(data?.project?.title || "").trim();
          return title ? [id, title] : null;
        } catch {
          return null;
        }
      })
    );
    const next = {};
    for (const p of pairs) {
      if (!p) continue;
      const [id, title] = p;
      next[id] = title;
    }
    if (Object.keys(next).length > 0) {
      setProjectTitleCache((prev) => ({ ...prev, ...next }));
    }
  }, [projectTitleCache]);

  useEffect(() => {
    if (user?.role === "ADMIN") {
      navigate("/admin/notifications", { replace: true });
    }
  }, [user, navigate]);

  const load = useCallback(async () => {
    const { data } = await notificationsApi.list({ limit: 30 });
    const notifs = data.notifications || [];
    setItems(notifs);
    // Enrichissement au mieux pour les anciennes notifications sans titre de projet.
    await enrichProjectTitles(notifs);
  }, [enrichProjectTitles]);

  useEffect(() => {
    let cancelled = false;
    setError("");
    (async () => {
      try {
        await load();
      } catch (err) {
        if (!cancelled) {
          const out = extractApiError(err, "Impossible de charger.");
          setError(out.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, navigate, load]);

  async function markRead(id) {
    try {
      await notificationsApi.markRead(id);
      emitNotificationsChanged();
      await load();
    } catch (err) {
      const out = extractApiError(err, "Action impossible.");
      setError(out.message);
    }
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Messages liés à vos projets, paiements et actions importantes sur la plateforme."
      />

      {loading && <PageLoader label="Chargement de vos messages…" />}

      {error && <Alert variant="warning">{error}</Alert>}

      {!loading && !error && items.length === 0 && (
        <EmptyState
          icon="fa-regular fa-bell"
          title="Vous êtes à jour"
          description="Quand une étape change (validation, publication, paiement simulé…), un message apparaîtra ici."
        />
      )}

      {!loading && items.length > 0 && (
        <div className="list-group list-group-flush rounded-3 overflow-hidden border fc-surface-card">
          {items.map((n) => (
            <div
              key={n._id}
              className={`list-group-item py-3 px-3 ${!n.read ? "bg-primary bg-opacity-10" : ""}`}
            >
              <div className="d-flex flex-column flex-md-row justify-content-between gap-3">
                <div className="d-flex gap-3 min-w-0">
                  <div
                    className="flex-shrink-0 rounded-3 d-flex align-items-center justify-content-center text-primary bg-white border"
                    style={{ width: "2.75rem", height: "2.75rem" }}
                    aria-hidden="true"
                  >
                    <i className="fa-solid fa-bell" />
                  </div>
                  <div className="min-w-0">
                    <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                      {!n.read && <span className="badge bg-primary">Nouveau</span>}
                      {labelNotificationType(n.type) ? (
                        <span className="badge bg-light text-dark text-truncate">
                          {labelNotificationType(n.type)}
                        </span>
                      ) : null}
                    </div>
                    <div className="fw-semibold text-dark">{n.title}</div>
                    <div className="small text-muted">{n.message}</div>
                    {String(n.relatedEntityType || "").toUpperCase() === "PROJECT" &&
                      String(n.relatedEntityId || "") &&
                      projectTitleCache[String(n.relatedEntityId || "")] &&
                      !String(n.title || "").includes("—") && (
                        <div className="small text-muted mt-1">
                          Projet : <strong>{projectTitleCache[String(n.relatedEntityId || "")]}</strong>
                        </div>
                      )}
                    <div className="small text-muted mt-2 d-inline-flex align-items-center gap-2">
                      <i className="fa-regular fa-clock" aria-hidden="true" />
                      {n.createdAt ? new Date(n.createdAt).toLocaleString("fr-FR") : ""}
                    </div>
                  </div>
                </div>
                <div className="d-flex align-items-start justify-content-md-end flex-shrink-0">
                  {!n.read && (
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => markRead(n._id)}
                    >
                      <i className="fa-regular fa-circle-check me-2" aria-hidden="true" />
                      Marquer comme lue
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

