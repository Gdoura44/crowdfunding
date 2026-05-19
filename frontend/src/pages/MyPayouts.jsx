import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { payoutsApi } from "../api/payouts";
import { invoiceApi } from "../api/invoice";
import { useAuth } from "../hooks/useAuth.js";
import { extractApiError } from "../utils/apiError";
import { Landmark, ArrowRight, FileText, Loader2, AlertTriangle, ExternalLink, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function StatusBadge({ status }) {
  const normalized = String(status).toUpperCase();
  
  if (normalized === "PENDING") {
    return <Badge variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200">En attente</Badge>;
  }
  if (normalized === "READY") {
    return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200">Prêt</Badge>;
  }
  if (normalized === "PROCESSING") {
    return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200">En traitement</Badge>;
  }
  if (normalized === "COMPLETED") {
    return <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200">Terminé</Badge>;
  }
  if (normalized === "FAILED") {
    return <Badge variant="destructive">Échoué</Badge>;
  }
  if (normalized === "CANCELLED") {
    return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200">Annulé</Badge>;
  }
  
  return <Badge variant="outline">{status}</Badge>;
}

export default function MyPayouts() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [invoices, setInvoices] = useState({}); // referenceId -> invoiceId

  useEffect(() => {
    if (user?.role === "ADMIN") return;
    let cancelled = false;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const { data } = await payoutsApi.mine({ limit: 50 });
        if (!cancelled) setItems(data.payouts || []);

        const invsRes = await invoiceApi.list({ limit: 50 });
        const map = {};
        (invsRes.data?.invoices || []).forEach(i => {
          map[i.referenceId] = i._id;
        });
        if (!cancelled) setInvoices(map);
      } catch (e) {
        if (!cancelled) {
          const out = extractApiError(e, "Impossible de charger vos paiements.");
          setError(out.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="border-b border-border/40 pb-6 mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Mes versements</h1>
        <p className="text-muted-foreground max-w-3xl">
          Quand un projet atteint son objectif, vous pouvez fournir vos coordonnées bancaires. Un administrateur validera ensuite le versement des fonds sur votre compte.
        </p>
      </div>

      {user?.role === "ADMIN" && (
        <div className="bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 p-4 rounded-xl flex items-center gap-3">
          <Info className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">Les comptes administrateurs n’ont pas d’espace créateur (versements personnels).</p>
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted-foreground font-medium">Chargement de vos versements…</p>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 px-4 text-center border border-dashed border-border rounded-xl bg-muted/10">
          <div className="w-16 h-16 bg-primary/10 text-primary flex items-center justify-center rounded-full mb-4">
            <Landmark className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Aucun versement</h2>
          <p className="text-muted-foreground max-w-md">
            Quand un de vos projets devient financé avec succès, un dossier de versement (payout) sera créé automatiquement ici.
          </p>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <Card className="border-border/50 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground border-b border-border text-xs uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-4">Projet associé</th>
                  <th className="px-6 py-4">Montant</th>
                  <th className="px-6 py-4">Statut</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {items.map((p) => (
                  <tr key={p._id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      {p.projectId && typeof p.projectId === "object" ? (
                        <div>
                          <div className="font-semibold text-foreground truncate max-w-[300px] md:max-w-[420px]" title={p.projectId.title}>
                            {p.projectId.title || String(p.projectId._id || "—")}
                          </div>
                          {p.projectId.status && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Statut du projet : <span className="font-medium">{p.projectId.status}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">{String(p.projectId || "—")}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-bold text-foreground">
                      {Number(p.amount).toLocaleString("fr-FR")} TND
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <div className="flex justify-end gap-2">
                        {invoices[p._id] && (
                          <Button variant="outline" size="sm" asChild className="h-8 bg-background">
                            <Link to={`/invoices/${invoices[p._id]}`}>
                              <FileText className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                              Facture
                            </Link>
                          </Button>
                        )}
                        <Button size="sm" asChild className="h-8">
                          <Link to={`/payouts/${p._id}`}>
                            Détails <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                          </Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
