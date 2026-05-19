import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { payoutsApi } from "../api/payouts";
import { extractApiError } from "../utils/apiError";
import { invoiceApi } from "../api/invoice";
import {
  ArrowLeft, Loader2, AlertTriangle, CheckCircle2, Save,
  Landmark, FileText, Info, ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

function statusHelp(status) {
  if (status === "PENDING") return "Ajoutez vos coordonnées bancaires pour passer à l'étape suivante.";
  if (status === "READY") return "Coordonnées reçues. Un administrateur va valider le virement.";
  if (status === "PROCESSING") return "Virement initié. En attente de confirmation du prestataire.";
  if (status === "COMPLETED") return "Virement marqué comme complété.";
  if (status === "FAILED") return "Une erreur est survenue. Un administrateur va réessayer.";
  return "—";
}

function StatusBadge({ status }) {
  const map = {
    PENDING: "bg-amber-100 text-amber-800 border-amber-200",
    READY: "bg-blue-100 text-blue-800 border-blue-200",
    PROCESSING: "bg-purple-100 text-purple-800 border-purple-200",
    COMPLETED: "bg-green-100 text-green-800 border-green-200",
    FAILED: "bg-red-100 text-red-800 border-red-200",
    CANCELLED: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <Badge variant="outline" className={`${map[status] || "bg-slate-100 text-slate-600"} text-xs uppercase tracking-wider font-semibold`}>
      {status}
    </Badge>
  );
}

const TUNISIAN_BANKS = ["BIAT","BNA","STB","Amen Bank","ATB","BH Bank","BT","UIB","UBCI","Zitouna","Autre"];

export default function PayoutDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [payout, setPayout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [invoiceId, setInvoiceId] = useState("");

  const [accountHolderName, setAccountHolderName] = useState("");
  const [bankName, setBankName] = useState("");
  const [ribOrIban, setRibOrIban] = useState("");
  const [swiftCode, setSwiftCode] = useState("");

  const canEdit = payout?.status === "PENDING";

  const bankDetailsJson = useMemo(() => {
    const normalized = String(ribOrIban || "").replace(/\s+/g, "").toUpperCase();
    const looksLikeIban = /^[A-Z]{2}/.test(normalized);
    return JSON.stringify({
      accountHolderName,
      bankName,
      ...(looksLikeIban ? { iban: normalized } : { rib: normalized }),
      swiftCode: swiftCode || undefined,
    });
  }, [accountHolderName, bankName, ribOrIban, swiftCode]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const { data } = await payoutsApi.get(id);
        if (!cancelled) setPayout(data.payout);
        if (data.payout?.status === "COMPLETED") {
          const invsRes = await invoiceApi.list({ limit: 50 });
          const matching = (invsRes.data?.invoices || []).find(i => String(i.referenceId) === String(id));
          if (!cancelled && matching) setInvoiceId(matching._id);
        }
      } catch (e) {
        if (!cancelled) setError(extractApiError(e, "Impossible de charger ce payout.").message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError(""); setOk("");
    try {
      await payoutsApi.provideBankDetails(id, bankDetailsJson);
      setOk("Coordonnées bancaires enregistrées. Statut passé en READY.");
      const { data } = await payoutsApi.get(id);
      setPayout(data.payout);
    } catch (e2) {
      setError(extractApiError(e2, "Erreur lors de l'enregistrement.").message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="border-b border-border/40 pb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2 flex items-center gap-3">
            <Landmark className="w-8 h-8 text-primary" />
            Détails du Virement (Payout)
          </h1>
          {payout && <p className="text-muted-foreground">{statusHelp(payout.status)}</p>}
        </div>
        <div className="flex gap-2 shrink-0">
          {invoiceId && (
            <Button variant="outline" asChild>
              <Link to={`/invoices/${invoiceId}`}><FileText className="w-4 h-4 mr-2" /> Facture</Link>
            </Button>
          )}
          <Button variant="ghost" onClick={() => nav(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Retour
          </Button>
          <Button variant="outline" asChild>
            <Link to="/payouts">Mes payouts</Link>
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" /> <p className="text-sm font-medium">{error}</p>
        </div>
      )}
      {ok && (
        <div className="bg-green-100 text-green-800 p-4 rounded-xl flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> <p className="text-sm font-medium">{ok}</p>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted-foreground">Chargement du payout…</p>
        </div>
      ) : payout && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Summary Card */}
          <div className="lg:col-span-2">
            <Card className="p-5 border-border/50 shadow-sm h-full">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Résumé</h2>
                <StatusBadge status={payout.status} />
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Projet</p>
                  <p className="font-semibold text-foreground text-sm">
                    {payout.projectId && typeof payout.projectId === "object"
                      ? payout.projectId.title || String(payout.projectId._id)
                      : String(payout.projectId || "—")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Montant à virer</p>
                  <p className="font-black text-2xl text-primary">{payout.amount} <span className="text-sm font-normal text-muted-foreground">TND</span></p>
                </div>
              </div>
              {invoiceId && (
                <div className="mt-5 pt-4 border-t border-border">
                  <Button asChild className="w-full">
                    <Link to={`/invoices/${invoiceId}`}>
                      <FileText className="w-4 h-4 mr-2" /> Consulter la Facture
                    </Link>
                  </Button>
                </div>
              )}
            </Card>
          </div>

          {/* Bank details form */}
          <div className="lg:col-span-3">
            <Card className="p-5 border-border/50 shadow-sm">
              <h2 className="font-bold text-sm uppercase tracking-wider text-muted-foreground mb-1">
                Coordonnées bancaires
              </h2>
              <p className="text-xs text-muted-foreground mb-4">
                Saisissez avec précision les informations du titulaire et du compte — elles sont chiffrées côté serveur.
              </p>

              {canEdit ? (
                <>
                  <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 text-blue-800 dark:text-blue-300 p-3 rounded-xl text-xs flex items-start gap-2 mb-5">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>Après l'envoi, la demande passe en validation admin. Vous ne pourrez plus modifier les champs tant que le statut est <strong>PENDING</strong>.</span>
                  </div>
                  <form onSubmit={submit} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold">Nom complet du titulaire <span className="text-destructive font-bold">*</span></label>
                      <Input value={accountHolderName} onChange={e => setAccountHolderName(e.target.value)} required minLength={3} placeholder="ex: Ahmed Ben Salah" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold">Banque <span className="text-destructive font-bold">*</span></label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={bankName} onChange={e => setBankName(e.target.value)} required
                      >
                        <option value="">Choisir une banque…</option>
                        {TUNISIAN_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold">RIB / IBAN <span className="text-destructive font-bold">*</span></label>
                      <Input value={ribOrIban} onChange={e => setRibOrIban(e.target.value)} required placeholder="RIB (20 chiffres) ou IBAN (ex: TN59...)" />
                      <p className="text-xs text-muted-foreground">RIB: 20 chiffres sans espaces. IBAN: commence par <strong>TN</strong>.</p>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold">Code SWIFT/BIC <span className="text-muted-foreground font-normal">(optionnel)</span></label>
                      <Input value={swiftCode} onChange={e => setSwiftCode(e.target.value)} placeholder="ex: ABCDTNTT (8 ou 11 caractères)" />
                    </div>
                    <Button type="submit" disabled={saving} className="w-full mt-2">
                      {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                      {saving ? "Enregistrement…" : "Confirmer et envoyer pour validation"}
                    </Button>
                  </form>
                </>
              ) : (
                <div className="bg-muted/40 border border-border rounded-xl p-4 flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-muted-foreground shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    Les coordonnées ne sont plus modifiables pour l'instant (statut actuel: <strong className="text-foreground">{payout.status}</strong>).
                  </p>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
