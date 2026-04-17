import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { projectsApi } from "../api/projects";
import { useAuth } from "../hooks/useAuth.js";
import PageLoader from "../components/ui/PageLoader.jsx";
import Stepper from "../components/ui/Stepper.jsx";
import ProjectPreviewCard from "../components/project/ProjectPreviewCard.jsx";
import { FUNDING_GOAL_MAX, FUNDING_GOAL_MIN } from "../config/businessRules.js";

function addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export default function ProjectNew() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const defaultStart = addDays(7);
  const defaultForm = useMemo(
    () => ({
      title: "",
      description: "",
      category: "",
      fundingGoal: 10000,
      startAt: defaultStart,
      deadline: addDays(21),
    }),
    [defaultStart]
  );
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    fundingGoal: 10000,
    startAt: defaultStart,
    deadline: addDays(21),
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({});

  const descMax = 5000;

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
      // Clean the form so if user comes back it’s fresh.
      setForm(defaultForm);
      setTouched({});
      navigate(`/projects/${data.project._id}`, { replace: true });
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        (err.response?.data?.details
          ? JSON.stringify(err.response.data.details)
          : null) ||
        "Impossible de créer le projet.";
      setError(msg);
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

        <div className="row g-4 align-items-start">
          <div className="col-12 col-lg-7">
            <div className="card border-0 fc-surface-card">
              <div className="card-body p-4 p-md-5">
                {error && <div className="alert alert-danger small mb-4">{String(error)}</div>}

                <form onSubmit={onSubmit} className="vstack gap-3">
              <div className="d-flex align-items-center justify-content-between">
                <h2 className="h6 text-uppercase text-muted mb-0">Informations</h2>
                <span className="badge bg-light text-dark border">Brouillon</span>
              </div>
              <div>
                <label className="form-label small text-muted mb-1">Titre</label>
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
                <label className="form-label small text-muted mb-1">
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
                <label className="form-label small text-muted mb-1">
                  Catégorie
                </label>
                <input
                  className={`form-control ${touched.category && errors.category ? "is-invalid" : ""}`}
                  placeholder="Ex. social, tech, énergie…"
                  value={form.category}
                  onBlur={() => setTouched((t) => ({ ...t, category: true }))}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
                {touched.category && errors.category && <div className="invalid-feedback">{errors.category}</div>}
              </div>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label small text-muted mb-1">
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
                  <label className="form-label small text-muted mb-1">
                    Date de démarrage
                  </label>
                  <input
                    className={`form-control ${touched.startAt && errors.startAt ? "is-invalid" : ""}`}
                    type="date"
                    required
                    min={addDays(7)}
                    value={form.startAt}
                    onBlur={() => setTouched((t) => ({ ...t, startAt: true }))}
                    onChange={(e) =>
                      setForm({ ...form, startAt: e.target.value })
                    }
                  />
                  <div className="form-text">
                    La campagne peut démarrer au plus tôt dans 7 jours.
                  </div>
                  {touched.startAt && errors.startAt && (
                    <div className="invalid-feedback d-block">{errors.startAt}</div>
                  )}
                </div>
                <div className="col-md-6">
                  <label className="form-label small text-muted mb-1">
                    Date limite de collecte
                  </label>
                  <input
                    className={`form-control ${touched.deadline && errors.deadline ? "is-invalid" : ""}`}
                    type="date"
                    required
                    min={form.startAt || addDays(7)}
                    value={form.deadline}
                    onBlur={() => setTouched((t) => ({ ...t, deadline: true }))}
                    onChange={(e) =>
                      setForm({ ...form, deadline: e.target.value })
                    }
                  />
                  <div className="form-text">
                    Doit être après la date de démarrage (ex. 2 à 4 semaines).
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
