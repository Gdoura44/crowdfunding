import { useEffect, useMemo, useState } from "react";
import { adminApi } from "../api/admin";
import { useAuth } from "../hooks/useAuth";
import PageHeader from "../components/ui/PageHeader.jsx";
import PageLoader from "../components/ui/PageLoader.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";

function badgeClass(status) {
  const map = {
    UNDER_REVIEW: "bg-warning text-dark",
    APPROVED: "bg-success",
    REJECTED: "bg-danger",
    ACTIVE: "bg-primary",
    FUNDED: "bg-info text-dark",
  };
  return `badge ${map[status] || "bg-secondary"}`;
}

function formatDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return "—";
  }
}

export default function AdminProjects() {
  const { user } = useAuth();
  const [tab, setTab] = useState("UNDER_REVIEW");
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedbackById, setFeedbackById] = useState({});
  const [busyId, setBusyId] = useState(null);

  const canAccess = user?.role === "ADMIN";
  const title = useMemo(() => {
    if (tab === "UNDER_REVIEW") return "Projets en revue";
    if (tab === "APPROVED") return "Projets approuvés (à publier)";
    if (tab === "SUSPENDED") return "Projets suspendus";
    return "Projets";
  }, [tab]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await adminApi.listProjects({ status: tab, limit: 40 });
      setProjects(res.data.projects || []);
    } catch (e) {
      setError(e?.response?.data?.message || "Impossible de charger la liste.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canAccess) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, canAccess]);

  async function approve(p) {
    setBusyId(p._id);
    setError("");
    try {
      await adminApi.validateProject(p._id, {
        decision: "APPROVED",
        feedback: feedbackById[p._id] || "",
      });
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || "Action impossible.");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(p) {
    setBusyId(p._id);
    setError("");
    try {
      await adminApi.validateProject(p._id, {
        decision: "REJECTED",
        feedback: feedbackById[p._id] || "",
      });
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || "Action impossible.");
    } finally {
      setBusyId(null);
    }
  }

  async function publish(p) {
    setBusyId(p._id);
    setError("");
    try {
      await adminApi.publishProject(p._id);
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || "Action impossible.");
    } finally {
      setBusyId(null);
    }
  }

  async function retryAi(p) {
    setBusyId(p._id);
    setError("");
    try {
      await adminApi.retryAiAnalysis(p._id);
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || "Action impossible.");
    } finally {
      setBusyId(null);
    }
  }

  async function reactivate(p) {
    setBusyId(p._id);
    setError("");
    try {
      await adminApi.reactivateProject(p._id);
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || "Action impossible.");
    } finally {
      setBusyId(null);
    }
  }

  if (!canAccess) {
    return (
      <div className="card border-0 fc-surface-card">
        <div className="card-body p-4 p-md-5 text-center">
          <div className="fc-empty__icon mb-3" aria-hidden="true">
            <i className="fa-solid fa-lock" />
          </div>
          <h1 className="h5 mb-2 text-dark">Espace administration</h1>
          <p className="text-muted small mb-0 mx-auto" style={{ maxWidth: "28rem" }}>
            Cette page est réservée aux comptes administrateur.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="d-flex flex-column gap-3">
      <PageHeader
        title={title}
        subtitle="Validez d’abord les dossiers en revue, puis publiez les projets approuvés pour les rendre visibles publiquement."
        actions={
          <div className="btn-group shadow-sm">
            <button
              type="button"
              className={`btn btn-sm ${tab === "UNDER_REVIEW" ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => setTab("UNDER_REVIEW")}
            >
              À valider
            </button>
            <button
              type="button"
              className={`btn btn-sm ${tab === "APPROVED" ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => setTab("APPROVED")}
            >
              À publier
            </button>
            <button
              type="button"
              className={`btn btn-sm ${tab === "SUSPENDED" ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => setTab("SUSPENDED")}
            >
              Suspendus
            </button>
          </div>
        }
      />

      {error && <div className="alert alert-danger py-2 mb-0">{error}</div>}

      <div className="card border-0 fc-surface-card">
        <div className="card-body p-0 p-md-1">
          {loading ? (
            <PageLoader label="Chargement des dossiers…" />
          ) : projects.length === 0 ? (
            <div className="p-3 p-md-4">
              <EmptyState
                icon="fa-solid fa-clipboard-check"
                title="Rien à traiter ici"
                description="Quand des projets arriveront dans cette étape, ils apparaîtront dans ce tableau."
              />
            </div>
          ) : (
            <div className="table-responsive rounded-3">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th>Titre</th>
                    <th>Statut</th>
                    <th>Créé</th>
                    <th>Début</th>
                    <th>Deadline</th>
                    <th style={{ minWidth: "18rem" }}>Feedback</th>
                    <th style={{ width: "1%" }} />
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => (
                    <tr key={p._id}>
                      <td className="fw-semibold">{p.title}</td>
                      <td>
                        <span className={badgeClass(p.status)}>{p.status}</span>
                      </td>
                      <td className="text-muted small">{formatDate(p.createdAt)}</td>
                      <td className="text-muted small">{formatDate(p.startAt)}</td>
                      <td className="text-muted small">{formatDate(p.deadline)}</td>
                      <td>
                        <input
                          className="form-control form-control-sm"
                          placeholder="Message (optionnel)…"
                          value={feedbackById[p._id] || ""}
                          onChange={(e) =>
                            setFeedbackById((prev) => ({
                              ...prev,
                              [p._id]: e.target.value,
                            }))
                          }
                        />
                      </td>
                      <td className="text-end">
                        {p.status === "UNDER_REVIEW" ? (
                          <div className="btn-group">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-success"
                              disabled={busyId === p._id}
                              onClick={() => approve(p)}
                            >
                              Approuver
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              disabled={busyId === p._id}
                              onClick={() => reject(p)}
                            >
                              Rejeter
                            </button>
                          </div>
                      ) : p.status === "AWAITING_AI" || p.aiStatus === "FAILED" ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          disabled={busyId === p._id}
                          onClick={() => retryAi(p)}
                        >
                          Relancer IA
                        </button>
                        ) : p.status === "SUSPENDED" ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-success"
                            disabled={busyId === p._id}
                            onClick={() => reactivate(p)}
                          >
                            Réactiver
                          </button>
                        ) : p.status === "APPROVED" ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            disabled={busyId === p._id}
                            onClick={() => publish(p)}
                          >
                            Publier
                          </button>
                        ) : (
                          <span className="text-muted small">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

