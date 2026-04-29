import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader.jsx";
import PageLoader from "../components/ui/PageLoader.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { reportsApi } from "../api/reports";
import { useAuth } from "../hooks/useAuth.js";
import { extractApiError } from "../utils/apiError";

function badge(status) {
  const map = {
    PENDING: "bg-secondary",
    RESOLVED: "bg-success",
    DISMISSED: "bg-warning text-dark",
  };
  return (
    <span className={`badge ${map[status] || "bg-light text-dark border"}`}>
      {status || "—"}
    </span>
  );
}

export default function MyReports() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.role === "ADMIN") return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await reportsApi.mine({ limit: 50 });
        if (!cancelled) setItems(data.reports || []);
      } catch (e) {
        if (!cancelled) {
          const out = extractApiError(e, "Impossible de charger vos signalements.");
          setError(out.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div>
      <PageHeader
        title="Mes signalements"
        subtitle="Suivez l’état de vos signalements (en cours, traités, ou classés sans suite)."
        actions={
          <Link to="/projects" className="btn btn-outline-secondary btn-sm">
            Explorer des projets
          </Link>
        }
      />

      {user?.role === "ADMIN" && (
        <div className="alert alert-info py-2">
          Les comptes administrateur n’ont pas d’espace utilisateur pour les signalements.
        </div>
      )}

      {error && <div className="alert alert-danger py-2">{error}</div>}
      {loading && <PageLoader label="Chargement…" />}

      {!loading && !error && items.length === 0 && (
        <EmptyState
          icon="fa-solid fa-flag"
          title="Aucun signalement"
          description="Si vous signalez un projet, vous pourrez suivre ici l’avancement du traitement."
        />
      )}

      {!loading && !error && items.length > 0 && (
        <div className="card border-0 fc-surface-card">
          <div className="table-responsive rounded-3">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>Projet</th>
                  <th>Type</th>
                  <th>Statut</th>
                  <th>Date</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r._id}>
                    <td>
                      <Link to={`/projects/${r.projectId}`} className="text-decoration-none fw-semibold">
                        Ouvrir
                      </Link>
                      <div className="small text-muted">{String(r.projectId)}</div>
                    </td>
                    <td className="small">{r.type || "—"}</td>
                    <td>{badge(r.status)}</td>
                    <td className="small text-muted">
                      {r.createdAt ? new Date(r.createdAt).toLocaleString("fr-FR") : "—"}
                    </td>
                    <td className="small text-muted" style={{ maxWidth: 360 }}>
                      {r.resolution || r.description || "—"}
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

