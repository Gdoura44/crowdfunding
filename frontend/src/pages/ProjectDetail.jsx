import { useEffect, useState, useCallback } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { projectsApi } from "../api/projects";
import { investmentsApi } from "../api/investments";
import { reportsApi } from "../api/reports";
import { chatbotApi } from "../api/chatbot";
import { useAuth } from "../hooks/useAuth.js";
import { canCreatorDeleteProject } from "../utils/projectRules.js";
import { extractApiError } from "../utils/apiError";
import {
  Coins, Building2, Info, Flag, AlertTriangle, MessageSquare, Loader2,
  ShieldAlert, CheckCircle2, PenTool, Archive, Trash2, XCircle, Heart,
  Send, AlertCircle, Clock, Search, ExternalLink, ChevronLeft, HandCoins,
  BotMessageSquare, ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
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

export default function ProjectDetail() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, isExpert } = useAuth();
  
  const [project, setProject] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [error, setError] = useState("");
  const [submitMsg, setSubmitMsg] = useState("");
  const [submitErr, setSubmitErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  
  // Invest state
  const [investAmount, setInvestAmount] = useState(50);
  const [tipAmount, setTipAmount] = useState(2);
  const [customTip, setCustomTip] = useState("");
  const [investing, setInvesting] = useState(false);
  const [investErr, setInvestErr] = useState("");
  const [wantsExpert, setWantsExpert] = useState(false);
  
  // Other states
  const [autoRefreshing, setAutoRefreshing] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportType, setReportType] = useState("FRAUD");
  const [reportDesc, setReportDesc] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportOk, setReportOk] = useState("");
  const [reportErr, setReportErr] = useState("");
  
  // Chat state
  const [chatQ, setChatQ] = useState("");
  const [chatA, setChatA] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatErr, setChatErr] = useState("");
  const [chatMode, setChatMode] = useState("");
  
  // Comments state
  const [flash, setFlash] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentErr, setCommentErr] = useState("");
  const [commentOk, setCommentOk] = useState("");
  
  // Dialog state
  const [confirmConfig, setConfirmConfig] = useState(null);

  const load = useCallback(async () => {
    const { data } = await projectsApi.byId(id);
    setProject(data.project);
    setIsOwner(data.isOwner);
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    setError("");
    if (location?.state?.flash) {
      setFlash(location.state.flash);
      navigate(location.pathname, { replace: true, state: null });
    }
    (async () => {
      try {
        await load();
      } catch (err) {
        if (!cancelled) {
          const out = extractApiError(err, "Projet introuvable.");
          setError(out.message);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load, location?.state?.flash, location.pathname, navigate]);

  useEffect(() => {
    if (flash) {
      const timer = setTimeout(() => {
        setFlash(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [flash]);

  useEffect(() => {
    if (submitMsg) {
      const t = setTimeout(() => setSubmitMsg(""), 5000);
      return () => clearTimeout(t);
    }
  }, [submitMsg]);

  useEffect(() => {
    if (submitErr) {
      const t = setTimeout(() => setSubmitErr(""), 5000);
      return () => clearTimeout(t);
    }
  }, [submitErr]);

  useEffect(() => {
    if (commentOk) {
      const t = setTimeout(() => setCommentOk(""), 5000);
      return () => clearTimeout(t);
    }
  }, [commentOk]);

  useEffect(() => {
    if (commentErr) {
      const t = setTimeout(() => setCommentErr(""), 5000);
      return () => clearTimeout(t);
    }
  }, [commentErr]);

  useEffect(() => {
    if (!project) return;
    const goal = Number(project.fundingGoal || 0);
    const current = Number(project.currentFunding || 0);
    const remaining = Math.max(goal - current, 0);
    if (!Number.isFinite(remaining) || remaining <= 0) return;
    setInvestAmount((prev) => {
      const n = Number(prev);
      const min = 100;
      const fallback = Math.min(min, remaining);
      if (!Number.isFinite(n) || n < min) return fallback;
      return Math.min(n, remaining);
    });
  }, [project]);

  useEffect(() => {
    let alive = true;
    setCommentErr("");
    setCommentOk("");
    const isPublicStatus = ["ACTIVE", "FUNDED"].includes(String(project?.status));
    if (!project?._id || !isPublicStatus || project.isArchived) {
      setComments([]);
      return () => {
        alive = false;
      };
    }
    (async () => {
      try {
        const { data } = await projectsApi.listComments(project._id);
        if (alive) setComments(data.comments || []);
      } catch (e) {
        if (alive) {
          const out = extractApiError(e, "Impossible de charger les commentaires.");
          setCommentErr(out.message);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [project?._id, project?.status, project?.isArchived]);

  useEffect(() => {
    if (!project || !isOwner) {
      setAutoRefreshing(false);
      return;
    }
    const shouldPoll =
      project.status === "AWAITING_AI" &&
      ["PENDING", "FAILED"].includes(String(project.aiStatus || ""));
    if (!shouldPoll) {
      setAutoRefreshing(false);
      return;
    }
    setAutoRefreshing(true);
    let alive = true;
    let t = null;
    const tick = async () => {
      try {
        await load();
      } catch {
        // Ignore error
      } finally {
        if (alive) {
          t = setTimeout(tick, 4000);
        }
      }
    };
    t = setTimeout(tick, 2000);
    return () => {
      alive = false;
      if (t) clearTimeout(t);
    };
  }, [project, isOwner, load]);

  async function submitForAi() {
    setSubmitting(true);
    setSubmitErr("");
    setSubmitMsg("");
    try {
      const { data } = await projectsApi.submitForAi(id);
      setSubmitMsg(data.message || "Soumis.");
      await load();
    } catch (err) {
      const out = extractApiError(err, "Soumission impossible.");
      setSubmitErr(out.message);
    } finally {
      setSubmitting(false);
    }
  }

  // --- Early returns ---
  if (error) {
    return (
      <div className="max-w-3xl mx-auto mt-12 text-center space-y-6">
        <div className="mx-auto w-16 h-16 bg-destructive/10 text-destructive flex items-center justify-center rounded-full mb-4">
          <XCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Projet introuvable</h2>
        <p className="text-muted-foreground">{error}</p>
        <p className="text-sm text-muted-foreground">
          Les brouillons et projets non publiés ne sont visibles que par leur créateur.
        </p>
        <div className="flex justify-center gap-4 pt-4">
          <Button variant="outline" asChild>
            <Link to="/">Accueil</Link>
          </Button>
          {isAuthenticated ? (
            <Button asChild>
              <Link to="/dashboard">Mes projets</Link>
            </Button>
          ) : (
            <Button asChild>
              <Link to="/login" state={{ from: location }}>Connexion</Link>
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  const isPublicActive = project.status === "ACTIVE" && !project.isArchived;
  const showVisitorCta = !isAuthenticated && !isOwner && isPublicActive;
  const canEdit = isOwner && ["DRAFT", "UNDER_REVIEW", "REJECTED"].includes(project.status);
  const canArchive = isOwner && ["DRAFT", "AWAITING_AI", "UNDER_REVIEW", "REJECTED"].includes(project.status) && !project.isArchived;
  const canDelete = isOwner && canCreatorDeleteProject(project);
  const analysisInProgress = isOwner && project.status === "AWAITING_AI" && project.aiStatus === "PENDING";
  const analysisFailed = isOwner && project.status === "AWAITING_AI" && project.aiStatus === "FAILED";
  
  const queuedMinutes = (() => {
    const q = project?.aiQueuedAt ? new Date(project.aiQueuedAt) : null;
    if (!q || Number.isNaN(q.getTime())) return null;
    return Math.max(0, Math.floor((Date.now() - q.getTime()) / 60000));
  })();
  const aiLastErrorCode = String(project?.aiLastError || "").trim();
  const hasRetrySignal = Boolean(project?.aiNextRetryAt) || Number(project?.aiAutoRetryCount || 0) > 0 || ["AI_QUOTA_EXCEEDED", "AI_TEMPORARY_FAILURE"].includes(aiLastErrorCode);
  const likelyQuotaWait = analysisInProgress && hasRetrySignal && queuedMinutes != null && queuedMinutes >= 1;
  const queuedAtLabel = project?.aiQueuedAt ? new Date(project.aiQueuedAt).toLocaleString("fr-FR") : "";
  const nextRetryLabel = project?.aiNextRetryAt ? new Date(project.aiNextRetryAt).toLocaleString("fr-FR") : "";
  
  const canReport = isAuthenticated && !isOwner && !isExpert && !project.isArchived && ["ACTIVE", "CLOSED", "FUNDED"].includes(project.status);
  const showChat = !isExpert;
  const canInvest = !isOwner && isPublicActive && isAuthenticated && !isExpert;

  const confirmArchive = () => {
    setConfirmConfig({
      title: "Archiver ce projet ?",
      message: "Le projet ne sera plus affiché au public. Vous pourrez le conserver dans votre espace.",
      onConfirm: async () => {
        try {
          await projectsApi.archive(project._id);
          navigate(`/projects/${project._id}`, {
            replace: true,
            state: { flash: { type: "success", message: "Projet archivé." } },
          });
        } catch (err) {
          const out = extractApiError(err, "Archivage impossible.");
          navigate(`/projects/${project._id}`, {
            replace: true,
            state: { flash: { type: "error", message: out.message } },
          });
        }
      }
    });
  };

  const confirmDelete = () => {
    setConfirmConfig({
      title: "Supprimer ce projet ?",
      message: "Cette action est irréversible. La suppression est possible uniquement avant mise en ligne et sans financement.",
      isDanger: true,
      confirmLabel: "Supprimer",
      onConfirm: async () => {
        try {
          await projectsApi.remove(project._id);
          navigate("/dashboard", {
            replace: true,
            state: { flash: { type: "success", message: "Projet supprimé." } },
          });
        } catch (err) {
          const out = extractApiError(err, "Suppression impossible.");
          navigate(`/projects/${project._id}`, {
            replace: true,
            state: { flash: { type: "error", message: out.message } },
          });
        }
      }
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      {/* Return link */}
      <div>
        <Button variant="ghost" asChild className="text-muted-foreground hover:text-foreground">
          <Link to={isOwner ? "/dashboard" : "/projects"}>
            <ChevronLeft className="w-4 h-4 mr-2" />
            {isOwner ? "Retour au tableau de bord" : "Retour aux projets"}
          </Link>
        </Button>
      </div>

      {/* Visitor CTA */}
      {showVisitorCta && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <HandCoins className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">Campagne ouverte au public</h3>
                <p className="text-sm text-muted-foreground">Connectez-vous pour soutenir cette campagne.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button asChild variant="outline">
                <Link to="/register">Inscription</Link>
              </Button>
              <Button asChild>
                <Link to="/login" state={{ from: location }}>Connexion</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Owner Actions */}
      {(canEdit || canArchive || canDelete) && (
        <div className="flex flex-wrap gap-3">
          {canEdit && (
            <Button variant="outline" asChild>
              <Link to={`/projects/${project._id}/edit`}>
                <PenTool className="w-4 h-4 mr-2" /> Modifier
              </Link>
            </Button>
          )}
          {canArchive && (
            <Button variant="outline" onClick={confirmArchive}>
              <Archive className="w-4 h-4 mr-2" /> Archiver
            </Button>
          )}
          {canDelete && (
            <Button variant="destructive" onClick={confirmDelete}>
              <Trash2 className="w-4 h-4 mr-2" /> Supprimer
            </Button>
          )}
        </div>
      )}

      {isOwner && (
        <div className="bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 p-4 rounded-xl flex items-center gap-3">
          <Info className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">Vous êtes le <strong>créateur</strong> de ce projet.</p>
        </div>
      )}

      {flash && (
        <div className={`p-4 rounded-xl flex items-center gap-3 ${flash.type === "error" ? "bg-destructive/10 text-destructive" : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"}`}>
          {flash.type === "error" ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
          <p className="text-sm font-medium">{flash.message}</p>
        </div>
      )}

      {/* Main Grid layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column (Main details) */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border/50 shadow-sm overflow-hidden">
            <CardContent className="p-6 md:p-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{project.title}</h1>
                <span className="px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
                  {project.status}
                </span>
              </div>
              
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground mb-8">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/50">
                  <Flag className="w-4 h-4" /> {project.category || "Sans catégorie"}
                </div>
                {project.startAt && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/50">
                    <Clock className="w-4 h-4" /> Démarre : {new Date(project.startAt).toLocaleDateString("fr-FR")}
                  </div>
                )}
                {project.deadline && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/50">
                    <Clock className="w-4 h-4 text-primary" /> Échéance : {new Date(project.deadline).toLocaleDateString("fr-FR")}
                  </div>
                )}
              </div>

              {project.isCompany && (
                <div className="flex gap-4 p-5 rounded-xl border bg-primary/5 border-primary/10 mb-8">
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Porté par l'entreprise : <span className="text-primary">{project.companyName}</span></h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      <span className="font-medium">Matricule Fiscal:</span> {project.companyMatricule} &bull; <span className="font-medium">RNE:</span> {project.companyRNE}
                    </p>
                  </div>
                </div>
              )}

              <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {project.description || "Aucune description."}
              </div>

              {showChat && (
                <div className="mt-10 pt-8 border-t border-border">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white flex-shrink-0 shadow-sm">
                      <BotMessageSquare className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground mb-1">Posez une question à l'IA</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Posez une question courte sur le projet. Si le service IA est momentanément limité, une réponse simplifiée s’affichera.
                      </p>

                      {!isAuthenticated && (
                        <div className="p-4 rounded-lg bg-muted text-sm flex items-center justify-between gap-4 mb-4">
                          <span className="text-muted-foreground">Connectez-vous pour utiliser le chatbot.</span>
                          <Button size="sm" variant="outline" asChild>
                            <Link to="/login" state={{ from: location }}>Connexion</Link>
                          </Button>
                        </div>
                      )}

                      {chatErr && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md mb-3">{chatErr}</div>}
                      {chatMode === "fallback" && (
                        <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-md mb-3">Réponse simplifiée (service IA momentanément limité).</div>
                      )}
                      {chatA && (
                        <div className="p-4 rounded-lg bg-muted mb-4">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Réponse</h4>
                          <p className="text-sm text-foreground whitespace-pre-wrap">{chatA}</p>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <input
                          type="text"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          value={chatQ}
                          onChange={(e) => setChatQ(e.target.value)}
                          placeholder="Ex: Quels sont les risques d’annulation ?"
                          disabled={chatBusy || !isAuthenticated}
                          maxLength={800}
                        />
                        <Button 
                          disabled={chatBusy || !isAuthenticated || !chatQ.trim()}
                          onClick={async () => {
                            setChatBusy(true);
                            setChatErr("");
                            setChatA("");
                            setChatMode("");
                            try {
                              const { data } = await chatbotApi.askAboutProject(project._id, chatQ.trim());
                              setChatA(data?.answer || "—");
                              setChatMode(String(data?.mode || ""));
                              setChatQ("");
                            } catch (e) {
                              const out = extractApiError(e, "Impossible d’obtenir une réponse.");
                              setChatErr(out.message);
                            } finally {
                              setChatBusy(false);
                            }
                          }}
                        >
                          {chatBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Status / Approval / Rejection Warnings */}
          {analysisInProgress && (
            <Card className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-900">
              <CardContent className="p-6 flex gap-4">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-blue-900 dark:text-blue-300">{likelyQuotaWait ? "Analyse en attente (quota IA)" : "Analyse en cours"}</h3>
                  <p className="text-sm text-blue-800 dark:text-blue-400 mt-1">
                    {likelyQuotaWait ? "Le service IA est momentanément limité. La plateforme réessaie automatiquement." : "Votre projet est en cours d’analyse automatique. Vous serez notifié dès qu'elle est terminée."}
                  </p>
                  {autoRefreshing && <p className="text-xs text-blue-600 mt-2">Mise à jour automatique en cours…</p>}
                </div>
              </CardContent>
            </Card>
          )}

          {analysisFailed && (
            <Card className="bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-900">
              <CardContent className="p-6 flex gap-4">
                <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-amber-900 dark:text-amber-300">Analyse indisponible</h3>
                  <p className="text-sm text-amber-800 dark:text-amber-400 mt-1">
                    L’analyse automatique a échoué. Un administrateur prendra le relais. Aucune action n’est requise de votre part.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {isOwner && project.status === "REJECTED" && !project.isArchived && (
            <Card className="bg-destructive/10 border-destructive/20">
              <CardContent className="p-6 flex gap-4">
                <AlertTriangle className="w-6 h-6 text-destructive flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-destructive">Projet à corriger</h3>
                  <p className="text-sm text-destructive/90 mt-1">
                    {project.rejectionReason ? <><span className="font-medium">Raison:</span> {project.rejectionReason}</> : "Un administrateur a demandé des ajustements."} Modifiez le projet et renvoyez-le.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {isOwner && project.status === "DRAFT" && !project.isArchived && (
            <Card className="border-border/50">
              <CardContent className="p-6">
                <h3 className="font-bold text-foreground mb-4">Étape suivante</h3>
                <div className="bg-muted p-4 rounded-lg text-sm text-muted-foreground mb-4">
                  Après soumission, votre projet passe en <strong>analyse IA</strong>, puis en revue par l’administration avant publication.
                </div>
                {submitMsg && <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md mb-4">{submitMsg}</div>}
                {submitErr && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md mb-4">{submitErr}</div>}
                <Button onClick={submitForAi} disabled={submitting}>
                  {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Soumettre pour analyse
                </Button>
              </CardContent>
            </Card>
          )}

          {isOwner && project.status === "APPROVED" && !project.isArchived && (
            <Card className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-900">
              <CardContent className="p-6 flex gap-4">
                <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-green-900 dark:text-green-300">Projet approuvé</h3>
                  <p className="text-sm text-green-800 dark:text-green-400 mt-1">
                    Votre projet a été approuvé. Un administrateur va maintenant le publier pour l’ouvrir aux contributions.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI Analysis Results for Owner */}
          {isOwner && project.aiStatus === "COMPLETED" && project.aiAnalysis && (
            <Card className="border-border/50 bg-muted/20">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" /> Résultat de l'analyse IA
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-background border border-border">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Niveau de risque</p>
                    <p className="font-semibold text-foreground">{project.aiAnalysis.riskLevel || "—"}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-background border border-border">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Score de risque</p>
                    <p className="font-semibold text-foreground">{Number.isFinite(Number(project.aiAnalysis.riskScore)) ? `${Number(project.aiAnalysis.riskScore)}/100` : "—"}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-background border border-border">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Probabilité de succès</p>
                    <p className="font-semibold text-foreground">{Number.isFinite(Number(project.aiAnalysis.successProbability)) ? `${Number(project.aiAnalysis.successProbability)}%` : "—"}</p>
                  </div>
                </div>

                {project.aiAnalysis?.report?.summary && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2 text-foreground">Rapport (résumé)</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{project.aiAnalysis.report.summary}</p>
                  </div>
                )}

                {(project.aiAnalysis?.report?.improvements || []).length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2 text-foreground">À améliorer</h4>
                    <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                      {project.aiAnalysis.report.improvements.slice(0, 6).map((x, idx) => <li key={idx}>{x}</li>)}
                    </ul>
                  </div>
                )}
                
                {project.aiAnalysis.analyzedAt && (
                  <p className="text-xs text-muted-foreground">Analysé le {new Date(project.aiAnalysis.analyzedAt).toLocaleString("fr-FR")}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Comments Section */}
          {isPublicActive && (
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary" /> Commentaires
                </CardTitle>
                <p className="text-sm text-muted-foreground">Partagez un avis utile et respectueux. Pas d’informations sensibles.</p>
              </CardHeader>
              <CardContent>
                {commentErr && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md mb-4">{commentErr}</div>}
                {commentOk && <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md mb-4">{commentOk}</div>}

                {isAuthenticated && user?.role !== "ADMIN" ? (
                  <form className="mb-8" onSubmit={async (e) => {
                    e.preventDefault();
                    setCommentBusy(true);
                    setCommentErr("");
                    setCommentOk("");
                    try {
                      const { data } = await projectsApi.createComment(project._id, { content: commentText });
                      setCommentOk(data.message || "Commentaire publié.");
                      setCommentText("");
                      const { data: listData } = await projectsApi.listComments(project._id);
                      setComments(listData.comments || []);
                    } catch (e2) {
                      const out = extractApiError(e2, "Publication impossible.");
                      setCommentErr(out.message);
                    } finally {
                      setCommentBusy(false);
                    }
                  }}>
                    <textarea
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring mb-2"
                      maxLength={1000}
                      placeholder="Écrivez votre commentaire…"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                    />
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">{(commentText || "").length}/1000</span>
                      <Button size="sm" disabled={commentBusy || !commentText.trim()}>{commentBusy ? "Envoi…" : "Publier"}</Button>
                    </div>
                  </form>
                ) : (
                  <div className="bg-muted p-4 rounded-lg text-sm text-muted-foreground mb-8 text-center">
                    Connectez-vous pour publier un commentaire.
                  </div>
                )}

                <div className="space-y-4">
                  {comments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center italic py-4">Aucun commentaire pour le moment.</p>
                  ) : (
                    comments.slice(0, 20).map((c) => (
                      <div key={c._id} className="p-4 rounded-lg border border-border bg-card">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium text-sm text-foreground">{c.authorLabel || "Utilisateur"}</span>
                          <span className="text-xs text-muted-foreground">{c.createdAt ? new Date(c.createdAt).toLocaleString("fr-FR") : "—"}</span>
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{c.content}</p>
                        
                        {isAuthenticated && user?.role !== "ADMIN" && (
                          <div className="flex justify-end mt-3">
                            {(String(c.userId) === String(user?.id || user?._id)) ? (
                              <Button variant="ghost" size="sm" className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10" disabled={commentBusy} onClick={() => {
                                setConfirmConfig({
                                  title: "Supprimer votre commentaire ?",
                                  message: "Cette action est définitive.",
                                  isDanger: true,
                                  confirmLabel: "Supprimer",
                                  onConfirm: async () => {
                                    setCommentBusy(true);
                                    try {
                                      await projectsApi.deleteComment(project._id, c._id);
                                      setCommentOk("Commentaire supprimé.");
                                      const { data: listData } = await projectsApi.listComments(project._id);
                                      setComments(listData.comments || []);
                                    } catch (e2) {
                                      const out = extractApiError(e2, "Suppression impossible.");
                                      setCommentErr(out.message);
                                    } finally {
                                      setCommentBusy(false);
                                    }
                                  }
                                });
                              }}>
                                Supprimer
                              </Button>
                            ) : (
                              <Button variant="ghost" size="sm" className="h-8 text-muted-foreground" disabled={commentBusy} onClick={() => {
                                setConfirmConfig({
                                  title: "Signaler ce commentaire",
                                  message: "Un administrateur vérifiera le contenu signalé.",
                                  customUI: (close) => {
                                    let reason = "";
                                    return (
                                      <div className="p-6">
                                        <h3 className="text-lg font-semibold mb-2">Signaler ce commentaire</h3>
                                        <p className="text-sm text-muted-foreground mb-4">Indiquez brièvement la raison (obligatoire).</p>
                                        <textarea 
                                          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring mb-4"
                                          placeholder="Ex: insultes / contenu haineux / spam…"
                                          onChange={(e) => { reason = e.target.value; }}
                                        />
                                        <div className="flex justify-end gap-2">
                                          <Button variant="outline" onClick={close}>Annuler</Button>
                                          <Button variant="destructive" onClick={async () => {
                                            const r = String(reason || "").trim();
                                            if (!r) return;
                                            close();
                                            setCommentBusy(true);
                                            try {
                                              const { data } = await reportsApi.createComment({
                                                projectId: project._id,
                                                commentId: c._id,
                                                type: "INAPPROPRIATE_CONTENT",
                                                description: r,
                                              });
                                              setCommentOk(data.message || "Signalement envoyé.");
                                            } catch (e2) {
                                              const out = extractApiError(e2, "Signalement impossible.");
                                              setCommentErr(out.message);
                                            } finally {
                                              setCommentBusy(false);
                                            }
                                          }}>Envoyer</Button>
                                        </div>
                                      </div>
                                    )
                                  }
                                });
                              }}>
                                Signaler
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          )}

        </div>

        {/* Right column (Investment & Stats) */}
        <div className="space-y-6 lg:sticky lg:top-6 h-fit">
          <Card className="border-border/50 shadow-md">
            <CardHeader className="bg-primary/5 border-b border-border/50 pb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold text-muted-foreground">Objectif</span>
                <span className="text-lg font-bold text-foreground">{Number(project.fundingGoal || 0).toLocaleString("fr-FR")} TND</span>
              </div>
              <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden mb-2">
                <div 
                  className="bg-primary h-full transition-all duration-500 ease-out" 
                  style={{ width: `${Math.min(((Number(project.currentFunding || 0) / Number(project.fundingGoal || 1)) * 100), 100)}%` }}
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-2xl font-extrabold text-primary">{Number(project.currentFunding || 0).toLocaleString("fr-FR")} TND</span>
                <span className="text-sm font-medium text-primary">{Math.round((Number(project.currentFunding || 0) / Number(project.fundingGoal || 1)) * 100)}%</span>
              </div>
            </CardHeader>
            
            {project.realBudget && (
              <div className="p-4 bg-muted/30 border-b border-border/50 text-sm">
                <div className="flex items-center gap-1.5 font-semibold text-foreground mb-3">
                  <Info className="w-4 h-4 text-primary" /> Répartition du financement
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Net (Projet)</span>
                    <span className="font-medium text-foreground">{Number(project.realBudget).toLocaleString("fr-FR")} TND</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Frais (5%)</span>
                    <span className="font-medium text-foreground">{Math.round(project.fundingGoal - project.realBudget).toLocaleString("fr-FR")} TND</span>
                  </div>
                </div>
              </div>
            )}

            {canInvest ? (
              <CardContent className="p-6">
                <h3 className="font-bold flex items-center gap-2 mb-4 text-foreground">
                  <Coins className="w-5 h-5 text-primary" /> Soutenir ce projet
                </h3>
                
                {(() => {
                  const goal = Number(project?.fundingGoal || 0);
                  const current = Number(project?.currentFunding || 0);
                  const min = 100;
                  const remaining = Math.max(goal - current, 0);
                  const max = Math.max(remaining, 0);
                  const step = 100;
                  const safeValue = Math.min(Math.max(Number(investAmount || 0), min), Math.max(max, min));
                  const bump = (delta) => setInvestAmount((v) => Math.min(Math.max((Number.isFinite(Number(v)) ? Number(v) : 0) + delta, min), Math.max(max, min)));
                  const tooLowRemaining = Number.isFinite(remaining) && remaining > 0 && remaining < min;

                  const threshold = goal * 0.30;
                  const isEligible = Number(investAmount) >= threshold;

                  return (
                    <div className="space-y-6">
                      <div>
                        <label className="text-sm font-medium text-foreground mb-2 block">Montant (TND)</label>
                        <div className="flex items-center gap-2 mb-3">
                          <Button variant="outline" size="icon" onClick={() => bump(-step)} disabled={tooLowRemaining} className="flex-shrink-0">-</Button>
                          <input
                            type="number"
                            min={min}
                            max={Math.max(max, min)}
                            step={step}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-center font-semibold"
                            value={safeValue}
                            onChange={(e) => setInvestAmount(Number(e.target.value))}
                            disabled={tooLowRemaining}
                          />
                          <Button variant="outline" size="icon" onClick={() => bump(step)} disabled={tooLowRemaining} className="flex-shrink-0">+</Button>
                        </div>
                        <input
                          type="range"
                          className="w-full accent-primary"
                          min={min}
                          max={Math.max(max, min)}
                          step={step}
                          value={safeValue}
                          onChange={(e) => setInvestAmount(Number(e.target.value))}
                          disabled={tooLowRemaining}
                        />
                        <p className="text-xs text-muted-foreground mt-2">
                          {tooLowRemaining ? `Reste ${remaining} TND (min ${min} TND).` : `Ajustez par ${step} TND. Max: ${max} TND.`}
                        </p>
                      </div>

                      <div className="bg-muted p-3 rounded-lg border border-border">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="wantsExpertCheck"
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50"
                            checked={wantsExpert}
                            disabled={!isEligible}
                            onChange={(e) => setWantsExpert(e.target.checked)}
                          />
                          <label htmlFor="wantsExpertCheck" className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${isEligible ? "text-foreground" : "text-muted-foreground"}`}>
                            Demander un expert
                          </label>
                        </div>
                        <p className={`text-xs mt-2 ${isEligible ? "text-primary" : "text-muted-foreground"}`}>
                          {isEligible ? "Éligible ! Paiement mis en attente pour validation." : `Disponible dès ${threshold.toLocaleString("fr-FR")} TND (30%).`}
                        </p>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                          <Heart className="w-4 h-4 text-red-500" /> Pourboire FinCollab (Optionnel)
                        </label>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {[0, 1, 2, 5].map((val) => (
                            <button
                              key={val}
                              type="button"
                              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${tipAmount === val ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80 border border-border"}`}
                              onClick={() => { setTipAmount(val); setCustomTip(""); }}
                            >
                              {val === 0 ? "Aucun" : `+${val} TND`}
                            </button>
                          ))}
                          <button
                            type="button"
                            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${tipAmount === "custom" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80 border border-border"}`}
                            onClick={() => setTipAmount("custom")}
                          >
                            Autre
                          </button>
                        </div>
                        {tipAmount === "custom" && (
                          <div className="flex items-center gap-1.5 mt-2">
                            <Button 
                              type="button"
                              variant="outline" 
                              size="sm" 
                              className="h-8 w-8 p-0 flex-shrink-0 font-bold"
                              onClick={() => setCustomTip((v) => String(Math.max(0, (Number(v) || 0) - 1)))}
                            >
                              -
                            </Button>
                            <input
                              type="number"
                              min="0"
                              className="no-spin flex h-8 w-16 text-center rounded-md border border-input bg-background px-2 py-1 text-sm font-semibold focus-visible:outline-none"
                              value={customTip}
                              onChange={(e) => setCustomTip(e.target.value)}
                            />
                            <Button 
                              type="button"
                              variant="outline" 
                              size="sm" 
                              className="h-8 w-8 p-0 flex-shrink-0 font-bold"
                              onClick={() => setCustomTip((v) => String((Number(v) || 0) + 1))}
                            >
                              +
                            </Button>
                            <span className="h-8 px-2.5 flex items-center bg-muted border border-input rounded-md text-xs font-semibold text-muted-foreground">TND</span>
                          </div>
                        )}
                      </div>

                      <div className="pt-4 border-t border-border">
                        <div className="flex justify-between items-center mb-1 text-sm">
                          <span className="text-muted-foreground">Investissement</span>
                          <span className="font-medium text-foreground">{safeValue.toLocaleString("fr-FR")} TND</span>
                        </div>
                        {(tipAmount === "custom" ? Number(customTip || 0) : Number(tipAmount || 0)) > 0 && (
                          <div className="flex justify-between items-center mb-2 text-sm">
                            <span className="text-muted-foreground">Pourboire</span>
                            <span className="font-medium text-red-500">+{tipAmount === "custom" ? Number(customTip || 0) : Number(tipAmount || 0)} TND</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center mt-3 pt-3 border-t border-border">
                          <span className="font-bold text-foreground">Total à payer</span>
                          <span className="text-xl font-extrabold text-primary">
                            {(safeValue + (tipAmount === "custom" ? Number(customTip || 0) : Number(tipAmount || 0))).toLocaleString("fr-FR")} TND
                          </span>
                        </div>
                      </div>

                      <Button 
                        className="w-full font-bold text-base py-6 shadow-md"
                        disabled={investing || tooLowRemaining}
                        onClick={async () => {
                          setInvesting(true);
                          setInvestErr("");
                          try {
                            const amt = Number(investAmount);
                            if (!Number.isFinite(amt) || amt < 100) throw new Error("Montant invalide.");
                            const tipVal = tipAmount === "custom" ? Number(customTip || 0) : Number(tipAmount || 0);
                            if (Number.isNaN(tipVal) || tipVal < 0) throw new Error("Pourboire invalide.");
                            const { data } = await investmentsApi.create({ projectId: project._id, amount: amt, tipAmount: tipVal, wantsConsultation: wantsExpert });
                            navigate(data.paymentUrl);
                          } catch (err) {
                            const out = extractApiError(err, "Investissement impossible.");
                            setInvestErr(out.message);
                          } finally {
                            setInvesting(false);
                          }
                        }}
                      >
                        {investing ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : "Procéder au paiement"}
                      </Button>
                      {investErr && <div className="text-sm text-destructive mt-2 text-center">{investErr}</div>}
                    </div>
                  );
                })()}
              </CardContent>
            ) : (
              <CardContent className="p-6 bg-muted/30">
                <p className="text-sm text-muted-foreground text-center">
                  {!isPublicActive ? "Cette campagne n'est pas ouverte aux investissements pour le moment." : 
                   !isAuthenticated ? "Vous devez être connecté pour soutenir cette campagne." :
                   "Vous ne pouvez pas investir dans ce projet avec votre compte actuel."}
                </p>
              </CardContent>
            )}
          </Card>

          {/* Reporting */}
          {canReport && (
            <Card className="border-border/50">
              <CardContent className="p-4">
                {!showReport ? (
                  <Button variant="ghost" className="w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => setShowReport(true)}>
                    <Flag className="w-4 h-4 mr-2" /> Signaler ce projet
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold text-sm">Signalement</h3>
                      <Link to="/reports" className="text-xs text-primary hover:underline">Mes signalements</Link>
                    </div>
                    {reportOk && <div className="text-xs text-green-600 bg-green-50 p-2 rounded">{reportOk}</div>}
                    {reportErr && <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">{reportErr}</div>}
                    
                    <div>
                      <label className="text-xs font-medium mb-1 block text-muted-foreground">Type</label>
                      <select className="w-full text-sm border-input rounded-md bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring" value={reportType} onChange={(e) => setReportType(e.target.value)} disabled={reportBusy}>
                        <option value="FRAUD">Fraude</option>
                        <option value="INAPPROPRIATE_CONTENT">Contenu inapproprié</option>
                        <option value="SPAM">Spam</option>
                        <option value="OTHER">Autre</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1 block text-muted-foreground">Détails (optionnel)</label>
                      <textarea className="w-full text-sm border-input rounded-md bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring min-h-[60px]" placeholder="Précisions..." value={reportDesc} onChange={(e) => setReportDesc(e.target.value)} disabled={reportBusy} />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" className="flex-1" disabled={reportBusy} onClick={async () => {
                        setReportBusy(true); setReportOk(""); setReportErr("");
                        try {
                          await reportsApi.create({ projectId: project._id, type: reportType, description: reportDesc });
                          setReportOk("Signalement transmis."); setReportDesc(""); setShowReport(false);
                        } catch (e) {
                          setReportErr(extractApiError(e).message);
                        } finally {
                          setReportBusy(false);
                        }
                      }}>Envoyer</Button>
                      <Button size="sm" variant="outline" className="flex-1" disabled={reportBusy} onClick={() => setShowReport(false)}>Annuler</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

        </div>
      </div>

      {/* Dynamic Confirmation Dialog */}
      {confirmConfig && (
        <AlertDialog open={!!confirmConfig} onOpenChange={(open) => !open && setConfirmConfig(null)}>
          <AlertDialogContent>
            {confirmConfig.customUI ? (
              confirmConfig.customUI(() => setConfirmConfig(null))
            ) : (
              <>
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
              </>
            )}
          </AlertDialogContent>
        </AlertDialog>
      )}

    </div>
  );
}
