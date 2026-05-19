import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { expertApi } from "../api/expert";
import { extractApiError } from "../utils/apiError";
import {
  Loader2, AlertTriangle, CheckCircle2, ClipboardList,
  TrendingUp, Target, CalendarClock, Bot, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ExpertProjects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await expertApi.listProjects({ limit: 50 });
        if (alive) setProjects(data.projects || []);
      } catch (err) {
        if (alive) setError(extractApiError(err, "Impossible de charger les projets.").message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="border-b border-border/40 pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2 flex items-center gap-3">
          <ClipboardList className="w-8 h-8 text-primary" />
          Dossiers à analyser
        </h1>
        <p className="text-muted-foreground">
          Projets en statut <strong>UNDER_REVIEW</strong> en attente de votre validation de l'analyse financière.
        </p>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted-foreground font-medium">Chargement des dossiers…</p>
        </div>
      ) : projects.length === 0 && !error ? (
        <Card className="border-dashed shadow-sm">
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="w-16 h-16 bg-green-50 text-green-600 flex items-center justify-center rounded-full mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">File d'attente vide</h2>
            <p className="text-muted-foreground max-w-md">
              Aucun projet n'est en attente de votre analyse pour le moment. Revenez plus tard.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {projects.map((p) => {
            const riskLevel = p.aiAnalysis?.riskLevel;
            const riskClass = riskLevel === "LOW"
              ? "bg-green-100 text-green-800 border-green-200"
              : riskLevel === "HIGH"
                ? "bg-red-100 text-red-800 border-red-200"
                : "bg-amber-100 text-amber-800 border-amber-200";
            const deadlinePassed = p.deadline && new Date(p.deadline) < new Date();

            return (
              <Card key={p._id} className="border-border/50 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                <div className="p-5">
                  {/* Top row: title + badges */}
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold text-foreground truncate">{p.title}</h2>
                      <span className="text-sm text-muted-foreground">{p.category || "Sans catégorie"}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <Badge variant="secondary" className="uppercase tracking-wider text-[10px]">UNDER_REVIEW</Badge>
                      {riskLevel && (
                        <Badge variant="outline" className={`uppercase tracking-wider text-[10px] ${riskClass}`}>
                          Risque {riskLevel}
                        </Badge>
                      )}
                      {deadlinePassed && (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px]">
                          Échéance dépassée
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <div className="bg-muted/40 rounded-lg p-3 text-center">
                      <Target className="w-4 h-4 text-primary mx-auto mb-1" />
                      <div className="font-bold text-sm text-foreground">
                        {Number(p.fundingGoal || 0).toLocaleString("fr-FR")} TND
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Objectif</div>
                    </div>
                    <div className="bg-muted/40 rounded-lg p-3 text-center">
                      <Bot className="w-4 h-4 text-primary mx-auto mb-1" />
                      <div className="font-bold text-sm text-foreground">
                        {p.aiAnalysis?.riskScore != null ? `${p.aiAnalysis.riskScore}/100` : "—"}
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Score IA</div>
                    </div>
                    <div className="bg-muted/40 rounded-lg p-3 text-center">
                      <TrendingUp className="w-4 h-4 text-primary mx-auto mb-1" />
                      <div className="font-bold text-sm text-foreground">
                        {p.aiAnalysis?.successProbability != null ? `${p.aiAnalysis.successProbability}%` : "—"}
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Prob. Succès</div>
                    </div>
                    <div className="bg-muted/40 rounded-lg p-3 text-center">
                      <CalendarClock className="w-4 h-4 text-primary mx-auto mb-1" />
                      <div className={`font-bold text-sm ${deadlinePassed ? "text-red-600" : "text-foreground"}`}>
                        {p.deadline ? new Date(p.deadline).toLocaleDateString("fr-FR") : "—"}
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Échéance</div>
                    </div>
                  </div>

                  {/* Summary preview */}
                  {p.aiAnalysis?.report?.summary && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2 leading-relaxed border-l-2 border-primary/30 pl-3">
                      {p.aiAnalysis.report.summary}
                    </p>
                  )}

                  {/* CTA */}
                  <Button
                    onClick={() => navigate(`/expert/projects/${p._id}/review`)}
                    className="w-full sm:w-auto"
                  >
                    Examiner le dossier
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
