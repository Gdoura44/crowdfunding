import { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/ui/PageHeader.jsx";
import PageLoader from "../components/ui/PageLoader.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { adminApi } from "../api/admin";
import { useAuth } from "../hooks/useAuth.js";

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
      setError(e?.response?.data?.message || "Impossible de charger les opérations.");
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
      setError(e?.response?.data?.message || "Retry failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!canAccess) {
    return (
      <div className="alert alert-warning border-0">
        Accès réservé aux administrateurs.
      </div>
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

      {error && <div className="alert alert-danger py-2">{error}</div>}
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
                  <th>ProjectId</th>
                  <th>InvestmentId</th>
                  <th>Reason</th>
                  <th>Retry</th>
                </tr>
              </thead>
              <tbody>
                {refunds.map((r) => (
                  <tr key={r._id}>
                    <td className="small text-muted">
                      {r.createdAt ? new Date(r.createdAt).toLocaleString("fr-FR") : "—"}
                    </td>
                    <td className="small text-muted">{String(r.projectId)}</td>
                    <td className="small text-muted">{String(r.investmentId)}</td>
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
                  <th>PayoutId</th>
                  <th>Retry</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p._id}>
                    <td className="small text-muted">
                      {p.createdAt ? new Date(p.createdAt).toLocaleString("fr-FR") : "—"}
                    </td>
                    <td className="small text-muted">{String(p.payoutId)}</td>
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

