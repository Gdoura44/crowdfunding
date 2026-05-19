import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { projectsApi } from "../api/projects";
import ProjectCard from "../components/project/ProjectCard.jsx";
import { extractApiError } from "../utils/apiError";
import { PROJECT_CATEGORIES } from "../config/categories.js";
import {
  PenTool, Search, Filter, Info, ChevronLeft, ChevronRight, Loader2, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const RISK_LEVELS = ["LOW", "MEDIUM", "HIGH"];

export default function BrowseProjects() {
  const [qDraft, setQDraft] = useState("");
  const [categoryDraft, setCategoryDraft] = useState("");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [riskLevel, setRiskLevel] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [includeUpcoming, setIncludeUpcoming] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Debounce des champs texte pour éviter de recharger à chaque frappe.
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(qDraft);
      setCategory(categoryDraft);
    }, 400);
    return () => clearTimeout(t);
  }, [qDraft, categoryDraft]);

  // Revenir à la première page quand les filtres changent.
  useEffect(() => {
    setPage(1);
  }, [q, category, riskLevel, status, includeUpcoming]);

  const params = useMemo(() => {
    const p = { limit: 21, page };
    if (q.trim()) p.q = q.trim();
    if (category.trim()) p.category = category.trim();
    if (riskLevel) p.riskLevel = riskLevel;
    if (status) p.status = status;
    if (status === "ACTIVE") p.includeUpcoming = includeUpcoming ? "true" : "false";
    return p;
  }, [q, category, riskLevel, status, includeUpcoming, page]);

  async function load() {
    const { data } =
      params.q || params.category || params.riskLevel || params.status
        ? await projectsApi.search(params)
        : await projectsApi.public(params);
    setProjects(data.projects || []);
    setTotalPages(Number(data.totalPages || 1));
    setTotal(Number(data.total || 0));
  }

  useEffect(() => {
    let cancelled = false;
    setError("");
    setLoading(true);
    (async () => {
      try {
        await load();
      } catch (err) {
        if (!cancelled) {
          const out = extractApiError(err, "Impossible de charger les projets.");
          setError(out.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Découvrir des projets</h1>
          <p className="text-muted-foreground mt-1">
            Recherchez par mots-clés, filtrez par catégorie ou par niveau de risque.
          </p>
        </div>
        <Button asChild>
          <Link to="/register">
            <PenTool className="mr-2 h-4 w-4" />
            Lancer un projet
          </Link>
        </Button>
      </div>

      {/* FILTERS */}
      <Card className="shadow-sm border-border/50">
        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-5 space-y-2">
              <label className="text-sm font-medium leading-none">Recherche</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
                  placeholder="Titre, description…"
                  value={qDraft}
                  onChange={(e) => setQDraft(e.target.value)}
                />
              </div>
            </div>
            <div className="md:col-span-3 space-y-2">
              <label className="text-sm font-medium leading-none">Catégorie</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
                value={categoryDraft}
                onChange={(e) => setCategoryDraft(e.target.value)}
              >
                <option value="">Toutes</option>
                {PROJECT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium leading-none">Risque</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
                value={riskLevel}
                onChange={(e) => setRiskLevel(e.target.value)}
              >
                <option value="">Tous</option>
                {RISK_LEVELS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium leading-none">Statut</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="ACTIVE">Actifs</option>
                <option value="CLOSED">Clôturés</option>
              </select>
            </div>
          </div>

          {status === "ACTIVE" && (
            <div className="flex items-center space-x-2 mt-4">
              <input
                type="checkbox"
                id="includeUpcoming"
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                checked={includeUpcoming}
                onChange={(e) => setIncludeUpcoming(e.target.checked)}
              />
              <label htmlFor="includeUpcoming" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Inclure les campagnes à venir (date de démarrage future)
              </label>
            </div>
          )}

          <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-border">
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="h-4 w-4 shrink-0" />
              <span>Campagnes <strong>publiques</strong> et non archivées.</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Filter className="h-4 w-4 shrink-0" />
              <span>Filtre <strong>Statut</strong> : "Actifs" (campagnes en cours) ou "Clôturés" (terminées).</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* STATES & LIST */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
          <p>Chargement des campagnes…</p>
        </div>
      )}

      {error && (
        <div className="rounded-md bg-destructive/15 p-4 text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && projects.length === 0 && (
        <Card className="border-dashed shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Aucun résultat</h3>
            <p className="text-muted-foreground max-w-sm">
              Essayez d’élargir la recherche, de retirer un filtre ou de vérifier l’orthographe.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && projects.length > 0 && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
            <div>
              Page <strong className="text-foreground">{page}</strong> / <strong className="text-foreground">{totalPages}</strong>
              {Number.isFinite(total) && total > 0 ? <span> · {total} résultats</span> : null}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, Number(p || 1) - 1))}
                disabled={loading || page <= 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Précédent
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, Number(p || 1) + 1))}
                disabled={loading || page >= totalPages}
              >
                Suivant
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((p) => (
              <ProjectCard key={p._id} project={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

