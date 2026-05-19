import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { expertApi } from "../api/expert";
import { projectsApi } from "../api/projects";
import { extractApiError } from "../utils/apiError";
import { 
  Loader2, ArrowLeft, Building2, FileText, Bot, 
  ShieldCheck, CheckCircle2, XCircle, Lightbulb, 
  HelpCircle, AlertTriangle, Scale, FileOutput, Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

export default function ExpertProjectReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [decision, setDecision] = useState("");
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState("");
  const [submitErr, setSubmitErr] = useState("");

  const load = useCallback(async () => {
    const { data } = await projectsApi.byId(id);
    setProject(data.project);
  }, [id]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await load();
      } catch (err) {
        if (alive) setError(extractApiError(err, "Projet introuvable.").message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [load]);

  async function handleSubmit() {
    if (!decision) { setSubmitErr("Veuillez choisir une décision."); return; }
    if (decision === "REJECTED" && !feedback.trim()) {
      setSubmitErr("Un motif est obligatoire en cas de rejet.");
      return;
    }
    setSubmitting(true);
    setSubmitErr("");
    setSubmitMsg("");
    try {
      const { data } = await expertApi.validateProject(id, { decision, feedback });
      setSubmitMsg(data.message || "Décision enregistrée avec succès.");
      await load();
    } catch (err) {
      setSubmitErr(extractApiError(err, "Impossible d'enregistrer la décision.").message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-muted-foreground font-medium">Chargement du dossier…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto mt-12 text-center p-8 bg-destructive/5 rounded-2xl border border-destructive/20">
        <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
        <h2 className="text-xl font-bold text-destructive mb-2">Erreur</h2>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button variant="outline" asChild>
          <Link to="/expert/projects"><ArrowLeft className="w-4 h-4 mr-2" /> Retour aux dossiers</Link>
        </Button>
      </div>
    );
  }

  const ai = project?.aiAnalysis;
  const canDecide = project?.status === "UNDER_REVIEW" && project?.aiStatus === "COMPLETED" && ai;
  const alreadyDecided = !["UNDER_REVIEW"].includes(project?.status);

  const riskColor = ai?.riskLevel === "LOW" ? "bg-green-100 text-green-800 border-green-200" 
                  : ai?.riskLevel === "HIGH" ? "bg-red-100 text-red-800 border-red-200" 
                  : "bg-amber-100 text-amber-800 border-amber-200";

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-white flex items-center justify-center flex-shrink-0 shadow-lg">
          <FileText className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight">{project.title}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge variant="secondary" className="font-semibold uppercase tracking-wider">{project.status}</Badge>
            {ai?.riskLevel && (
              <Badge variant="outline" className={`font-semibold uppercase tracking-wider ${riskColor}`}>
                Risque {ai.riskLevel}
              </Badge>
            )}
            <span className="text-sm text-muted-foreground ml-2">Créé le {new Date(project.createdAt).toLocaleDateString("fr-FR")}</span>
          </div>
        </div>
        <Button variant="outline" asChild className="shrink-0">
          <Link to="/expert/projects">
            <ArrowLeft className="w-4 h-4 mr-2" /> Retour
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Project Info & Due Diligence */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="p-5 border-border/50 shadow-sm">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
              <Info className="w-4 h-4" /> Informations
            </h2>
            <div className="space-y-4">
              <div>
                <span className="text-xs text-muted-foreground block mb-0.5">Catégorie</span>
                <span className="font-semibold text-sm">{project.category || "—"}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block mb-0.5">Objectif</span>
                <span className="font-semibold text-sm text-primary">{Number(project.fundingGoal).toLocaleString("fr-FR")} TND</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block mb-0.5">Démarrage</span>
                <span className="font-semibold text-sm">{project.startAt ? new Date(project.startAt).toLocaleDateString("fr-FR") : "—"}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block mb-0.5">Échéance</span>
                <span className="font-semibold text-sm">{project.deadline ? new Date(project.deadline).toLocaleDateString("fr-FR") : "—"}</span>
              </div>
              <div className="pt-2 border-t border-border/50">
                <span className="text-xs text-muted-foreground block mb-1.5">Description</span>
                <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                  {project.description || "Aucune description."}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-5 border-border/50 shadow-sm">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> Diligence & Conformité
            </h2>
            
            {project.isCompany ? (
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 space-y-3 border border-border/50 mb-4">
                <div>
                  <span className="text-xs text-muted-foreground block mb-0.5">Raison Sociale</span>
                  <span className="font-semibold text-sm flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-muted-foreground" /> {project.companyName || "Non spécifié"}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block mb-0.5">Matricule Fiscal (MF)</span>
                  <span className="font-semibold text-sm">{project.companyMatricule || "Non renseigné"}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block mb-0.5">Registre National (RNE)</span>
                  <span className="font-semibold text-sm">{project.companyRNE || "Non renseigné"}</span>
                </div>
              </div>
            ) : (
              <div className="bg-blue-50/50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 rounded-lg p-3 text-xs leading-relaxed border border-blue-200 dark:border-blue-800/50 mb-4 flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
                <span>Ce projet est porté par une personne physique (particulier). Aucune structure légale d'entreprise n'est associée.</span>
              </div>
            )}

            <div>
              <span className="text-xs font-semibold block mb-2">Documents administratifs :</span>
              {project.documents && project.documents.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {project.documents.map((doc, idx) => {
                    const filename = doc.split("/").pop() || `document_${idx + 1}`;
                    return (
                      <a
                        key={idx}
                        href={doc}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2 rounded-md border border-border/60 hover:bg-muted transition-colors text-sm text-foreground group"
                      >
                        <FileOutput className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        <span className="truncate flex-1">{filename}</span>
                      </a>
                    );
                  })}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground italic block bg-muted/30 p-2 rounded-md border border-border/40 text-center">Aucun document justificatif téléversé.</span>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column: AI Report & Decision */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* AI Report Card */}
          <Card className="p-6 border-border/50 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
              <Bot className="w-32 h-32" />
            </div>
            
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2 mb-6">
              <Bot className="w-5 h-5 text-primary" /> Rapport d'analyse IA
            </h2>

            {ai ? (
              <div className="space-y-6 relative z-10">
                
                {/* AI Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-border/50 text-center">
                    <div className="text-3xl font-black text-primary mb-1">{ai.riskScore ?? "—"}<span className="text-lg text-muted-foreground font-medium">/100</span></div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Score Global</div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-border/50 text-center">
                    <div className={`text-2xl font-black mb-1 mt-1 ${ai.riskLevel === "LOW" ? "text-green-600" : ai.riskLevel === "HIGH" ? "text-red-600" : "text-amber-600"}`}>
                      {ai.riskLevel || "—"}
                    </div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Niveau Risque</div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-border/50 text-center">
                    <div className="text-3xl font-black text-blue-600 mb-1">{ai.successProbability != null ? `${ai.successProbability}%` : "—"}</div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Succès Estimé</div>
                  </div>
                </div>

                {/* Summary */}
                {ai.report?.summary && (
                  <div className="bg-muted/30 p-4 rounded-xl border border-border/40">
                    <h3 className="text-sm font-semibold mb-2">Résumé exécutif</h3>
                    <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{ai.report.summary}</p>
                  </div>
                )}

                {/* Report Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(ai.report?.advantages || []).length > 0 && (
                    <div className="bg-green-50/50 dark:bg-green-950/20 p-4 rounded-xl border border-green-100 dark:border-green-900/30">
                      <h4 className="font-semibold text-green-700 dark:text-green-400 mb-3 flex items-center gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4" /> Points forts
                      </h4>
                      <ul className="text-sm space-y-2 list-disc pl-4 text-green-900/80 dark:text-green-200/70 marker:text-green-500">
                        {ai.report.advantages.map((x, i) => <li key={i} className="pl-1">{x}</li>)}
                      </ul>
                    </div>
                  )}

                  {(ai.report?.disadvantages || []).length > 0 && (
                    <div className="bg-red-50/50 dark:bg-red-950/20 p-4 rounded-xl border border-red-100 dark:border-red-900/30">
                      <h4 className="font-semibold text-red-700 dark:text-red-400 mb-3 flex items-center gap-2 text-sm">
                        <XCircle className="w-4 h-4" /> Points faibles
                      </h4>
                      <ul className="text-sm space-y-2 list-disc pl-4 text-red-900/80 dark:text-red-200/70 marker:text-red-500">
                        {ai.report.disadvantages.map((x, i) => <li key={i} className="pl-1">{x}</li>)}
                      </ul>
                    </div>
                  )}

                  {(ai.report?.improvements || []).length > 0 && (
                    <div className="bg-amber-50/50 dark:bg-amber-950/20 p-4 rounded-xl border border-amber-100 dark:border-amber-900/30">
                      <h4 className="font-semibold text-amber-700 dark:text-amber-400 mb-3 flex items-center gap-2 text-sm">
                        <Lightbulb className="w-4 h-4" /> Améliorations suggérées
                      </h4>
                      <ul className="text-sm space-y-2 list-disc pl-4 text-amber-900/80 dark:text-amber-200/70 marker:text-amber-500">
                        {ai.report.improvements.map((x, i) => <li key={i} className="pl-1">{x}</li>)}
                      </ul>
                    </div>
                  )}

                  {(ai.report?.questionsToClarify || []).length > 0 && (
                    <div className="bg-blue-50/50 dark:bg-blue-950/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
                      <h4 className="font-semibold text-blue-700 dark:text-blue-400 mb-3 flex items-center gap-2 text-sm">
                        <HelpCircle className="w-4 h-4" /> Questions à clarifier
                      </h4>
                      <ul className="text-sm space-y-2 list-disc pl-4 text-blue-900/80 dark:text-blue-200/70 marker:text-blue-500">
                        {ai.report.questionsToClarify.map((x, i) => <li key={i} className="pl-1">{x}</li>)}
                      </ul>
                    </div>
                  )}
                </div>

                {ai.analyzedAt && (
                  <div className="text-xs text-muted-foreground/70 text-right">
                    Analysé le {new Date(ai.analyzedAt).toLocaleString("fr-FR")}
                    {ai.meta?.model && ` · Modèle : ${ai.meta.model}`}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 p-4 rounded-xl flex gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <p className="text-sm">L'analyse IA n'est pas encore disponible pour ce projet ou a échoué. Elle est indispensable avant de prendre une décision finale.</p>
              </div>
            )}
          </Card>

          {/* Decision Panel */}
          <Card className="p-6 border-border/50 shadow-sm border-t-4 border-t-primary">
            <h2 className="text-lg font-bold text-foreground mb-2 flex items-center gap-2">
              <Scale className="w-5 h-5 text-primary" /> Verdict Expert
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              En tant qu'expert financier, vous pouvez valider la faisabilité du projet ou le renvoyer pour correction. Si vous l'approuvez, l'administrateur sera notifié pour la mise en ligne finale.
            </p>

            {submitMsg && (
              <div className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 p-4 rounded-xl flex items-center gap-3 mb-6">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <p className="text-sm font-medium">{submitMsg}</p>
              </div>
            )}
            
            {submitErr && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-xl flex items-center gap-3 mb-6">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <p className="text-sm font-medium">{submitErr}</p>
              </div>
            )}

            {alreadyDecided && !submitMsg ? (
              <div className="bg-muted p-4 rounded-xl flex gap-3 text-muted-foreground">
                <Info className="w-5 h-5 shrink-0" />
                <p className="text-sm">Une décision a déjà été prise pour ce projet (Statut actuel : <strong className="text-foreground">{project.status}</strong>). Le panneau de décision est verrouillé.</p>
              </div>
            ) : canDecide ? (
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-sm font-semibold block">Votre Décision <span className="text-destructive">*</span></label>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${decision === "APPROVED" ? "border-green-500 bg-green-50 dark:bg-green-950/20" : "border-border hover:border-green-500/50"}`}>
                      <input 
                        type="radio" 
                        name="decision" 
                        value="APPROVED" 
                        checked={decision === "APPROVED"} 
                        onChange={(e) => setDecision(e.target.value)} 
                        disabled={submitting}
                        className="w-4 h-4 text-green-600 focus:ring-green-500"
                      />
                      <div className="flex items-center gap-2 text-green-700 dark:text-green-500 font-semibold text-sm">
                        <CheckCircle2 className="w-5 h-5" /> Approuver le projet
                      </div>
                    </label>

                    <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${decision === "REJECTED" ? "border-red-500 bg-red-50 dark:bg-red-950/20" : "border-border hover:border-red-500/50"}`}>
                      <input 
                        type="radio" 
                        name="decision" 
                        value="REJECTED" 
                        checked={decision === "REJECTED"} 
                        onChange={(e) => setDecision(e.target.value)} 
                        disabled={submitting}
                        className="w-4 h-4 text-red-600 focus:ring-red-500"
                      />
                      <div className="flex items-center gap-2 text-red-700 dark:text-red-500 font-semibold text-sm">
                        <XCircle className="w-5 h-5" /> Rejeter / Renvoyer
                      </div>
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold block">
                    Commentaires & Feedback {decision === "REJECTED" ? <span className="text-destructive">*</span> : <span className="text-muted-foreground font-normal">(optionnel)</span>}
                  </label>
                  <Textarea
                    rows={4}
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    disabled={submitting}
                    className="resize-y"
                    placeholder={
                      decision === "REJECTED"
                        ? "Veuillez expliquer au créateur ce qu'il manque au dossier ou ce qui doit être corrigé..."
                        : "Notes internes ou mots d'encouragement pour le créateur..."
                    }
                  />
                  {decision === "REJECTED" && <p className="text-xs text-muted-foreground">Ce retour sera directement envoyé par email au créateur.</p>}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border">
                  <Button 
                    onClick={handleSubmit} 
                    disabled={submitting || !decision} 
                    className={`sm:w-auto w-full ${decision === "APPROVED" ? "bg-green-600 hover:bg-green-700 text-white" : decision === "REJECTED" ? "bg-red-600 hover:bg-red-700 text-white" : ""}`}
                  >
                    {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enregistrement…</> : "Valider le verdict"}
                  </Button>
                  <Button variant="outline" asChild className="sm:w-auto w-full">
                    <Link to="/expert/projects">Ignorer pour le moment</Link>
                  </Button>
                </div>
              </div>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  );
}
