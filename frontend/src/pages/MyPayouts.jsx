import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader.jsx";
import PageLoader from "../components/ui/PageLoader.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { payoutsApi } from "../api/payouts";
import { useAuth } from "../hooks/useAuth.js";
import { extractApiError } from "../utils/apiError";
import Alert from "../components/ui/Alert.jsx";

function statusBadge(status) {
  const map = {
    PENDING: "bg-secondary",
    READY: "bg-primary",
    PROCESSING: "bg-info text-dark",
    COMPLETED: "bg-success",
    FAILED: "bg-danger",
    CANCELLED: "bg-warning text-dark",
  };
  return <span className={`badge ${map[status] || "bg-light text-dark border"}`}>{status}</span>;
}

export default function MyPayouts() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.role === "ADMIN") return;
    let cancelled = false;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const { data } = await payoutsApi.mine({ limit: 50 });
        if (!cancelled) setItems(data.payouts || []);
      } catch (e) {
        if (!cancelled) {
          const out = extractApiError(e, "Impossible de charger vos paiements.");
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
        title="Mes paiements (payouts)"
        subtitle="Quand un projet atteint son objectif, vous pouvez fournir vos coordonnées bancaires puis un administrateur valide le virement."
      />

      {user?.role === "ADMIN" && (
        <Alert variant="info">
          Les comptes administrateur n’ont pas d’espace créateur (payouts personnels).
        </Alert>
      )}
      {error && <Alert variant="danger">{error}</Alert>}
      {loading && <PageLoader label="Chargement…" />}

      {!loading && !error && items.length === 0 && (
        <EmptyState
          icon="fa-solid fa-building-columns"
          title="Aucun payout"
          description="Quand un de vos projets devient financé, un payout sera créé automatiquement."
        />
      )}

      {!loading && !error && items.length > 0 && (
        <div className="card border-0 fc-surface-card">
          <div className="table-responsive rounded-3">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>Projet</th>
                  <th>Montant</th>
                  <th>Statut</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p._id}>
                    <td className="small">
                      {p.projectId && typeof p.projectId === "object" ? (
                        <div className="fw-semibold text-truncate" style={{ maxWidth: 420 }}>
                          {p.projectId.title || String(p.projectId._id || "—")}
                        </div>
                      ) : (
                        <span className="text-muted">{String(p.projectId || "—")}</span>
                      )}
                      {p.projectId && typeof p.projectId === "object" && p.projectId.status ? (
                        <div className="text-muted small">Statut projet : {p.projectId.status}</div>
                      ) : null}
                    </td>
                    <td className="fw-semibold">{p.amount} TND</td>
                    <td>{statusBadge(p.status)}</td>
                    <td>
                      <Link to={`/payouts/${p._id}`} className="btn btn-sm btn-primary">
                        <i className="fa-solid fa-arrow-right-to-bracket me-2" aria-hidden="true" />
                        Détails
                      </Link>
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

