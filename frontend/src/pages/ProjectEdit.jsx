import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { confirmAlert } from "react-confirm-alert";
import { projectsApi } from "../api/projects";
import { canCreatorDeleteProject } from "../utils/projectRules.js";
import { extractApiError } from "../utils/apiError";
import Guidance from "../components/ui/Guidance.jsx";
import Alert from "../components/ui/Alert.jsx";
import { PROJECT_CATEGORIES } from "../config/categories.js";
import { FUNDING_GOAL_MAX, FUNDING_GOAL_MIN } from "../config/businessRules.js";

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

// Page modification : permet d’éditer un projet non public et relance l’analyse IA si un champ “impactant” change.
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
    fundingGoal: 1000,
    startAt: "",
    deadline: "",
  });
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
          setForm({
            title: p.title || "",
            description: p.description || "",
            category: p.category || "",
            fundingGoal: p.fundingGoal || 1000,
            startAt: toDateInput(p.startAt),
            deadline: toDateInput(p.deadline),
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
    setSaving(true);
    setError("");
    try {
      const payload = {
        title: form.title,
        description: form.description,
        category: form.category,
        fundingGoal: Number(form.fundingGoal),
        startAt: new Date(form.startAt).toISOString(),
        deadline: new Date(form.deadline).toISOString(),
      };
      if (status === "REJECTED") {
        await projectsApi.resubmit(id, payload);
      } else {
        await projectsApi.update(id, payload);
      }
      navigate(`/projects/${id}`, {
        replace: true,
        state: { flash: { type: "success", message: "Projet mis à jour." } },
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
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Chargement…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card border-0 shadow-sm">
        <div className="card-body text-center py-5">
          <p className="text-danger mb-2">{error}</p>
          <Link to={`/projects/${id}`} className="btn btn-outline-secondary">
            Retour
          </Link>
        </div>
      </div>
    );
  }

  const projectSnapshot = { status, currentFunding };
  const showDelete = canCreatorDeleteProject(projectSnapshot);
  const minDurationDays = 30;

  return (
    <div className="row justify-content-center">
      <div className="col-12 col-lg-8">
        <div className="mb-4">
          <h1 className="h3 fw-bold text-dark mb-1">Modifier le projet</h1>
          <p className="text-muted small mb-0">
            Modification autorisée pour les brouillons, les projets en revue et les projets
            renvoyés après refus — tant que la campagne n’est pas publique.
          </p>
        </div>
        <Alert variant="secondary">
          <strong>Important :</strong> FinCollab est une plateforme de <strong>soutien</strong> (don / contribution).
          Ce n’est <strong>pas</strong> un produit financier : aucun rendement n’est garanti.
        </Alert>
        <div className="card border-0 fc-surface-card">
          <div className="card-body p-4 p-md-5">
            <form onSubmit={onSubmit} className="vstack gap-3">
              <div>
                <label className="form-label fw-semibold text-dark mb-1">Titre</label>
                <input
                  className="form-control"
                  required
                  minLength={3}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label fw-semibold text-dark mb-1">Description</label>
                <textarea
                  className="form-control"
                  rows={5}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
                <div className="mt-2">
                  <Guidance title="Guidance" variant="info">
                    Gardez une description <strong>structurée</strong> (plan, budget, risques). Si votre projet a été{" "}
                    <strong>refusé</strong>, une mise à jour relancera l’analyse IA automatiquement après la re‑soumission.
                    <div className="mt-2">
                      <strong>Budget :</strong> l’estimation des dépenses est déduite de la description. Un écart
                      <strong> ≥ 30%</strong> entre besoins et objectif entraîne un <strong>rejet automatique</strong>.
                    </div>
                  </Guidance>
                </div>
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
                    Utilisez une structure claire (plan, budget, risques).
                  </div>
                </div>
              </div>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label fw-semibold text-dark mb-1">Catégorie</label>
                  <select
                    className="form-select"
                    required
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  >
                    <option value="">Choisir une catégorie…</option>
                    {PROJECT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
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
                      className="form-control no-spin"
                      type="number"
                      min={FUNDING_GOAL_MIN}
                      max={FUNDING_GOAL_MAX}
                      step={1000}
                      required
                      value={form.fundingGoal}
                      onChange={(e) => setForm({ ...form, fundingGoal: e.target.value })}
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
                  <input
                    type="range"
                    className="form-range mt-2"
                    min={FUNDING_GOAL_MIN}
                    max={FUNDING_GOAL_MAX}
                    step={1000}
                    value={Number(form.fundingGoal || 0)}
                    onChange={(e) => setForm({ ...form, fundingGoal: Number(e.target.value) })}
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
                    className="form-control"
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
                <div className="col-md-6">
                  <label className="form-label fw-semibold text-dark mb-1">Échéance</label>
                  <input
                    className="form-control"
                    type="date"
                    required
                    min={form.startAt ? addDaysToDateInput(form.startAt, minDurationDays) : undefined}
                    value={form.deadline}
                    onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                  />
                  <div className="form-text">Durée minimale : 1 mois (30 jours) après le démarrage.</div>
                </div>
              </div>
              <div className="d-flex flex-wrap gap-2 pt-2">
                <button
                  className="btn btn-fc-primary text-white px-4"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </button>
                <Link to={`/projects/${id}`} className="btn btn-outline-secondary">
                  Annuler
                </Link>
              </div>
            </form>
            {showDelete && (
              <div className="border-top mt-4 pt-4">
                <h2 className="h6 text-danger mb-2">Zone sensible</h2>
                <p className="small text-muted mb-3">
                  Supprimer définitivement ce dossier (possible uniquement avant la mise en ligne
                  active et sans financement enregistré).
                </p>
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm"
                  onClick={() => {
                    confirmAlert({
                      title: "Supprimer ce projet ?",
                      message: "Cette action est irréversible.",
                      buttons: [
                        { label: "Annuler", onClick: () => {} },
                        {
                          label: "Supprimer",
                          onClick: () => {
                            (async () => {
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
                            })();
                          },
                        },
                      ],
                    });
                  }}
                >
                  <i className="fa-solid fa-trash me-2" aria-hidden="true" />
                  Supprimer le projet
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

