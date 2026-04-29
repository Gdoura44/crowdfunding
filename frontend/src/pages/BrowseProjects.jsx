import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { projectsApi } from "../api/projects";
import ProjectCard from "../components/project/ProjectCard.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import PageLoader from "../components/ui/PageLoader.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { extractApiError } from "../utils/apiError";
import { PROJECT_CATEGORIES } from "../config/categories.js";

const RISK_LEVELS = ["LOW", "MEDIUM", "HIGH"];

export default function BrowseProjects() {
  const [qDraft, setQDraft] = useState("");
  const [categoryDraft, setCategoryDraft] = useState("");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [riskLevel, setRiskLevel] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [includeUpcoming, setIncludeUpcoming] = useState(true);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Debounce text inputs so we don't reload on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(qDraft);
      setCategory(categoryDraft);
    }, 400);
    return () => clearTimeout(t);
  }, [qDraft, categoryDraft]);

  const params = useMemo(() => {
    const p = { limit: 24 };
    if (q.trim()) p.q = q.trim();
    if (category.trim()) p.category = category.trim();
    if (riskLevel) p.riskLevel = riskLevel;
    if (status) p.status = status;
    if (status === "ACTIVE") p.includeUpcoming = includeUpcoming ? "true" : "false";
    return p;
  }, [q, category, riskLevel, status, includeUpcoming]);

  async function load() {
    // Public browse/search. We debounce text fields for a smoother UX.
    const { data } =
      params.q || params.category || params.riskLevel || params.status
        ? await projectsApi.search(params)
        : await projectsApi.public({ limit: 24 });
    setProjects(data.projects || []);
  }

  useEffect(() => {
    let cancelled = false;
    setError("");
    setLoading(true);
    (async () => {
      try {
        await load();
      } catch (err) {
        if (!cancelled) {
          const out = extractApiError(err, "Impossible de charger les projets.");
          setError(out.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  return (
    <div>
      <PageHeader
        title="Découvrir des projets"
        subtitle="Recherchez par mots-clés, filtrez par catégorie ou par niveau de risque indiqué sur la fiche."
        actions={
          <Link to="/register" className="btn btn-fc-primary text-white">
            <i className="fa-solid fa-pen-ruler me-2" aria-hidden="true" />
            Lancer un projet
          </Link>
        }
      />

      <div className="card border-0 fc-surface-card mb-4">
        <div className="card-body p-4">
          <div className="row g-3 align-items-end">
            <div className="col-md-5">
              <label className="form-label small text-muted mb-1">Recherche</label>
              <input
                className="form-control"
                placeholder="Titre, description…"
                value={qDraft}
                onChange={(e) => setQDraft(e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label small text-muted mb-1">Catégorie</label>
              <select
                className="form-select"
                value={categoryDraft}
                onChange={(e) => setCategoryDraft(e.target.value)}
              >
                <option value="">Toutes</option>
                {PROJECT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small text-muted mb-1">Risque</label>
              <select
                className="form-select"
                value={riskLevel}
                onChange={(e) => setRiskLevel(e.target.value)}
              >
                <option value="">Tous</option>
                {RISK_LEVELS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small text-muted mb-1">Statut</label>
              <select
                className="form-select"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="ACTIVE">Actifs</option>
                <option value="CLOSED">Clôturés</option>
              </select>
            </div>
          </div>
          {status === "ACTIVE" && (
            <div className="form-check form-switch mt-3">
              <input
                className="form-check-input"
                type="checkbox"
                role="switch"
                id="includeUpcoming"
                checked={includeUpcoming}
                onChange={(e) => setIncludeUpcoming(e.target.checked)}
              />
              <label className="form-check-label small text-muted" htmlFor="includeUpcoming">
                Inclure les campagnes à venir (date de démarrage future)
              </label>
            </div>
          )}
          <div className="small text-muted mt-3 d-flex align-items-start gap-2">
            <i className="fa-solid fa-circle-info mt-1" aria-hidden="true" />
            <span>
              Campagnes <strong>publiques</strong> et non archivées.
            </span>
          </div>
          <div className="small text-muted mt-2 d-flex align-items-start gap-2">
            <i className="fa-solid fa-filter mt-1" aria-hidden="true" />
            <span>
              Filtre <strong>Statut</strong> : “Actifs” (campagnes en cours) ou “Clôturés” (terminées).
            </span>
          </div>
        </div>
      </div>

      {loading && <PageLoader label="Chargement des campagnes…" />}

      {error && <div className="alert alert-warning">{error}</div>}

      {!loading && !error && projects.length === 0 && (
        <EmptyState
          icon="fa-solid fa-magnifying-glass"
          title="Aucun résultat"
          description="Essayez d’élargir la recherche, de retirer un filtre ou de vérifier l’orthographe."
        />
      )}

      {!loading && !error && projects.length > 0 && (
        <div className="row g-3">
          {projects.map((p) => (
            <div key={p._id} className="col-12 col-md-6 col-lg-4">
              <ProjectCard project={p} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

