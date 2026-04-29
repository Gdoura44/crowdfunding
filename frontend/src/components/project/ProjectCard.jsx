import { Link, useLocation } from "react-router-dom";

function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}

function statusBadge(project) {
  const status = String(project?.status || "");
  if (project?.isArchived) {
    return { label: "Archivé", cls: "badge bg-light text-dark border rounded-pill px-3" };
  }
  const map = {
    ACTIVE: { label: "Active", cls: "badge bg-success rounded-pill px-3" },
    CLOSED: { label: "Clôturée", cls: "badge bg-secondary rounded-pill px-3" },
    FUNDED: { label: "Objectif atteint", cls: "badge bg-info text-dark rounded-pill px-3" },
    SUSPENDED: { label: "Suspendue", cls: "badge bg-warning text-dark rounded-pill px-3" },
    UNDER_REVIEW: { label: "En revue", cls: "badge bg-warning text-dark rounded-pill px-3" },
    APPROVED: { label: "Approuvée (non publiée)", cls: "badge bg-primary rounded-pill px-3" },
    REJECTED: { label: "Rejetée", cls: "badge bg-danger rounded-pill px-3" },
    AWAITING_AI: { label: "Analyse en cours", cls: "badge bg-primary rounded-pill px-3" },
    DRAFT: { label: "Brouillon", cls: "badge bg-light text-dark border rounded-pill px-3" },
  };
  return map[status] || { label: status || "—", cls: "badge bg-light text-dark border rounded-pill px-3" };
}

export default function ProjectCard({ project }) {
  const location = useLocation();
  const goal = Number(project.fundingGoal || 0);
  const current = Number(project.currentFunding || 0);
  const pct = goal > 0 ? clamp((current / goal) * 100, 0, 100) : 0;
  const sb = statusBadge(project);

  return (
    <div className="card h-100 border-0 fc-surface-card fc-card-interactive">
      <div className="card-body d-flex flex-column p-4">
        <div className="d-flex justify-content-between gap-2 mb-2">
          <span className={sb.cls}>{sb.label}</span>
          {project.aiAnalysis?.riskLevel && (
            <span className="badge bg-light text-dark border">
              Indicatif risque : {project.aiAnalysis.riskLevel}
            </span>
          )}
        </div>
        <h3 className="h6 fw-semibold text-dark mb-1">{project.title}</h3>
        <div className="small text-muted mb-2">
          {project.category || "Sans catégorie"}
          {project.deadline && (
            <>
              {" "}
              · échéance {new Date(project.deadline).toLocaleDateString("fr-FR")}
            </>
          )}
        </div>
        <p className="small text-muted mb-3" style={{ flex: 1 }}>
          {(project.description || "").slice(0, 120)}
          {(project.description || "").length > 120 ? "…" : ""}
        </p>

        <div className="mb-2">
          <div className="d-flex justify-content-between small text-muted mb-1">
            <span>
              {current} / {goal} TND
            </span>
            <span>{Math.round(pct)}%</span>
          </div>
          <div className="progress" style={{ height: "8px" }}>
            <div
              className="progress-bar"
              role="progressbar"
              style={{ width: `${pct}%`, backgroundColor: "var(--fc-brand)" }}
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>

        <Link
          to={`/projects/${project._id}`}
          state={{ from: location }}
          className="btn btn-fc-primary text-white btn-sm mt-2"
        >
          Voir la campagne
          <i className="fa-solid fa-arrow-right ms-2" style={{ fontSize: "0.75rem" }} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

