import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Clock, Tag } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}

function statusBadge(project) {
  const status = String(project?.status || "");
  if (project?.isArchived) {
    return { label: "Archivé", cls: "bg-muted text-muted-foreground" };
  }
  const map = {
    ACTIVE: { label: "Active", cls: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
    CLOSED: { label: "Clôturée", cls: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300" },
    FUNDED: { label: "Objectif atteint", cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
    SUSPENDED: { label: "Suspendue", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
    UNDER_REVIEW: { label: "En revue", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
    APPROVED: { label: "Approuvée (non publiée)", cls: "bg-primary/10 text-primary" },
    REJECTED: { label: "Rejetée", cls: "bg-destructive/10 text-destructive" },
    AWAITING_AI: { label: "Analyse en cours", cls: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
    DRAFT: { label: "Brouillon", cls: "bg-secondary text-secondary-foreground" },
  };
  return map[status] || { label: status || "—", cls: "bg-secondary text-secondary-foreground" };
}

export default function ProjectCard({ project }) {
  const location = useLocation();
  const goal = Number(project.fundingGoal || 0);
  const current = Number(project.currentFunding || 0);
  const pct = goal > 0 ? clamp((current / goal) * 100, 0, 100) : 0;
  const sb = statusBadge(project);

  return (
    <Card className="flex flex-col h-full overflow-hidden hover:shadow-md transition-shadow duration-200 border-border/50 group">
      <CardHeader className="p-5 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold transition-colors ${sb.cls}`}>
            {sb.label}
          </span>
          {project.aiAnalysis?.riskLevel && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-background text-muted-foreground">
              Risque : {project.aiAnalysis.riskLevel}
            </span>
          )}
        </div>
        <h3 className="text-lg font-semibold tracking-tight text-foreground line-clamp-2 group-hover:text-primary transition-colors">
          {project.title}
        </h3>
      </CardHeader>
      
      <CardContent className="flex-1 p-5 pt-0 flex flex-col">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground mb-4">
          <div className="flex items-center gap-1">
            <Tag className="h-3.5 w-3.5" />
            {project.category || "Sans catégorie"}
          </div>
          {project.deadline && (
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {new Date(project.deadline).toLocaleDateString("fr-FR")}
            </div>
          )}
        </div>
        
        <p className="text-sm text-muted-foreground line-clamp-3 mb-6 flex-1">
          {project.description || ""}
        </p>

        <div className="space-y-2 mt-auto">
          <div className="flex justify-between text-xs font-medium">
            <span className="text-foreground">
              {current.toLocaleString()} <span className="text-muted-foreground font-normal">/ {goal.toLocaleString()} TND</span>
            </span>
            <span className="text-primary">{Math.round(pct)}%</span>
          </div>
          <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </CardContent>

      <CardFooter className="p-5 pt-0 mt-auto">
        <Button asChild className="w-full group/btn" variant="default">
          <Link to={`/projects/${project._id}`} state={{ from: location }}>
            Voir la campagne
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

