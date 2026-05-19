import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { projectsApi } from "../api/projects";
import { canCreatorDeleteProject } from "../utils/projectRules.js";
import { extractApiError } from "../utils/apiError";
import { PROJECT_CATEGORIES } from "../config/categories.js";
import { FUNDING_GOAL_MAX, PLATFORM_FEE_RATE } from "../config/businessRules.js";
import { 
  Lightbulb, Loader2, AlertTriangle, ChartPie, FileText, 
  Building2, Calendar, DollarSign, Wand2, Trash2, ArrowLeft 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

function addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function toDateInput(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function addDaysToDateInput(dateStr, days) {
  const base = dateStr ? new Date(dateStr) : new Date();
  if (Number.isNaN(base.getTime())) return "";
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

export default function ProjectEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [currentFunding, setCurrentFunding] = useState(0);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    realBudget: 20000,
    fundingGoal: 21053,
    startAt: "",
    deadline: "",
    isCompany: false,
    companyName: "",
    companyMatricule: "",
    companyRNE: "",
  });
  const [touched, setTouched] = useState({});
  const [confirmConfig, setConfirmConfig] = useState(null);

  const descTemplate = [
    "Résumé (2–3 lignes)",
    "- Le problème (pour qui, où) + la solution proposée + l’impact attendu.",
    "",
    "1) Problème & contexte",
    "- Contexte : qui est concerné, où, pourquoi c’est urgent.",
    "- Ce qui ne fonctionne pas aujourd’hui et pourquoi.",
    "",
    "2) Objectifs & indicateurs (SMART)",
    "- Objectif principal.",
    "- Indicateurs de succès.",
    "",
    "3) Solution & exécution",
    "- Ce que vous allez faire concrètement.",
    "- Équipe : rôles, expériences pertinentes.",
    "",
    "4) Plan d’action (jalons + calendrier)",
    "- Jalon 1 : …",
    "- Date de livraison : …",
    "",
    "5) Budget détaillé",
    "- Ligne 1 : … TND (justification)",
    "- Total : … TND",
    "",
    "6) Risques & atténuation (Vérifié par l'IA)",
    "- Risque 1 : … → Mesure : …",
  ].join("\n");

  useEffect(() => {
    let cancelled = false;
    setError("");
    (async () => {
      try {
        const { data } = await projectsApi.edit(id);
        const p = data.project;
        if (!cancelled) {
          setStatus(p.status || "");
          setCurrentFunding(Number(p.currentFunding || 0));
          
          const defaultStart = addDays(7);
          const minDurationDays = 31;

          setForm({
            title: p.title || "",
            description: p.description || "",
            category: p.category || "",
            realBudget: p.realBudget || Math.round((p.fundingGoal || 1000) * (1 - PLATFORM_FEE_RATE)),
            fundingGoal: p.fundingGoal || 1000,
            startAt: defaultStart,
            deadline: addDaysToDateInput(defaultStart, minDurationDays),
            isCompany: p.isCompany || false,
            companyName: p.companyName || "",
            companyMatricule: p.companyMatricule || "",
            companyRNE: p.companyRNE || "",
          });
        }
      } catch (err) {
        if (!cancelled) {
          const out = extractApiError(err, "Impossible de charger ce projet.");
          setError(out.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function onSubmit(e) {
    e.preventDefault();
    setTouched({ title: true, description: true, category: true, fundingGoal: true, startAt: true, deadline: true, companyName: true, companyMatricule: true, companyRNE: true });
    
    if (form.isCompany) {
      if (!String(form.companyName || "").trim()) {
        setError("Le nom de l'entreprise est obligatoire.");
        return;
      }
      if (!/^\d{7}\/[A-Z]\/[A-Z]\/\d{3}$/.test(form.companyMatricule)) {
        setError("Format du matricule fiscal invalide (Ex. 1675849/A/M/000).");
        return;
      }
      if (!/^\d{7}[A-Z]$/.test(form.companyRNE)) {
        setError("Format du RNE invalide (Ex. 1827463X).");
        return;
      }
    }

    setSaving(true);
    setError("");
    try {
      const payload = {
        title: form.title,
        description: form.description,
        category: form.category,
        realBudget: Number(form.realBudget || Math.round(form.fundingGoal * (1 - PLATFORM_FEE_RATE))),
        fundingGoal: Number(form.fundingGoal),
        startAt: new Date(form.startAt).toISOString(),
        deadline: new Date(form.deadline).toISOString(),
        isCompany: form.isCompany,
        companyName: form.isCompany ? form.companyName : "",
        companyMatricule: form.isCompany ? form.companyMatricule : "",
        companyRNE: form.isCompany ? form.companyRNE : "",
      };
      if (status === "REJECTED") {
        await projectsApi.resubmit(id, payload);
      } else {
        await projectsApi.update(id, payload);
      }
      navigate(`/projects/${id}`, {
        replace: true,
        state: { flash: { type: "success", message: "Projet mis à jour avec succès." } },
      });
    } catch (err) {
      const out = extractApiError(err, "Mise à jour impossible.");
      setError(out.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-muted-foreground font-medium">Chargement du projet…</p>
      </div>
    );
  }

  if (error && !form.title) {
    return (
      <div className="max-w-2xl mx-auto mt-12 text-center p-8 bg-destructive/5 rounded-2xl border border-destructive/20">
        <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
        <p className="text-lg font-bold text-destructive mb-4">{error}</p>
        <Button variant="outline" asChild>
          <Link to={`/projects/${id}`}><ArrowLeft className="w-4 h-4 mr-2" /> Retour au projet</Link>
        </Button>
      </div>
    );
  }

  const projectSnapshot = { status, currentFunding };
  const showDelete = canCreatorDeleteProject(projectSnapshot);
  const minDurationDays = 30;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="border-b border-border/40 pb-6 mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-4 text-muted-foreground hover:text-foreground">
          <Link to={`/projects/${id}`}><ArrowLeft className="w-4 h-4 mr-1.5" /> Retour</Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Modifier le projet</h1>
        <p className="text-muted-foreground max-w-2xl">
          Modification autorisée pour les brouillons, les projets en revue et les projets renvoyés après refus — tant que la campagne n’est pas publique.
        </p>
      </div>

      <div className="bg-slate-50 dark:bg-slate-900/40 text-slate-800 dark:text-slate-300 p-4 rounded-xl flex gap-3 border border-slate-200 dark:border-slate-800">
        <Lightbulb className="w-5 h-5 flex-shrink-0 text-amber-500 mt-0.5" />
        <div className="text-sm leading-relaxed">
          <strong>Important :</strong> FinCollab est une plateforme de <strong>soutien</strong> (don / contribution). Ce n’est <strong>pas</strong> un produit financier : aucun rendement n’est garanti.
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium whitespace-pre-line">{error}</p>
        </div>
      )}

      <Card className="p-6 md:p-8 border-border/50 shadow-sm">
        <form onSubmit={onSubmit} className="space-y-8">
          {/* Section 1: Informations */}
          <div className="space-y-5">
            <div className="flex items-center gap-2 border-b border-border/40 pb-2">
              <FileText className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Informations Générales</h2>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Titre du projet <span className="text-destructive">*</span></label>
              <Input
                required
                minLength={3}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-end">
                <label className="text-sm font-semibold">Description détaillée <span className="text-destructive">*</span></label>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-xs text-primary hover:bg-primary/10"
                  onClick={() => setForm(f => ({ ...f, description: f.description?.trim() ? f.description : descTemplate }))}
                >
                  <Wand2 className="w-3.5 h-3.5 mr-1" /> Insérer un modèle
                </Button>
              </div>
              <Textarea
                required
                rows={10}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="resize-y"
              />
              
              <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded-lg p-3 mt-2 text-xs text-blue-800 dark:text-blue-400">
                Gardez une description <strong>structurée</strong> (plan, budget, risques). Si votre projet a été <strong>refusé</strong>, une mise à jour relancera l’analyse IA automatiquement après la re-soumission. Un écart <strong>≥ 30%</strong> entre besoins et objectif entraîne un <strong>rejet automatique</strong>.
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Catégorie <span className="text-destructive">*</span></label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                required
              >
                <option value="" disabled>Choisir une catégorie…</option>
                {PROJECT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 2: Personne Morale */}
          <div className="bg-muted/30 border border-border/50 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-muted-foreground" />
                <label className="text-sm font-semibold cursor-pointer select-none" htmlFor="isCompanySwitch">
                  Ce projet est porté par une entreprise (Personne morale)
                </label>
              </div>
              <Switch 
                id="isCompanySwitch" 
                checked={form.isCompany} 
                onCheckedChange={(checked) => setForm({ ...form, isCompany: checked })} 
              />
            </div>
            
            {form.isCompany && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-border/40">
                <div className="col-span-1 md:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Nom de l'entreprise <span className="text-destructive font-bold">*</span></label>
                  <Input
                    placeholder="Ex. FinCollab Tech S.A."
                    value={form.companyName}
                    onBlur={() => setTouched((t) => ({ ...t, companyName: true }))}
                    onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                    className={touched.companyName && !String(form.companyName || "").trim() ? "border-destructive" : ""}
                    required={form.isCompany}
                  />
                  {touched.companyName && !String(form.companyName || "").trim() && <p className="text-[11px] text-destructive">Obligatoire.</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Matricule Fiscal <span className="text-destructive font-bold">*</span></label>
                  <Input
                    placeholder="Ex. 1675849/A/M/000"
                    value={form.companyMatricule}
                    onBlur={() => setTouched((t) => ({ ...t, companyMatricule: true }))}
                    onChange={(e) => setForm({ ...form, companyMatricule: e.target.value })}
                    className={touched.companyMatricule && (!String(form.companyMatricule || "").trim() || !/^\d{7}\/[A-Z]\/[A-Z]\/\d{3}$/.test(form.companyMatricule)) ? "border-destructive" : ""}
                    required={form.isCompany}
                  />
                  {touched.companyMatricule && !/^\d{7}\/[A-Z]\/[A-Z]\/\d{3}$/.test(form.companyMatricule) && <p className="text-[11px] text-destructive">Format invalide.</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Numéro RNE <span className="text-destructive font-bold">*</span></label>
                  <Input
                    placeholder="Ex. 1827463X"
                    value={form.companyRNE}
                    onBlur={() => setTouched((t) => ({ ...t, companyRNE: true }))}
                    onChange={(e) => setForm({ ...form, companyRNE: e.target.value })}
                    className={touched.companyRNE && (!String(form.companyRNE || "").trim() || !/^\d{7}[A-Z]$/.test(form.companyRNE)) ? "border-destructive" : ""}
                    required={form.isCompany}
                  />
                  {touched.companyRNE && !/^\d{7}[A-Z]$/.test(form.companyRNE) && <p className="text-[11px] text-destructive">Format invalide.</p>}
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Budget & Calendrier */}
          <div className="space-y-5">
            <div className="flex items-center gap-2 border-b border-border/40 pb-2">
              <DollarSign className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Budget & Calendrier</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Budget Selector */}
              <div className="col-span-1 md:col-span-2 space-y-3">
                <label className="text-sm font-semibold">Besoin Réel du Projet (TND) <span className="text-destructive">*</span></label>
                <div className="flex">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-r-none px-3"
                    onClick={() => {
                      const newReal = Math.max(1000, Number(form.realBudget || 0) - 1000);
                      setForm((f) => ({ ...f, realBudget: newReal, fundingGoal: Math.ceil(newReal / (1 - PLATFORM_FEE_RATE)) }));
                    }}
                  >−1000</Button>
                  <Input
                    type="number"
                    min={1000}
                    max={FUNDING_GOAL_MAX}
                    step={1000}
                    required
                    className="rounded-none font-medium text-center focus-visible:z-10"
                    value={form.realBudget || ""}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setForm({ ...form, realBudget: val, fundingGoal: Math.ceil(val / (1 - PLATFORM_FEE_RATE)) });
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-l-none px-3"
                    onClick={() => {
                      const newReal = Math.min(FUNDING_GOAL_MAX, Number(form.realBudget || 0) + 1000);
                      setForm((f) => ({ ...f, realBudget: newReal, fundingGoal: Math.ceil(newReal / (1 - PLATFORM_FEE_RATE)) }));
                    }}
                  >+1000</Button>
                </div>
                
                <input
                  type="range"
                  className="w-full accent-primary h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                  min={1000}
                  max={FUNDING_GOAL_MAX}
                  step={1000}
                  value={Number(form.realBudget || 0)}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setForm({ ...form, realBudget: val, fundingGoal: Math.ceil(val / (1 - PLATFORM_FEE_RATE)) });
                  }}
                />

                {/* Breakdown Box */}
                <div className="bg-slate-50 dark:bg-slate-900/50 border border-border rounded-xl p-4 mt-4">
                  <div className="text-sm font-semibold flex items-center gap-2 mb-3">
                    <ChartPie className="w-4 h-4 text-primary" />
                    Répartition Transparente
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Budget de Réalisation (Net) :</span>
                      <span className="font-medium text-foreground">{Number(form.realBudget || 0).toLocaleString("fr-FR")} TND</span>
                    </div>
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Commission (5% HT + TVA) :</span>
                      <span className="font-medium text-foreground">{Math.round(form.fundingGoal - form.realBudget).toLocaleString("fr-FR")} TND</span>
                    </div>
                    <div className="flex justify-between items-center font-bold text-base pt-2 border-t border-border mt-2">
                      <span>Objectif de Campagne Public :</span>
                      <span className="text-primary">{Number(form.fundingGoal || 0).toLocaleString("fr-FR")} TND</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-muted-foreground" /> Date de démarrage <span className="text-destructive font-bold">*</span>
                </label>
                <Input
                  type="date"
                  required
                  value={form.startAt}
                  onChange={(e) => {
                    const nextStart = e.target.value;
                    const minDeadline = addDaysToDateInput(nextStart, minDurationDays);
                    setForm((f) => {
                      const currentDeadline = String(f.deadline || "");
                      const shouldBump = currentDeadline && minDeadline ? currentDeadline < minDeadline : false;
                      return { ...f, startAt: nextStart, deadline: shouldBump ? minDeadline : currentDeadline };
                    });
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-muted-foreground" /> Échéance <span className="text-destructive font-bold">*</span>
                </label>
                <Input
                  type="date"
                  required
                  min={form.startAt ? addDaysToDateInput(form.startAt, minDurationDays) : undefined}
                  value={form.deadline}
                  onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                />
                <p className="text-[11px] text-muted-foreground">Durée minimale : 31 jours après démarrage.</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-border/40">
            <Button type="submit" disabled={saving} className="sm:w-auto w-full font-medium shadow-md">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {saving ? "Enregistrement…" : "Enregistrer les modifications"}
            </Button>
            <Button variant="outline" asChild className="sm:w-auto w-full">
              <Link to={`/projects/${id}`}>Annuler</Link>
            </Button>
          </div>
        </form>

        {/* Delete Zone */}
        {showDelete && (
          <div className="mt-10 pt-6 border-t border-border">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-destructive/5 border border-destructive/20 rounded-xl p-5">
              <div>
                <h3 className="text-destructive font-bold flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-5 h-5" />
                  Zone Sensible
                </h3>
                <p className="text-sm text-destructive/80">
                  Supprimer définitivement ce dossier. Possible uniquement avant la mise en ligne active et sans financement enregistré.
                </p>
              </div>
              <Button 
                variant="destructive" 
                className="flex-shrink-0"
                onClick={() => {
                  setConfirmConfig({
                    title: "Supprimer définitivement ce projet ?",
                    message: "Cette action est irréversible. Le projet sera définitivement supprimé de la base de données.",
                    isDanger: true,
                    confirmLabel: "Oui, supprimer",
                    onConfirm: async () => {
                      try {
                        await projectsApi.remove(id);
                        navigate("/dashboard", {
                          replace: true,
                          state: { refresh: Date.now() },
                        });
                      } catch (err) {
                        const out = extractApiError(err, "Suppression impossible.");
                        setError(out.message);
                      }
                    }
                  });
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" /> Supprimer le projet
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
