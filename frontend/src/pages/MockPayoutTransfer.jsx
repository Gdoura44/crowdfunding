import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { extractApiError } from "../utils/apiError";
import { adminApi } from "../api/admin";
import {
  Building2, CheckCircle2, XCircle, Loader2, AlertTriangle, ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function maskOperationRef(transferId) {
  const raw = String(transferId || "").replace(/^mock_tr_/i, "");
  if (raw.length < 6) return null;
  return raw.slice(-6).toUpperCase();
}

const STATUS_CONFIG = {
  PENDING: { label: "Action requise", cls: "bg-amber-100 text-amber-800 border-amber-200", desc: "Un virement a été initié vers le compte indiqué par le bénéficiaire. Merci de confirmer le résultat côté banque." },
  TRAITEMENT: { label: "Traitement…", cls: "bg-blue-100 text-blue-800 border-blue-200", desc: "Enregistrement de votre réponse." },
  COMPLETED: { label: "Virement effectué", cls: "bg-green-100 text-green-800 border-green-200", desc: "Le statut du transfert a été mis à jour. Le créateur sera notifié." },
  FAILED: { label: "Non abouti", cls: "bg-red-100 text-red-800 border-red-200", desc: "Le refus a été enregistré. Un administrateur pourra relancer si nécessaire." },
};

export default function MockPayoutTransfer() {
  const nav = useNavigate();
  const q = useQuery();
  const payoutIdRaw = q.get("payoutId") || "";
  const ref = q.get("ref") || "";
  const payoutId = payoutIdRaw || (/^[a-f\d]{24}$/i.test(String(ref).trim()) ? String(ref).trim() : "");
  const transferId = q.get("transferId") || "";
  const amount = q.get("amount") || "";
  const currency = (q.get("currency") || "TND").toUpperCase();

  const [status, setStatus] = useState("PENDING");
  const [error, setError] = useState("");
  const [showOutcome, setShowOutcome] = useState(false);

  const handleErrorDismiss = useCallback(() => { setError(""); }, []);
  useEffect(() => { if (status === "COMPLETED" || status === "FAILED") setShowOutcome(true); }, [status]);

  const disabled = !payoutId || !transferId || status === "TRAITEMENT";
  const terminal = status === "COMPLETED" || status === "FAILED";
  const pres = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
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
      await adminApi.mockConfirmPayout(payoutId, { providerTransferId: transferId, status: next });
      setStatus(next);
    } catch (e) {
      setError(extractApiError(e, "Impossible d'enregistrer la réponse.").message);
      setStatus("PENDING");
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="border-b border-border/40 pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2 flex items-center gap-3">
            <Building2 className="w-8 h-8 text-primary" />
            Confirmation de virement
          </h1>
          <p className="text-muted-foreground text-sm">
            Espace sécurisé prestataire — indiquez si le virement a bien été réalisé par votre établissement.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="ghost" size="sm" onClick={() => nav(-1)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Retour
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/payouts">Retraits admin</Link>
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
          <button onClick={handleErrorDismiss} className="ml-auto text-destructive/60 hover:text-destructive text-lg leading-none">&times;</button>
        </div>
      )}

      <Card className="border-border/50 shadow-sm overflow-hidden">
        {/* Gradient banner */}
        <div className="px-6 py-4 flex items-center gap-4 text-white" style={{ background: "linear-gradient(135deg, #0f4c5c 0%, #1a8a9e 100%)" }}>
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-white/70 text-xs">Prestataire partenaire</p>
            <p className="font-semibold">Virement sortant — vérification bancaire</p>
          </div>
        </div>

        <div className="p-6 md:p-8 space-y-6">
          {/* Amount + status */}
          <div className="flex flex-wrap justify-between items-start gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Montant du transfert</p>
              <div className="text-4xl font-black text-foreground">
                {amountLabel ? <>{amountLabel} <span className="text-xl font-semibold text-muted-foreground">{currency}</span></> : "—"}
              </div>
              {opRef && (
                <p className="text-sm text-muted-foreground mt-2">
                  Réf. opération <span className="font-mono font-semibold text-foreground">···{opRef}</span>
                </p>
              )}
            </div>
            <Badge variant="outline" className={`${pres.cls} text-xs uppercase tracking-wider font-semibold`}>
              {pres.label}
            </Badge>
          </div>

          {pres.desc && <p className="text-sm text-muted-foreground">{pres.desc}</p>}

          {!payoutId || !transferId ? (
            <div className="bg-amber-50 text-amber-800 p-4 rounded-xl border border-amber-200 text-sm">
              Cette page doit être ouverte depuis l'administration après initiation d'un virement.
            </div>
          ) : null}

          {payoutId && transferId && !terminal && (
            <>
              <hr className="border-border/50" />
              {status === "TRAITEMENT" ? (
                <div className="flex items-center gap-2 py-2 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Enregistrement de la réponse…
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      disabled={disabled}
                      onClick={() => confirm("COMPLETED")}
                      className="bg-green-600 hover:bg-green-700 text-white flex-1"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Confirmer le virement
                    </Button>
                    <Button
                      variant="outline"
                      disabled={disabled}
                      onClick={() => confirm("FAILED")}
                      className="text-destructive border-destructive/30 hover:bg-destructive/10 flex-1"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Signaler un refus / échec
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Indiquez le résultat tel qu'il apparaît dans votre outil de virement ou de contrôle des opérations.
                  </p>
                </div>
              )}
            </>
          )}

          {terminal && showOutcome && (
            <div className={`p-4 rounded-xl flex items-center justify-between gap-3 ${status === "COMPLETED" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
              <div className="flex items-center gap-2">
                {status === "COMPLETED" ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                <span className="text-sm font-medium">
                  {status === "COMPLETED" ? "Réponse enregistrée." : "Échec signalé."} Vous pouvez fermer cette page ou revenir au tableau des retraits.
                </span>
              </div>
              <button onClick={() => setShowOutcome(false)} className="opacity-60 hover:opacity-100 text-lg leading-none">&times;</button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
