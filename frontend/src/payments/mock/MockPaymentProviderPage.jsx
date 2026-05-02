import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { investmentsApi } from "../../api/investments";
import { extractApiError } from "../../utils/apiError";
import Guidance from "../../components/ui/Guidance.jsx";
import Alert from "../../components/ui/Alert.jsx";
import { onlyDigits, isValidExpiry } from "./cardUtils.js";
import { useMockPaymentQuery } from "./useMockPaymentQuery.js";
import MockCardForm from "./MockCardForm.jsx";
import MockThreeDSStep from "./MockThreeDSStep.jsx";

/**
 * Simule une page hébergée par le prestataire de paiement (PCI).
 * États : PENDING (saisie carte) → 3DS (OTP démo) → TRAITEMENT → redirection /investments.
 */
export default function MockPaymentProviderPage() {
  const navigate = useNavigate();
  const { providerPaymentId, ref, amount, currency } = useMockPaymentQuery();

  const [status, setStatus] = useState("PENDING");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  /** Intention après 3DS : SUCCEEDED ou FAILED */
  const [pendingIntent, setPendingIntent] = useState("");
  const [otp, setOtp] = useState("");
  const [otpErr, setOtpErr] = useState("");

  const cardDigits = onlyDigits(cardNumber);
  const cvvDigits = onlyDigits(cvv);
  const looksLikeCard = cardDigits.length >= 13 && cardDigits.length <= 19;
  const looksLikeCvv = cvvDigits.length >= 3 && cvvDigits.length <= 4;
  const looksLikeName = String(cardName || "").trim().length >= 3;
  const looksLikeExpiry = isValidExpiry(expiry);
  const canSubmit =
    Boolean(providerPaymentId) && looksLikeCard && looksLikeExpiry && looksLikeCvv && looksLikeName;

  async function confirm(nextStatus) {
    setLoading(true);
    setError("");
    try {
      setStatus("TRAITEMENT");
      await investmentsApi.mockConfirm(
        {
          providerPaymentId,
          status: nextStatus,
          paymentMethod: "MOCK_CARD",
        },
        { timeout: 15000 }
      );
      window.location.assign("/investments");
    } catch (e) {
      const out = extractApiError(e, "Impossible de confirmer le paiement.");
      setError(out.message);
      setStatus("PENDING");
    } finally {
      setLoading(false);
    }
  }

  function start3ds(intent) {
    setError("");
    setOtp("");
    setOtpErr("");
    setPendingIntent(String(intent || "").toUpperCase());
    setStatus("3DS");
  }

  async function confirm3ds() {
    const code = onlyDigits(otp);
    if (code.length !== 6) {
      setOtpErr("Code invalide (6 chiffres).");
      return;
    }
    setOtpErr("");
    await confirm(pendingIntent || "SUCCEEDED");
  }

  function cancel3ds() {
    setStatus("PENDING");
    setPendingIntent("");
    setOtp("");
    setOtpErr("");
  }

  const cardFormDisabled = loading || status !== "PENDING";

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
                Testez le parcours comme avec un vrai prestataire : succès ou échec, puis retour sur la campagne.
              </div>
            </div>
            <span
              className={`badge ${
                status === "SUCCEEDED"
                  ? "bg-success"
                  : status === "FAILED"
                    ? "bg-danger"
                    : status === "3DS"
                      ? "bg-info text-dark"
                      : "bg-warning text-dark"
              }`}
            >
              {status}
            </span>
          </div>

          <hr className="my-3" />
          <Guidance title="Guidance" variant="info">
            Renseignez des informations comme sur une vraie page de paiement (démo). Ensuite, choisissez{" "}
            <strong>Simuler succès</strong> ou <strong>Simuler échec</strong>.
          </Guidance>

          <div className="row g-3 small">
            <div className="col-sm-6">
              <div className="text-muted">Montant</div>
              <div className="fw-semibold">
                {amount} {currency}
              </div>
            </div>
            <div className="col-sm-6">
              <div className="text-muted">Référence (investissement)</div>
              <div className="fw-semibold text-truncate">{ref || "—"}</div>
              <div className="text-muted mt-2">Identifiant de paiement</div>
              <div className="fw-semibold text-truncate">{providerPaymentId || "—"}</div>
            </div>
          </div>

          <MockCardForm
            cardName={cardName}
            onCardNameChange={setCardName}
            cardNumber={cardNumber}
            onCardNumberChange={setCardNumber}
            expiry={expiry}
            onExpiryChange={setExpiry}
            cvv={cvv}
            onCvvChange={setCvv}
            disabled={cardFormDisabled}
            looksLikeCard={looksLikeCard}
            looksLikeCvv={looksLikeCvv}
            looksLikeExpiry={looksLikeExpiry}
          />

          {error && (
            <Alert variant="danger" className="mt-3 mb-0">
              {error}
            </Alert>
          )}

          {status === "3DS" ? (
            <MockThreeDSStep
              otp={otp}
              onOtpChange={setOtp}
              otpErr={otpErr}
              loading={loading}
              onCancel={cancel3ds}
              onConfirm={confirm3ds}
            />
          ) : (
            <div className="d-flex flex-wrap gap-2 mt-3">
              <button
                type="button"
                className="btn btn-success"
                disabled={!canSubmit || loading || status !== "PENDING"}
                onClick={(e) => {
                  e.currentTarget.blur();
                  start3ds("SUCCEEDED");
                }}
              >
                <i className="fa-solid fa-circle-check me-2" aria-hidden="true" />
                Simuler succès
              </button>
              <button
                type="button"
                className="btn btn-outline-danger"
                disabled={!canSubmit || loading || status !== "PENDING"}
                onClick={(e) => {
                  e.currentTarget.blur();
                  start3ds("FAILED");
                }}
              >
                <i className="fa-solid fa-circle-xmark me-2" aria-hidden="true" />
                Simuler échec
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary ms-auto"
                onClick={() => navigate(-1)}
                disabled={loading}
              >
                <i className="fa-solid fa-arrow-left me-2" aria-hidden="true" />
                Retour
              </button>
            </div>
          )}

          <div className="text-muted small mt-3">
            Paiement simulé : en production, la saisie se ferait sur une page hébergée par le prestataire (PCI) et la
            confirmation arriverait automatiquement via webhook.
          </div>
        </div>
      </div>
    </div>
  );
}
