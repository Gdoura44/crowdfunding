import { useCallback, useEffect, useState } from "react";
import { notificationsApi } from "../api/notifications";
import { projectsApi } from "../api/projects";
import { extractApiError } from "../utils/apiError";
import { emitNotificationsChanged } from "../utils/notificationsEvents";
import { labelNotificationType } from "../utils/notificationLabels";
import {
  Bell, Clock, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Info, AlertTriangle, MessageSquare, HandCoins, CheckSquare, XCircle, ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Map notification types to modern icons and colors
const getIconForType = (type) => {
  const t = String(type).toUpperCase();
  if (t.includes("APPROVED") || t.includes("SUCCESS")) return <CheckSquare className="w-5 h-5 text-green-500" />;
  if (t.includes("REJECTED") || t.includes("FAILED")) return <XCircle className="w-5 h-5 text-destructive" />;
  if (t.includes("WARNING") || t.includes("REPORT")) return <AlertTriangle className="w-5 h-5 text-amber-500" />;
  if (t.includes("INVESTMENT") || t.includes("PAYOUT") || t.includes("PAYMENT")) return <HandCoins className="w-5 h-5 text-indigo-500" />;
  if (t.includes("COMMENT") || t.includes("MESSAGE")) return <MessageSquare className="w-5 h-5 text-blue-500" />;
  if (t.includes("AI") || t.includes("REVIEW")) return <ShieldCheck className="w-5 h-5 text-purple-500" />;
  return <Bell className="w-5 h-5 text-primary" />;
};

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [projectTitleCache, setProjectTitleCache] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [feedFilter, setFeedFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const enrichProjectTitles = useCallback(async (notifs) => {
    const missing = (notifs || []).filter((n) => {
      const isProject = String(n.relatedEntityType || "").toUpperCase() === "PROJECT";
      const id = String(n.relatedEntityId || "");
      if (!isProject || !id) return false;
      if (projectTitleCache[id]) return false;
      const t = String(n.title || "");
      if (t.includes("—")) return false;
      return true;
    });
    if (missing.length === 0) return;

    const pairs = await Promise.all(
      missing.map(async (n) => {
        const id = String(n.relatedEntityId || "");
        try {
          const { data } = await projectsApi.byId(id);
          const title = String(data?.project?.title || "").trim();
          return title ? [id, title] : null;
        } catch {
          return null;
        }
      })
    );
    const next = {};
    for (const p of pairs) {
      if (!p) continue;
      const [id, title] = p;
      next[id] = title;
    }
    if (Object.keys(next).length > 0) {
      setProjectTitleCache((prev) => ({ ...prev, ...next }));
    }
  }, [projectTitleCache]);

  const load = useCallback(async () => {
    const { data } = await notificationsApi.list({
      page,
      limit: 30,
      unreadOnly: feedFilter === "UNREAD" ? true : undefined,
    });
    const notifs = data.notifications || [];
    setItems(notifs);
    setHasMore(Boolean(data.hasMore));
    await enrichProjectTitles(notifs);
  }, [enrichProjectTitles, feedFilter, page]);

  useEffect(() => {
    let cancelled = false;
    setError("");
    setLoading(true);
    (async () => {
      try {
        await load();
      } catch (err) {
        if (!cancelled) {
          const out = extractApiError(err, "Impossible de charger.");
          setError(out.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function markRead(id) {
    try {
      await notificationsApi.markRead(id);
      emitNotificationsChanged();
      await load();
    } catch (err) {
      const out = extractApiError(err, "Action impossible.");
      setError(out.message);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-1">Notifications</h1>
          <p className="text-muted-foreground">Suivez l'activité de vos projets, paiements et messages importants.</p>
        </div>
        
        <div className="flex bg-muted/50 p-1 rounded-lg border border-border">
          <button
            onClick={() => { setFeedFilter("ALL"); setPage(1); }}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${feedFilter === "ALL" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            Toutes
          </button>
          <button
            onClick={() => { setFeedFilter("UNREAD"); setPage(1); }}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${feedFilter === "UNREAD" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            Non lues
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted-foreground font-medium">Chargement de vos messages…</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center border border-dashed border-border rounded-xl bg-muted/10">
          <div className="w-16 h-16 bg-primary/10 text-primary flex items-center justify-center rounded-full mb-4">
            <Bell className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">
            {feedFilter === "UNREAD" ? "Aucune notification non lue" : "Vous êtes à jour"}
          </h2>
          <p className="text-muted-foreground max-w-md">
            {feedFilter === "UNREAD"
              ? "Toutes vos notifications ont été lues."
              : "Quand une étape change (validation, publication, paiement…), un message apparaîtra ici."}
          </p>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="flex justify-between items-center bg-muted/30 p-3 rounded-lg border border-border">
            <span className="text-sm text-muted-foreground font-medium pl-2">
              Page {page} {hasMore && <span className="hidden sm:inline">· d’autres messages suivent</span>}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Précédent
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasMore}
                onClick={() => setPage((p) => p + 1)}
              >
                Suivant <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {items.map((n) => (
              <Card 
                key={n._id} 
                className={`overflow-hidden transition-colors border ${!n.read ? "bg-primary/5 border-primary/20 shadow-sm" : "bg-card border-border/50"}`}
              >
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row gap-4">
                  <div className="flex flex-1 gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${!n.read ? "bg-background shadow-sm border border-primary/20" : "bg-muted text-muted-foreground"}`}>
                      {getIconForType(n.type)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        {!n.read && <Badge variant="default" className="bg-primary hover:bg-primary text-xs">Nouveau</Badge>}
                        {labelNotificationType(n.type) && (
                          <Badge variant="secondary" className="text-xs font-medium text-muted-foreground border-border/50">
                            {labelNotificationType(n.type)}
                          </Badge>
                        )}
                      </div>
                      
                      <h3 className={`text-base font-semibold ${!n.read ? "text-foreground" : "text-foreground/90"}`}>
                        {n.title}
                      </h3>
                      <p className={`text-sm mt-1 mb-2 ${!n.read ? "text-muted-foreground" : "text-muted-foreground/80"}`}>
                        {n.message}
                      </p>
                      
                      {String(n.relatedEntityType || "").toUpperCase() === "PROJECT" &&
                        String(n.relatedEntityId || "") &&
                        projectTitleCache[String(n.relatedEntityId || "")] &&
                        !String(n.title || "").includes("—") && (
                          <div className="text-xs font-medium text-muted-foreground bg-muted/50 inline-flex items-center px-2 py-1 rounded mb-2">
                            Projet : <span className="ml-1 text-foreground">{projectTitleCache[String(n.relatedEntityId || "")]}</span>
                          </div>
                        )}
                        
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                        <Clock className="w-3.5 h-3.5" />
                        {n.createdAt ? new Date(n.createdAt).toLocaleString("fr-FR") : ""}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex sm:flex-col justify-end items-center sm:items-end flex-shrink-0 mt-2 sm:mt-0">
                    {!n.read && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-primary hover:text-primary hover:bg-primary/10 h-8 px-2"
                        onClick={() => markRead(n._id)}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        <span className="text-xs font-medium">Marquer lue</span>
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
