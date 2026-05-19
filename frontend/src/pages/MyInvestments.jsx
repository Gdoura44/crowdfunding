import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { investmentsApi } from "../api/investments";
import { invoiceApi } from "../api/invoice";
import { useAuth } from "../hooks/useAuth.js";
import { extractApiError } from "../utils/apiError";
import { 
  Coins, Hourglass, Reply, UserCircle, AlertCircle, 
  Lock, FileText, Loader2, AlertTriangle, Info, RefreshCw 
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

function paymentConfirmedAtMs(tx) {
  if (!tx || tx.status !== "SUCCEEDED") return null;
  const raw = tx.succeededAt || tx.updatedAt || tx.createdAt;
  if (!raw) return null;
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function cancellationInfo(inv) {
  const tx = inv?.transaction;
  const graceMin = Number(inv?.cancellationGracePeriodMinutes || 0);
  const eligibleInitiated = inv?.status === "INITIATED" && tx?.status === "PENDING";
  const confirmedMs = paymentConfirmedAtMs(tx);
  const eligibleSuccess =
    inv?.status === "SUCCESS" && tx?.status === "SUCCEEDED" && confirmedMs != null && graceMin > 0;

  if (eligibleInitiated) {
    return { canCancel: true, label: "Annuler (en attente)" };
  }

  if (eligibleSuccess) {
    const deadlineMs = confirmedMs + graceMin * 60 * 1000;
    const leftMs = deadlineMs - Date.now();
    if (leftMs <= 0) return { canCancel: false };
    const totalSeconds = Math.max(1, Math.ceil(leftMs / 1000));
    const mm = Math.floor(totalSeconds / 60);
    const ss = totalSeconds % 60;
    const mmStr = String(mm).padStart(2, "0");
    const ssStr = String(ss).padStart(2, "0");
    return {
      canCancel: true,
      label: `Annuler (${mmStr}:${ssStr})`,
      policy: `Annulation possible pendant ${graceMin} minutes après la confirmation du paiement.`,
    };
  }

  return { canCancel: false };
}

function StatusBadge({ inv }) {
  const canCancel = cancellationInfo(inv).canCancel;
  
  if (canCancel) {
    return (
      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-300">
        <Hourglass className="w-3.5 h-3.5 mr-1 animate-pulse" /> EN ATTENTE
      </Badge>
    );
  }

  const status = inv.status;
  if (status === "REFUNDED") {
    const isOverFunded = inv.cancelReason === "OVER_FUNDED_OR_INACTIVE";
    return (
      <Badge 
        className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-300"
        title={isOverFunded ? "Remboursé : Le projet a atteint son objectif ou est inactif." : "Remboursé"}
      >
        <Reply className="w-3.5 h-3.5 mr-1" /> REMBOURSÉ
      </Badge>
    );
  }

  const map = {
    INITIATED: "bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200",
    SUCCESS: "bg-green-100 text-green-700 hover:bg-green-200 border-green-200",
    FAILED: "bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20",
    CANCELLED: "bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200",
    CANCELLING: "bg-indigo-100 text-indigo-800 hover:bg-indigo-200 border-indigo-200",
    PENDING_CONSULTATION: "bg-purple-100 text-purple-800 hover:bg-purple-200 border-purple-200",
  };

  const css = map[status] || "bg-muted text-muted-foreground border-border";
  return <Badge className={`${css} font-semibold`}>{status}</Badge>;
}

export default function MyInvestments() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [invoices, setInvoices] = useState({}); // referenceId -> invoiceId
  const [tick, setTick] = useState(0);
  const [confirmConfig, setConfirmConfig] = useState(null);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => (x + 1) % 1000000), 1000);
    return () => clearInterval(t);
  }, []);

  async function refresh(clearError = true) {
    setLoading(true);
    if (clearError) setError("");
    try {
      const { data } = await investmentsApi.mine({ limit: 50 });
      setItems(data.investments || []);
      
      const invsRes = await invoiceApi.list({ limit: 50 });
      const map = {};
      (invsRes.data?.invoices || []).forEach(i => {
        map[i.referenceId] = i._id;
      });
      setInvoices(map);
    } catch (e) {
      if (clearError) {
        const out = extractApiError(e, "Impossible de charger vos investissements.");
        setError(out.message);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user?.role === "ADMIN") return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await investmentsApi.mine({ limit: 50 });
        if (!cancelled) setItems(data.investments || []);
        
        const invsRes = await invoiceApi.list({ limit: 50 });
        const map = {};
        (invsRes.data?.invoices || []).forEach(i => {
          map[i.referenceId] = i._id;
        });
        if (!cancelled) setInvoices(map);
      } catch (e) {
        if (!cancelled) {
          const out = extractApiError(e, "Impossible de charger vos investissements.");
          setError(out.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/40 pb-6 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Mes investissements</h1>
          <p className="text-muted-foreground max-w-2xl">
            Retrouvez ici l'historique de vos soutiens et le statut détaillé de vos paiements.
          </p>
        </div>
        <Button variant="outline" asChild className="flex-shrink-0">
          <Link to="/projects">Explorer des projets</Link>
        </Button>
      </div>

      {user?.role === "ADMIN" && (
        <div className="bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 p-4 rounded-xl flex items-center gap-3">
          <Info className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">Les comptes administrateurs n’ont pas d’espace investisseur.</p>
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted-foreground font-medium">Chargement de vos investissements…</p>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 px-4 text-center border border-dashed border-border rounded-xl bg-muted/10">
          <div className="w-16 h-16 bg-primary/10 text-primary flex items-center justify-center rounded-full mb-4">
            <Coins className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Aucun investissement</h2>
          <p className="text-muted-foreground max-w-md">
            Lorsque vous soutiendrez un projet, il apparaîtra ici avec son suivi complet.
          </p>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <Card className="border-border/50 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground border-b border-border text-xs uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-4">Projet</th>
                  <th className="px-6 py-4">Montant</th>
                  <th className="px-6 py-4">Statut</th>
                  <th className="px-6 py-4">Paiement</th>
                  <th className="px-6 py-4">Date & Infos</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {items.map((inv) => (
                  <tr key={inv._id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      {inv.project ? (
                        <Link to={`/projects/${inv.projectId}`} className="font-semibold text-foreground hover:text-primary transition-colors truncate max-w-[200px] block">
                          {inv.project.title}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">{String(inv.projectId)}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-bold text-foreground">
                        {Number(inv.amount).toLocaleString("fr-FR")} TND
                      </div>
                      {Number(inv.tipAmount || 0) > 0 && (
                        <div className="text-[10px] text-muted-foreground font-medium mt-0.5" title="Soutien volontaire à la plateforme">
                          + {Number(inv.tipAmount).toLocaleString("fr-FR")} TND don
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge inv={inv} />
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-xs">
                      {inv.transaction ? (
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{inv.transaction.provider}</span>
                          <span>{inv.transaction.status}</span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs">
                      <div className="text-muted-foreground mb-1">
                        {inv.createdAt ? new Date(inv.createdAt).toLocaleString("fr-FR") : "—"}
                      </div>
                      
                      {inv.status === "PENDING_CONSULTATION" && (
                        <div className="text-purple-600 font-medium flex items-center mt-1">
                          <UserCircle className="w-3.5 h-3.5 mr-1" /> Consultation experte requise
                        </div>
                      )}
                      {inv.status === "REFUNDED" && inv.cancelReason === "OVER_FUNDED_OR_INACTIVE" && (
                        <div className="text-destructive font-medium flex items-center mt-1">
                          <AlertCircle className="w-3.5 h-3.5 mr-1" /> Objectif atteint ou inactif
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <div className="flex flex-wrap justify-end gap-2 min-w-[200px]">
                        
                        {/* Consultation Actions */}
                        {inv.status === "PENDING_CONSULTATION" && (
                          <>
                            <Button
                              size="sm"
                              className="bg-purple-600 hover:bg-purple-700 text-white"
                              disabled={busyId === inv._id}
                              onClick={async () => {
                                setBusyId(inv._id);
                                setError("");
                                try {
                                  await investmentsApi.finalizeConsultation(inv._id);
                                  await refresh();
                                } catch (e) {
                                  const out = extractApiError(e, "Finalisation impossible.");
                                  setError(out.message);
                                  await refresh(false);
                                } finally {
                                  setBusyId("");
                                }
                              }}
                            >
                              {busyId === inv._id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmer"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              disabled={busyId === inv._id}
                              onClick={async () => {
                                setBusyId(inv._id);
                                setError("");
                                try {
                                  await investmentsApi.cancel(inv._id);
                                  await refresh();
                                } catch (e) {
                                  const out = extractApiError(e, "Annulation impossible.");
                                  setError(out.message);
                                } finally {
                                  setBusyId("");
                                }
                              }}
                            >
                              Annuler
                            </Button>
                          </>
                        )}

                        {/* Retry Action */}
                        {inv.status === "FAILED" && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busyId === inv._id}
                            onClick={async () => {
                              setBusyId(inv._id);
                              setError("");
                              try {
                                const { data } = await investmentsApi.retry(inv._id);
                                if (data?.paymentUrl) {
                                  window.location.assign(data.paymentUrl);
                                  return;
                                }
                                await refresh();
                              } catch (e) {
                                const out = extractApiError(e, "Retry impossible.");
                                setError(out.message);
                              } finally {
                                setBusyId("");
                              }
                            }}
                          >
                            {busyId === inv._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Réessayer</>}
                          </Button>
                        )}

                        {/* Cancel Grace Period Action */}
                        {(() => {
                          void tick; // force re-render for real-time countdown
                          const info = cancellationInfo(inv);
                          if (!info.canCancel) return null;
                          return (
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={busyId === inv._id}
                              onClick={() => {
                                setConfirmConfig({
                                  title: "Annuler cet investissement ?",
                                  message: info.policy || "Si l’annulation est autorisée, le paiement sera annulé (ou remboursé).",
                                  isDanger: true,
                                  confirmLabel: "Annuler le paiement",
                                  onConfirm: async () => {
                                    setBusyId(inv._id);
                                    setError("");
                                    try {
                                      await investmentsApi.cancel(inv._id);
                                      await refresh();
                                    } catch (e) {
                                      const out = extractApiError(e, "Annulation impossible.");
                                      setError(out.message);
                                    } finally {
                                      setBusyId("");
                                    }
                                  }
                                });
                              }}
                            >
                              {busyId === inv._id ? <Loader2 className="w-4 h-4 animate-spin" /> : info.label}
                            </Button>
                          );
                        })()}

                        {/* Invoice Action */}
                        {(() => {
                          const invoiceId = invoices[inv._id];
                          const canPrint = invoiceId && !cancellationInfo(inv).canCancel && ["SUCCESS", "REFUNDED"].includes(inv.status);
                          
                          if (canPrint) {
                            return (
                              <Button variant="outline" size="sm" asChild className="bg-background">
                                <Link to={`/invoices/${invoiceId}`}>
                                  <FileText className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" /> Facture
                                </Link>
                              </Button>
                            );
                          }
                          
                          let tooltip = "Facture indisponible";
                          if (inv.status === "PENDING_CONSULTATION") tooltip = "Disponible après validation de la consultation";
                          else if (cancellationInfo(inv).canCancel) tooltip = "En attente de fin du délai de rétractation";
                          else if (inv.status === "FAILED") tooltip = "Le paiement a échoué";
                          else if (inv.status === "INITIATED") tooltip = "En attente du paiement";

                          return (
                            <div title={tooltip}>
                              <Button variant="outline" size="sm" disabled className="bg-muted/50 text-muted-foreground opacity-50 cursor-not-allowed">
                                <Lock className="w-3.5 h-3.5 mr-1.5" /> Facture
                              </Button>
                            </div>
                          );
                        })()}

                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Dynamic Confirmation Dialog */}
      {confirmConfig && (
        <AlertDialog open={!!confirmConfig} onOpenChange={(open) => !open && setConfirmConfig(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmConfig.title}</AlertDialogTitle>
              <AlertDialogDescription>{confirmConfig.message}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Retour</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => { confirmConfig.onConfirm(); setConfirmConfig(null); }} 
                className={confirmConfig.isDanger ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
              >
                {confirmConfig.confirmLabel || "Confirmer"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
