import { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/ui/PageHeader.jsx";
import PageLoader from "../components/ui/PageLoader.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { adminApi } from "../api/admin";
import { useAuth } from "../hooks/useAuth.js";
import { extractApiError } from "../utils/apiError";
import Alert from "../components/ui/Alert.jsx";

export default function AdminOps() {
  const { user } = useAuth();
  const [tab, setTab] = useState("REFUNDS");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refunds, setRefunds] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [busy, setBusy] = useState(false);

  const isRefunds = tab === "REFUNDS";
  const params = useMemo(() => ({ resolved: false, limit: 100 }), []);
  const canAccess = user?.role === "ADMIN";

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      if (isRefunds) {
        const { data } = await adminApi.opsListFailedRefunds(params);
        setRefunds(data.failedRefunds || []);
      } else {
        const { data } = await adminApi.opsListFailedPayouts(params);
        setPayouts(data.failedPayouts || []);
      }
    } catch (e) {
      const out = extractApiError(e, "Impossible de charger les opérations.");
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

  async function retryNow() {
    setBusy(true);
    setError("");
    try {
      if (isRefunds) await adminApi.opsRetryRefunds({ limit: 50 });
      else await adminApi.opsRetryPayouts({ limit: 50 });
      await refresh();
    } catch (e) {
      const out = extractApiError(e, "Relance impossible pour le moment.");
      setError(out.message);
    } finally {
      setBusy(false);
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
        title="Admin · Ops"
        subtitle="Surveiller les échecs techniques (remboursements / payouts) et relancer en 1 clic."
        actions={
          <div className="d-flex gap-2 align-items-center">
            <div className="btn-group btn-group-sm">
              <button
                type="button"
                className={`btn btn-outline-secondary ${isRefunds ? "active" : ""}`}
                onClick={() => setTab("REFUNDS")}
              >
                Remboursements
              </button>
              <button
                type="button"
                className={`btn btn-outline-secondary ${!isRefunds ? "active" : ""}`}
                onClick={() => setTab("PAYOUTS")}
              >
                Payouts
              </button>
            </div>
            <button className="btn btn-sm btn-primary" onClick={retryNow} disabled={busy}>
              {busy ? "Relance…" : "Relancer maintenant"}
            </button>
          </div>
        }
      />

      {error && <Alert variant="danger">{error}</Alert>}
      {loading && <PageLoader label="Chargement…" />}

      {!loading && !error && isRefunds && refunds.length === 0 && (
        <EmptyState
          icon="fa-solid fa-rotate"
          title="Aucun remboursement en échec"
          description="Tout est OK pour le moment."
        />
      )}
      {!loading && !error && !isRefunds && payouts.length === 0 && (
        <EmptyState
          icon="fa-solid fa-rotate"
          title="Aucun payout en échec"
          description="Tout est OK pour le moment."
        />
      )}

      {!loading && !error && isRefunds && refunds.length > 0 && (
        <div className="card border-0 fc-surface-card">
          <div className="table-responsive rounded-3">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>Créé</th>
                  <th>Projet</th>
                  <th>Investissement</th>
                  <th>Raison</th>
                  <th>Tentatives</th>
                </tr>
              </thead>
              <tbody>
                {refunds.map((r) => (
                  <tr key={r._id}>
                    <td className="small text-muted">
                      {r.createdAt ? new Date(r.createdAt).toLocaleString("fr-FR") : "—"}
                    </td>
                    <td className="small">
                      {r.projectId && typeof r.projectId === "object" ? (
                        <>
                          <div className="fw-semibold text-truncate" style={{ maxWidth: "16rem" }}>
                            {r.projectId.title || String(r.projectId._id || "—")}
                          </div>
                          {r.projectId.status ? (
                            <div className="text-muted small">Statut : {r.projectId.status}</div>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-muted">{String(r.projectId || "—")}</span>
                      )}
                    </td>
                    <td className="small text-muted">
                      {r.investmentId && typeof r.investmentId === "object"
                        ? `${r.investmentId.amount ?? "—"} TND · ${r.investmentId.status || "—"}`
                        : String(r.investmentId || "—")}
                    </td>
                    <td>
                      <span className="badge bg-light text-dark border">{r.reason}</span>
                    </td>
                    <td className="small text-muted">{r.retryCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && !error && !isRefunds && payouts.length > 0 && (
        <div className="card border-0 fc-surface-card">
          <div className="table-responsive rounded-3">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>Créé</th>
                  <th>Projet</th>
                  <th>Payout</th>
                  <th>Tentatives</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p._id}>
                    <td className="small text-muted">
                      {p.createdAt ? new Date(p.createdAt).toLocaleString("fr-FR") : "—"}
                    </td>
                    <td className="small">
                      {p.payoutId && typeof p.payoutId === "object" && p.payoutId.projectId && typeof p.payoutId.projectId === "object" ? (
                        <>
                          <div className="fw-semibold text-truncate" style={{ maxWidth: "16rem" }}>
                            {p.payoutId.projectId.title || String(p.payoutId.projectId._id || "—")}
                          </div>
                          {p.payoutId.projectId.status ? (
                            <div className="text-muted small">Statut : {p.payoutId.projectId.status}</div>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="small text-muted">
                      {p.payoutId && typeof p.payoutId === "object"
                        ? `${String(p.payoutId._id).slice(-6)} · ${p.payoutId.status || "—"} · ${p.payoutId.amount ?? "—"} TND`
                        : String(p.payoutId || "—")}
                    </td>
                    <td className="small text-muted">{p.retryCount}</td>
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

