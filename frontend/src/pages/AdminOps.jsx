import { useEffect, useMemo, useState } from "react";
import { adminApi } from "../api/admin";
import { useAuth } from "../hooks/useAuth.js";
import { extractApiError } from "../utils/apiError";
import { 
  ServerCrash, Loader2, AlertTriangle, 
  RotateCw, RefreshCcw, Banknote, CreditCard,
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AdminOps() {
  const { user } = useAuth();
  const [tab, setTab] = useState("REFUNDS");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [refunds, setRefunds] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [busy, setBusy] = useState(false);

  const isRefunds = tab === "REFUNDS";
  const params = useMemo(() => ({ resolved: false, limit: 100 }), []);
  const canAccess = user?.role === "ADMIN";

  async function refresh() {
    setLoading(true);
    setError("");
    setOk("");
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
    setOk("");
    try {
      if (isRefunds) await adminApi.opsRetryRefunds({ limit: 50 });
      else await adminApi.opsRetryPayouts({ limit: 50 });
      await refresh();
      setOk("Relance effectuée avec succès.");
    } catch (e) {
      const out = extractApiError(e, "Relance impossible pour le moment.");
      setError(out.message);
    } finally {
      setBusy(false);
    }
  }

  if (!canAccess) {
    return (
      <div className="max-w-2xl mx-auto mt-12 text-center p-8 bg-amber-50 rounded-2xl border border-amber-200">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-amber-800 mb-2">Accès réservé</h2>
        <p className="text-amber-700">Cette section est strictement réservée aux administrateurs techniques.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="border-b border-border/40 pb-6 mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2 flex items-center gap-3">
            <ServerCrash className="w-8 h-8 text-primary" />
            Opérations Techniques (Ops)
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Surveillez les échecs techniques (remboursements / payouts) et relancez les processus en un clic.
          </p>
        </div>
        <Button onClick={retryNow} disabled={busy} className="shrink-0 shadow-sm" variant="outline">
          {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RotateCw className="w-4 h-4 mr-2" />}
          Relancer le traitement
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 bg-muted/30 p-1.5 rounded-xl border border-border/50 inline-flex">
        <Button
          variant={isRefunds ? "default" : "ghost"}
          size="sm"
          onClick={() => setTab("REFUNDS")}
          className={`rounded-lg px-4 ${isRefunds ? "shadow-sm" : ""}`}
        >
          <CreditCard className="w-4 h-4 mr-2" /> Remboursements
        </Button>
        <Button
          variant={!isRefunds ? "default" : "ghost"}
          size="sm"
          onClick={() => setTab("PAYOUTS")}
          className={`rounded-lg px-4 ${!isRefunds ? "shadow-sm" : ""}`}
        >
          <Banknote className="w-4 h-4 mr-2" /> Décaissements (Payouts)
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-xl flex items-center gap-3 shadow-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium whitespace-pre-line">{error}</p>
        </div>
      )}
      
      {ok && (
        <div className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 p-4 rounded-xl flex items-center gap-3 shadow-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{ok}</p>
        </div>
      )}

      {/* Content */}
      <Card className="border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-4">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-muted-foreground font-medium">Analyse des flux…</p>
            </div>
          ) : (isRefunds && refunds.length === 0) || (!isRefunds && payouts.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
              <div className="w-16 h-16 bg-green-50 text-green-600 flex items-center justify-center rounded-full mb-4">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">Systèmes opérationnels</h2>
              <p className="text-muted-foreground max-w-md">Aucun {isRefunds ? "remboursement" : "payout"} en échec n'a été détecté dans les files d'attente.</p>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground border-b border-border text-xs uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-5 py-4 w-40">Date / Heure</th>
                  <th className="px-5 py-4 w-[25%]">Projet Associé</th>
                  <th className="px-5 py-4">{isRefunds ? "Investissement" : "Payout (Montant)"}</th>
                  {isRefunds && <th className="px-5 py-4">Raison</th>}
                  <th className="px-5 py-4 text-center">Tentatives</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {(isRefunds ? refunds : payouts).map((item) => {
                  const isRef = isRefunds;
                  const projectObj = isRef ? item.projectId : (item.payoutId?.projectId);
                  const projectTitle = projectObj && typeof projectObj === "object" ? projectObj.title : String(projectObj || "—");
                  const projectStatus = projectObj && typeof projectObj === "object" ? projectObj.status : null;

                  return (
                    <tr key={item._id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-4 text-xs text-muted-foreground">
                        {item.createdAt ? new Date(item.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "medium" }) : "—"}
                      </td>
                      
                      <td className="px-5 py-4 align-top">
                        <div className="font-semibold text-foreground truncate max-w-[250px]" title={projectTitle}>
                          {projectTitle}
                        </div>
                        {projectStatus && (
                          <div className="text-[11px] text-muted-foreground mt-1">Statut: {projectStatus}</div>
                        )}
                      </td>

                      <td className="px-5 py-4 align-top text-xs text-muted-foreground">
                        {isRef ? (
                          item.investmentId && typeof item.investmentId === "object"
                            ? <span className="font-medium text-foreground">{item.investmentId.amount ?? "—"} TND <span className="text-muted-foreground font-normal">({item.investmentId.status || "—"})</span></span>
                            : String(item.investmentId || "—")
                        ) : (
                          item.payoutId && typeof item.payoutId === "object"
                            ? <span className="font-medium text-foreground">{item.payoutId.amount ?? "—"} TND <span className="text-muted-foreground font-normal">({item.payoutId.status || "—"}) / ID: {String(item.payoutId._id).slice(-6)}</span></span>
                            : String(item.payoutId || "—")
                        )}
                      </td>

                      {isRef && (
                        <td className="px-5 py-4 align-top">
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 uppercase tracking-wider text-[10px]">
                            {item.reason}
                          </Badge>
                        </td>
                      )}

                      <td className="px-5 py-4 align-top text-center">
                        <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted font-bold text-muted-foreground">
                          {item.retryCount}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}
