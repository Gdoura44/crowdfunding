import { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/ui/PageHeader.jsx";
import PageLoader from "../components/ui/PageLoader.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { adminApi } from "../api/admin";
import { useAuth } from "../hooks/useAuth.js";
import { extractApiError } from "../utils/apiError";

function badge(status) {
  const map = {
    PENDING: "bg-secondary",
    READY: "bg-primary",
    COMPLETED: "bg-success",
    FAILED: "bg-danger",
    CANCELLED: "bg-warning text-dark",
  };
  return <span className={`badge ${map[status] || "bg-light text-dark border"}`}>{status}</span>;
}

export default function AdminPayouts() {
  const { user } = useAuth();
  const [tab, setTab] = useState("READY");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState({});
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
    try {
      await adminApi.approvePayout(id, { notes: notes[id] || "" });
      await refresh();
    } catch (e) {
      const out = extractApiError(e, "Approbation impossible pour le moment.");
      setError(out.message);
    } finally {
      setBusyId("");
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
        title="Admin · Payouts"
        subtitle="Valider les virements."
        actions={
          <div className="btn-group btn-group-sm">
            {["READY", "PENDING", "COMPLETED", "FAILED", "CANCELLED"].map((k) => (
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

      {error && <div className="alert alert-danger py-2">{error}</div>}
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
                  <th>ProjectId</th>
                  <th>CreatorId</th>
                  <th>Montant</th>
                  <th>Statut</th>
                  <th style={{ width: 320 }}>Notes</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p._id}>
                    <td className="text-muted small">{String(p._id).slice(-6)}</td>
                    <td className="text-muted small">{String(p.projectId)}</td>
                    <td className="text-muted small">{String(p.creatorId)}</td>
                    <td className="fw-semibold">{p.amount} TND</td>
                    <td>{badge(p.status)}</td>
                    <td>
                      <input
                        className="form-control form-control-sm"
                        value={notes[p._id] || ""}
                        onChange={(e) => setNotes((x) => ({ ...x, [p._id]: e.target.value }))}
                        placeholder="Optionnel…"
                        disabled={p.status !== "READY"}
                      />
                    </td>
                    <td>
                      {p.status === "READY" ? (
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => approve(p._id)}
                          disabled={busyId === p._id}
                        >
                          {busyId === p._id ? "Validation…" : "Approuver"}
                        </button>
                      ) : (
                        <span className="text-muted small">—</span>
                      )}
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

