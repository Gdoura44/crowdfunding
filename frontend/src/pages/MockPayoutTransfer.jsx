import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader.jsx";
import { extractApiError } from "../utils/apiError";
import { adminApi } from "../api/admin";
import Alert from "../components/ui/Alert.jsx";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function maskOperationRef(transferId) {
  const raw = String(transferId || "").replace(/^mock_tr_/i, "");
  if (raw.length < 6) return null;
  return raw.slice(-6).toUpperCase();
}

function statusPresentation(code) {
  const c = String(code || "").toUpperCase();
  if (c === "PENDING") {
    return {
      label: "Action requise",
      badgeClass: "bg-warning text-dark",
      description:
        "Un virement a été initié vers le compte indiqué par le bénéficiaire. Merci de confirmer le résultat côté banque.",
    };
  }
  if (c === "TRAITEMENT") {
    return {
      label: "Traitement…",
      badgeClass: "bg-info text-dark",
      description: "Enregistrement de votre réponse.",
    };
  }
  if (c === "COMPLETED") {
    return {
      label: "Virement effectué",
      badgeClass: "bg-success",
      description: "Le statut du transfert a été mis à jour. Le créateur sera notifié.",
    };
  }
  if (c === "FAILED") {
    return {
      label: "Non abouti",
      badgeClass: "bg-danger",
      description: "Le refus a été enregistré. Un administrateur pourra relancer si nécessaire.",
    };
  }
  return { label: c, badgeClass: "bg-light text-dark border", description: "" };
}

export default function MockPayoutTransfer() {
  const nav = useNavigate();
  const q = useQuery();
  const payoutIdRaw = q.get("payoutId") || "";
  const ref = q.get("ref") || "";
  const payoutId =
    payoutIdRaw ||
    (/^[a-f\d]{24}$/i.test(String(ref).trim()) ? String(ref).trim() : "");
  const transferId = q.get("transferId") || "";
  const amount = q.get("amount") || "";
  const currency = (q.get("currency") || "TND").toUpperCase();

  const [status, setStatus] = useState("PENDING");
  const [error, setError] = useState("");
  const [outcomeBannerHidden, setOutcomeBannerHidden] = useState(false);

  const handleOutcomeDismiss = useCallback(() => {
    setOutcomeBannerHidden(true);
  }, []);

  const handleErrorDismiss = useCallback(() => {
    setError("");
  }, []);

  useEffect(() => {
    if (status === "COMPLETED" || status === "FAILED") setOutcomeBannerHidden(false);
  }, [status]);

  const disabled = !payoutId || !transferId || status === "TRAITEMENT";
  const terminal = status === "COMPLETED" || status === "FAILED";
  const pres = statusPresentation(status);
  const opRef = maskOperationRef(transferId);
  const amountLabel = useMemo(() => {
    const n = Number(amount);
    if (amount && Number.isFinite(n)) return n.toLocaleString("fr-FR");
    return amount || "";
  }, [amount]);

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
      const out = extractApiError(e, "Impossible d’enregistrer la réponse.");
      setError(out.message);
      setStatus("PENDING");
    }
  }

  return (
    <div>
      <PageHeader
        title="Confirmation de virement"
        subtitle="Espace sécurisé prestataire : indiquez si le virement a bien été réalisé par votre établissement."
        actions={
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => nav(-1)}>
              Retour
            </button>
            <Link to="/admin/payouts" className="btn btn-outline-secondary btn-sm">
              Retraits admin
            </Link>
          </div>
        }
      />

      {error ? (
        <div className="mb-3" style={{ maxWidth: "min(36rem, 100%)" }}>
          <Alert
            variant="danger"
            dismissAfterMs={5000}
            onDismiss={handleErrorDismiss}
            className="mb-0 py-2 px-3"
          >
            {error}
          </Alert>
        </div>
      ) : null}

      <div className="card border-0 shadow-sm overflow-hidden fc-surface-card">
        <div
          className="px-4 py-3 text-white d-flex align-items-center gap-3"
          style={{
            background: "linear-gradient(135deg, #0f4c5c 0%, #1a8a9e 100%)",
          }}
        >
          <div
            className="rounded-circle bg-white bg-opacity-25 d-flex align-items-center justify-content-center flex-shrink-0"
            style={{ width: "3rem", height: "3rem" }}
            aria-hidden="true"
          >
            <i className="fa-solid fa-building-columns fs-4" />
          </div>
          <div>
            <div className="small text-white-50 mb-0">Prestataire partenaire</div>
            <div className="fw-semibold">Virement sortant — vérification bancaire</div>
          </div>
        </div>

        <div className="card-body p-4 p-md-5">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
            <div>
              <div className="text-muted small text-uppercase" style={{ letterSpacing: "0.06em" }}>
                Montant du transfert
              </div>
              <div className="display-6 fw-bold text-dark mt-1">
                {amountLabel ? (
                  <>
                    {amountLabel}{" "}
                    <span className="fs-4 fw-semibold text-muted">{currency}</span>
                  </>
                ) : (
                  "—"
                )}
              </div>
              {opRef ? (
                <div className="small text-muted mt-2">
                  Réf. opération <span className="font-monospace fw-semibold text-dark">···{opRef}</span>
                </div>
              ) : null}
            </div>
            <div className="text-end">
              <span className={`badge ${pres.badgeClass} px-3 py-2`}>{pres.label}</span>
            </div>
          </div>

          {pres.description ? <p className="text-muted small mb-0 mb-md-4">{pres.description}</p> : null}

          {!payoutId || !transferId ? (
            <Alert variant="warning" className="mb-0">
              Cette page doit être ouverte depuis l’administration après initiation d’un virement.
            </Alert>
          ) : null}

          {payoutId && transferId && !terminal ? (
            <>
              <hr className="my-4" />
              {status === "TRAITEMENT" ? (
                <div className="d-flex align-items-center gap-2 py-2 text-muted" role="status">
                  <span className="spinner-border spinner-border-sm" aria-hidden="true" />
                  Enregistrement de la réponse…
                </div>
              ) : (
                <>
                  <div className="d-flex flex-column flex-sm-row flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-success btn-sm px-3"
                      disabled={disabled}
                      onClick={() => confirm("COMPLETED")}
                    >
                      <i className="fa-solid fa-circle-check me-2" aria-hidden="true" />
                      Confirmer le virement
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm px-3"
                      disabled={disabled}
                      onClick={() => confirm("FAILED")}
                    >
                      <i className="fa-solid fa-triangle-exclamation me-2" aria-hidden="true" />
                      Signaler un refus / échec
                    </button>
                  </div>
                  <p className="small text-muted mt-3 mb-0">
                    Indiquez le résultat tel qu’il apparaît dans votre outil de virement ou de contrôle des opérations.
                  </p>
                </>
              )}
            </>
          ) : null}

          {terminal && !outcomeBannerHidden ? (
            <div className="mt-3" style={{ maxWidth: "min(26rem, 100%)" }}>
              <Alert
                variant={status === "COMPLETED" ? "success" : "danger"}
                dismissAfterMs={5000}
                onDismiss={handleOutcomeDismiss}
                className="mb-0 py-2 px-3 shadow-sm"
              >
                <strong>{status === "COMPLETED" ? "Réponse enregistrée." : "Échec signalé."}</strong> Vous pouvez
                fermer cette page ou revenir au tableau des retraits.
              </Alert>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
