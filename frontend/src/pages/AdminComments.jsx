import { useEffect, useMemo, useState } from "react";
import { adminApi } from "../api/admin.js";
import { extractApiError } from "../utils/apiError.js";
import { 
  MessageSquare, Loader2, AlertTriangle, CheckCircle2, 
  Search, Filter, EyeOff, Eye, SearchX 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

export default function AdminComments() {
  const [projectId, setProjectId] = useState("");
  const [q, setQ] = useState("");
  const [includeHidden, setIncludeHidden] = useState(true);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busyId, setBusyId] = useState(null);
  
  // Custom dialog state for hiding comment with reason
  const [hideCommentId, setHideCommentId] = useState(null);
  const [hideReason, setHideReason] = useState("");

  const params = useMemo(() => {
    const p = { limit: 80, includeHidden: includeHidden ? "true" : "false" };
    if (projectId.trim()) p.projectId = projectId.trim();
    if (q.trim()) p.q = q.trim();
    return p;
  }, [projectId, q, includeHidden]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data } = await adminApi.listComments(params);
      setItems(data.comments || []);
    } catch (e) {
      const out = extractApiError(e, "Impossible de charger les commentaires.");
      setError(out.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  async function handleHide() {
    if (!hideCommentId) return;
    setBusyId(hideCommentId);
    setError("");
    setOk("");
    try {
      await adminApi.hideComment(hideCommentId, { reason: hideReason || "" });
      await load();
      setOk("Commentaire masqué avec succès.");
    } catch (e) {
      const out = extractApiError(e, "Action impossible.");
      setError(out.message);
    } finally {
      setBusyId(null);
      setHideCommentId(null);
      setHideReason("");
    }
  }

  async function handleUnhide(cId) {
    setBusyId(cId);
    setError("");
    setOk("");
    try {
      await adminApi.unhideComment(cId);
      await load();
      setOk("Commentaire rétabli.");
    } catch (e) {
      const out = extractApiError(e, "Action impossible.");
      setError(out.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="border-b border-border/40 pb-6 mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2 flex items-center gap-3">
          <MessageSquare className="w-8 h-8 text-primary" />
          Modération des commentaires
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Supervisez les échanges sur la plateforme. Masquer un commentaire le retire de l’espace public sans le supprimer définitivement.
        </p>
      </div>

      {/* Filters */}
      <Card className="p-5 border-border/50 shadow-sm bg-muted/20">
        <div className="flex items-center gap-2 mb-4 text-sm font-semibold text-foreground">
          <Filter className="w-4 h-4" /> Filtres de recherche
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-4 space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">ID du Projet (Optionnel)</label>
            <Input
              placeholder="Ex: 60d5ecb..."
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="bg-background"
            />
          </div>
          <div className="md:col-span-5 space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Recherche par mot-clé</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Chercher dans le contenu..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9 bg-background"
              />
            </div>
          </div>
          <div className="md:col-span-3 pb-2">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary"
                checked={includeHidden}
                onChange={(e) => setIncludeHidden(e.target.checked)}
              />
              <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                Inclure les masqués
              </span>
            </label>
          </div>
        </div>
      </Card>

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

      {/* Content */}
      <Card className="border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-4">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-muted-foreground font-medium">Recherche des commentaires…</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
              <div className="w-16 h-16 bg-muted text-muted-foreground flex items-center justify-center rounded-full mb-4">
                <SearchX className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">Aucun résultat</h2>
              <p className="text-muted-foreground max-w-md">Aucun commentaire ne correspond à vos filtres actuels.</p>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground border-b border-border text-xs uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-5 py-4 w-[20%]">Auteur & Projet</th>
                  <th className="px-5 py-4 w-[50%]">Contenu</th>
                  <th className="px-5 py-4">État</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {items.map((c) => {
                  const authorName = c.userId && typeof c.userId === "object"
                    ? [c.userId.profile?.firstName, c.userId.profile?.lastName].filter(Boolean).join(" ") || c.authorLabel || String(c.userId.email || "Utilisateur")
                    : c.authorLabel || "Utilisateur";

                  const projectTitle = c.projectId && typeof c.projectId === "object"
                    ? (c.projectId.title || String(c.projectId._id))
                    : String(c.projectId || "Projet Inconnu");

                  return (
                    <tr key={c._id} className={`transition-colors ${c.isHidden ? "bg-muted/20" : "hover:bg-muted/30"}`}>
                      <td className="px-5 py-4 align-top">
                        <div className="font-semibold text-foreground">{authorName}</div>
                        <div className="text-[11px] text-muted-foreground mt-1 mb-2">
                          {c.createdAt ? new Date(c.createdAt).toLocaleDateString("fr-FR", { hour: '2-digit', minute:'2-digit' }) : "—"}
                        </div>
                        <div className="text-xs border border-border/60 bg-muted/50 px-2 py-1 rounded inline-block truncate max-w-[150px]" title={projectTitle}>
                          {projectTitle}
                        </div>
                      </td>

                      <td className="px-5 py-4 align-top">
                        <div className={`text-sm whitespace-pre-wrap leading-relaxed ${c.isHidden ? "text-muted-foreground italic" : "text-foreground"}`}>
                          {c.content}
                        </div>
                        {c.isHidden && c.hiddenReason && (
                          <div className="mt-3 bg-destructive/10 text-destructive text-xs p-2 rounded border border-destructive/20 inline-block">
                            <strong>Motif du masquage :</strong> {c.hiddenReason}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4 align-top">
                        {c.isHidden ? (
                          <Badge variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200 flex w-fit items-center gap-1">
                            <EyeOff className="w-3 h-3" /> Masqué
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100 flex w-fit items-center gap-1">
                            <Eye className="w-3 h-3" /> Visible
                          </Badge>
                        )}
                      </td>

                      <td className="px-5 py-4 align-top text-right">
                        {!c.isHidden ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                            disabled={busyId === c._id}
                            onClick={() => {
                              setHideReason("");
                              setHideCommentId(c._id);
                            }}
                          >
                            {busyId === c._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <EyeOff className="w-4 h-4 mr-2" />}
                            Masquer
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-primary hover:bg-primary/10 hover:text-primary border-primary/30"
                            disabled={busyId === c._id}
                            onClick={() => handleUnhide(c._id)}
                          >
                            {busyId === c._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
                            Rétablir
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* Custom Hide Comment Dialog */}
      <AlertDialog open={!!hideCommentId} onOpenChange={(open) => !open && setHideCommentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Masquer ce commentaire ?</AlertDialogTitle>
            <AlertDialogDescription>
              Ce commentaire ne sera plus visible par le public. Vous pouvez optionnellement spécifier une raison qui sera conservée dans l'historique de modération.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <label className="text-sm font-semibold text-foreground mb-2 block">
              Raison du masquage (optionnel)
            </label>
            <Input
              placeholder="Ex: Contenu injurieux, hors-sujet..."
              value={hideReason}
              onChange={(e) => setHideReason(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleHide}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirmer le masquage
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
