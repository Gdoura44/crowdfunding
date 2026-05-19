import { useEffect, useState } from "react";
import { adminApi } from "../api/admin";
import { useAuth } from "../hooks/useAuth";
import { extractApiError } from "../utils/apiError";
import { Users, UserPlus, Loader2, AlertTriangle, CheckCircle2, Trash2, X, ShieldAlert, ShieldCheck } from "lucide-react";
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

const COUNTRIES = [
  { iso2: "TN", name: "Tunisie", calling: "+216" },
  { iso2: "FR", name: "France", calling: "+33" },
  { iso2: "DZ", name: "Algérie", calling: "+213" },
  { iso2: "MA", name: "Maroc", calling: "+212" },
  { iso2: "LY", name: "Libye", calling: "+218" },
  { iso2: "DE", name: "Allemagne", calling: "+49" },
  { iso2: "IT", name: "Italie", calling: "+39" },
  { iso2: "ES", name: "Espagne", calling: "+34" },
  { iso2: "GB", name: "Royaume-Uni", calling: "+44" },
  { iso2: "US", name: "États-Unis", calling: "+1" },
];

function normalizeDigits(s) {
  return String(s || "").replace(/[^\d]/g, "");
}

export default function AdminExperts() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busyId, setBusyId] = useState(null);

  // Form states for creating a new Expert
  const [showDrawer, setShowDrawer] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [cabinetName, setCabinetName] = useState("");
  const [phoneCountry, setPhoneCountry] = useState("TN");
  const [phoneNational, setPhoneNational] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formErr, setFormErr] = useState("");
  
  // Dialog state
  const [confirmConfig, setConfirmConfig] = useState(null);

  const canAccess = user?.role === "ADMIN";

  async function reload() {
    try {
      const { data } = await adminApi.listExperts();
      setItems(data.experts || []);
    } catch (e) {
      const out = extractApiError(e, "Impossible de recharger la liste des experts.");
      setError(out.message);
    }
  }

  useEffect(() => {
    if (!canAccess) return;
    let cancelled = false;
    setError("");
    setLoading(true);
    (async () => {
      try {
        const { data } = await adminApi.listExperts();
        if (!cancelled) setItems(data.experts || []);
      } catch (e) {
        if (!cancelled) {
          const out = extractApiError(e, "Impossible de charger la liste des experts.");
          setError(out.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canAccess]);

  async function handleAddExpert(e) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setFormErr("L'e-mail et le mot de passe sont requis.");
      return;
    }
    setSubmitting(true);
    setFormErr("");
    setOk("");
    setError("");
    try {
      const calling = COUNTRIES.find((c) => c.iso2 === phoneCountry)?.calling || "+";
      const fullPhone =
        phoneNational && normalizeDigits(phoneNational)
          ? `${calling}${normalizeDigits(phoneNational)}`
          : "";

      const { data } = await adminApi.createExpert({
        email,
        password,
        firstName,
        lastName,
        cabinetName,
        phone: fullPhone,
      });
      setOk(data.message || "Compte expert créé avec succès.");
      setShowDrawer(false);
      // Reset form
      setEmail("");
      setPassword("");
      setFirstName("");
      setLastName("");
      setCabinetName("");
      setPhoneCountry("TN");
      setPhoneNational("");
      await reload();
    } catch (err) {
      const out = extractApiError(err, "Impossible de créer le compte expert.");
      setFormErr(out.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!canAccess) {
    return (
      <div className="max-w-3xl mx-auto mt-12 text-center p-8 bg-destructive/5 rounded-2xl border border-destructive/20">
        <ShieldAlert className="w-12 h-12 text-destructive mx-auto mb-4" />
        <h2 className="text-xl font-bold text-destructive mb-2">Accès refusé</h2>
        <p className="text-muted-foreground">L'accès à cette page est strictement réservé aux administrateurs de la plateforme.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 relative">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/40 pb-6 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Gestion des Experts</h1>
          <p className="text-muted-foreground max-w-2xl">
            Gérez les comptes des cabinets d'audit et experts financiers habilités à valider les dossiers d'analyse.
          </p>
        </div>
        
        <Button onClick={() => { setShowDrawer(true); setFormErr(""); }} className="flex-shrink-0">
          <UserPlus className="w-4 h-4 mr-2" />
          Ajouter un Expert
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {ok && (
        <div className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 p-4 rounded-xl flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{ok}</p>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted-foreground font-medium">Chargement des experts…</p>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 px-4 text-center border border-dashed border-border rounded-xl bg-muted/10">
          <div className="w-16 h-16 bg-primary/10 text-primary flex items-center justify-center rounded-full mb-4">
            <Users className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Aucun expert enregistré</h2>
          <p className="text-muted-foreground max-w-md mb-6">
            Vous n'avez pas encore ajouté de compte expert sur la plateforme.
          </p>
          <Button onClick={() => { setShowDrawer(true); setFormErr(""); }} variant="outline">
            <UserPlus className="w-4 h-4 mr-2" /> Commencer par ajouter un expert
          </Button>
        </div>
      )}

      {!loading && items.length > 0 && (
        <Card className="border-border/50 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground border-b border-border text-xs uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-4">Cabinet</th>
                  <th className="px-6 py-4">Contact</th>
                  <th className="px-6 py-4">E-mail</th>
                  <th className="px-6 py-4">Téléphone</th>
                  <th className="px-6 py-4">Statut</th>
                  <th className="px-6 py-4">Créé le</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {items.map((u) => {
                  const contactName = [u.profile?.firstName, u.profile?.lastName].filter(Boolean).join(" ");
                  return (
                    <tr key={u._id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-semibold text-foreground">
                        {u.profile?.cabinetName || "—"}
                      </td>
                      <td className="px-6 py-4 font-medium text-muted-foreground">
                        <span className="capitalize">{contactName || "—"}</span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {u.email}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {u.profile?.phone || "—"}
                      </td>
                      <td className="px-6 py-4">
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200">
                          Actif
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString("fr-FR") : "—"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={busyId === u._id}
                          onClick={() => {
                            setConfirmConfig({
                              title: "Supprimer cet expert ?",
                              message: `Cette action supprimera définitivement l'accès du cabinet "${displayName || u.email}" à la plateforme de validation.`,
                              isDanger: true,
                              confirmLabel: "Supprimer",
                              onConfirm: async () => {
                                setBusyId(u._id);
                                setError("");
                                setOk("");
                                try {
                                  await adminApi.deleteExpert(u._id);
                                  await reload();
                                  setOk("Compte expert supprimé avec succès.");
                                } catch (e) {
                                  const out = extractApiError(e, "Impossible de supprimer cet expert.");
                                  setError(out.message);
                                } finally {
                                  setBusyId(null);
                                }
                              }
                            });
                          }}
                        >
                          {busyId === u._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tailwind Overlay Modal for adding a new Expert */}
      {showDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border shadow-2xl rounded-xl w-full max-w-lg flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center px-6 py-4 border-b border-border bg-muted/20">
              <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
                <UserPlus className="w-5 h-5 text-primary" />
                Nouveau Cabinet Expert
              </h3>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setShowDrawer(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <form onSubmit={handleAddExpert} className="flex flex-col">
              <div className="p-6 space-y-4">
                {formErr && (
                  <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    {formErr}
                  </div>
                )}

                <div>
                  <label className="text-sm font-semibold text-foreground mb-1.5 block" htmlFor="expert-email">
                    Adresse e-mail <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="email"
                    id="expert-email"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="cabinet@expert.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-foreground mb-1.5 block" htmlFor="expert-password">
                    Mot de passe temporaire <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="password"
                    id="expert-password"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-foreground mb-1.5 block" htmlFor="expert-cabinet">
                    Nom du Cabinet <span className="text-destructive font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    id="expert-cabinet"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Ex: Cabinet Audit Nord"
                    value={cabinetName}
                    onChange={(e) => setCabinetName(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-foreground mb-1.5 block" htmlFor="expert-fname">
                      Prénom du contact <span className="text-destructive font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      id="expert-fname"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="Ex: Hédi"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      disabled={submitting}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-foreground mb-1.5 block" htmlFor="expert-lname">
                      Nom du contact <span className="text-destructive font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      id="expert-lname"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="Ex: Ben Salah"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      disabled={submitting}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-foreground mb-1.5 block">
                    Téléphone
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select
                      className="flex h-10 w-full sm:w-1/3 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
                      value={phoneCountry}
                      onChange={(e) => setPhoneCountry(e.target.value)}
                      disabled={submitting}
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c.iso2} value={c.iso2}>
                          {c.name} ({c.calling})
                        </option>
                      ))}
                    </select>
                    <div className="flex h-10 w-full sm:w-2/3 rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 overflow-hidden transition-colors">
                      <span className="flex items-center px-3 bg-muted border-r border-input text-muted-foreground text-sm shrink-0">
                        {COUNTRIES.find((c) => c.iso2 === phoneCountry)?.calling || "+"}
                      </span>
                      <input
                        type="tel"
                        className="w-full bg-transparent px-3 py-2 text-sm focus:outline-none"
                        value={phoneNational}
                        onChange={(e) => setPhoneNational(e.target.value)}
                        placeholder="Numéro"
                        disabled={submitting}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end items-center gap-3 px-6 py-4 bg-muted/20 border-t border-border">
                <Button variant="outline" type="button" onClick={() => setShowDrawer(false)} disabled={submitting}>
                  Annuler
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Création…
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 mr-2" />
                      Créer le compte
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                className={confirmConfig.isDanger ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
              >
                {confirmConfig.confirmLabel || "Confirmer"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
