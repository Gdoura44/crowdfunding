import { useEffect, useState } from "react";
import { adminApi } from "../api/admin";
import { useAuth } from "../hooks/useAuth";
import { extractApiError } from "../utils/apiError";
import { 
  MailWarning, Loader2, AlertTriangle, 
  RefreshCw, CheckCircle2, MailCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AdminEmailFailures() {
  const { user } = useAuth();
  const [failed, setFailed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [ok, setOk] = useState("");

  const canAccess = user?.role === "ADMIN";

  useEffect(() => {
    if (!canAccess) return;
    let cancelled = false;
    setError("");
    setLoading(true);
    (async () => {
      try {
        const { data } = await adminApi.listFailedNotifications({ resolved: false, limit: 80 });
        if (!cancelled) setFailed(data.failedNotifications || []);
      } catch (e) {
        if (!cancelled) setError(extractApiError(e, "Impossible de charger les échecs d'e-mails.").message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [canAccess]);

  if (!canAccess) {
    return (
      <div className="max-w-2xl mx-auto mt-12 text-center p-8 bg-amber-50 rounded-2xl border border-amber-200">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-amber-800 mb-2">Accès réservé</h2>
        <p className="text-amber-700">Cette section est strictement réservée aux administrateurs techniques.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="border-b border-border/40 pb-6 mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2 flex items-center gap-3">
            <MailWarning className="w-8 h-8 text-primary" />
            Échecs d'envoi d'E-mails
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Surveillez les événements de notification échoués et relancez les envois manuellement ligne par ligne.
          </p>
        </div>
      </div>

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

      <Card className="border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-4">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-muted-foreground font-medium">Inspection de la file d'attente…</p>
            </div>
          ) : failed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
              <div className="w-16 h-16 bg-green-50 text-green-600 flex items-center justify-center rounded-full mb-4">
                <MailCheck className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">File d'attente propre</h2>
              <p className="text-muted-foreground max-w-md">Aucun échec d'envoi d'e-mail détecté pour le moment.</p>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground border-b border-border text-xs uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-5 py-4 w-40">Date / Heure</th>
                  <th className="px-5 py-4 w-32">Event ID</th>
                  <th className="px-5 py-4 w-32">Notif ID</th>
                  <th className="px-5 py-4">Erreur Technique</th>
                  <th className="px-5 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {failed.map((ev) => (
                  <tr key={ev._id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-4 text-xs text-muted-foreground whitespace-nowrap">
                      {ev.createdAt ? new Date(ev.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "medium" }) : "—"}
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant="secondary" className="font-mono text-[10px]">{String(ev._id).slice(-8)}</Badge>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant="outline" className="font-mono text-[10px] bg-background">{String(ev.payload?.notificationId || "—")}</Badge>
                    </td>
                    <td className="px-5 py-4">
                      <div className="bg-destructive/5 border border-destructive/10 text-destructive-foreground dark:text-red-400 p-2.5 rounded-lg text-xs leading-relaxed max-w-[420px] break-words">
                        {String(ev.error || "Raison inconnue")}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-primary border-primary/30 hover:bg-primary/10 hover:text-primary"
                        disabled={busyId === ev._id}
                        onClick={async () => {
                          setBusyId(ev._id);
                          setError("");
                          setOk("");
                          try {
                            await adminApi.retryNotification(ev._id);
                            setOk(`Événement ${String(ev._id).slice(-8)} relancé avec succès.`);
                            const { data } = await adminApi.listFailedNotifications({ resolved: false, limit: 80 });
                            setFailed(data.failedNotifications || []);
                          } catch (e) {
                            setError(extractApiError(e, "Relance impossible.").message);
                          } finally {
                            setBusyId("");
                          }
                        }}
                      >
                        {busyId === ev._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                        {busyId === ev._id ? "Envoi…" : "Relancer"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}
