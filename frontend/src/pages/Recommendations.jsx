import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ProjectCard from "../components/project/ProjectCard.jsx";
import { recommendationsApi } from "../api/recommendations";
import { useAuth } from "../hooks/useAuth.js";
import { extractApiError } from "../utils/apiError";
import { Wand2, Loader2, AlertTriangle, Info, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Recommendations() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showPrefsDialog, setShowPrefsDialog] = useState(false);

  useEffect(() => {
    if (!user || user?.role === "ADMIN") return;
    const prefs = user?.profile?.preferredCategories || [];
    if (Array.isArray(prefs) && prefs.length > 0) return;
    const key = "fc:recommendations-prefs-prompted:v1";
    try {
      if (window.localStorage.getItem(key) === "1") return;
      window.localStorage.setItem(key, "1");
    } catch { /* ignore */ }
    setShowPrefsDialog(true);
  }, [user]);

  useEffect(() => {
    if (user?.role === "ADMIN") return;
    let cancelled = false;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const { data } = await recommendationsApi.list({ limit: 12 });
        if (!cancelled) setItems(data.projects || []);
      } catch (e) {
        if (!cancelled) setError(extractApiError(e, "Impossible de charger les recommandations.").message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <AlertDialog open={showPrefsDialog} onOpenChange={setShowPrefsDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Personnaliser vos recommandations ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les recommandations se basent sur vos catégories préférées et votre préférence de risque. Choisissez au moins une catégorie dans votre profil pour de meilleurs résultats.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Plus tard</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate("/profile")}>Aller au profil</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="border-b border-border/40 pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2 flex items-center gap-3">
            <Wand2 className="w-8 h-8 text-primary" />
            Recommandations
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Sélection de projets actifs adaptée à vos catégories préférées et votre profil de risque.
          </p>
        </div>
        <Button variant="outline" asChild><Link to="/projects">Explorer tout</Link></Button>
      </div>

      {user?.role === "ADMIN" && (
        <div className="bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 p-4 rounded-xl flex items-center gap-3 border border-blue-200">
          <Info className="w-5 h-5 shrink-0" />
          <p className="text-sm">Les comptes administrateur n'ont pas de recommandations personnelles.</p>
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted-foreground font-medium">Calcul des recommandations…</p>
        </div>
      ) : items.length === 0 && !error ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-primary/10 text-primary flex items-center justify-center rounded-full mb-4">
              <Sparkles className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Aucune recommandation</h2>
            <p className="text-muted-foreground max-w-md mb-6">
              Complétez votre profil avec des catégories préférées pour obtenir des suggestions personnalisées.
            </p>
            <div className="flex gap-3">
              <Button asChild variant="outline"><Link to="/profile">Compléter le profil</Link></Button>
              <Button asChild><Link to="/projects">Explorer les projets</Link></Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((p) => <ProjectCard key={p._id} project={p} />)}
        </div>
      )}
    </div>
  );
}
