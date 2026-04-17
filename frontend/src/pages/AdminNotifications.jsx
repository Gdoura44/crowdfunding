import { useEffect, useState } from "react";
import { adminApi } from "../api/admin";
import { useAuth } from "../hooks/useAuth";
import PageHeader from "../components/ui/PageHeader.jsx";
import PageLoader from "../components/ui/PageLoader.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";

export default function AdminNotifications() {
  const { user } = useAuth();
  const [tab, setTab] = useState("FEED");
  const [items, setItems] = useState([]);
  const [failed, setFailed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const canAccess = user?.role === "ADMIN";

  useEffect(() => {
    if (!canAccess) return;
    let cancelled = false;
    setError("");
    setLoading(true);
    (async () => {
      try {
        if (tab === "FEED") {
          const { data } = await adminApi.listNotifications({ limit: 80 });
          if (!cancelled) setItems(data.notifications || []);
        } else {
          const { data } = await adminApi.listFailedNotifications({ resolved: false, limit: 80 });
          if (!cancelled) setFailed(data.failedNotifications || []);
        }
      } catch (e) {
        if (!cancelled) setError(e?.response?.data?.message || "Impossible de charger les notifications.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canAccess, tab]);

  if (!canAccess) {
    return (
      <div className="card border-0 fc-surface-card">
        <div className="card-body p-4 text-center text-muted">Accès réservé aux administrateurs.</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Notifications (plateforme)"
        subtitle="Flux de notifications et gestion des échecs d’envoi (dead-letter)."
        actions={
          <div className="btn-group shadow-sm">
            <button
              type="button"
              className={`btn btn-sm ${tab === "FEED" ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => setTab("FEED")}
            >
              Flux
            </button>
            <button
              type="button"
              className={`btn btn-sm ${tab === "FAILED" ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => setTab("FAILED")}
            >
              Échecs d’e-mail
            </button>
          </div>
        }
      />
      {error && <div className="alert alert-danger py-2">{error}</div>}
      {loading && <PageLoader label="Chargement…" />}
      {!loading && !error && tab === "FEED" && items.length === 0 && (
        <EmptyState icon="fa-regular fa-bell" title="Aucune notification" description="La base est vide pour le moment." />
      )}
      {!loading && !error && tab === "FEED" && items.length > 0 && (
        <div className="list-group list-group-flush border rounded-3 fc-surface-card overflow-hidden">
          {items.map((n) => (
            <div key={n._id} className="list-group-item py-3 px-3">
              <div className="d-flex flex-wrap justify-content-between gap-2">
                <span className="badge bg-light text-dark">{n.type}</span>
                <span className="small text-muted">
                  {n.createdAt ? new Date(n.createdAt).toLocaleString("fr-FR") : ""}
                </span>
              </div>
              <div className="fw-semibold text-dark mt-1">{n.title}</div>
              <div className="small text-muted">{n.message}</div>
              <div className="small text-muted mt-1">Destinataire (id) : {String(n.userId)}</div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && tab === "FAILED" && failed.length === 0 && (
        <EmptyState
          icon="fa-solid fa-envelope-circle-check"
          title="Aucun échec d’envoi"
          description="Aucun événement de type notification en échec pour le moment."
        />
      )}
      {!loading && !error && tab === "FAILED" && failed.length > 0 && (
        <div className="card border-0 fc-surface-card">
          <div className="table-responsive rounded-3">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>EventId</th>
                  <th>NotificationId</th>
                  <th>Erreur</th>
                  <th style={{ width: "1%" }} />
                </tr>
              </thead>
              <tbody>
                {failed.map((ev) => (
                  <tr key={ev._id}>
                    <td className="small text-muted">
                      {ev.createdAt ? new Date(ev.createdAt).toLocaleString("fr-FR") : "—"}
                    </td>
                    <td className="small text-muted">{String(ev._id).slice(-8)}</td>
                    <td className="small text-muted">{String(ev.payload?.notificationId || "—")}</td>
                    <td className="small text-muted" style={{ maxWidth: 420 }}>
                      {String(ev.error || "—")}
                    </td>
                    <td className="text-end">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        disabled={busyId === ev._id}
                        onClick={async () => {
                          setBusyId(ev._id);
                          setError("");
                          try {
                            await adminApi.retryNotification(ev._id);
                            const { data } = await adminApi.listFailedNotifications({ resolved: false, limit: 80 });
                            setFailed(data.failedNotifications || []);
                          } catch (e) {
                            setError(e?.response?.data?.message || "Action impossible.");
                          } finally {
                            setBusyId("");
                          }
                        }}
                      >
                        Relancer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
