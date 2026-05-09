import { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/ui/PageHeader.jsx";
import PageLoader from "../components/ui/PageLoader.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { adminApi } from "../api/admin";
import { useAuth } from "../hooks/useAuth.js";
import { extractApiError } from "../utils/apiError";
import { useNavigate } from "react-router-dom";
import Alert from "../components/ui/Alert.jsx";
import { confirmAlert } from "react-confirm-alert";

function formatPayoutTerminalAt(p) {
  if (!p) return "—";
  const d =
    p.status === "COMPLETED"
      ? p.completedAt
      : p.status === "FAILED"
        ? p.failedAt
        : p.status === "CANCELLED"
          ? p.cancelledAt
          : null;
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

function badge(status) {
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

export default function AdminPayouts() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState("READY");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busyId, setBusyId] = useState("");

  const params = useMemo(() => ({ status: tab, limit: 100 }), [tab]);
  const canAccess = user?.role === "ADMIN";

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const { data } = await adminApi.listPayouts(params);
      setItems(data.payouts || []);
    } catch (e) {
      const out = extractApiError(e, "Impossible de charger les payouts.");
      setError(out.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canAccess) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, canAccess]);

  async function approve(id) {
    setBusyId(id);
    setError("");
    setOk("");
    try {
      confirmAlert({
        title: "Initier le virement ?",
        message:
          "Vous serez redirigé vers l’interface prestataire pour confirmer la réussite ou l’échec du virement.",
        buttons: [
          { label: "Annuler", onClick: () => {} },
          {
            label: "Initier",
            onClick: async () => {
              setBusyId(id);
              setError("");
              setOk("");
              try {
                const { data } = await adminApi.approvePayout(id, {});
                if (data?.transferUrl) {
                  setOk("Virement initié. Confirmation prestataire requise.");
                  nav(data.transferUrl, { replace: true });
                  return;
                }
                await refresh();
                setOk("Virement initié.");
              } catch (e) {
                const out = extractApiError(e, "Approbation impossible pour le moment.");
                setError(out.message);
              } finally {
                setBusyId("");
              }
            },
          },
        ],
      });
    } catch (e) {
      const out = extractApiError(e, "Approbation impossible pour le moment.");
      setError(out.message);
    } finally {
      setBusyId("");
    }
  }

  if (!canAccess) {
    return (
      <Alert variant="warning">Accès réservé aux administrateurs.</Alert>
    );
  }

  return (
    <div>
      <PageHeader
        title="Admin · Payouts"
        subtitle="Initier et suivre les virements sortants."
        actions={
          <div className="btn-group btn-group-sm">
            {["READY", "PROCESSING", "PENDING", "COMPLETED", "FAILED", "CANCELLED"].map((k) => (
              <button
                key={k}
                type="button"
                className={`btn btn-outline-secondary ${tab === k ? "active" : ""}`}
                onClick={() => setTab(k)}
              >
                {k}
              </button>
            ))}
          </div>
        }
      />

      {error && <Alert variant="danger">{error}</Alert>}
      {ok && <Alert variant="success">{ok}</Alert>}
      {loading && <PageLoader label="Chargement…" />}

      {!loading && !error && items.length === 0 && (
        <EmptyState
          icon="fa-solid fa-building-columns"
          title="Aucun payout"
          description="Aucun élément pour ce statut."
        />
      )}

      {!loading && !error && items.length > 0 && (
        <div className="card border-0 fc-surface-card">
          <div className="table-responsive rounded-3">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>Id</th>
                  <th>Projet</th>
                  <th>Créateur</th>
                  <th>Montant</th>
                  <th>Statut</th>
                  {["COMPLETED", "FAILED", "CANCELLED"].includes(tab) ? (
                    <th>Horodatage</th>
                  ) : null}
                  {tab === "READY" ? <th style={{ width: "1%" }}>Action</th> : null}
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p._id}>
                    <td className="text-muted small">{String(p._id).slice(-6)}</td>
                    <td className="small">
                      {p.projectId && typeof p.projectId === "object" ? (
                        <div className="fw-semibold text-truncate" style={{ maxWidth: 360 }}>
                          {p.projectId.title || String(p.projectId._id || "—")}
                        </div>
                      ) : (
                        <span className="text-muted">{String(p.projectId || "—")}</span>
                      )}
                      {p.projectId && typeof p.projectId === "object" && p.projectId.status ? (
                        <div className="text-muted small">Statut projet : {p.projectId.status}</div>
                      ) : null}
                    </td>
                    <td className="small text-muted">
                      {p.creatorId && typeof p.creatorId === "object" ? (
                        <>
                          <div className="fw-semibold">
                            {[
                              p.creatorId.profile?.firstName,
                              p.creatorId.profile?.lastName,
                            ]
                              .filter(Boolean)
                              .join(" ") || String(p.creatorId.email || "—")}
                          </div>
                          <div className="small text-muted">{String(p.creatorId.email || p.creatorId._id || "—")}</div>
                        </>
                      ) : (
                        String(p.creatorId || "—")
                      )}
                    </td>
                    <td className="fw-semibold">{p.amount} TND</td>
                    <td>{badge(p.status)}</td>
                    {["COMPLETED", "FAILED", "CANCELLED"].includes(tab) ? (
                      <td className="small text-muted text-nowrap">{formatPayoutTerminalAt(p)}</td>
                    ) : null}
                    {tab === "READY" ? (
                      <td className="text-end">
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => approve(p._id)}
                          disabled={busyId === p._id}
                        >
                          {busyId === p._id ? "Validation…" : "Initier virement"}
                        </button>
                      </td>
                    ) : null}
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

