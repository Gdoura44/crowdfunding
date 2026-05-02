import { useMemo, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader.jsx";
import { extractApiError } from "../utils/apiError";
import { adminApi } from "../api/admin";
import Alert from "../components/ui/Alert.jsx";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function MockPayoutTransfer() {
  const nav = useNavigate();
  const q = useQuery();
  const payoutId = q.get("payoutId") || "";
  const transferId = q.get("transferId") || "";
  const amount = q.get("amount") || "";
  const currency = q.get("currency") || "TND";
  const ref = q.get("ref") || "";

  const [status, setStatus] = useState("PENDING");
  const [error, setError] = useState("");

  const disabled = !payoutId || !transferId || status === "TRAITEMENT";

  async function confirm(next) {
    setError("");
    setStatus("TRAITEMENT");
    try {
      await adminApi.mockConfirmPayout(payoutId, {
        providerTransferId: transferId,
        status: next,
      });
      setStatus(next);
    } catch (e) {
      const out = extractApiError(e, "Erreur de simulation du virement.");
      setError(out.message);
      setStatus("PENDING");
    }
  }

  return (
    <div>
      <PageHeader
        title="Mock Flouci — Virement payout"
        subtitle="Simulation : l’admin initie un virement, puis le prestataire confirme (succès/échec)."
        actions={
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => nav(-1)}>
              Retour
            </button>
            <Link to="/admin/payouts" className="btn btn-outline-secondary btn-sm">
              Admin payouts
            </Link>
          </div>
        }
      />

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="card border-0 fc-surface-card">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <div className="fw-semibold">Détails du transfert</div>
            <span className="badge bg-light text-dark border">{status}</span>
          </div>

          <div className="row g-2 small">
            <div className="col-12 col-md-6">
              <div className="text-muted">PayoutId</div>
              <div className="text-truncate">{payoutId || "—"}</div>
            </div>
            <div className="col-12 col-md-6">
              <div className="text-muted">TransferId</div>
              <div className="text-truncate">{transferId || "—"}</div>
            </div>
            <div className="col-12 col-md-6">
              <div className="text-muted">Référence</div>
              <div className="text-truncate">{ref || "—"}</div>
            </div>
            <div className="col-12 col-md-6">
              <div className="text-muted">Montant</div>
              <div className="fw-semibold">
                {amount ? `${amount} ${currency}` : "—"}
              </div>
            </div>
          </div>

          <hr className="my-3" />

          <div className="d-flex flex-wrap gap-2">
            <button className="btn btn-success" disabled={disabled} onClick={() => confirm("COMPLETED")}>
              Simuler succès
            </button>
            <button className="btn btn-danger" disabled={disabled} onClick={() => confirm("FAILED")}>
              Simuler échec
            </button>
          </div>

          {!payoutId || !transferId ? (
            <Alert variant="warning" className="mt-3 mb-0">
              Paramètres manquants. Ouvrez cette page via “Approuver” dans l’admin.
            </Alert>
          ) : null}
        </div>
      </div>
    </div>
  );
}

