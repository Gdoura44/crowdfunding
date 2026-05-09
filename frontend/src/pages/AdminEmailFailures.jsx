import { useEffect, useState } from "react";
import { adminApi } from "../api/admin";
import { useAuth } from "../hooks/useAuth";
import PageHeader from "../components/ui/PageHeader.jsx";
import PageLoader from "../components/ui/PageLoader.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { extractApiError } from "../utils/apiError";
import Alert from "../components/ui/Alert.jsx";

export default function AdminEmailFailures() {
  const { user } = useAuth();
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
        const { data } = await adminApi.listFailedNotifications({ resolved: false, limit: 80 });
        if (!cancelled) setFailed(data.failedNotifications || []);
      } catch (e) {
        if (!cancelled) setError(extractApiError(e, "Impossible de charger.").message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canAccess]);

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
        title="Échecs d’envoi e-mail"
        subtitle="Événements de notification en échec ; relance possible ligne par ligne."
      />
      {error && <Alert variant="danger">{error}</Alert>}
      {loading && <PageLoader label="Chargement…" />}
      {!loading && !error && failed.length === 0 && (
        <EmptyState
          icon="fa-solid fa-envelope-circle-check"
          title="Aucun échec d’envoi"
          description="Aucun événement de type notification en échec pour le moment."
        />
      )}
      {!loading && !error && failed.length > 0 && (
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
                            setError(extractApiError(e, "Action impossible.").message);
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
