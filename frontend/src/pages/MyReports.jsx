import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { reportsApi } from "../api/reports";
import { useAuth } from "../hooks/useAuth.js";
import { extractApiError } from "../utils/apiError";
import {
  Flag, Loader2, AlertTriangle, Info, ExternalLink, CheckCircle2, Clock, XCircle
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function StatusBadge({ status }) {
  const map = {
    PENDING: { cls: "bg-amber-100 text-amber-800 border-amber-200", icon: Clock },
    RESOLVED: { cls: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle2 },
    DISMISSED: { cls: "bg-slate-100 text-slate-600 border-slate-200", icon: XCircle },
  };
  const cfg = map[status] || { cls: "bg-slate-100 text-slate-600 border-slate-200", icon: Flag };
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={`${cfg.cls} text-[10px] uppercase tracking-wider font-semibold flex items-center gap-1 w-fit`}>
      <Icon className="w-3 h-3" /> {status || "—"}
    </Badge>
  );
}

export default function MyReports() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.role === "ADMIN") return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await reportsApi.mine({ limit: 50 });
        if (!cancelled) setItems(data.reports || []);
      } catch (e) {
        if (!cancelled) {
          const out = extractApiError(e, "Impossible de charger vos signalements.");
          setError(out.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="border-b border-border/40 pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2 flex items-center gap-3">
            <Flag className="w-8 h-8 text-primary" />
            Mes Signalements
          </h1>
          <p className="text-muted-foreground">
            Suivez l'état de vos signalements : en attente, traités, ou classés sans suite.
          </p>
        </div>
        <Button variant="outline" asChild className="shrink-0">
          <Link to="/projects">Explorer des projets</Link>
        </Button>
      </div>

      {user?.role === "ADMIN" && (
        <div className="bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 p-4 rounded-xl flex items-center gap-3 border border-blue-200 dark:border-blue-800">
          <Info className="w-5 h-5 shrink-0" />
          <p className="text-sm">Les comptes administrateur n'ont pas d'espace utilisateur pour les signalements.</p>
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
          <p className="text-muted-foreground font-medium">Chargement de vos signalements…</p>
        </div>
      ) : items.length === 0 && !error && user?.role !== "ADMIN" ? (
        <Card className="border-dashed shadow-sm">
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="w-16 h-16 bg-muted text-muted-foreground flex items-center justify-center rounded-full mb-4">
              <Flag className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Aucun signalement</h2>
            <p className="text-muted-foreground max-w-md">
              Si vous signalez un contenu depuis une fiche projet, vous pourrez suivre ici l'avancement du traitement.
            </p>
          </div>
        </Card>
      ) : items.length > 0 ? (
        <Card className="border-border/50 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground border-b border-border text-xs uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-5 py-4">Projet</th>
                  <th className="px-5 py-4">Type</th>
                  <th className="px-5 py-4">Statut</th>
                  <th className="px-5 py-4">Date</th>
                  <th className="px-5 py-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {items.map((r) => (
                  <tr key={r._id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-4 align-top">
                      <Link
                        to={`/projects/${r.projectId}`}
                        className="font-semibold text-primary hover:underline underline-offset-4 flex items-center gap-1"
                      >
                        Ouvrir <ExternalLink className="w-3 h-3" />
                      </Link>
                      <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        {String(r.projectId).slice(-8)}
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <Badge variant="outline" className="uppercase tracking-wider text-[10px]">
                        {r.type || "—"}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-5 py-4 align-top text-xs text-muted-foreground whitespace-nowrap">
                      {r.createdAt ? new Date(r.createdAt).toLocaleDateString("fr-FR", { dateStyle: "medium" }) : "—"}
                    </td>
                    <td className="px-5 py-4 align-top text-xs text-muted-foreground max-w-xs">
                      <div className="leading-relaxed line-clamp-3">
                        {r.resolution || r.description || "—"}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
