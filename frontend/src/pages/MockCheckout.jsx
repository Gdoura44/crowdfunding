import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { investmentsApi } from "../api/investments";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function MockCheckout() {
  const q = useQuery();
  const navigate = useNavigate();
  const providerPaymentId = q.get("paymentId") || "";
  const ref = q.get("ref") || "";
  const amount = q.get("amount") || "";
  const currency = q.get("currency") || "TND";

  const [status, setStatus] = useState("PENDING");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function confirm(nextStatus) {
    setLoading(true);
    setError("");
    try {
      await investmentsApi.mockConfirm({
        providerPaymentId,
        status: nextStatus,
        paymentMethod: "MOCK_CARD",
      });
      setStatus(nextStatus);
    } catch (e) {
      setError(e?.response?.data?.message || "Impossible de confirmer le paiement.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="d-flex flex-column gap-3">
      <nav aria-label="fil d’Ariane" className="mb-1">
        <ol className="breadcrumb small mb-0">
          <li className="breadcrumb-item">
            <Link to="/projects">Explorer</Link>
          </li>
          <li className="breadcrumb-item active" aria-current="page">
            Paiement (simulation)
          </li>
        </ol>
      </nav>

      <div className="card border-0 fc-surface-card">
        <div className="card-body p-4 p-md-5">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
            <div>
              <h1 className="h5 mb-1 d-flex align-items-center gap-2 text-dark">
                <i className="fa-solid fa-credit-card text-primary" aria-hidden="true" />
                Paiement (simulation)
              </h1>
              <div className="text-muted small">
                Testez le parcours comme avec un vrai prestataire : succès ou échec, puis retour
                sur la campagne.
              </div>
            </div>
            <span
              className={`badge ${
                status === "SUCCEEDED"
                  ? "bg-success"
                  : status === "FAILED"
                    ? "bg-danger"
                    : "bg-warning text-dark"
              }`}
            >
              {status}
            </span>
          </div>

          <hr className="my-3" />

          <div className="row g-3 small">
            <div className="col-sm-6">
              <div className="text-muted">Montant</div>
              <div className="fw-semibold">
                {amount} {currency}
              </div>
            </div>
            <div className="col-sm-6">
              <div className="text-muted">Référence</div>
              <div className="fw-semibold text-truncate">{ref || "—"}</div>
            </div>
          </div>

          {error && <div className="alert alert-danger py-2 mt-3 mb-0">{error}</div>}

          <div className="d-flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              className="btn btn-success"
              disabled={!providerPaymentId || loading || status !== "PENDING"}
              onClick={() => confirm("SUCCEEDED")}
            >
              <i className="fa-solid fa-circle-check me-2" aria-hidden="true" />
              Simuler succès
            </button>
            <button
              type="button"
              className="btn btn-outline-danger"
              disabled={!providerPaymentId || loading || status !== "PENDING"}
              onClick={() => confirm("FAILED")}
            >
              <i className="fa-solid fa-circle-xmark me-2" aria-hidden="true" />
              Simuler échec
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary ms-auto"
              onClick={() => navigate(-1)}
            >
              <i className="fa-solid fa-arrow-left me-2" aria-hidden="true" />
              Retour
            </button>
          </div>

          <div className="text-muted small mt-3">
            Paiement simulé : en production, le prestataire de paiement confirmerait automatiquement via webhook.
          </div>
        </div>
      </div>
    </div>
  );
}

