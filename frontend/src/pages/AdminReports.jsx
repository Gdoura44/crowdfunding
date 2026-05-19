import { useEffect, useState } from "react";
import { adminApi } from "../api/admin";
import { useAuth } from "../hooks/useAuth";
import { extractApiError } from "../utils/apiError";
import { 
  Flag, Loader2, AlertTriangle, CheckCircle2, 
  MessageSquare, FolderGit2, Check, Send
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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

export default function AdminReports() {
  const { user } = useAuth();
  const [status, setStatus] = useState("PENDING");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [confirmConfig, setConfirmConfig] = useState(null);
  
  // Resolution states
  const [resolutionById, setResolutionById] = useState({});
  const [actionById, setActionById] = useState({});
  const [decisionById, setDecisionById] = useState({});

  const canAccess = user?.role === "ADMIN";

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data } = await adminApi.listReports({ status, limit: 80 });
      setItems(data.reports || []);
    } catch (e) {
      const out = extractApiError(e, "Impossible de charger les signalements.");
      setError(out.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canAccess) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, canAccess]);

  if (!canAccess) {
    return (
      <div className="max-w-2xl mx-auto mt-12 text-center p-8 bg-amber-50 rounded-2xl border border-amber-200">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-amber-800 mb-2">Accès réservé</h2>
        <p className="text-amber-700">Cette section est réservée aux administrateurs de la modération.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="border-b border-border/40 pb-6 mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2 flex items-center gap-3">
          <Flag className="w-8 h-8 text-primary" />
          Modération des Signalements
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Traitez les signalements utilisateurs (commentaires abusifs, projets suspects) et appliquez les sanctions si nécessaire.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 bg-muted/30 p-1.5 rounded-xl border border-border/50 inline-flex">
        <Button
          variant={status === "PENDING" ? "default" : "ghost"}
          size="sm"
          onClick={() => setStatus("PENDING")}
          className={`rounded-lg px-4 ${status === "PENDING" ? "shadow-sm" : ""}`}
        >
          En attente
        </Button>
        <Button
          variant={status === "RESOLVED" ? "default" : "ghost"}
          size="sm"
          onClick={() => setStatus("RESOLVED")}
          className={`rounded-lg px-4 ${status === "RESOLVED" ? "shadow-sm" : ""}`}
        >
          Traités
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

      <Card className="border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-4">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-muted-foreground font-medium">Chargement des signalements…</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
              <div className="w-16 h-16 bg-muted text-muted-foreground flex items-center justify-center rounded-full mb-4">
                <Check className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">Tout est calme</h2>
              <p className="text-muted-foreground max-w-md">Aucun signalement {status === "PENDING" ? "en attente" : "traité"} pour le moment.</p>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground border-b border-border text-xs uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-3 w-48">Rapporteur & Date</th>
                  <th className="px-4 py-3">Raison & Cible</th>
                  {status === "PENDING" && <th className="px-4 py-3 w-[300px]">Résolution</th>}
                  {status === "PENDING" && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {items.map((r) => {
                  const reporterName = r.reporterId && typeof r.reporterId === "object" 
                    ? [r.reporterId.profile?.firstName, r.reporterId.profile?.lastName].filter(Boolean).join(" ") || String(r.reporterId.email || "—")
                    : String(r.reporterId || "—");

                  const isComment = !!r.commentId;
                  const projectTitle = r.projectId && typeof r.projectId === "object" ? r.projectId.title : String(r.projectId || "—");

                  return (
                    <tr key={r._id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-4 align-top">
                        <div className="font-medium text-foreground text-xs break-words">{reporterName}</div>
                        <div className="text-[11px] text-muted-foreground mt-1">
                          {r.createdAt ? new Date(r.createdAt).toLocaleDateString("fr-FR", { hour: '2-digit', minute:'2-digit' }) : "—"}
                        </div>
                        <Badge variant="outline" className="mt-2 text-[9px] uppercase tracking-wider">{r.type}</Badge>
                      </td>
                      
                      <td className="px-4 py-4 align-top">
                        <div className="bg-destructive/5 border border-destructive/20 text-destructive-foreground dark:text-red-400 p-2.5 rounded-lg text-xs leading-relaxed mb-3">
                          <strong className="text-destructive block mb-0.5">Motif du signalement :</strong>
                          {r.description || "Aucune description fournie par l'utilisateur."}
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-start gap-2">
                            <FolderGit2 className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                            <div className="text-xs">
                              <span className="font-semibold text-foreground block">Projet : {projectTitle}</span>
                              {r.projectId && typeof r.projectId === "object" && r.projectId.status && (
                                <span className="text-muted-foreground">Statut actuel : {r.projectId.status}</span>
                              )}
                            </div>
                          </div>

                          {isComment && (
                            <div className="flex items-start gap-2 pt-2 border-t border-border/50">
                              <MessageSquare className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                              <div className="text-xs flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-semibold text-foreground">Commentaire ciblé</span>
                                  {r.commentId && typeof r.commentId === "object" && (r.commentId.deletedAt || r.commentId.isHidden) && (
                                    <Badge variant="secondary" className="text-[9px] h-4">
                                      {r.commentId.deletedAt ? "Supprimé" : "Masqué"}
                                    </Badge>
                                  )}
                                </div>
                                <div className="bg-muted p-2 rounded text-muted-foreground whitespace-pre-wrap italic">
                                  "{r.commentId && typeof r.commentId === "object" ? r.commentId.content : "Contenu indisponible"}"
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>

                      {status === "PENDING" && (
                        <td className="px-4 py-4 align-top">
                          <div className="space-y-2">
                            <Textarea
                              className="text-xs h-16 resize-none"
                              placeholder="Notes de modération (obligatoire)..."
                              value={resolutionById[r._id] || ""}
                              onChange={(e) => setResolutionById((p) => ({ ...p, [r._id]: e.target.value }))}
                            />
                            
                            <div className="grid grid-cols-2 gap-2">
                              <select
                                className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                value={decisionById[r._id] || "RESOLVED"}
                                onChange={(e) => setDecisionById((p) => ({ ...p, [r._id]: e.target.value }))}
                              >
                                <option value="RESOLVED">Signalement Justifié (Résoudre)</option>
                                <option value="DISMISSED">Rejeter le signalement</option>
                              </select>

                              <select
                                className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                value={actionById[r._id] || ""}
                                onChange={(e) => setActionById((p) => ({ ...p, [r._id]: e.target.value }))}
                              >
                                {isComment ? (
                                  <>
                                    <option value="">(Commentaire) Aucune action</option>
                                    <option value="HIDE_COMMENT">Masquer</option>
                                    <option value="DELETE_COMMENT">Supprimer définitivement</option>
                                  </>
                                ) : (
                                  <>
                                    <option value="">(Projet) Aucune action</option>
                                    <option value="WARNING">Avertissement</option>
                                    <option value="DEACTIVATE">Suspendre le projet</option>
                                  </>
                                )}
                              </select>
                            </div>
                          </div>
                        </td>
                      )}

                      {status === "PENDING" && (
                        <td className="px-4 py-4 align-top text-right">
                          <Button
                            size="sm"
                            className="w-full bg-primary"
                            disabled={busyId === r._id || !(resolutionById[r._id] || "").trim()}
                            onClick={() => {
                              const action = actionById[r._id] || "";
                              const decision = decisionById[r._id] || "RESOLVED";
                              const isDestructive = ["DELETE_COMMENT", "HIDE_COMMENT", "DEACTIVATE"].includes(action);
                              
                              const doRun = async () => {
                                setBusyId(r._id); setError(""); setOk("");
                                try {
                                  await adminApi.resolveReport(r._id, {
                                    resolution: resolutionById[r._id],
                                    actionOnProject: isComment ? undefined : action || undefined,
                                    actionOnComment: isComment ? action || undefined : undefined,
                                    status: decision,
                                  });
                                  await load();
                                  setOk("Signalement traité avec succès.");
                                } catch (e) {
                                  setError(extractApiError(e, "Erreur.").message);
                                } finally {
                                  setBusyId(null);
                                }
                              };

                              if (!isDestructive) {
                                doRun();
                              } else {
                                setConfirmConfig({
                                  title: "Confirmer la sanction ?",
                                  message: `L'action choisie ("${action}") modifiera ou cachera publiquement le contenu. Êtes-vous sûr de vouloir continuer ?`,
                                  onConfirm: doRun
                                });
                              }
                            }}
                          >
                            {busyId === r._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                            Traiter
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
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
              <AlertDialogAction 
                onClick={() => { confirmConfig.onConfirm(); setConfirmConfig(null); }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Confirmer l'action
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
