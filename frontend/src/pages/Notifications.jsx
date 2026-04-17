import { useEffect, useState } from "react";
import { notificationsApi } from "../api/notifications";
import PageHeader from "../components/ui/PageHeader.jsx";
import PageLoader from "../components/ui/PageLoader.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await notificationsApi.list({ limit: 30 });
    setItems(data.notifications || []);
  }

  useEffect(() => {
    let cancelled = false;
    setError("");
    (async () => {
      try {
        await load();
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || "Impossible de charger.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function markRead(id) {
    try {
      await notificationsApi.markRead(id);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Action impossible.");
    }
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Messages liés à vos projets, paiements et actions importantes sur la plateforme."
      />

      {loading && <PageLoader label="Chargement de vos messages…" />}

      {error && <div className="alert alert-warning">{error}</div>}

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
                      <span className="badge bg-light text-dark text-truncate">{n.type}</span>
                    </div>
                    <div className="fw-semibold text-dark">{n.title}</div>
                    <div className="small text-muted">{n.message}</div>
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

