import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { confirmAlert } from "react-confirm-alert";
import { useAuth } from "../hooks/useAuth.js";
import { canCreatorDeleteProject } from "../utils/projectRules.js";
import PageHeader from "../components/ui/PageHeader.jsx";
import PageLoader from "../components/ui/PageLoader.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { useMyProjects } from "../hooks/useMyProjects.js";

const STATUS_VARIANT = {
  DRAFT: "secondary",
  AWAITING_AI: "info",
  UNDER_REVIEW: "primary",
  APPROVED: "success",
  ACTIVE: "success",
  REJECTED: "danger",
  FUNDED: "warning",
  CLOSED: "dark",
  SUSPENDED: "danger",
};

function statusBadge(status) {
  const variant = STATUS_VARIANT[status] || "secondary";
  const textClass = variant === "warning" ? " text-dark" : "";
  return (
    <span className={`badge bg-${variant} badge-status${textClass}`}>
      {status}
    </span>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { projects, loading, error, deleteProject } = useMyProjects({
    enabled: user?.role !== "ADMIN",
  });
  const [actionError, setActionError] = useState("");
  const [actionOk, setActionOk] = useState("");

  useEffect(() => {
    if (user?.role === "ADMIN") {
      navigate("/admin/projects", { replace: true });
    }
  }, [user, navigate]);

  return (
    <div>
      <PageHeader
        title="Mes projets"
        subtitle="Brouillons, analyses, validations et campagnes publiées — ouvrez une fiche pour agir ou suivre l’étape en cours."
        actions={
          user?.role !== "ADMIN" ? (
            <Link to="/projects/new" className="btn btn-fc-primary text-white px-4">
              <i className="fa-solid fa-circle-plus me-2" aria-hidden="true" />
              Nouveau projet
            </Link>
          ) : null
        }
      />

      {loading && <PageLoader label="Chargement de vos projets…" />}

      {error && <div className="alert alert-warning">{error}</div>}
      {actionError && <div className="alert alert-danger">{actionError}</div>}
      {actionOk && <div className="alert alert-success">{actionOk}</div>}

      {!loading && !error && projects.length === 0 && (
        <EmptyState
          icon="fa-solid fa-folder-open"
          title="Aucun projet pour l’instant"
          description="Créez un brouillon en quelques minutes : titre, description, objectif et dates. Vous pourrez le peaufiner avant toute soumission."
        >
          {user?.role !== "ADMIN" && (
            <Link to="/projects/new" className="btn btn-fc-primary text-white">
              <i className="fa-solid fa-circle-plus me-2" aria-hidden="true" />
              Créer un premier brouillon
            </Link>
          )}
        </EmptyState>
      )}

      {!loading && !error && projects.length > 0 && (
        <div className="list-group list-group-flush rounded-3 overflow-hidden border fc-surface-card">
          {projects.map((p) => (
            <div
              key={p._id}
              className="list-group-item d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2 py-3 px-3"
            >
              <Link
                to={`/projects/${p._id}`}
                className="text-decoration-none text-reset flex-grow-1 min-w-0"
              >
                <span className="fw-semibold text-dark d-block">{p.title}</span>
                <span className="small text-muted">
                  {p.category || "Sans catégorie"}
                </span>
              </Link>
              <div className="d-flex align-items-center gap-2 flex-shrink-0">
                {statusBadge(p.status)}
                {canCreatorDeleteProject(p) && (
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm"
                    title="Supprimer"
                    aria-label={`Supprimer ${p.title}`}
                    onClick={() => {
                      confirmAlert({
                        title: "Supprimer ce projet ?",
                        message: `${p.title} — action définitive.`,
                        buttons: [
                          { label: "Annuler", onClick: () => {} },
                          {
                            label: "Supprimer",
                            onClick: () => {
                              (async () => {
                                try {
                                  setActionError("");
                                  setActionOk("");
                                  await deleteProject(p._id);
                                  setActionOk("Projet supprimé.");
                                } catch (err) {
                                  setActionError(
                                    err?.response?.data?.message || "Suppression impossible."
                                  );
                                }
                              })();
                            },
                          },
                        ],
                      });
                    }}
                  >
                    <i className="fa-solid fa-trash" aria-hidden="true" />
                  </button>
                )}
                <Link
                  to={`/projects/${p._id}`}
                  className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
                >
                  Ouvrir
                  <i className="fa-solid fa-chevron-right" style={{ fontSize: "0.7rem" }} aria-hidden="true" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
