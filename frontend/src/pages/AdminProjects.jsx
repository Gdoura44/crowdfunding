import { useEffect, useMemo, useState } from "react";
import { adminApi } from "../api/admin";
import { useAuth } from "../hooks/useAuth";
import { extractApiError } from "../utils/apiError";
import { 
  CheckCircle2, AlertTriangle, FileText, Lock, 
  RefreshCw, PauseCircle, PlayCircle, Eye, Loader2, X, Send
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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

function StatusBadge({ status }) {
  const map = {
    DRAFT: "bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200",
    AWAITING_AI: "bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200",
    UNDER_REVIEW: "bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200",
    APPROVED: "bg-teal-100 text-teal-800 hover:bg-teal-200 border-teal-200",
    REJECTED: "bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20",
    ACTIVE: "bg-green-100 text-green-700 hover:bg-green-200 border-green-200",
    FUNDED: "bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200",
    CLOSED: "bg-muted text-muted-foreground border-border",
    SUSPENDED: "bg-slate-800 text-white hover:bg-slate-700 border-slate-800",
  };
  
  const labelMap = {
    APPROVED: "APPROUVÉ (à publier)",
    DRAFT: "BROUILLON",
    AWAITING_AI: "EN ATTENTE IA",
    UNDER_REVIEW: "EN REVUE",
    ACTIVE: "EN LIGNE",
    FUNDED: "FINANCÉ",
    REJECTED: "REJETÉ",
    CLOSED: "CLÔTURÉ",
    SUSPENDED: "SUSPENDU",
  };

  const css = map[status] || map.DRAFT;
  return <Badge className={`${css} font-semibold uppercase text-[10px] tracking-wider`}>{labelMap[status] || status}</Badge>;
}

function formatDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("fr-FR");
  } catch {
    return "—";
  }
}

export default function AdminProjects() {
  const { user } = useAuth();
  const [tab, setTab] = useState(user?.role === "ADMIN" ? "APPROVED" : "UNDER_REVIEW");
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [feedbackById, setFeedbackById] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [confirmConfig, setConfirmConfig] = useState(null);
  const [selectedAiReport, setSelectedAiReport] = useState(null);

  const canAccess = user?.role === "ADMIN";

  const usesFeedback = useMemo(() => {
    return ["APPROVED", "ACTIVE", "FUNDED"].includes(String(tab));
  }, [tab]);

  const TABS = [
    { id: "AWAITING_AI", label: "IA en cours" },
    { id: "UNDER_REVIEW", label: "En revue" },
    { id: "APPROVED", label: "À publier" },
    { id: "ACTIVE", label: "En ligne" },
    { id: "FUNDED", label: "Financés" },
    { id: "CLOSED", label: "Clôturés" },
    { id: "REJECTED", label: "Rejetés" },
    { id: "SUSPENDED", label: "Suspendus" },
  ];

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await adminApi.listProjects({ status: tab, limit: 40 });
      setProjects(res.data.projects || []);
    } catch (e) {
      const out = extractApiError(e, "Impossible de charger la liste.");
      setError(out.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canAccess) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, canAccess]);

  async function doApprove(p, publishAfter = false) {
    setBusyId(p._id);
    setError("");
    setOk("");
    try {
      await adminApi.validateProject(p._id, {
        decision: "APPROVED",
        feedback: feedbackById[p._id] || "",
      });
      if (publishAfter) {
        await adminApi.publishProject(p._id);
      }
      await load();
      setOk(publishAfter ? "Projet approuvé et publié (en ligne)." : "Projet approuvé (à publier manuellement).");
    } catch (e) {
      const out = extractApiError(e, "Action impossible.");
      setError(out.message);
    } finally {
      setBusyId(null);
    }
  }

  async function publish(p) {
    setBusyId(p._id);
    setError("");
    setOk("");
    try {
      await adminApi.publishProject(p._id);
      await load();
      setOk("Projet publié. La campagne est visible publiquement.");
    } catch (e) {
      const out = extractApiError(e, "Action impossible.");
      setError(out.message);
    } finally {
      setBusyId(null);
    }
  }

  async function retryAi(p) {
    setBusyId(p._id);
    setError("");
    setOk("");
    try {
      const { data } = await adminApi.retryAiAnalysis(p._id);
      await load();
      const queued = Boolean(data?.diagnostics?.queued);
      const hint = String(data?.diagnostics?.hint || "").trim();
      setOk(queued ? `Analyse IA relancée. ${hint}` : `Échec de la relance IA. ${hint}`);
    } catch (e) {
      const out = extractApiError(e, "Action impossible.");
      setError(out.message);
    } finally {
      setBusyId(null);
    }
  }

  async function reactivate(p) {
    setBusyId(p._id);
    setError("");
    setOk("");
    try {
      await adminApi.reactivateProject(p._id);
      await load();
      setOk("Projet réactivé.");
    } catch (e) {
      const out = extractApiError(e, "Action impossible.");
      setError(out.message);
    } finally {
      setBusyId(null);
    }
  }

  if (!canAccess) {
    return (
      <div className="max-w-2xl mx-auto mt-12 text-center p-8 bg-destructive/5 rounded-2xl border border-destructive/20">
        <Lock className="w-12 h-12 text-destructive mx-auto mb-4" />
        <h2 className="text-xl font-bold text-destructive mb-2">Accès restreint</h2>
        <p className="text-muted-foreground">Cette page est strictement réservée aux administrateurs.</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-12 relative">
      {/* Header */}
      <div className="border-b border-border/40 pb-6 mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Gestion des Projets</h1>
        <p className="text-muted-foreground max-w-3xl">
          Validez les dossiers en revue, publiez les projets approuvés, et modérez les campagnes actives.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map(t => (
          <Button
            key={t.id}
            variant={tab === t.id ? "default" : "outline"}
            size="sm"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-4 ${tab === t.id ? "shadow-md" : "bg-background"}`}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium whitespace-pre-line">{error}</p>
        </div>
      )}

      {ok && (
        <div className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 p-4 rounded-xl flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{ok}</p>
        </div>
      )}

      {/* Table Card */}
      <Card className="border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-4">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-muted-foreground font-medium">Chargement des dossiers…</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
              <div className="w-16 h-16 bg-muted text-muted-foreground flex items-center justify-center rounded-full mb-4">
                <FileText className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">Aucun projet</h2>
              <p className="text-muted-foreground max-w-md">
                Les projets dans ce statut apparaîtront ici.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground border-b border-border text-xs uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-5 py-4">Titre & Statut IA</th>
                  <th className="px-5 py-4">Statut Global</th>
                  <th className="px-5 py-4">Dates</th>
                  {usesFeedback && <th className="px-5 py-4 w-[280px]">Feedback (Optionnel)</th>}
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {projects.map((p) => (
                  <tr key={p._id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-foreground max-w-[300px] truncate" title={p.title}>{p.title}</div>
                      {p.aiStatus && (
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge variant="outline" className="text-[9px] uppercase px-1.5 py-0 border-border bg-muted/50">
                            IA: {p.aiStatus}
                          </Badge>
                          {p.aiAnalysis?.report && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-5 px-1.5 text-[10px] text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              onClick={() => setSelectedAiReport(p)}
                            >
                              <Eye className="w-3 h-3 mr-1" /> Voir rapport
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={p.status} />
                      {p.status === "APPROVED" && (
                         <div className="text-[11px] text-muted-foreground mt-1.5 leading-tight">
                           Prêt à être mis en ligne
                         </div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-[13px] text-muted-foreground whitespace-nowrap">
                      <div>Créé: <span className="font-medium text-foreground">{formatDate(p.createdAt)}</span></div>
                      <div>Début: <span className="font-medium text-foreground">{formatDate(p.startAt)}</span></div>
                      <div>Fin: <span className="font-medium text-foreground">{formatDate(p.deadline)}</span></div>
                    </td>
                    {usesFeedback && (
                      <td className="px-5 py-4">
                        <Input
                          placeholder="Motif / Explication..."
                          className="h-8 text-xs bg-background"
                          value={feedbackById[p._id] || ""}
                          onChange={(e) => setFeedbackById((prev) => ({ ...prev, [p._id]: e.target.value }))}
                        />
                      </td>
                    )}
                    <td className="px-5 py-4 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {p.status === "AWAITING_AI" || p.aiStatus === "FAILED" ? (
                          <Button size="sm" variant="outline" disabled={busyId === p._id} onClick={() => retryAi(p)} className="h-8">
                            {busyId === p._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />} Relancer IA
                          </Button>
                        ) : p.status === "SUSPENDED" ? (
                          <Button size="sm" className="bg-green-600 hover:bg-green-700 h-8" disabled={busyId === p._id} onClick={() => reactivate(p)}>
                            <PlayCircle className="w-3.5 h-3.5 mr-1.5" /> Réactiver
                          </Button>
                        ) : p.status === "APPROVED" ? (
                          <>
                            <Button size="sm" disabled={busyId === p._id} onClick={() => publish(p)} className="h-8">
                              <Send className="w-3.5 h-3.5 mr-1.5" /> Publier
                            </Button>
                            <Button size="sm" variant="destructive" className="h-8" disabled={busyId === p._id} onClick={() => {
                              const reason = String(feedbackById[p._id] || "").trim();
                              if (!reason) return setError("Renseignez un feedback avant d'annuler.");
                              setConfirmConfig({
                                title: "Annuler l'approbation ?",
                                message: "Le projet repassera en 'Rejeté' et le créateur devra corriger selon votre feedback.",
                                isDanger: true,
                                confirmLabel: "Annuler l'approbation",
                                onConfirm: async () => {
                                  setBusyId(p._id); setError(""); setOk("");
                                  try { await adminApi.revokeApproval(p._id, { reason }); await load(); setOk("Approbation annulée."); } 
                                  catch (e) { setError(extractApiError(e, "Erreur.").message); } 
                                  finally { setBusyId(null); }
                                }
                              });
                            }}>
                              Annuler
                            </Button>
                          </>
                        ) : p.status === "ACTIVE" || p.status === "FUNDED" ? (
                          <Button size="sm" variant="destructive" className="h-8" disabled={busyId === p._id} onClick={() => {
                            setConfirmConfig({
                              title: "Suspendre ce projet ?",
                              message: "Il ne sera plus visible et les paiements seront bloqués.",
                              isDanger: true,
                              confirmLabel: "Suspendre",
                              onConfirm: async () => {
                                setBusyId(p._id); setError(""); setOk("");
                                try { await adminApi.deactivateProject(p._id, { reason: feedbackById[p._id] || "" }); await load(); setOk("Projet suspendu."); } 
                                catch (e) { setError(extractApiError(e, "Erreur.").message); } 
                                finally { setBusyId(null); }
                              }
                            });
                          }}>
                            <PauseCircle className="w-3.5 h-3.5 mr-1.5" /> Suspendre
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* AI Report Modal */}
      {selectedAiReport && (() => {
        const p = selectedAiReport;
        const report = p.aiAnalysis?.report || {};
        const riskLevel = p.aiAnalysis?.riskLevel || "";
        const riskBadge = riskLevel === "HIGH" ? "bg-destructive text-destructive-foreground" : riskLevel === "MEDIUM" ? "bg-amber-500 text-white" : "bg-green-500 text-white";

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <div className="bg-card border border-border shadow-2xl rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center px-6 py-4 border-b border-border bg-muted/20">
                <div>
                  <h3 className="text-lg font-bold text-foreground">Rapport d'Analyse IA</h3>
                  <p className="text-sm text-muted-foreground truncate max-w-lg">{p.title}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setSelectedAiReport(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="flex gap-3">
                  <Badge className={riskBadge}>Risque : {riskLevel}</Badge>
                  <Badge variant="outline">Score : {p.aiAnalysis?.riskScore || 0}/100</Badge>
                </div>

                <div className="bg-muted/30 p-4 rounded-lg border border-border/50">
                  <h4 className="font-semibold mb-2">Résumé</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{report.summary || "—"}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="p-4 shadow-sm">
                    <h4 className="font-semibold text-green-600 mb-2">Points forts</h4>
                    <ul className="text-sm space-y-1.5 list-disc pl-4 text-muted-foreground">
                      {(report.advantages || []).map((x, i) => <li key={i}>{x}</li>)}
                    </ul>
                  </Card>
                  <Card className="p-4 shadow-sm">
                    <h4 className="font-semibold text-destructive mb-2">Points faibles</h4>
                    <ul className="text-sm space-y-1.5 list-disc pl-4 text-muted-foreground">
                      {(report.disadvantages || []).map((x, i) => <li key={i}>{x}</li>)}
                    </ul>
                  </Card>
                  <Card className="p-4 shadow-sm">
                    <h4 className="font-semibold text-blue-600 mb-2">Améliorations suggérées</h4>
                    <ul className="text-sm space-y-1.5 list-disc pl-4 text-muted-foreground">
                      {(report.improvements || []).map((x, i) => <li key={i}>{x}</li>)}
                    </ul>
                  </Card>
                  <Card className="p-4 shadow-sm">
                    <h4 className="font-semibold text-amber-600 mb-2">Questions à clarifier</h4>
                    <ul className="text-sm space-y-1.5 list-disc pl-4 text-muted-foreground">
                      {(report.questionsToClarify || []).map((x, i) => <li key={i}>{x}</li>)}
                    </ul>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
