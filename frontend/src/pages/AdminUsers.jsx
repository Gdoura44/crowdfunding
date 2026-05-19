import { useEffect, useState } from "react";
import { adminApi } from "../api/admin";
import { useAuth } from "../hooks/useAuth";
import { extractApiError } from "../utils/apiError";
import { 
  Users, Loader2, AlertTriangle, CheckCircle2, 
  Shield, User, ShieldAlert, Ban, UserCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

function RoleBadge({ role }) {
  const map = {
    ADMIN: "bg-primary text-primary-foreground",
    EXPERT: "bg-slate-800 text-white",
    USER: "bg-slate-100 text-slate-700 border-slate-200",
  };
  const Icon = role === "ADMIN" ? ShieldAlert : role === "EXPERT" ? Shield : User;
  
  return (
    <Badge className={`${map[role] || map.USER} font-semibold flex w-fit items-center gap-1`}>
      <Icon className="w-3 h-3" />
      {role}
    </Badge>
  );
}

export default function AdminUsers() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [confirmConfig, setConfirmConfig] = useState(null);

  const canAccess = user?.role === "ADMIN";

  function sortUsers(users) {
    if (!Array.isArray(users)) return [];
    const roleWeight = { EXPERT: 1, USER: 2, ADMIN: 3 };
    return [...users].sort((a, b) => {
      const wA = roleWeight[a.role] || 4;
      const wB = roleWeight[b.role] || 4;
      if (wA !== wB) return wA - wB;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  }

  async function reload() {
    try {
      const { data } = await adminApi.listUsers({ limit: 60 });
      setItems(sortUsers(data.users || []));
    } catch (e) {
      // Background reload fail, just ignore or log
      console.error(e);
    }
  }

  useEffect(() => {
    if (!canAccess) return;
    let cancelled = false;
    setError("");
    setLoading(true);
    (async () => {
      try {
        const { data } = await adminApi.listUsers({ limit: 60 });
        if (!cancelled) setItems(sortUsers(data.users || []));
      } catch (e) {
        if (!cancelled) {
          const out = extractApiError(e, "Impossible de charger les utilisateurs.");
          setError(out.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [canAccess]);

  async function toggleStatus(u) {
    setBusyId(u._id);
    setError("");
    setOk("");
    try {
      if (!u.isActive) {
        await adminApi.reactivateUser(u._id);
        await reload();
        setOk("Utilisateur réactivé avec succès.");
      } else {
        await adminApi.setUserActive(u._id, { isActive: false });
        await reload();
        setOk("Utilisateur désactivé.");
      }
    } catch (e) {
      const out = extractApiError(e, "Action impossible.");
      setError(out.message);
    } finally {
      setBusyId(null);
    }
  }

  if (!canAccess) {
    return (
      <div className="max-w-2xl mx-auto mt-12 text-center p-8 bg-amber-50 rounded-2xl border border-amber-200">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-amber-800 mb-2">Accès réservé</h2>
        <p className="text-amber-700">Cette section est strictement réservée aux administrateurs.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="border-b border-border/40 pb-6 mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2 flex items-center gap-3">
          <Users className="w-8 h-8 text-primary" />
          Gestion des Utilisateurs
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Consultez et modérez les comptes enregistrés sur la plateforme.
        </p>
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
              <p className="text-muted-foreground font-medium">Chargement des comptes…</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
              <div className="w-16 h-16 bg-muted text-muted-foreground flex items-center justify-center rounded-full mb-4">
                <Users className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">Aucun utilisateur</h2>
              <p className="text-muted-foreground max-w-md">La base de données est vide.</p>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground border-b border-border text-xs uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-5 py-4">Utilisateur</th>
                  <th className="px-5 py-4">Rôle</th>
                  <th className="px-5 py-4">Statut</th>
                  <th className="px-5 py-4">Inscription</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {items.map((u) => {
                  const fullName = [u.profile?.firstName, u.profile?.lastName].filter(Boolean).join(" ");
                  return (
                    <tr key={u._id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-foreground">{fullName || "Non renseigné"}</div>
                        <div className="text-xs text-muted-foreground break-all">{u.email}</div>
                      </td>
                      <td className="px-5 py-4">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="px-5 py-4">
                        {u.isActive ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Actif</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Inactif</Badge>
                        )}
                      </td>
                      <td className="px-5 py-4 text-xs text-muted-foreground whitespace-nowrap">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString("fr-FR") : "—"}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {u.role !== "ADMIN" && (
                          <Button
                            size="sm"
                            variant={u.isActive ? "destructive" : "outline"}
                            className={!u.isActive ? "bg-green-50 hover:bg-green-100 text-green-700 border-green-200" : ""}
                            disabled={busyId === u._id}
                            onClick={() => {
                              if (!u.isActive) {
                                toggleStatus(u);
                              } else {
                                setConfirmConfig({
                                  title: "Désactiver cet utilisateur ?",
                                  message: "Il ne pourra plus se connecter ni effectuer d'actions sur la plateforme. Ses données seront toutefois conservées.",
                                  onConfirm: () => toggleStatus(u)
                                });
                              }
                            }}
                          >
                            {busyId === u._id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : !u.isActive ? (
                              <><UserCheck className="w-4 h-4 mr-2" /> Réactiver</>
                            ) : (
                              <><Ban className="w-4 h-4 mr-2" /> Désactiver</>
                            )}
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

      {/* Dynamic Confirmation Dialog */}
      {confirmConfig && (
        <AlertDialog open={!!confirmConfig} onOpenChange={(open) => !open && setConfirmConfig(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmConfig.title}</AlertDialogTitle>
              <AlertDialogDescription>{confirmConfig.message}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => { confirmConfig.onConfirm(); setConfirmConfig(null); }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Confirmer la désactivation
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
