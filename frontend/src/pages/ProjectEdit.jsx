import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { confirmAlert } from "react-confirm-alert";
import { projectsApi } from "../api/projects";
import { canCreatorDeleteProject } from "../utils/projectRules.js";

function toDateInput(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
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
    fundingGoal: 1000,
    startAt: "",
    deadline: "",
  });

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
          setError(err.response?.data?.message || "Impossible de charger ce projet.");
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
      setError(err.response?.data?.message || "Mise à jour impossible.");
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

  return (
    <div className="row justify-content-center">
      <div className="col-12 col-lg-8">
        <div className="mb-4">
          <h1 className="h3 fw-bold text-dark mb-1">Modifier le projet</h1>
          <p className="text-muted small mb-0">
            Modification autorisée pour les brouillons, les projets en analyse et les projets
            renvoyés après refus — tant que la campagne n’est pas publique.
          </p>
        </div>
        <div className="card border-0 fc-surface-card">
          <div className="card-body p-4 p-md-5">
            <form onSubmit={onSubmit} className="vstack gap-3">
              <div>
                <label className="form-label small text-muted mb-1">Titre</label>
                <input
                  className="form-control"
                  required
                  minLength={3}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label small text-muted mb-1">Description</label>
                <textarea
                  className="form-control"
                  rows={5}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </div>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label small text-muted mb-1">Catégorie</label>
                  <input
                    className="form-control"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label small text-muted mb-1">
                    Objectif (TND)
                  </label>
                  <input
                    className="form-control"
                    type="number"
                    min={1}
                    step={50}
                    value={form.fundingGoal}
                    onChange={(e) =>
                      setForm({ ...form, fundingGoal: e.target.value })
                    }
                  />
                  <div className="form-text">Saisissez le montant au clavier (pas besoin de +1 / -1).</div>
                </div>
                <div className="col-md-6">
                  <label className="form-label small text-muted mb-1">
                    Date de démarrage
                  </label>
                  <input
                    className="form-control"
                    type="date"
                    required
                    value={form.startAt}
                    onChange={(e) => setForm({ ...form, startAt: e.target.value })}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label small text-muted mb-1">Échéance</label>
                  <input
                    className="form-control"
                    type="date"
                    required
                    min={form.startAt || undefined}
                    value={form.deadline}
                    onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                  />
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
                                setError(
                                  err.response?.data?.message ||
                                    "Suppression impossible."
                                );
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

