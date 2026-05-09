import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { confirmAlert } from "react-confirm-alert";
import { investmentsApi } from "../api/investments";
import PageHeader from "../components/ui/PageHeader.jsx";
import PageLoader from "../components/ui/PageLoader.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { extractApiError } from "../utils/apiError";
import Alert from "../components/ui/Alert.jsx";

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

function paymentConfirmedAtMs(tx) {
  if (!tx || tx.status !== "SUCCEEDED") return null;
  const raw = tx.succeededAt || tx.updatedAt || tx.createdAt;
  if (!raw) return null;
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function cancellationInfo(inv) {
  const tx = inv?.transaction;
  const graceMin = Number(inv?.cancellationGracePeriodMinutes || 0);
  const eligibleInitiated = inv?.status === "INITIATED" && tx?.status === "PENDING";
  const confirmedMs = paymentConfirmedAtMs(tx);
  const eligibleSuccess =
    inv?.status === "SUCCESS" && tx?.status === "SUCCEEDED" && confirmedMs != null && graceMin > 0;

  if (eligibleInitiated) {
    return { canCancel: true, label: "Annuler · paiement en attente" };
  }

  if (eligibleSuccess) {
    const deadlineMs = confirmedMs + graceMin * 60 * 1000;
    const leftMs = deadlineMs - Date.now();
    if (leftMs <= 0) return { canCancel: false };
    const totalSeconds = Math.max(1, Math.ceil(leftMs / 1000));
    const mm = Math.floor(totalSeconds / 60);
    const ss = totalSeconds % 60;
    const mmStr = String(mm).padStart(2, "0");
    const ssStr = String(ss).padStart(2, "0");
    return {
      canCancel: true,
      label: `Annuler · reste ${mmStr}:${ssStr}`,
      policy: `Annulation possible pendant ${graceMin} minutes après la confirmation du paiement (ex. validation OTP).`,
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
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => (x + 1) % 1000000), 1000);
    return () => clearInterval(t);
  }, []);

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
        subtitle="Historique de vos soutiens et statut des paiements."
        actions={
          <Link to="/projects" className="btn btn-outline-secondary btn-sm">
            Explorer des projets
          </Link>
        }
      />

      {user?.role === "ADMIN" && (
        <Alert variant="info">
          Les comptes administrateur n’ont pas d’espace investisseur.
        </Alert>
      )}
      {error && <Alert variant="danger">{error}</Alert>}
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
                                // Si le backend renvoie paymentUrl, rediriger vers la page de paiement.
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
                          // Forcer le recalcul du délai d’annulation (mm:ss) en temps réel.
                          void tick;
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

