import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { projectsApi } from "../api/projects";
import { useAuth } from "../hooks/useAuth.js";
import PageLoader from "../components/ui/PageLoader.jsx";
import Stepper from "../components/ui/Stepper.jsx";
import ProjectPreviewCard from "../components/project/ProjectPreviewCard.jsx";
import Guidance from "../components/ui/Guidance.jsx";
import Alert from "../components/ui/Alert.jsx";
import { FUNDING_GOAL_MAX, FUNDING_GOAL_MIN } from "../config/businessRules.js";
import { extractApiError } from "../utils/apiError.js";
import { PROJECT_CATEGORIES } from "../config/categories.js";

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

// Page création : guide l’utilisateur (dates/règles) et crée un brouillon avant soumission à l’analyse IA.
export default function ProjectNew() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const defaultStart = addDays(7);
  const minDurationDays = 30;
  const defaultForm = useMemo(
    () => ({
      title: "",
      description: "",
      category: "",
      fundingGoal: 10000,
      startAt: defaultStart,
      deadline: addDaysToDateInput(defaultStart, minDurationDays),
    }),
    [defaultStart]
  );
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    fundingGoal: 10000,
    startAt: defaultStart,
    deadline: addDaysToDateInput(defaultStart, minDurationDays),
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({});

  const descMax = 5000;
  const descTemplate = [
    "Résumé (2–3 lignes)",
    "- Le problème (pour qui, où) + la solution proposée + l’impact attendu.",
    "",
    "1) Problème & contexte",
    "- Contexte : qui est concerné, où, pourquoi c’est urgent.",
    "- Constat chiffré : bénéficiaires, coûts actuels, délais, manque d’équipement, etc.",
    "- Ce qui ne fonctionne pas aujourd’hui et pourquoi.",
    "",
    "2) Objectifs & indicateurs (SMART)",
    "- Objectif principal (1 phrase).",
    "- 2–3 objectifs secondaires.",
    "- Indicateurs de succès : chiffres, dates, livrables mesurables.",
    "",
    "3) Solution & exécution",
    "- Ce que vous allez faire concrètement (5–8 lignes).",
    "- Méthode : étapes techniques/terrain, partenaires, autorisations (si besoin).",
    "- Équipe : rôles, expériences pertinentes, responsabilités.",
    "",
    "4) Plan d’action (jalons + calendrier)",
    "- Jalon 1 (Semaine X–Y) : … (résultat attendu)",
    "- Jalon 2 (Semaine X–Y) : …",
    "- Jalon 3 (Semaine X–Y) : …",
    "- Date de livraison / mise en service : …",
    "",
    "5) Budget détaillé (important)",
    "- Ligne 1 : … TND (quantité × prix unitaire) — justification",
    "- Ligne 2 : … TND — justification",
    "- Ligne 3 : … TND — justification",
    "- Frais logistiques : … TND",
    "- Total : … TND (doit correspondre à l’objectif)",
    "- Si vous avez un co-financement : montant + source + statut (confirmé / en cours).",
    "",
    "6) Livrables & transparence",
    "- Livrable 1 : … (photo/rapport/vidéo/lien)",
    "- Livrable 2 : …",
    "- Fréquence des mises à jour (ex. 1 fois / semaine).",
    "",
    "7) Risques & atténuation (ce que l’IA vérifie)",
    "- Risque 1 : … → Mesure : …",
    "- Risque 2 : … → Mesure : …",
    "- Plan B : …",
    "",
    "8) Questions à clarifier (si applicable)",
    "- Exemple : fournisseurs, autorisations, maintenance, qui exploite après livraison ?",
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
    if (!category) e.category = "Indiquez une catégorie (ex. social, tech, énergie).";
    if (!Number.isFinite(goal)) e.fundingGoal = "L’objectif doit être un montant valide.";
    else if (goal < FUNDING_GOAL_MIN) e.fundingGoal = `Minimum ${FUNDING_GOAL_MIN.toLocaleString("fr-FR")} TND.`;
    else if (goal > FUNDING_GOAL_MAX) e.fundingGoal = `Maximum ${FUNDING_GOAL_MAX.toLocaleString("fr-FR")} TND.`;
    if (String(form.description || "").length > descMax) e.description = `Max ${descMax} caractères.`;
    const minStart = new Date(addDays(7));
    if (!startAt || Number.isNaN(startAt.getTime())) e.startAt = "Choisissez une date de démarrage.";
    else if (startAt < minStart) e.startAt = "Le démarrage doit être au moins dans 7 jours.";
    if (!deadline || Number.isNaN(deadline.getTime())) e.deadline = "Choisissez une date limite.";
    else if (startAt && deadline <= startAt) e.deadline = "La date limite doit être après la date de démarrage.";
    else if (startAt) {
      const min = new Date(startAt);
      min.setDate(min.getDate() + minDurationDays);
      if (deadline < min) {
        e.deadline = "La campagne doit durer au moins 1 mois (30 jours) après le démarrage.";
      }
    }
    return e;
  }, [form.title, form.category, form.fundingGoal, form.startAt, form.deadline, form.description]);

  const canSubmit = Object.keys(errors).length === 0;

  useEffect(() => {
    if (authLoading) return;
    if (user?.role === "ADMIN") {
      navigate("/admin/projects", { replace: true });
    }
  }, [authLoading, user, navigate]);

  async function onSubmit(e) {
    e.preventDefault();
    setTouched({ title: true, description: true, category: true, fundingGoal: true, startAt: true, deadline: true });
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
      // Nettoyer le formulaire pour qu’un retour sur la page reparte sur une base saine.
      setForm(defaultForm);
      setTouched({});
      navigate(`/projects/${data.project._id}`, { replace: true });
    } catch (err) {
      const out = extractApiError(err, "Impossible de créer le projet.");
      const details =
        out.fieldMessages?.length > 0
          ? `\n- ${out.fieldMessages.map((e) => `${e.field}: ${e.message}`).join("\n- ")}`
          : "";
      setError(`${out.message}${details}`);
    } finally {
      setLoading(false);
    }
  }

  if (authLoading) {
    return <PageLoader label="Préparation…" />;
  }
  if (user?.role === "ADMIN") {
    return null;
  }

  return (
    <div className="row justify-content-center py-2">
      <div className="col-12 col-xl-10">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
          <div>
            <h1 className="h3 fw-bold text-dark mb-1">Nouveau projet</h1>
            <p className="text-muted small mb-0">
              Créez d’abord un <strong>brouillon</strong>. Vous pourrez le modifier à tout moment
              avant publication. Le démarrage doit être <strong>au moins dans 7 jours</strong>.
            </p>
          </div>
          <Stepper steps={["Infos", "Calendrier", "Revue"]} current={step} />
        </div>
        <Guidance title="Rédaction & budget" variant="info">
          L’analyse IA lit surtout votre <strong>description</strong> : restez concret, avec{" "}
          <strong>quelques chiffres</strong> pour le budget et les besoins. Pour la structure complète (sections,
          jalons, risques, etc.), utilisez <strong>Insérer un modèle</strong>. Si l’écart entre l’objectif et le budget
          décrit dans le texte dépasse <strong>30&nbsp;%</strong>, le projet sera {" "}
          <strong>rejeté automatiquement</strong>.
        </Guidance>

        <div className="row g-4 align-items-start">
          <div className="col-12 col-lg-7">
            <div className="card border-0 fc-surface-card">
              <div className="card-body p-4 p-md-5">
                {error && (
                  <Alert variant="danger" className="mb-4">
                    {String(error)}
                  </Alert>
                )}

                <form onSubmit={onSubmit} className="vstack gap-3">
              <div className="d-flex align-items-center justify-content-between">
                <h2 className="h6 text-uppercase text-muted mb-0">Informations</h2>
                <span className="badge bg-light text-dark border">Brouillon</span>
              </div>
              <div>
                <label className="form-label fw-semibold text-dark mb-1">Titre</label>
                <input
                  className={`form-control ${touched.title && errors.title ? "is-invalid" : ""}`}
                  required
                  minLength={3}
                  placeholder="Ex. Ferme solaire pour une école"
                  value={form.title}
                  onBlur={() => setTouched((t) => ({ ...t, title: true }))}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
                {touched.title && errors.title && <div className="invalid-feedback">{errors.title}</div>}
              </div>
              <div>
                <label className="form-label fw-semibold text-dark mb-1">
                  Description
                </label>
                <textarea
                  className={`form-control ${touched.description && errors.description ? "is-invalid" : ""}`}
                  rows={5}
                  placeholder="Expliquez le problème, la solution, le budget, et l’impact attendu."
                  value={form.description}
                  maxLength={descMax}
                  onBlur={() => setTouched((t) => ({ ...t, description: true }))}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
                <div className="mt-2 d-flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        description: f.description?.trim()
                          ? f.description
                          : descTemplate,
                      }))
                    }
                  >
                    Insérer un modèle
                  </button>
                  <div className="small text-muted align-self-center">
                    Un projet clair (plan, budget, risques) inspire plus confiance.
                  </div>
                </div>
                <div className="d-flex justify-content-between">
                  <div className="form-text">
                    Soyez concret : objectifs, plan d’action, et ce que vous livrez.
                  </div>
                  <div className="form-text">
                    {String(form.description || "").length}/{descMax}
                  </div>
                </div>
                {touched.description && errors.description && (
                  <div className="invalid-feedback d-block">{errors.description}</div>
                )}
              </div>
              <div>
                <label className="form-label fw-semibold text-dark mb-1">
                  Catégorie
                </label>
                <select
                  className={`form-select ${touched.category && errors.category ? "is-invalid" : ""}`}
                  value={form.category}
                  onBlur={() => setTouched((t) => ({ ...t, category: true }))}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  required
                >
                  <option value="">Choisir une catégorie…</option>
                  {PROJECT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                {touched.category && errors.category && <div className="invalid-feedback">{errors.category}</div>}
              </div>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label fw-semibold text-dark mb-1">
                    Objectif (TND)
                  </label>
                  <div className="input-group">
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          fundingGoal: Math.max(FUNDING_GOAL_MIN, Number(f.fundingGoal || 0) - 1000),
                        }))
                      }
                      aria-label="Diminuer l’objectif"
                    >
                      −1000
                    </button>
                    <input
                      className={`form-control no-spin ${touched.fundingGoal && errors.fundingGoal ? "is-invalid" : ""}`}
                      type="number"
                      min={FUNDING_GOAL_MIN}
                      max={FUNDING_GOAL_MAX}
                      step={1000}
                      required
                      value={form.fundingGoal}
                      onBlur={() => setTouched((t) => ({ ...t, fundingGoal: true }))}
                      onChange={(e) =>
                        setForm({ ...form, fundingGoal: e.target.value })
                      }
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          fundingGoal: Math.min(FUNDING_GOAL_MAX, Number(f.fundingGoal || 0) + 1000),
                        }))
                      }
                      aria-label="Augmenter l’objectif"
                    >
                      +1000
                    </button>
                  </div>
                  {touched.fundingGoal && errors.fundingGoal && (
                    <div className="invalid-feedback">{errors.fundingGoal}</div>
                  )}
                  <input
                    type="range"
                    className="form-range mt-2"
                    min={FUNDING_GOAL_MIN}
                    max={FUNDING_GOAL_MAX}
                    step={1000}
                    value={Number(form.fundingGoal || 0)}
                    onChange={(e) => setForm({ ...form, fundingGoal: Number(e.target.value) })}
                    onMouseUp={() => setTouched((t) => ({ ...t, fundingGoal: true }))}
                    onTouchEnd={() => setTouched((t) => ({ ...t, fundingGoal: true }))}
                  />
                  <div className="form-text">
                    Astuce : utilisez des paliers (±1000) et ajustez au clavier si besoin.
                  </div>
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-semibold text-dark mb-1">
                    Date de démarrage
                  </label>
                  <input
                    className={`form-control ${touched.startAt && errors.startAt ? "is-invalid" : ""}`}
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
                  />
                  <div className="form-text">
                    La campagne peut démarrer au plus tôt dans 7 jours.
                  </div>
                  {touched.startAt && errors.startAt && (
                    <div className="invalid-feedback d-block">{errors.startAt}</div>
                  )}
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-semibold text-dark mb-1">
                    Date limite de collecte
                  </label>
                  <input
                    className={`form-control ${touched.deadline && errors.deadline ? "is-invalid" : ""}`}
                    type="date"
                    required
                    min={addDaysToDateInput(form.startAt || addDays(7), minDurationDays)}
                    value={form.deadline}
                    onBlur={() => setTouched((t) => ({ ...t, deadline: true }))}
                    onChange={(e) =>
                      setForm({ ...form, deadline: e.target.value })
                    }
                  />
                  <div className="form-text">
                    Durée minimale : 1 mois (30 jours) après la date de démarrage.
                  </div>
                  {touched.deadline && errors.deadline && (
                    <div className="invalid-feedback d-block">{errors.deadline}</div>
                  )}
                </div>
              </div>
              <div className="d-flex flex-wrap gap-2 pt-2">
                <button
                  className="btn btn-fc-primary text-white px-4"
                  type="submit"
                  disabled={loading || !canSubmit}
                >
                  {loading ? "Enregistrement…" : "Enregistrer le brouillon"}
                </button>
                <Link to="/dashboard" className="btn btn-outline-secondary">
                  Annuler
                </Link>
              </div>
            </form>
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-5">
            <ProjectPreviewCard
              title={form.title}
              description={form.description}
              category={form.category}
              fundingGoal={form.fundingGoal}
              startAt={form.startAt}
              deadline={form.deadline}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
