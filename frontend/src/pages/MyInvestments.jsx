import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { confirmAlert } from "react-confirm-alert";
import { investmentsApi } from "../api/investments";
import PageHeader from "../components/ui/PageHeader.jsx";
import PageLoader from "../components/ui/PageLoader.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { extractApiError } from "../utils/apiError";

function badge(status) {
  const map = {
    INITIATED: "bg-secondary",
    SUCCESS: "bg-success",
    FAILED: "bg-danger",
    CANCELLED: "bg-warning text-dark",
    REFUNDED: "bg-info text-dark",
    CANCELLING: "bg-primary",
  };
  return <span className={`badge ${map[status] || "bg-light text-dark border"}`}>{status}</span>;
}

function cancellationInfo(inv) {
  const tx = inv?.transaction;
  const graceMin = Number(inv?.cancellationGracePeriodMinutes || 0);
  const eligibleInitiated = inv?.status === "INITIATED" && tx?.status === "PENDING";
  const eligibleSuccess = inv?.status === "SUCCESS" && tx?.status === "SUCCEEDED" && tx?.createdAt && graceMin > 0;

  if (eligibleInitiated) {
    return { canCancel: true, label: "Annuler (paiement en attente)" };
  }

  if (eligibleSuccess) {
    const deadlineMs = new Date(tx.createdAt).getTime() + graceMin * 60 * 1000;
    const leftMs = deadlineMs - Date.now();
    if (leftMs <= 0) return { canCancel: false };
    const leftMin = Math.max(1, Math.ceil(leftMs / (60 * 1000)));
    return {
      canCancel: true,
      label: `Annuler (reste ~${leftMin} min)`,
      policy: `Annulation possible pendant ${graceMin} minutes après le paiement.`,
    };
  }

  return { canCancel: false };
}

export default function MyInvestments() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const { data } = await investmentsApi.mine({ limit: 50 });
      setItems(data.investments || []);
    } catch (e) {
      const out = extractApiError(e, "Impossible de charger vos investissements.");
      setError(out.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user?.role === "ADMIN") return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await investmentsApi.mine({ limit: 50 });
        if (!cancelled) setItems(data.investments || []);
      } catch (e) {
        if (!cancelled) {
          const out = extractApiError(e, "Impossible de charger vos investissements.");
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
        title="Mes investissements"
        subtitle="Historique de vos soutiens et statut des paiements (simulation)."
        actions={
          <Link to="/projects" className="btn btn-outline-secondary btn-sm">
            Explorer des projets
          </Link>
        }
      />

      {user?.role === "ADMIN" && (
        <div className="alert alert-info py-2">
          Les comptes administrateur n’ont pas d’espace investisseur.
        </div>
      )}
      {error && <div className="alert alert-danger py-2">{error}</div>}
      {loading && <PageLoader label="Chargement…" />}

      {!loading && !error && items.length === 0 && (
        <EmptyState
          icon="fa-solid fa-coins"
          title="Aucun investissement"
          description="Lorsque vous soutenez un projet, il apparaîtra ici avec le statut du paiement."
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
                  <th>Paiement</th>
                  <th>Date</th>
                  <th style={{ width: "1%" }} />
                </tr>
              </thead>
              <tbody>
                {items.map((inv) => (
                  <tr key={inv._id}>
                    <td>
                      {inv.project ? (
                        <Link to={`/projects/${inv.projectId}`} className="text-decoration-none fw-semibold">
                          {inv.project.title}
                        </Link>
                      ) : (
                        <span className="text-muted small">{String(inv.projectId)}</span>
                      )}
                    </td>
                    <td className="fw-semibold">{inv.amount} TND</td>
                    <td>{badge(inv.status)}</td>
                    <td className="small text-muted">
                      {inv.transaction ? `${inv.transaction.provider} · ${inv.transaction.status}` : "—"}
                    </td>
                    <td className="small text-muted">
                      {inv.createdAt ? new Date(inv.createdAt).toLocaleString("fr-FR") : "—"}
                    </td>
                    <td className="text-end">
                      <div className="d-flex justify-content-end gap-2">
                        {inv.status === "FAILED" && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary"
                            disabled={busyId === inv._id}
                            onClick={async () => {
                              setBusyId(inv._id);
                              setError("");
                              try {
                                const { data } = await investmentsApi.retry(inv._id);
                                // If backend returns paymentUrl, redirect to mock checkout.
                                if (data?.paymentUrl) {
                                  window.location.assign(data.paymentUrl);
                                  return;
                                }
                                await refresh();
                              } catch (e) {
                                const out = extractApiError(e, "Retry impossible.");
                                setError(out.message);
                              } finally {
                                setBusyId("");
                              }
                            }}
                          >
                            {busyId === inv._id ? "Relance…" : "Réessayer"}
                          </button>
                        )}

                        {(() => {
                          const info = cancellationInfo(inv);
                          if (!info.canCancel) return null;
                          return (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              disabled={busyId === inv._id}
                              onClick={() => {
                                confirmAlert({
                                  title: "Annuler cet investissement ?",
                                  message:
                                    info.policy ||
                                    "Si l’annulation est autorisée, le paiement sera annulé (ou remboursé si nécessaire).",
                                  buttons: [
                                    { label: "Retour" },
                                    {
                                      label: "Annuler",
                                      onClick: async () => {
                                        setBusyId(inv._id);
                                        setError("");
                                        try {
                                          await investmentsApi.cancel(inv._id);
                                          await refresh();
                                        } catch (e) {
                                          const out = extractApiError(e, "Annulation impossible.");
                                          setError(out.message);
                                        } finally {
                                          setBusyId("");
                                        }
                                      },
                                    },
                                  ],
                                });
                              }}
                            >
                              {busyId === inv._id ? "…" : info.label}
                            </button>
                          );
                        })()}

                        {inv.status !== "FAILED" && !cancellationInfo(inv).canCancel && (
                          <span className="text-muted small">—</span>
                        )}
                      </div>
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

