import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { projectsApi } from "../api/projects";
import { useAuth } from "../hooks/useAuth.js";
import ProjectPreviewCard from "../components/project/ProjectPreviewCard.jsx";
import { FUNDING_GOAL_MAX, FUNDING_GOAL_MIN } from "../config/businessRules.js";
import { extractApiError } from "../utils/apiError.js";
import { PROJECT_CATEGORIES } from "../config/categories.js";
import { 
  Lightbulb, Loader2, AlertTriangle, ChartPie, FileText, 
  Building2, Calendar, DollarSign, Wand2 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function addDaysToDateInput(dateStr, days) {
  const base = dateStr ? new Date(dateStr) : new Date();
  if (Number.isNaN(base.getTime())) return addDays(days);
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

export default function ProjectNew() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const defaultStart = addDays(7);
  const minDurationDays = 30;
  
  const defaultForm = useMemo(() => ({
    title: "",
    description: "",
    category: "",
    realBudget: 9500,
    fundingGoal: 10000,
    startAt: defaultStart,
    deadline: addDaysToDateInput(defaultStart, minDurationDays),
    isCompany: false,
    companyName: "",
    companyMatricule: "",
    companyRNE: "",
  }), [defaultStart]);

  const [form, setForm] = useState(defaultForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({});

  const descMax = 5000;
  const descTemplate = [
    "Résumé (2–3 lignes)",
    "- Le problème + la solution proposée + l’impact attendu.",
    "",
    "1) Problème & contexte",
    "- Contexte : qui est concerné, où, pourquoi c’est urgent.",
    "- Ce qui ne fonctionne pas aujourd’hui et pourquoi.",
    "",
    "2) Objectifs & indicateurs (SMART)",
    "- Objectif principal.",
    "- Indicateurs de succès (chiffres, livrables).",
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

  const step = useMemo(() => {
    if (!form.title.trim() || !form.category.trim()) return 0;
    if (!form.startAt || !form.deadline || !form.fundingGoal) return 1;
    return 2;
  }, [form.title, form.category, form.startAt, form.deadline, form.fundingGoal]);

  const errors = useMemo(() => {
    const e = {};
    const title = String(form.title || "").trim();
    const category = String(form.category || "").trim();
    const goal = Number(form.fundingGoal || 0);
    const startAt = form.startAt ? new Date(form.startAt) : null;
    const deadline = form.deadline ? new Date(form.deadline) : null;

    if (title.length < 3) e.title = "Le titre doit contenir au moins 3 caractères.";
    if (!category) e.category = "Indiquez une catégorie.";
    if (!Number.isFinite(goal)) e.fundingGoal = "Montant invalide.";
    else if (goal < FUNDING_GOAL_MIN) e.fundingGoal = `Minimum ${FUNDING_GOAL_MIN.toLocaleString("fr-FR")} TND.`;
    else if (goal > FUNDING_GOAL_MAX) e.fundingGoal = `Maximum ${FUNDING_GOAL_MAX.toLocaleString("fr-FR")} TND.`;
    if (String(form.description || "").length > descMax) e.description = `Max ${descMax} caractères.`;
    
    const minStart = new Date(addDays(7));
    if (!startAt || Number.isNaN(startAt.getTime())) e.startAt = "Date requise.";
    else if (startAt < minStart) e.startAt = "Démarrage dans 7 jours minimum.";
    
    if (!deadline || Number.isNaN(deadline.getTime())) e.deadline = "Date requise.";
    else if (startAt && deadline <= startAt) e.deadline = "Doit être après le démarrage.";
    else if (startAt) {
      const min = new Date(startAt);
      min.setDate(min.getDate() + minDurationDays);
      if (deadline < min) e.deadline = "Durée minimale: 30 jours.";
    }
    
    if (form.isCompany) {
      if (!String(form.companyName || "").trim()) e.companyName = "Obligatoire.";
      const matricule = String(form.companyMatricule || "").trim();
      if (!matricule) e.companyMatricule = "Obligatoire.";
      else if (!/^\d{7}\/[A-Z]\/[A-Z]\/\d{3}$/.test(matricule)) e.companyMatricule = "Format (Ex. 1675849/A/M/000).";
      const rne = String(form.companyRNE || "").trim();
      if (!rne) e.companyRNE = "Obligatoire.";
      else if (!/^\d{7}[A-Z]$/.test(rne)) e.companyRNE = "Format (Ex. 1827463X).";
    }
    return e;
  }, [form]);

  const canSubmit = Object.keys(errors).length === 0;

  useEffect(() => {
    if (authLoading) return;
    if (user?.role === "ADMIN") navigate("/admin/projects", { replace: true });
  }, [authLoading, user, navigate]);

  async function onSubmit(e) {
    e.preventDefault();
    setTouched({ title: true, description: true, category: true, fundingGoal: true, startAt: true, deadline: true, companyName: true, companyMatricule: true, companyRNE: true });
    if (!canSubmit) return;
    
    setLoading(true);
    setError("");
    try {
      const payload = {
        ...form,
        fundingGoal: Number(form.fundingGoal),
        startAt: new Date(form.startAt).toISOString(),
        deadline: new Date(form.deadline).toISOString(),
      };
      const { data } = await projectsApi.create(payload);
      setForm(defaultForm);
      setTouched({});
      navigate(`/projects/${data.project._id}`, { replace: true });
    } catch (err) {
      const out = extractApiError(err, "Impossible de créer le projet.");
      const details = out.fieldMessages?.length > 0
        ? `\n- ${out.fieldMessages.map((e) => `${e.field}: ${e.message}`).join("\n- ")}`
        : "";
      setError(`${out.message}${details}`);
    } finally {
      setLoading(false);
    }
  }

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-muted-foreground font-medium">Préparation…</p>
      </div>
    );
  }

  if (user?.role === "ADMIN") return null;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      {/* Header & Stepper */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Nouveau projet</h1>
          <p className="text-muted-foreground max-w-2xl">
            Créez un <strong className="text-foreground">brouillon</strong>. Vous pourrez le modifier à tout moment avant la demande de publication. Le démarrage effectif nécessite un délai de 7 jours minimum.
          </p>
        </div>
        
        <div className="flex items-center gap-2 bg-muted/30 p-1.5 rounded-lg border border-border/50">
          <Badge variant={step >= 0 ? "default" : "outline"} className={step >= 0 ? "bg-primary" : "text-muted-foreground"}>1. Infos</Badge>
          <div className="w-4 h-[2px] bg-border"></div>
          <Badge variant={step >= 1 ? "default" : "outline"} className={step >= 1 ? "bg-primary" : "text-muted-foreground"}>2. Calendrier</Badge>
          <div className="w-4 h-[2px] bg-border"></div>
          <Badge variant={step >= 2 ? "default" : "outline"} className={step >= 2 ? "bg-primary" : "text-muted-foreground"}>3. Revue</Badge>
        </div>
      </div>

      {/* Guidance Banner */}
      <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded-xl p-5 flex gap-4">
        <Lightbulb className="w-6 h-6 text-blue-500 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-1">Rédaction & budget (Analyse IA)</h3>
          <p className="text-sm text-blue-800 dark:text-blue-400 leading-relaxed">
            L'analyse IA examine principalement votre <strong>description</strong>. Restez concret, chiffrez vos besoins. Si l'écart entre l'objectif visé et le budget détaillé dans le texte dépasse <strong>30%</strong>, le projet sera <strong>rejeté automatiquement</strong>.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Form Column */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="p-6 md:p-8 border-border/50 shadow-sm">
            {error && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-xl flex items-center gap-3 mb-6">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-medium whitespace-pre-line">{error}</p>
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-8">
              {/* Section 1: Informations */}
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-border/40 pb-2">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                    Informations Générales
                  </h2>
                  <Badge variant="secondary" className="bg-muted">Brouillon</Badge>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">Titre du projet <span className="text-destructive">*</span></label>
                  <Input
                    required
                    minLength={3}
                    placeholder="Ex. Ferme solaire pour une école"
                    value={form.title}
                    onBlur={() => setTouched((t) => ({ ...t, title: true }))}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className={touched.title && errors.title ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  {touched.title && errors.title && <p className="text-xs text-destructive font-medium">{errors.title}</p>}
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
                    rows={8}
                    placeholder="Expliquez le problème, la solution, le budget, et l’impact attendu..."
                    value={form.description}
                    maxLength={descMax}
                    onBlur={() => setTouched((t) => ({ ...t, description: true }))}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className={`resize-y ${touched.description && errors.description ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  />
                  <div className="flex justify-between items-start text-xs text-muted-foreground mt-1">
                    <p>Un projet bien structuré inspire confiance et facilite la validation par l'IA.</p>
                    <span className={String(form.description || "").length > descMax * 0.9 ? "text-amber-500 font-medium" : ""}>
                      {String(form.description || "").length}/{descMax}
                    </span>
                  </div>
                  {touched.description && errors.description && <p className="text-xs text-destructive font-medium">{errors.description}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">Catégorie <span className="text-destructive">*</span></label>
                  <select
                    className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${touched.category && errors.category ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    value={form.category}
                    onBlur={() => setTouched((t) => ({ ...t, category: true }))}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    required
                  >
                    <option value="" disabled>Choisir une catégorie…</option>
                    {PROJECT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  {touched.category && errors.category && <p className="text-xs text-destructive font-medium">{errors.category}</p>}
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
                      <label className="text-xs font-semibold text-muted-foreground">Nom de l'entreprise</label>
                      <Input
                        placeholder="Ex. FinCollab Tech S.A."
                        value={form.companyName}
                        onBlur={() => setTouched((t) => ({ ...t, companyName: true }))}
                        onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                        className={touched.companyName && errors.companyName ? "border-destructive" : ""}
                      />
                      {touched.companyName && errors.companyName && <p className="text-[11px] text-destructive">{errors.companyName}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Matricule Fiscal</label>
                      <Input
                        placeholder="Ex. 1675849/A/M/000"
                        value={form.companyMatricule}
                        onBlur={() => setTouched((t) => ({ ...t, companyMatricule: true }))}
                        onChange={(e) => setForm({ ...form, companyMatricule: e.target.value })}
                        className={touched.companyMatricule && errors.companyMatricule ? "border-destructive" : ""}
                      />
                      {touched.companyMatricule && errors.companyMatricule && <p className="text-[11px] text-destructive">{errors.companyMatricule}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Numéro RNE</label>
                      <Input
                        placeholder="Ex. 1827463X"
                        value={form.companyRNE}
                        onBlur={() => setTouched((t) => ({ ...t, companyRNE: true }))}
                        onChange={(e) => setForm({ ...form, companyRNE: e.target.value })}
                        className={touched.companyRNE && errors.companyRNE ? "border-destructive" : ""}
                      />
                      {touched.companyRNE && errors.companyRNE && <p className="text-[11px] text-destructive">{errors.companyRNE}</p>}
                    </div>
                  </div>
                )}
              </div>

              {/* Section 3: Budget & Calendrier */}
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-border/40 pb-2">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-muted-foreground" />
                    Budget & Calendrier
                  </h2>
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
                          const newReal = Math.max(950, Number(form.realBudget || 0) - 1000);
                          setForm((f) => ({ ...f, realBudget: newReal, fundingGoal: Math.ceil(newReal / 0.95) }));
                        }}
                      >−1000</Button>
                      <Input
                        type="number"
                        min={950}
                        max={950000}
                        step={1000}
                        required
                        className={`rounded-none font-medium text-center focus-visible:z-10 ${touched.realBudget && errors.fundingGoal ? "border-destructive" : ""}`}
                        value={form.realBudget || ""}
                        onBlur={() => setTouched((t) => ({ ...t, realBudget: true, fundingGoal: true }))}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setForm({ ...form, realBudget: val, fundingGoal: Math.ceil(val / 0.95) });
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-l-none px-3"
                        onClick={() => {
                          const newReal = Math.min(950000, Number(form.realBudget || 0) + 1000);
                          setForm((f) => ({ ...f, realBudget: newReal, fundingGoal: Math.ceil(newReal / 0.95) }));
                        }}
                      >+1000</Button>
                    </div>
                    {touched.realBudget && errors.fundingGoal && <p className="text-xs text-destructive font-medium">{errors.fundingGoal}</p>}
                    
                    <input
                      type="range"
                      className="w-full accent-primary h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                      min={950}
                      max={950000}
                      step={1000}
                      value={Number(form.realBudget || 0)}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setForm({ ...form, realBudget: val, fundingGoal: Math.ceil(val / 0.95) });
                      }}
                      onMouseUp={() => setTouched((t) => ({ ...t, realBudget: true, fundingGoal: true }))}
                      onTouchEnd={() => setTouched((t) => ({ ...t, realBudget: true, fundingGoal: true }))}
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
                      min={addDays(7)}
                      value={form.startAt}
                      onBlur={() => setTouched((t) => ({ ...t, startAt: true }))}
                      onChange={(e) => {
                        const nextStart = e.target.value;
                        const minDeadline = addDaysToDateInput(nextStart || addDays(7), minDurationDays);
                        setForm((f) => {
                          const currentDeadline = String(f.deadline || "");
                          const shouldBump = !currentDeadline || currentDeadline < minDeadline;
                          return { ...f, startAt: nextStart, deadline: shouldBump ? minDeadline : currentDeadline };
                        });
                      }}
                      className={touched.startAt && errors.startAt ? "border-destructive" : ""}
                    />
                    <p className="text-[11px] text-muted-foreground">Démarrage possible au plus tôt dans 7 jours.</p>
                    {touched.startAt && errors.startAt && <p className="text-xs text-destructive font-medium">{errors.startAt}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-muted-foreground" /> Date limite <span className="text-destructive font-bold">*</span>
                    </label>
                    <Input
                      type="date"
                      required
                      min={addDaysToDateInput(form.startAt || addDays(7), minDurationDays)}
                      value={form.deadline}
                      onBlur={() => setTouched((t) => ({ ...t, deadline: true }))}
                      onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                      className={touched.deadline && errors.deadline ? "border-destructive" : ""}
                    />
                    <p className="text-[11px] text-muted-foreground">Durée minimale : 30 jours après démarrage.</p>
                    {touched.deadline && errors.deadline && <p className="text-xs text-destructive font-medium">{errors.deadline}</p>}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-border/40">
                <Button type="submit" disabled={loading || !canSubmit} className="sm:w-auto w-full font-medium shadow-md">
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  {loading ? "Enregistrement…" : "Enregistrer le brouillon"}
                </Button>
                <Button variant="outline" asChild className="sm:w-auto w-full">
                  <Link to="/dashboard">Annuler</Link>
                </Button>
              </div>
            </form>
          </Card>
        </div>

        {/* Preview Column */}
        <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-4">
          <div className="bg-muted/50 rounded-xl p-1 mb-2 inline-flex items-center">
            <Badge variant="secondary" className="bg-background shadow-sm border-0 font-medium">Aperçu en direct</Badge>
          </div>
          
          {/* Reuse the existing ProjectPreviewCard component which receives the form state */}
          <div className="pointer-events-none opacity-90 transition-all hover:opacity-100 shadow-xl rounded-2xl overflow-hidden ring-1 ring-border/50">
            <ProjectPreviewCard
              title={form.title}
              description={form.description}
              category={form.category}
              fundingGoal={form.fundingGoal}
              startAt={form.startAt}
              deadline={form.deadline}
            />
          </div>
          <p className="text-xs text-center text-muted-foreground mt-4">
            Cet aperçu montre comment votre projet apparaîtra aux investisseurs dans le catalogue.
          </p>
        </div>
      </div>
    </div>
  );
}
