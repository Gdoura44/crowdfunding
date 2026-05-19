import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { investmentsApi } from "../../api/investments";
import { extractApiError } from "../../utils/apiError";
import { CreditCard, CheckCircle2, XCircle, ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { onlyDigits, isValidExpiry } from "./cardUtils.js";
import { useMockPaymentQuery } from "./useMockPaymentQuery.js";
import MockCardForm from "./MockCardForm.jsx";
import MockThreeDSStep from "./MockThreeDSStep.jsx";

/**
 * Page de paiement hébergée (flux type prestataire PCI).
 * États : PENDING (saisie carte) → 3DS (OTP) → TRAITEMENT → redirection /investments.
 */
export default function MockPaymentProviderPage() {
  const navigate = useNavigate();
  const { providerPaymentId, amount, currency } = useMockPaymentQuery();

  const [status, setStatus] = useState("PENDING");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [pendingIntent, setPendingIntent] = useState("");
  const [otp, setOtp] = useState("");
  const [otpErr, setOtpErr] = useState("");

  const cardDigits = onlyDigits(cardNumber).slice(0, 16);
  const cvvDigits = onlyDigits(cvv);
  const looksLikeCard = cardDigits.length === 15 || cardDigits.length === 16;
  const looksLikeCvv = cvvDigits.length >= 3 && cvvDigits.length <= 4;
  const looksLikeName = String(cardName || "").trim().length >= 3;
  const looksLikeExpiry = isValidExpiry(expiry);
  const canSubmit = Boolean(providerPaymentId) && looksLikeCard && looksLikeExpiry && looksLikeCvv && looksLikeName;

  const statusBadge = {
    PENDING: "bg-amber-100 text-amber-800 border-amber-200",
    "3DS": "bg-blue-100 text-blue-800 border-blue-200",
    TRAITEMENT: "bg-purple-100 text-purple-800 border-purple-200",
    SUCCEEDED: "bg-green-100 text-green-800 border-green-200",
    FAILED: "bg-red-100 text-red-800 border-red-200",
  };

  async function confirm(nextStatus) {
    setLoading(true);
    setError("");
    try {
      setStatus("TRAITEMENT");
      const { data } = await investmentsApi.mockConfirm(
        { providerPaymentId, status: nextStatus, paymentMethod: "MOCK_CARD", otp: status === "3DS" ? otp : undefined },
        { timeout: 15000 }
      );
      window.location.assign(data?.redirectTo || "/investments");
    } catch (e) {
      setError(extractApiError(e, "Impossible de confirmer le paiement.").message);
      setStatus("PENDING");
    } finally {
      setLoading(false);
    }
  }

  function start3ds(intent) {
    setError(""); setOtp(""); setOtpErr("");
    if (intent !== undefined) {
      setPendingIntent(String(intent || "").toUpperCase());
    }
    setStatus("3DS");
    setLoading(true);
    void investmentsApi
      .mockSendOtp({ providerPaymentId }, { timeout: 15000 })
      .then((res) => { const url = res?.data?.previewUrl; if (url) console.info("[OTP] Aperçu:", url); })
      .catch((err) => { setOtpErr(extractApiError(err, "Erreur d'envoi du code.").message); })
      .finally(() => setLoading(false));
  }

  async function confirm3ds() {
    const code = onlyDigits(otp);
    if (code.length !== 6) { setOtpErr("Code invalide (6 chiffres)."); return; }
    setOtpErr("");
    await confirm(pendingIntent || "SUCCEEDED");
  }

  function cancel3ds() {
    setStatus("PENDING"); setPendingIntent(""); setOtp(""); setOtpErr("");
  }

  const cardFormDisabled = loading || status !== "PENDING";

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border/50 rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 md:p-7">
          {/* Header */}
          <div className="flex flex-wrap justify-between items-start gap-3 mb-5">
            <div>
              <h1 className="text-xl font-bold text-foreground mb-1 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" aria-hidden="true" />
                Paiement sécurisé
              </h1>
              <p className="text-sm text-muted-foreground">
                Complétez le formulaire, puis indiquez le résultat pour enregistrer votre soutien.
              </p>
            </div>
            <Badge variant="outline" className={`text-[10px] uppercase tracking-wider font-semibold ${statusBadge[status] || statusBadge.PENDING}`}>
              {status}
            </Badge>
          </div>

          <hr className="border-border/50 mb-5" />

          {/* Amount */}
          <div className="mb-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Montant</span>
            <p className="font-bold text-foreground text-lg">{amount} <span className="text-sm font-normal text-muted-foreground">{currency}</span></p>
          </div>

          {/* Card form */}
          <MockCardForm
            cardName={cardName} onCardNameChange={setCardName}
            cardNumber={cardNumber} onCardNumberChange={setCardNumber}
            expiry={expiry} onExpiryChange={setExpiry}
            cvv={cvv} onCvvChange={setCvv}
            disabled={cardFormDisabled}
            looksLikeCard={looksLikeCard}
            looksLikeCvv={looksLikeCvv}
            looksLikeExpiry={looksLikeExpiry}
          />

          {/* Error */}
          {error && (
            <div className="mt-4 bg-destructive/10 text-destructive p-3 rounded-xl flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {/* 3DS or action buttons */}
          {status === "3DS" ? (
            <MockThreeDSStep
              otp={otp} onOtpChange={setOtp} otpErr={otpErr}
              loading={loading} onCancel={cancel3ds} onConfirm={confirm3ds}
              onResend={() => start3ds()}
            />
          ) : (
            <div className="flex flex-wrap gap-3 mt-5">
              <Button
                type="button"
                className="bg-green-600 hover:bg-green-700 text-white"
                disabled={!canSubmit || loading || status !== "PENDING"}
                onClick={(e) => { e.currentTarget.blur(); start3ds("SUCCEEDED"); }}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Poursuivre — succès
              </Button>
              <Button
                type="button"
                variant="outline"
                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                disabled={!canSubmit || loading || status !== "PENDING"}
                onClick={(e) => { e.currentTarget.blur(); start3ds("FAILED"); }}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Poursuivre — échec
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="ml-auto"
                onClick={() => navigate(-1)}
                disabled={loading}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour
              </Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-5">
            Saisissez des valeurs cohérentes : elles servent uniquement à valider le formulaire avant enregistrement du soutien dans l'application.
          </p>
        </div>
      </div>
    </div>
  );
}
