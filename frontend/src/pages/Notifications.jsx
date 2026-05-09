import { useCallback, useEffect, useState } from "react";
import { notificationsApi } from "../api/notifications";
import { projectsApi } from "../api/projects";
import PageHeader from "../components/ui/PageHeader.jsx";
import PageLoader from "../components/ui/PageLoader.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { extractApiError } from "../utils/apiError";
import { emitNotificationsChanged } from "../utils/notificationsEvents";
import { labelNotificationType } from "../utils/notificationLabels";
import Alert from "../components/ui/Alert.jsx";

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [projectTitleCache, setProjectTitleCache] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [feedFilter, setFeedFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

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

  const load = useCallback(async () => {
    const { data } = await notificationsApi.list({
      page,
      limit: 30,
      unreadOnly: feedFilter === "UNREAD" ? true : undefined,
    });
    const notifs = data.notifications || [];
    setItems(notifs);
    setHasMore(Boolean(data.hasMore));
    // Enrichissement au mieux pour les anciennes notifications sans titre de projet.
    await enrichProjectTitles(notifs);
  }, [enrichProjectTitles, feedFilter, page]);

  useEffect(() => {
    let cancelled = false;
    setError("");
    setLoading(true);
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
  }, [load]);

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
        subtitle="Du plus récent au plus ancien, 30 messages par page. Projets, paiements et actions importantes."
        actions={
          <div className="btn-group shadow-sm">
            <button
              type="button"
              className={`btn btn-sm ${feedFilter === "ALL" ? "btn-dark" : "btn-outline-dark"}`}
              onClick={() => {
                setFeedFilter("ALL");
                setPage(1);
              }}
            >
              Toutes
            </button>
            <button
              type="button"
              className={`btn btn-sm ${feedFilter === "UNREAD" ? "btn-dark" : "btn-outline-dark"}`}
              onClick={() => {
                setFeedFilter("UNREAD");
                setPage(1);
              }}
            >
              Non lues
            </button>
          </div>
        }
      />

      {loading && <PageLoader label="Chargement de vos messages…" />}

      {error && <Alert variant="warning">{error}</Alert>}

      {!loading && !error && items.length === 0 && (
        <EmptyState
          icon="fa-regular fa-bell"
          title={feedFilter === "UNREAD" ? "Aucune notification non lue" : "Vous êtes à jour"}
          description={
            feedFilter === "UNREAD"
              ? "Toutes vos notifications ont été lues."
              : "Quand une étape change (validation, publication, paiement…), un message apparaîtra ici."
          }
        />
      )}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="d-flex justify-content-between align-items-center mb-3 gap-2 flex-wrap">
            <span className="small text-muted">
              Page {page}
              {hasMore ? " · d’autres messages suivent" : ""}
            </span>
            <div className="btn-group">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Précédent
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                disabled={!hasMore}
                onClick={() => setPage((p) => p + 1)}
              >
                Suivant
              </button>
            </div>
          </div>
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
        </>
      )}
    </div>
  );
}

