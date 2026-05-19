import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { canCreatorDeleteProject } from "../utils/projectRules.js";
import { useMyProjects } from "../hooks/useMyProjects.js";
import {
  FolderOpen, PlusCircle, Trash2, ChevronRight, Loader2, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const STATUS_VARIANT = {
  DRAFT: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  AWAITING_AI: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  UNDER_REVIEW: "bg-primary text-primary-foreground hover:bg-primary/90",
  APPROVED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  ACTIVE: "bg-green-500 text-white hover:bg-green-600",
  REJECTED: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  FUNDED: "bg-yellow-500 text-white hover:bg-yellow-600",
  CLOSED: "bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900",
  SUSPENDED: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
};

function StatusBadge({ status }) {
  const variantClass = STATUS_VARIANT[status] || "bg-secondary text-secondary-foreground";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold transition-colors ${variantClass}`}>
      {status}
    </span>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { projects, loading, error, deleteProject } = useMyProjects({
    enabled: user?.role !== "ADMIN",
  });

  useEffect(() => {
    if (user?.role === "ADMIN") {
      navigate("/admin/projects", { replace: true });
    }
  }, [user, navigate]);

  const handleDelete = async (projectId) => {
    try {
      await deleteProject(projectId);
      toast.success("Projet supprimé avec succès.");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Suppression impossible.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Mes projets</h1>
          <p className="text-muted-foreground mt-1">
            Brouillons, analyses, validations et campagnes publiées — ouvrez une fiche pour agir ou suivre l’étape en cours.
          </p>
        </div>
        {user?.role !== "ADMIN" && (
          <Button asChild>
            <Link to="/projects/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              Nouveau projet
            </Link>
          </Button>
        )}
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
          <p>Chargement de vos projets…</p>
        </div>
      )}

      {error && (
         <div className="rounded-md bg-destructive/15 p-4 text-sm text-destructive flex items-center gap-2">
           <AlertCircle className="h-5 w-5" />
           <p>{error}</p>
         </div>
      )}

      {!loading && !error && projects.length === 0 && (
        <Card className="border-dashed shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <FolderOpen className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Aucun projet pour l’instant</h3>
            <p className="text-muted-foreground max-w-sm mb-6">
              Créez un brouillon en quelques minutes : titre, description, objectif et dates. Vous pourrez le peaufiner avant toute soumission.
            </p>
            {user?.role !== "ADMIN" && (
              <Button asChild>
                <Link to="/projects/new">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Créer un premier brouillon
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {!loading && !error && projects.length > 0 && (
        <Card className="overflow-hidden shadow-sm">
          <div className="divide-y divide-border">
            {projects.map((p) => (
              <div
                key={p._id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-muted/50 transition-colors"
              >
                <Link
                  to={`/projects/${p._id}`}
                  className="flex-1 min-w-0 group"
                >
                  <span className="font-semibold text-foreground block group-hover:text-primary transition-colors truncate">
                    {p.title}
                  </span>
                  <span className="text-sm text-muted-foreground block truncate mt-0.5">
                    {p.category || "Sans catégorie"}
                  </span>
                </Link>

                <div className="flex items-center gap-3 shrink-0">
                  <StatusBadge status={p.status} />

                  {canCreatorDeleteProject(p) && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Supprimer {p.title}</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer ce projet ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {p.title} — action définitive. Cette action ne peut pas être annulée.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(p._id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}

                  <Button variant="outline" size="sm" asChild className="gap-1">
                    <Link to={`/projects/${p._id}`}>
                      Ouvrir
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
