import { useEffect, useState, useCallback } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { confirmAlert } from "react-confirm-alert";
import { projectsApi } from "../api/projects";
import { investmentsApi } from "../api/investments";
import { reportsApi } from "../api/reports";
import { chatbotApi } from "../api/chatbot";
import { useAuth } from "../hooks/useAuth.js";
import { canCreatorDeleteProject } from "../utils/projectRules.js";
import { extractApiError } from "../utils/apiError";
import Guidance from "../components/ui/Guidance.jsx";

export default function ProjectDetail() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [project, setProject] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [error, setError] = useState("");
  const [submitMsg, setSubmitMsg] = useState("");
  const [submitErr, setSubmitErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [investAmount, setInvestAmount] = useState(50);
  const [investing, setInvesting] = useState(false);
  const [investErr, setInvestErr] = useState("");
  const [autoRefreshing, setAutoRefreshing] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportType, setReportType] = useState("FRAUD");
  const [reportDesc, setReportDesc] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportOk, setReportOk] = useState("");
  const [reportErr, setReportErr] = useState("");
  const [chatQ, setChatQ] = useState("");
  const [chatA, setChatA] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatErr, setChatErr] = useState("");
  const [chatMode, setChatMode] = useState("");
  const [flash, setFlash] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentErr, setCommentErr] = useState("");
  const [commentOk, setCommentOk] = useState("");

  // Centralise le chargement (réutilisé par refresh automatique et après actions).
  const load = useCallback(async () => {
    const { data } = await projectsApi.byId(id);
    setProject(data.project);
    setIsOwner(data.isOwner);
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    setError("");
    if (location?.state?.flash) {
      setFlash(location.state.flash);
      // Clear once (so back/forward doesn't re-show).
      navigate(location.pathname, { replace: true, state: null });
    }
    (async () => {
      try {
        await load();
      } catch (err) {
        if (!cancelled) {
          const out = extractApiError(err, "Projet introuvable.");
          setError(out.message);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load, location?.state?.flash, location.pathname, navigate]);

  useEffect(() => {
    let alive = true;
    setCommentErr("");
    setCommentOk("");
    if (!project?._id || project.status !== "ACTIVE" || project.isArchived) {
      setComments([]);
      return () => {
        alive = false;
      };
    }
    (async () => {
      try {
        const { data } = await projectsApi.listComments(project._id);
        if (alive) setComments(data.comments || []);
      } catch (e) {
        if (alive) {
          const out = extractApiError(e, "Impossible de charger les commentaires.");
          setCommentErr(out.message);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [project?._id, project?.status, project?.isArchived]);

  // Auto-refresh tant que l’analyse IA est en attente:
  // - évite “F5” côté utilisateur
  // - rend visible le retry automatique en cas de quota (aiQueuedAt/aiNextRetryAt).
  useEffect(() => {
    if (!project || !isOwner) {
      setAutoRefreshing(false);
      return;
    }

    const shouldPoll =
      project.status === "AWAITING_AI" &&
      ["PENDING", "FAILED"].includes(String(project.aiStatus || ""));

    if (!shouldPoll) {
      setAutoRefreshing(false);
      return;
    }

    setAutoRefreshing(true);
    let alive = true;
    let t = null;

    const tick = async () => {
      try {
        await load();
      } catch {
        // best-effort
      } finally {
        if (alive) {
          t = setTimeout(tick, 4000);
        }
      }
    };

    t = setTimeout(tick, 2000);
    return () => {
      alive = false;
      if (t) clearTimeout(t);
    };
  }, [project, isOwner, load]);

  async function submitForAi() {
    setSubmitting(true);
    setSubmitErr("");
    setSubmitMsg("");
    try {
      const { data } = await projectsApi.submitForAi(id);
      setSubmitMsg(data.message || "Soumis.");
      await load();
    } catch (err) {
      const out = extractApiError(err, "Soumission impossible.");
      setSubmitErr(out.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (error) {
    return (
      <div className="card border-0 fc-surface-card">
        <div className="card-body text-center py-5">
          <p className="text-danger mb-2">{error}</p>
          <p className="small text-muted mb-3">
            Les brouillons et projets non publiés ne sont visibles que par leur
            créateur (compte connecté).
          </p>
          <Link to="/" className="btn btn-outline-secondary me-2">
            Accueil
          </Link>
          {isAuthenticated && (
            <Link to="/dashboard" className="btn btn-fc-primary text-white">
              Mes projets
            </Link>
          )}
          {!isAuthenticated && (
            <Link
              to="/login"
              state={{ from: location }}
              className="btn btn-fc-primary text-white"
            >
              Connexion
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Chargement…</span>
        </div>
      </div>
    );
  }

  const isPublicActive =
    project.status === "ACTIVE" && !project.isArchived;
  const showVisitorCta = !isOwner && isPublicActive;
  const canEdit =
    isOwner && ["DRAFT", "UNDER_REVIEW", "REJECTED"].includes(project.status);
  const canArchive =
    isOwner &&
    ["DRAFT", "AWAITING_AI", "UNDER_REVIEW", "REJECTED"].includes(project.status) &&
    !project.isArchived;
  const canDelete = isOwner && canCreatorDeleteProject(project);
  const analysisInProgress =
    isOwner && project.status === "AWAITING_AI" && project.aiStatus === "PENDING";
  const analysisFailed =
    isOwner && project.status === "AWAITING_AI" && project.aiStatus === "FAILED";
  const queuedMinutes = (() => {
    const q = project?.aiQueuedAt ? new Date(project.aiQueuedAt) : null;
    if (!q || Number.isNaN(q.getTime())) return null;
    return Math.max(0, Math.floor((Date.now() - q.getTime()) / 60000));
  })();
  const aiLastErrorCode = String(project?.aiLastError || "").trim();
  const hasRetrySignal =
    Boolean(project?.aiNextRetryAt) ||
    Number(project?.aiAutoRetryCount || 0) > 0 ||
    ["AI_QUOTA_EXCEEDED", "AI_TEMPORARY_FAILURE"].includes(aiLastErrorCode);
  const likelyQuotaWait =
    analysisInProgress && hasRetrySignal && queuedMinutes != null && queuedMinutes >= 1;
  const queuedAtLabel = (() => {
    if (!project?.aiQueuedAt) return "";
    const d = new Date(project.aiQueuedAt);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("fr-FR");
  })();
  const nextRetryLabel = (() => {
    if (!project?.aiNextRetryAt) return "";
    const d = new Date(project.aiNextRetryAt);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("fr-FR");
  })();
  const canReport =
    isAuthenticated &&
    !isOwner &&
    user?.role !== "ADMIN" &&
    !project.isArchived &&
    ["ACTIVE", "CLOSED", "FUNDED"].includes(project.status);
  const showChat = user?.role !== "ADMIN";
  const showContributionInfo = !isOwner && isPublicActive;
  const canInvest = !isOwner && isPublicActive && isAuthenticated && user?.role !== "ADMIN";

  return (
    <div>
      <nav aria-label="fil d’Ariane" className="mb-3">
        <ol className="breadcrumb small mb-0">
          <li className="breadcrumb-item">
            <Link to="/">Accueil</Link>
          </li>
          {isOwner && (
            <li className="breadcrumb-item">
              <Link to="/dashboard">Mes projets</Link>
            </li>
          )}
          <li className="breadcrumb-item active" aria-current="page">
            {project.title}
          </li>
        </ol>
      </nav>

      {showVisitorCta && (
        <div className="card border-0 fc-surface-card mb-4">
          <div className="card-body d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 p-4">
            <div className="d-flex gap-3 min-w-0">
              <div
                className="flex-shrink-0 rounded-3 d-flex align-items-center justify-content-center text-white"
                style={{
                  width: "2.75rem",
                  height: "2.75rem",
                  background: "linear-gradient(135deg, #0f4c5c, #1a8a9e)",
                }}
                aria-hidden="true"
              >
                <i className="fa-solid fa-hand-holding-dollar" />
              </div>
              <div className="min-w-0">
                <strong className="d-block text-dark mb-1">Campagne ouverte au public</strong>
                <p className="small text-muted mb-0">
                  Connectez-vous pour soutenir ce projet (simulation de paiement en environnement
                  de test).
                </p>
              </div>
            </div>
            <div className="d-flex flex-wrap gap-2 flex-shrink-0">
              <Link
                to="/login"
                state={{ from: location }}
                className="btn btn-fc-primary text-white btn-sm"
              >
                <i className="fa-solid fa-right-to-bracket me-2" aria-hidden="true" />
                Connexion
              </Link>
              <Link to="/register" className="btn btn-outline-secondary btn-sm">
                <i className="fa-solid fa-user-plus me-2" aria-hidden="true" />
                Inscription
              </Link>
            </div>
          </div>
        </div>
      )}

      {(canEdit || canArchive || canDelete) && (
        <div className="d-flex flex-wrap gap-2 mb-3">
          {canEdit && (
            <Link to={`/projects/${project._id}/edit`} className="btn btn-outline-primary btn-sm">
              <i className="fa-regular fa-pen-to-square me-2" aria-hidden="true" />
              Modifier
            </Link>
          )}
          {canArchive && (
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => {
                confirmAlert({
                  title: "Archiver ce projet ?",
                  message:
                    "Le projet ne sera plus affiché au public. Vous pourrez le conserver dans votre espace.",
                  buttons: [
                    { label: "Annuler", onClick: () => {} },
                    {
                      label: "Archiver",
                      onClick: async () => {
                        try {
                          await projectsApi.archive(project._id);
                          navigate(`/projects/${project._id}`, {
                            replace: true,
                            state: { flash: { type: "success", message: "Projet archivé." } },
                          });
                        } catch (err) {
                          const out = extractApiError(err, "Archivage impossible.");
                          navigate(`/projects/${project._id}`, {
                            replace: true,
                            state: { flash: { type: "error", message: out.message } },
                          });
                        }
                      },
                    },
                  ],
                });
              }}
            >
              <i className="fa-solid fa-box-archive me-2" aria-hidden="true" />
              Archiver
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              className="btn btn-outline-danger btn-sm"
              onClick={() => {
                confirmAlert({
                  title: "Supprimer ce projet ?",
                  message:
                    "Cette action est irréversible. La suppression est possible uniquement avant mise en ligne et sans financement.",
                  buttons: [
                    { label: "Annuler", onClick: () => {} },
                    {
                      label: "Supprimer",
                      onClick: async () => {
                        try {
                          await projectsApi.remove(project._id);
                          navigate("/dashboard", {
                            replace: true,
                            state: { flash: { type: "success", message: "Projet supprimé." } },
                          });
                        } catch (err) {
                          const out = extractApiError(err, "Suppression impossible.");
                          navigate(`/projects/${project._id}`, {
                            replace: true,
                            state: { flash: { type: "error", message: out.message } },
                          });
                        }
                      },
                    },
                  ],
                });
              }}
            >
              <i className="fa-regular fa-trash-can me-2" aria-hidden="true" />
              Supprimer
            </button>
          )}
        </div>
      )}

      {showContributionInfo && (
        <div className="alert alert-secondary border-0 small mb-3">
          <div className="fw-semibold mb-1">
            <i className="fa-solid fa-circle-info me-2" aria-hidden="true" />
            Information importante
          </div>
          <div>
            Sur FinCollab, vous <strong>contribuez</strong> à une campagne (don / soutien).{" "}
            <strong>Ce n’est pas un placement financier</strong> et aucun rendement n’est garanti.
            En cas d’annulation dans la fenêtre prévue (si applicable), de sur‑financement ou de projet expiré,
            un remboursement peut être déclenché selon les règles de la plateforme.
          </div>
        </div>
      )}

      {isOwner && (
        <div className="alert alert-primary border-0 py-2 small mb-3">
          Vous êtes le <strong>créateur</strong> de ce projet.
        </div>
      )}

      <div className="card border-0 fc-surface-card mb-4">
        <div className="card-body p-4 p-md-5">
          {flash?.type === "success" && (
            <div className="alert alert-success py-2 small mb-3">
              {flash.message}
            </div>
          )}
          {flash?.type === "error" && (
            <div className="alert alert-danger py-2 small mb-3">
              {flash.message}
            </div>
          )}
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
            <h1 className="h3 mb-0 fw-bold text-dark">{project.title}</h1>
            <span className="badge bg-secondary">{project.status}</span>
          </div>
          <p className="text-muted small mb-3">
            {project.category || "Sans catégorie"}
            {project.startAt && (
              <>
                {" "}
                · démarre{" "}
                {new Date(project.startAt).toLocaleDateString("fr-FR")}
              </>
            )}
            {project.deadline && (
              <>
                {" "}
                · échéance{" "}
                {new Date(project.deadline).toLocaleDateString("fr-FR")}
              </>
            )}
          </p>
          <p className="text-body mb-0" style={{ whiteSpace: "pre-wrap" }}>
            {project.description || "Aucune description."}
          </p>

          {showChat && (
            <div className="mt-4">
              <div className="card border-0 bg-light">
                <div className="card-body">
                  <div className="d-flex align-items-start gap-3">
                    <div
                      className="flex-shrink-0 rounded-3 d-flex align-items-center justify-content-center text-white"
                      style={{
                        width: "2.5rem",
                        height: "2.5rem",
                        background: "linear-gradient(135deg, #2c3e50, #3498db)",
                      }}
                      aria-hidden="true"
                    >
                      <i className="fa-solid fa-message" />
                    </div>
                    <div className="min-w-0 w-100">
                      <div className="fw-semibold mb-1">Questions sur ce projet</div>
                      <div className="small text-muted mb-3">
                        Posez une question courte sur le projet. Si le service IA est momentanément limité (quota),
                        une réponse simplifiée s’affiche et vous pourrez réessayer plus tard pour une réponse plus détaillée.
                      </div>

                      {!isAuthenticated && (
                        <div className="alert alert-info py-2 small">
                          Connectez-vous pour utiliser le chatbot.
                          <div className="mt-2">
                            <Link to="/login" state={{ from: location }} className="btn btn-sm btn-fc-primary text-white">
                              Connexion
                            </Link>
                          </div>
                        </div>
                      )}

                      {chatErr && <div className="alert alert-danger py-2 small">{chatErr}</div>}
                      {chatMode === "fallback" && (
                        <div className="alert alert-info py-2 small">
                          Réponse simplifiée (service IA momentanément limité). Vous pouvez réessayer plus tard pour une réponse plus détaillée.
                        </div>
                      )}
                      {chatA && (
                        <div className="alert alert-secondary py-2 small">
                          <div className="fw-semibold mb-1">Réponse</div>
                          <div style={{ whiteSpace: "pre-wrap" }}>{chatA}</div>
                        </div>
                      )}

                      <div className="d-flex flex-column flex-md-row gap-2">
                        <input
                          type="text"
                          className="form-control"
                          value={chatQ}
                          onChange={(e) => setChatQ(e.target.value)}
                          placeholder="Ex: Quels sont les risques ou les règles d’annulation ?"
                          disabled={chatBusy || !isAuthenticated}
                          maxLength={800}
                        />
                        <button
                          type="button"
                          className="btn btn-outline-primary"
                          disabled={chatBusy || !isAuthenticated || !chatQ.trim()}
                          onClick={async () => {
                            setChatBusy(true);
                            setChatErr("");
                            setChatA("");
                            setChatMode("");
                            try {
                              const { data } = await chatbotApi.askAboutProject(project._id, chatQ.trim());
                              setChatA(data?.answer || "—");
                              setChatMode(String(data?.mode || ""));
                              setChatQ("");
                            } catch (e) {
                              const out = extractApiError(e, "Impossible d’obtenir une réponse.");
                              setChatErr(out.message);
                            } finally {
                              setChatBusy(false);
                            }
                          }}
                        >
                          {chatBusy ? "Envoi…" : "Demander"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <hr className="my-4" />
          <div className="row g-3 small">
            <div className="col-sm-4">
              <span className="text-muted d-block">Objectif</span>
              <span className="fw-semibold">{project.fundingGoal} TND</span>
            </div>
            <div className="col-sm-4">
              <span className="text-muted d-block">Collecté</span>
              <span className="fw-semibold">{project.currentFunding} TND</span>
            </div>
            <div className="col-sm-4">
              <span className="text-muted d-block">Analyse IA</span>
              <span className="fw-semibold">
                {project.aiStatus === "COMPLETED"
                  ? "Terminée"
                  : project.aiStatus === "FAILED"
                    ? "Échouée"
                    : project.status !== "AWAITING_AI"
                      ? "Non lancée"
                      : project.aiStatus === "PENDING"
                        ? "En cours…"
                        : project.aiStatus || "—"}
              </span>
            </div>
          </div>

          {isOwner && project.aiStatus === "COMPLETED" && project.aiAnalysis && (
            <div className="card border-0 bg-light mt-4">
              <div className="card-body">
                <div className="fw-semibold mb-2">Résultat de l’analyse IA</div>
                <div className="row g-3 small">
                  <div className="col-md-4">
                    <span className="text-muted d-block">Niveau de risque</span>
                    <span className="fw-semibold">{project.aiAnalysis.riskLevel || "—"}</span>
                  </div>
                  <div className="col-md-4">
                    <span className="text-muted d-block">Score de risque</span>
                    <span className="fw-semibold">
                      {Number.isFinite(Number(project.aiAnalysis.riskScore))
                        ? `${Number(project.aiAnalysis.riskScore)}/100`
                        : "—"}
                    </span>
                  </div>
                  <div className="col-md-4">
                    <span className="text-muted d-block">Probabilité de succès</span>
                    <span className="fw-semibold">
                      {Number.isFinite(Number(project.aiAnalysis.successProbability))
                        ? `${Number(project.aiAnalysis.successProbability)}%`
                        : "—"}
                    </span>
                  </div>
                </div>
                {project.aiAnalysis?.report?.summary ? (
                  <div className="mt-3">
                    <div className="fw-semibold mb-1">Rapport (résumé)</div>
                    <div className="text-body small" style={{ whiteSpace: "pre-wrap" }}>
                      {project.aiAnalysis.report.summary}
                    </div>
                  </div>
                ) : null}

                {(project.aiAnalysis?.report?.improvements || []).length > 0 ? (
                  <div className="mt-3">
                    <div className="fw-semibold mb-1">À améliorer</div>
                    <ul className="small mb-0">
                      {project.aiAnalysis.report.improvements.slice(0, 6).map((x, idx) => (
                        <li key={idx}>{x}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {(project.aiAnalysis?.sourcesUsed || []).length > 0 ? (
                  <div className="mt-3">
                    <div className="fw-semibold mb-1">Sources consultées</div>
                    <ul className="small mb-0">
                      {project.aiAnalysis.sourcesUsed.slice(0, 6).map((s, idx) => (
                        <li key={idx}>
                          <a href={s.url} target="_blank" rel="noreferrer">
                            {s.domain || s.url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {project.aiAnalysis.analyzedAt && (
                  <div className="small text-muted mt-3">
                    Analysé le{" "}
                    {new Date(project.aiAnalysis.analyzedAt).toLocaleString("fr-FR")}
                  </div>
                )}
              </div>
            </div>
          )}
          {canReport && (
            <div className="mt-4">
              <button
                type="button"
                className="btn btn-outline-danger btn-sm"
                onClick={() => {
                  setShowReport((v) => !v);
                  setReportOk("");
                  setReportErr("");
                }}
              >
                <i className="fa-solid fa-flag me-2" aria-hidden="true" />
                Signaler ce projet
              </button>

              {showReport && (
                <div className="card border-0 bg-light mt-3">
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                      <div>
                        <div className="fw-semibold">Signalement</div>
                        <div className="small text-muted">
                          Un administrateur analysera votre signalement. Merci de rester factuel et respectueux.
                        </div>
                      </div>
                      <Link to="/reports" className="small text-decoration-none">
                        Voir mes signalements →
                      </Link>
                    </div>

                    {reportOk && (
                      <div className="alert alert-success py-2 small mb-3">
                        {reportOk}
                      </div>
                    )}
                    {reportErr && (
                      <div className="alert alert-danger py-2 small mb-3">
                        {reportErr}
                      </div>
                    )}

                    <div className="row g-2">
                      <div className="col-md-4">
                        <label className="form-label small text-muted mb-1">Type</label>
                        <select
                          className="form-select"
                          value={reportType}
                          onChange={(e) => setReportType(e.target.value)}
                          disabled={reportBusy}
                        >
                          <option value="FRAUD">Fraude</option>
                          <option value="INAPPROPRIATE_CONTENT">Contenu inapproprié</option>
                          <option value="SPAM">Spam</option>
                          <option value="OTHER">Autre</option>
                        </select>
                      </div>
                      <div className="col-md-8">
                        <label className="form-label small text-muted mb-1">Détails (optionnel)</label>
                        <textarea
                          className="form-control"
                          rows={2}
                          value={reportDesc}
                          onChange={(e) => setReportDesc(e.target.value)}
                          disabled={reportBusy}
                          placeholder="Décrivez brièvement le problème (liens, incohérences, preuves, etc.)."
                        />
                      </div>
                    </div>

                    <div className="d-flex flex-wrap gap-2 mt-3">
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={reportBusy}
                        onClick={async () => {
                          setReportBusy(true);
                          setReportOk("");
                          setReportErr("");
                          try {
                            await reportsApi.create({
                              projectId: project._id,
                              type: reportType,
                              description: reportDesc,
                            });
                            setReportOk("Merci. Votre signalement a été transmis.");
                            setReportDesc("");
                            setReportType("FRAUD");
                            setShowReport(false);
                          } catch (e) {
                            const out = extractApiError(e, "Impossible d’envoyer le signalement.");
                            setReportErr(out.message);
                          } finally {
                            setReportBusy(false);
                          }
                        }}
                      >
                        {reportBusy ? "Envoi…" : "Envoyer"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        disabled={reportBusy}
                        onClick={() => setShowReport(false)}
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {(canEdit || canArchive || canDelete) && (
            <div className="mt-4 d-flex flex-wrap gap-2">
              {canEdit && (
                <Link
                  to={`/projects/${project._id}/edit`}
                  className="btn btn-outline-secondary"
                >
                  Modifier
                </Link>
              )}
              {canArchive && (
                <button
                  type="button"
                  className="btn btn-outline-danger"
                  onClick={async () => {
                    try {
                      await projectsApi.archive(project._id);
                      await load();
                    } catch (err) {
                      const out = extractApiError(err, "Archivage impossible.");
                      setSubmitErr(out.message);
                    }
                  }}
                >
                  Archiver
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  className="btn btn-outline-danger"
                  onClick={() => {
                    setSubmitErr("");
                    setSubmitMsg("");
                    confirmAlert({
                      title: "Supprimer ce projet ?",
                      message:
                        "Action définitive. Possible uniquement tant que la campagne n’est pas active et qu’aucun financement n’a été enregistré.",
                      buttons: [
                        { label: "Annuler", onClick: () => {} },
                        {
                          label: "Supprimer",
                          onClick: () => {
                            (async () => {
                              try {
                                await projectsApi.remove(project._id);
                                navigate("/dashboard", {
                                  replace: true,
                                  state: { refresh: Date.now() },
                                });
                              } catch (err) {
                                const out = extractApiError(err, "Suppression impossible.");
                                setSubmitErr(out.message);
                              }
                            })();
                          },
                        },
                      ],
                    });
                  }}
                >
                  Supprimer
                </button>
              )}
            </div>
          )}

          {(submitMsg || submitErr) && (
            <div className="mt-3">
              {submitMsg && (
                <div className="alert alert-success py-2 small mb-2">
                  {submitMsg}
                </div>
              )}
              {submitErr && (
                <div className="alert alert-danger py-2 small mb-0">
                  {submitErr}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {canInvest && (
        <div className="card border-0 fc-surface-card mb-4">
          <div className="card-body p-4">
            <h2 className="h6 mb-2 d-flex align-items-center gap-2 text-dark">
              <i className="fa-solid fa-coins text-primary" aria-hidden="true" />
              Soutenir ce projet (paiement simulé)
            </h2>
            <p className="small text-muted mb-3">
              Vous allez ouvrir une page de paiement simulée. Choisissez un montant, puis confirmez :
              le système enregistre le résultat et met à jour la campagne.
            </p>
            <div className="row g-2 align-items-end">
              <div className="col-sm-5">
                <label className="form-label small text-muted mb-1">Montant (TND)</label>
                <input
                  type="number"
                  min="1"
                  step="10"
                  className="form-control"
                  value={investAmount}
                  onChange={(e) => setInvestAmount(e.target.value)}
                />
                <div className="form-text">Astuce : utilisez un pas de 10 TND, ou saisissez directement.</div>
              </div>
              <div className="col-sm-7 d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-fc-primary text-white"
                  disabled={investing}
                  onClick={async () => {
                    setInvesting(true);
                    setInvestErr("");
                    try {
                      const { data } = await investmentsApi.create({
                        projectId: project._id,
                        amount: investAmount,
                      });
                      navigate(data.paymentUrl);
                    } catch (err) {
                      const out = extractApiError(err, "Investissement impossible.");
                      setInvestErr(out.message);
                    } finally {
                      setInvesting(false);
                    }
                  }}
                >
                  {investing ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                        aria-hidden="true"
                      />
                      Préparation…
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-credit-card me-2" aria-hidden="true" />
                      Continuer vers le paiement
                    </>
                  )}
                </button>
                <Link to="/notifications" className="btn btn-outline-secondary">
                  <i className="fa-regular fa-bell me-2" aria-hidden="true" />
                  Mes notifications
                </Link>
              </div>
            </div>
            {investErr && <div className="alert alert-danger py-2 mt-3 mb-0">{investErr}</div>}
          </div>
        </div>
      )}

      {isPublicActive && (
        <div className="card border-0 fc-surface-card mb-4">
          <div className="card-body p-4">
            <h2 className="h6 mb-2 d-flex align-items-center gap-2 text-dark">
              <i className="fa-regular fa-comments text-primary" aria-hidden="true" />
              Commentaires
            </h2>
            <Guidance title="Règles" variant="info">
              Partagez un avis utile et respectueux. Pas d’informations sensibles (téléphone, IBAN, etc.).
            </Guidance>

            {commentErr && <div className="alert alert-warning py-2 small">{commentErr}</div>}
            {commentOk && <div className="alert alert-success py-2 small">{commentOk}</div>}

            {isAuthenticated && user?.role !== "ADMIN" ? (
              <form
                className="vstack gap-2 mb-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setCommentBusy(true);
                  setCommentErr("");
                  setCommentOk("");
                  try {
                    const { data } = await projectsApi.createComment(project._id, { content: commentText });
                    setCommentOk(data.message || "Commentaire publié.");
                    setCommentText("");
                    const { data: listData } = await projectsApi.listComments(project._id);
                    setComments(listData.comments || []);
                  } catch (e2) {
                    const out = extractApiError(e2, "Publication impossible.");
                    setCommentErr(out.message);
                  } finally {
                    setCommentBusy(false);
                  }
                }}
              >
                <textarea
                  className="form-control"
                  rows={3}
                  maxLength={1000}
                  placeholder="Écrivez votre commentaire…"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                />
                <div className="d-flex justify-content-between align-items-center">
                  <div className="small text-muted">{(commentText || "").length}/1000</div>
                  <button className="btn btn-outline-primary btn-sm" disabled={commentBusy || !commentText.trim()}>
                    {commentBusy ? "Envoi…" : "Publier"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="small text-muted mb-3">
                Connectez-vous avec un compte utilisateur pour publier un commentaire.
              </div>
            )}

            {comments.length === 0 ? (
              <div className="text-muted small">Aucun commentaire pour le moment.</div>
            ) : (
              <div className="vstack gap-2">
                {comments.slice(0, 20).map((c) => (
                  <div key={c._id} className="border rounded-3 p-3 bg-white">
                    <div className="d-flex justify-content-between gap-2">
                      <div className="fw-semibold text-dark small text-truncate">
                        {c.authorLabel || "Utilisateur"}
                      </div>
                      <div className="text-muted small">
                        {c.createdAt ? new Date(c.createdAt).toLocaleString() : "—"}
                      </div>
                    </div>
                    <div className="small mt-2" style={{ whiteSpace: "pre-wrap" }}>
                      {c.content}
                    </div>
                    {isAuthenticated && user?.role !== "ADMIN" ? (
                      <div className="d-flex justify-content-end gap-2 mt-2">
                        {(String(c.userId) === String(user?.id || user?._id)) && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={async () => {
                              const ok = window.confirm("Supprimer votre commentaire ? Cette action est définitive.");
                              if (!ok) return;
                              setCommentBusy(true);
                              setCommentErr("");
                              setCommentOk("");
                              try {
                                await projectsApi.deleteComment(project._id, c._id);
                                setCommentOk("Commentaire supprimé.");
                                const { data: listData } = await projectsApi.listComments(project._id);
                                setComments(listData.comments || []);
                              } catch (e2) {
                                const out = extractApiError(e2, "Suppression impossible.");
                                setCommentErr(out.message);
                              } finally {
                                setCommentBusy(false);
                              }
                            }}
                            disabled={commentBusy}
                          >
                            Supprimer
                          </button>
                        )}
                        {String(c.userId) !== String(user?.id || user?._id) && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            disabled={commentBusy}
                            onClick={async () => {
                              const reason = window.prompt("Pourquoi signalez-vous ce commentaire ? (obligatoire)", "");
                              if (!reason || !String(reason).trim()) return;
                              setCommentBusy(true);
                              setCommentErr("");
                              setCommentOk("");
                              try {
                                const { data } = await reportsApi.createComment({
                                  projectId: project._id,
                                  commentId: c._id,
                                  type: "INAPPROPRIATE_CONTENT",
                                  description: String(reason).trim(),
                                });
                                setCommentOk(data.message || "Signalement envoyé.");
                              } catch (e2) {
                                const out = extractApiError(e2, "Signalement impossible.");
                                setCommentErr(out.message);
                              } finally {
                                setCommentBusy(false);
                              }
                            }}
                          >
                            Signaler
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {analysisInProgress && (
        <div className="alert alert-info border-0 shadow-sm mb-4">
          <div className="fw-semibold mb-1">
            {likelyQuotaWait ? "Analyse en attente (quota IA)" : "Analyse en cours"}
          </div>
          <div className="small">
            {likelyQuotaWait ? (
              <>
                Le service IA est momentanément limité (quota). La plateforme réessaie automatiquement.
                Selon le type de limite (par minute ou par jour), le délai peut varier. Les quotas “par jour” reviennent
                généralement au prochain reset (souvent à minuit, heure du Pacifique), donc pas forcément à minuit chez vous.
              </>
            ) : (
              <>
                Votre projet est en cours d’analyse automatique. En général, cela prend peu de temps.
                Vous serez notifié(e) dès que l’analyse est terminée et que la revue démarre.
              </>
            )}
          </div>
          {likelyQuotaWait && queuedAtLabel && (
            <div className="small text-muted mt-2">
              Dernière mise en file : <strong>{queuedAtLabel}</strong>
            </div>
          )}
          {likelyQuotaWait && nextRetryLabel && (
            <div className="small text-muted mt-1">
              Prochaine tentative estimée : <strong>{nextRetryLabel}</strong>
            </div>
          )}
          {autoRefreshing && (
            <div className="small text-muted mt-2">
              Mise à jour automatique en cours…
            </div>
          )}
        </div>
      )}

      {analysisFailed && (
        <div className="alert alert-warning border-0 shadow-sm mb-4">
          <div className="fw-semibold mb-1">Analyse indisponible</div>
          <div className="small">
            L’analyse automatique n’a pas pu être finalisée après plusieurs
            tentatives. Votre projet reste en attente et sera pris en charge par
            un administrateur. Aucune action n’est requise de votre part pour le
            moment.
          </div>
        </div>
      )}

      {isOwner && project.status === "REJECTED" && !project.isArchived && (
        <Guidance title="Projet à corriger" variant="warning">
          Votre projet a été rejeté temporairement.{" "}
          {project.rejectionReason ? (
            <>
              <strong>Pourquoi ?</strong> {project.rejectionReason}
            </>
          ) : (
            <>Un administrateur a demandé des ajustements.</>
          )}{" "}
          Modifiez le projet, puis renvoyez‑le pour révision.
        </Guidance>
      )}

      {isOwner && project.status === "DRAFT" && !project.isArchived && (
        <div className="card border-0 fc-surface-card mb-4">
          <div className="card-body">
            <h2 className="h6 text-uppercase text-muted mb-3">
              Étape suivante
            </h2>
            <Guidance title="Que va-t-il se passer ?" variant="info">
              Après soumission, votre projet passe en <strong>analyse IA</strong>, puis en revue par l’administration
              avant publication. Vous pourrez suivre l’état directement ici.
            </Guidance>
            {submitMsg && (
              <div className="alert alert-success py-2 small">{submitMsg}</div>
            )}
            {submitErr && (
              <div className="alert alert-danger py-2 small">{submitErr}</div>
            )}
            <button
              type="button"
              className="btn btn-fc-primary text-white"
              disabled={submitting}
              onClick={submitForAi}
            >
              {submitting ? "Envoi…" : "Soumettre"}
            </button>
          </div>
        </div>
      )}

      {isOwner && project.status === "APPROVED" && !project.isArchived && (
        <Guidance title="Projet approuvé (non publié)" variant="info">
          Votre projet a été <strong>approuvé</strong> par l’administration. Il n’est pas encore visible dans “Explorer”.
          Un administrateur doit maintenant <strong>le publier</strong> pour l’ouvrir au public et aux contributions.
        </Guidance>
      )}

      <div className="d-flex flex-wrap gap-2">
        {isOwner ? (
          <Link to="/dashboard" className="btn btn-outline-secondary">
            ← Retour au tableau de bord
          </Link>
        ) : (
          <Link to="/" className="btn btn-outline-secondary">
            ← Accueil
          </Link>
        )}
      </div>
    </div>
  );
}
