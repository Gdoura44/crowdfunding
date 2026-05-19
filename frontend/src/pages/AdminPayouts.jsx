import { useEffect, useMemo, useState } from "react";
import { adminApi } from "../api/admin";
import { useAuth } from "../hooks/useAuth.js";
import { extractApiError } from "../utils/apiError";
import { useNavigate } from "react-router-dom";
import { 
  Building2, Loader2, AlertTriangle, CheckCircle2, 
  Banknote, ArrowRightLeft, Landmark, Send
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function formatPayoutTerminalAt(p) {
  if (!p) return "—";
  const d =
    p.status === "COMPLETED"
      ? p.completedAt
      : p.status === "FAILED"
        ? p.failedAt
        : p.status === "CANCELLED"
          ? p.cancelledAt
          : null;
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

function StatusBadge({ status }) {
  const map = {
    PENDING: "bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200",
    READY: "bg-primary text-primary-foreground hover:bg-primary/90",
    PROCESSING: "bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200",
    COMPLETED: "bg-green-100 text-green-800 hover:bg-green-200 border-green-200",
    FAILED: "bg-red-100 text-red-800 hover:bg-red-200 border-red-200",
    CANCELLED: "bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200",
  };
  const css = map[status] || "bg-slate-100 text-slate-700";
  return <Badge className={`${css} font-semibold uppercase tracking-wider text-[10px]`}>{status}</Badge>;
}

export default function AdminPayouts() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState("READY");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busyId, setBusyId] = useState("");
  const [confirmConfig, setConfirmConfig] = useState(null);

  const params = useMemo(() => ({ status: tab, limit: 100 }), [tab]);
  const canAccess = user?.role === "ADMIN";

  const TABS = ["READY", "PROCESSING", "PENDING", "COMPLETED", "FAILED", "CANCELLED"];

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

  async function handleApprove(id) {
    setBusyId(id);
    setError("");
    setOk("");
    try {
      const { data } = await adminApi.approvePayout(id, {});
      if (data?.transferUrl) {
        setOk("Virement initié. Redirection vers le prestataire...");
        nav(data.transferUrl, { replace: true });
        return;
      }
      await refresh();
      setOk("Virement initié.");
    } catch (e) {
      const out = extractApiError(e, "Approbation impossible pour le moment.");
      setError(out.message);
    } finally {
      setBusyId("");
    }
  }

  if (!canAccess) {
    return (
      <div className="max-w-2xl mx-auto mt-12 text-center p-8 bg-amber-50 rounded-2xl border border-amber-200">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-amber-800 mb-2">Accès réservé</h2>
        <p className="text-amber-700">Cette section est strictement réservée aux administrateurs financiers.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="border-b border-border/40 pb-6 mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2 flex items-center gap-3">
            <Landmark className="w-8 h-8 text-primary" />
            Décaissements (Payouts)
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Validez et suivez les transferts financiers vers les créateurs de projets financés.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 bg-muted/30 p-1.5 rounded-xl border border-border/50 inline-flex">
        {TABS.map((k) => (
          <Button
            key={k}
            variant={tab === k ? "default" : "ghost"}
            size="sm"
            onClick={() => setTab(k)}
            className={`rounded-lg px-4 ${tab === k ? "shadow-sm" : ""}`}
          >
            {k}
          </Button>
        ))}
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
              <p className="text-muted-foreground font-medium">Chargement des virements…</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
              <div className="w-16 h-16 bg-muted text-muted-foreground flex items-center justify-center rounded-full mb-4">
                <Banknote className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">Aucun transfert</h2>
              <p className="text-muted-foreground max-w-md">
                Il n'y a aucun dossier dans la catégorie <strong className="text-foreground">{tab}</strong>.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground border-b border-border text-xs uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-5 py-4 w-20">ID</th>
                  <th className="px-5 py-4">Projet Associé</th>
                  <th className="px-5 py-4">Bénéficiaire (Créateur)</th>
                  <th className="px-5 py-4">Montant</th>
                  <th className="px-5 py-4">Statut</th>
                  {["COMPLETED", "FAILED", "CANCELLED"].includes(tab) && <th className="px-5 py-4">Horodatage</th>}
                  {tab === "READY" && <th className="px-5 py-4 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {items.map((p) => (
                  <tr key={p._id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-4 font-mono text-xs text-muted-foreground">
                      {String(p._id).slice(-6)}
                    </td>
                    <td className="px-5 py-4">
                      {p.projectId && typeof p.projectId === "object" ? (
                        <div className="space-y-1">
                          <div className="font-semibold text-foreground max-w-[250px] truncate" title={p.projectId.title || p.projectId._id}>
                            {p.projectId.title || String(p.projectId._id || "—")}
                          </div>
                          {p.projectId.status && (
                            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                              <Building2 className="w-3 h-3" /> Statut: {p.projectId.status}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">{String(p.projectId || "—")}</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {p.creatorId && typeof p.creatorId === "object" ? (
                        <div>
                          <div className="font-semibold text-foreground">
                            {[p.creatorId.profile?.firstName, p.creatorId.profile?.lastName].filter(Boolean).join(" ") || String(p.creatorId.email || "—")}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                            {String(p.creatorId.email || p.creatorId._id || "—")}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">{String(p.creatorId || "—")}</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-bold text-base flex items-center gap-1.5">
                        <ArrowRightLeft className="w-4 h-4 text-muted-foreground" /> {p.amount} <span className="text-xs text-muted-foreground">TND</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={p.status} />
                    </td>
                    {["COMPLETED", "FAILED", "CANCELLED"].includes(tab) && (
                      <td className="px-5 py-4 text-xs text-muted-foreground whitespace-nowrap">
                        {formatPayoutTerminalAt(p)}
                      </td>
                    )}
                    {tab === "READY" && (
                      <td className="px-5 py-4 text-right">
                        <Button 
                          size="sm" 
                          className="bg-green-600 hover:bg-green-700 text-white"
                          disabled={busyId === p._id}
                          onClick={() => {
                            setConfirmConfig({
                              title: "Initier le virement ?",
                              message: "Vous serez redirigé vers l’interface de paiement (prestataire externe) pour confirmer la réussite ou l’échec du virement. Voulez-vous continuer ?",
                              onConfirm: () => handleApprove(p._id)
                            });
                          }}
                        >
                          {busyId === p._id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                          {busyId === p._id ? "Validation…" : "Initier virement"}
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* Dynamic Confirmation Dialog */}
      {confirmConfig && (
        <AlertDialog open={!!confirmConfig} onOpenChange={(open) => !open && setConfirmConfig(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmConfig.title}</AlertDialogTitle>
              <AlertDialogDescription>{confirmConfig.message}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={() => { confirmConfig.onConfirm(); setConfirmConfig(null); }}>
                Confirmer l'initiation
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
