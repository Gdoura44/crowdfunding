import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usersApi } from "../api/users";
import { useAuth } from "../hooks/useAuth.js";
import { extractApiError } from "../utils/apiError";
import { PROJECT_CATEGORIES } from "../config/categories.js";
import { 
  UserCircle, Loader2, Save, Trash2, ShieldAlert, 
  AlertTriangle, CheckCircle2, Phone, User as UserIcon, ListFilter, Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

export default function Profile() {
  const navigate = useNavigate();
  const { refreshUser, user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState(null);

  const COUNTRIES = useMemo(
    () => [
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
    ],
    []
  );

  const callingCodeFor = useMemo(() => {
    return (iso2) => COUNTRIES.find((c) => c.iso2 === iso2)?.calling || "+";
  }, [COUNTRIES]);

  function normalizeDigits(s) {
    return String(s || "").replace(/[^\d]/g, "");
  }

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    cabinetName: "",
    phoneCountry: "TN",
    phoneNational: "",
    riskPreference: "MEDIUM",
    preferredCategories: [],
  });

  useEffect(() => {
    let cancelled = false;
    setError("");
    setMessage("");
    (async () => {
      try {
        const { data } = await usersApi.getProfile();
        const p = data.profile || {};
        if (!cancelled) {
          const rawFirst = String(p.firstName || "");
          const rawLast = String(p.lastName || "");
          const rawCabinet = String(p.cabinetName || "");
          const looksLikeRolePair =
            ["ADMIN", "USER"].includes(rawFirst.toUpperCase()) &&
            ["ADMIN", "USER"].includes(rawLast.toUpperCase());
          const country = String(p.phoneCountry || "TN").toUpperCase();
          const phone = String(p.phone || "");
          const calling = callingCodeFor(country);
          const national =
            phone.startsWith(calling) ? normalizeDigits(phone.slice(calling.length)) : normalizeDigits(phone);
          setForm({
            firstName: looksLikeRolePair ? "" : rawFirst,
            lastName: looksLikeRolePair ? "" : rawLast,
            cabinetName: rawCabinet,
            phoneCountry: country,
            phoneNational: national,
            riskPreference: p.riskPreference || "MEDIUM",
            preferredCategories: Array.isArray(p.preferredCategories) ? p.preferredCategories : [],
          });
        }
      } catch (err) {
        if (!cancelled) {
          const out = extractApiError(err, "Impossible de charger le profil.");
          setError(out.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [callingCodeFor, refreshUser]);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const preferredCategories =
        ["ADMIN", "EXPERT"].includes(user?.role)
          ? []
          : Array.isArray(form.preferredCategories)
            ? form.preferredCategories.filter(Boolean)
            : [];
      const calling = callingCodeFor(form.phoneCountry);
      const phoneE164 =
        form.phoneNational && normalizeDigits(form.phoneNational)
          ? `${calling}${normalizeDigits(form.phoneNational)}`
          : "";
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: phoneE164,
        ...(user?.role === "EXPERT" ? { cabinetName: form.cabinetName } : {}),
        ...(["ADMIN", "EXPERT"].includes(user?.role) ? {} : { riskPreference: form.riskPreference, preferredCategories }),
      };
      await usersApi.updateProfile(payload);
      await refreshUser();
      setMessage("Profil mis à jour avec succès.");
    } catch (err) {
      const out = extractApiError(err, "Mise à jour impossible.");
      setError(out.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setError("");
    setMessage("");
    try {
      await usersApi.deleteAccount();
      try { await logout(); } catch { /* ignore */ }
      navigate("/", { replace: true });
    } catch (err) {
      const out = extractApiError(err, "Suppression impossible.");
      setError(out.message);
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-muted-foreground font-medium">Chargement de votre profil…</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="border-b border-border/40 pb-6 mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2 flex items-center gap-3">
          <UserCircle className="w-8 h-8 text-primary" />
          Mon profil
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Ces informations nous aident à personnaliser votre expérience et à vous contacter si nécessaire.
        </p>
      </div>

      <Card className="p-6 md:p-8 border-border/50 shadow-sm">
        {message && (
          <div className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 p-4 rounded-xl flex items-center gap-3 shadow-sm mb-6">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">{message}</p>
          </div>
        )}
        
        {error && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-xl flex items-center gap-3 shadow-sm mb-6">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium whitespace-pre-line">{error}</p>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-8">
          
          {/* Identité */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2 border-b border-border/40 pb-2">
              <UserIcon className="w-5 h-5 text-muted-foreground" /> Identité
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {user?.role === "EXPERT" && (
                <div className="col-span-1 md:col-span-2 space-y-1.5">
                  <label className="text-sm font-semibold text-muted-foreground">Nom du Cabinet <span className="text-destructive font-bold">*</span></label>
                  <Input
                    value={form.cabinetName}
                    onChange={(e) => setForm({ ...form, cabinetName: e.target.value })}
                    placeholder="Nom de votre cabinet ou entreprise d'expertise"
                    required
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-muted-foreground">
                  {user?.role === "EXPERT" ? "Prénom du contact" : "Prénom"}
                </label>
                <Input
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  placeholder={user?.role === "EXPERT" ? "Prénom du contact" : "Votre prénom"}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-muted-foreground">
                  {user?.role === "EXPERT" ? "Nom du contact" : "Nom"}
                </label>
                <Input
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  placeholder={user?.role === "EXPERT" ? "Nom du contact" : "Votre nom de famille"}
                />
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2 border-b border-border/40 pb-2">
              <Phone className="w-5 h-5 text-muted-foreground" /> Contact
            </h3>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-muted-foreground">Téléphone</label>
              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  className="flex h-10 sm:w-1/3 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={form.phoneCountry}
                  onChange={(e) => setForm({ ...form, phoneCountry: e.target.value })}
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.iso2} value={c.iso2}>{c.name} ({c.calling})</option>
                  ))}
                </select>
                <div className="flex flex-1 items-center border border-input bg-background rounded-md px-3 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                  <span className="text-muted-foreground text-sm font-medium mr-2">{callingCodeFor(form.phoneCountry)}</span>
                  <input
                    className="flex-1 h-9 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
                    value={form.phoneNational}
                    onChange={(e) => setForm({ ...form, phoneNational: e.target.value })}
                    placeholder="Numéro de téléphone"
                    type="tel"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Préférences Investisseur (Non affiché pour les ADMINS et EXPERTS) */}
          {!["ADMIN", "EXPERT"].includes(user?.role) && (
            <div className="space-y-6 pt-2">
              <h3 className="text-lg font-semibold flex items-center gap-2 border-b border-border/40 pb-2">
                <ListFilter className="w-5 h-5 text-muted-foreground" /> Préférences d'Investissement
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Risque */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold flex items-center gap-1.5 text-muted-foreground">
                    <Shield className="w-4 h-4" /> Niveau de risque souhaité
                  </label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={form.riskPreference}
                    onChange={(e) => setForm({ ...form, riskPreference: e.target.value })}
                  >
                    <option value="LOW">Prudent (Faible risque)</option>
                    <option value="MEDIUM">Équilibré (Risque moyen)</option>
                    <option value="HIGH">Dynamique (Haut risque)</option>
                  </select>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Cette préférence permet à FinCollab de filtrer et de mettre en avant les projets qui correspondent à votre profil de risque.
                  </p>
                </div>

                {/* Catégories */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-muted-foreground">Catégories préférées</label>
                  <div className="border border-input bg-background rounded-md p-3 h-48 overflow-y-auto space-y-2">
                    {PROJECT_CATEGORIES.filter((c) => c !== "Autre").map((c) => {
                      const checked = form.preferredCategories.includes(c);
                      return (
                        <label key={c} className="flex items-center gap-2 cursor-pointer group hover:bg-muted/50 p-1 rounded-md transition-colors">
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary"
                            checked={checked}
                            onChange={(e) => {
                              const on = e.target.checked;
                              setForm((f) => {
                                const next = new Set(f.preferredCategories || []);
                                if (on) next.add(c);
                                else next.delete(c);
                                return { ...f, preferredCategories: Array.from(next) };
                              });
                            }}
                          />
                          <span className="text-sm text-foreground select-none">{c}</span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-muted-foreground">Choisissez de 2 à 5 catégories pour affiner vos recommandations.</p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-4 border-t border-border/40">
            <Button type="submit" disabled={saving} className="w-full sm:w-auto font-medium px-8 shadow-sm">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              {saving ? "Enregistrement…" : "Enregistrer les modifications"}
            </Button>
          </div>
        </form>

        {/* Delete Account Zone (Non affiché pour ADMINS) */}
        {user?.role !== "ADMIN" && (
          <div className="mt-12 pt-6 border-t border-border">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-destructive/5 border border-destructive/20 rounded-xl p-5">
              <div>
                <h3 className="text-destructive font-bold flex items-center gap-2 mb-1">
                  <ShieldAlert className="w-5 h-5" />
                  Zone Dangereuse
                </h3>
                <p className="text-sm text-destructive/80 max-w-xl">
                  Demander la suppression de votre compte. Cette action anonymisera vos données. Elle sera bloquée si vous avez des opérations financières en cours.
                </p>
              </div>
              <Button 
                variant="destructive" 
                className="shrink-0 shadow-sm"
                disabled={deleting}
                onClick={() => {
                  setConfirmConfig({
                    title: "Supprimer définitivement votre compte ?",
                    message: "Cette action est irréversible. Toutes vos données personnelles seront anonymisées. Les opérations financières en cours peuvent empêcher cette suppression.",
                    onConfirm: handleDeleteAccount
                  });
                }}
              >
                {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                {deleting ? "Suppression…" : "Supprimer mon compte"}
              </Button>
            </div>
          </div>
        )}
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
                Confirmer la suppression
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
