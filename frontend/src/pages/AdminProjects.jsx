import { useEffect, useMemo, useState } from "react";
import { adminApi } from "../api/admin";
import { useAuth } from "../hooks/useAuth";
import PageHeader from "../components/ui/PageHeader.jsx";
import PageLoader from "../components/ui/PageLoader.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { extractApiError } from "../utils/apiError";
import { confirmAlert } from "react-confirm-alert";
import Alert from "../components/ui/Alert.jsx";

function badgeClass(status) {
  const map = {
    DRAFT: "bg-secondary",
    AWAITING_AI: "bg-secondary",
    UNDER_REVIEW: "bg-warning text-dark",
    APPROVED: "bg-success",
    REJECTED: "bg-danger",
    ACTIVE: "bg-primary",
    FUNDED: "bg-info text-dark",
    CLOSED: "bg-light text-dark border",
    SUSPENDED: "bg-dark",
  };
  return `badge ${map[status] || "bg-secondary"}`;
}

function statusLabel(status) {
  if (status === "APPROVED") return "APPROUVÉ (non publié)";
  if (status === "DRAFT") return "BROUILLON";
  if (status === "AWAITING_AI") return "EN ATTENTE IA";
  if (status === "UNDER_REVIEW") return "EN REVUE";
  if (status === "ACTIVE") return "EN LIGNE";
  if (status === "FUNDED") return "FINANCÉ";
  if (status === "REJECTED") return "REJETÉ";
  if (status === "CLOSED") return "CLÔTURÉ";
  if (status === "SUSPENDED") return "SUSPENDU";
  return String(status || "—");
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
  const [ok, setOk] = useState("");
  const [feedbackById, setFeedbackById] = useState({});
  const [busyId, setBusyId] = useState(null);

  const canAccess = user?.role === "ADMIN";
  const usesFeedback = useMemo(() => {
    // Feedback utile uniquement quand il est envoyé comme motif au créateur.
    // - UNDER_REVIEW: Rejeter (raison)
    // - APPROVED: Annuler approbation (motif obligatoire)
    // - ACTIVE/FUNDED: Suspendre (motif optionnel)
    return ["UNDER_REVIEW", "APPROVED", "ACTIVE", "FUNDED"].includes(String(tab));
  }, [tab]);
  const title = useMemo(() => {
    if (tab === "DRAFT") return "Brouillons";
    if (tab === "AWAITING_AI") return "En attente d’analyse IA";
    if (tab === "UNDER_REVIEW") return "Projets en revue";
    if (tab === "APPROVED") return "Projets approuvés (à publier)";
    if (tab === "ACTIVE") return "Campagnes en ligne";
    if (tab === "FUNDED") return "Projets financés";
    if (tab === "SUSPENDED") return "Projets suspendus";
    if (tab === "REJECTED") return "Projets rejetés";
    if (tab === "CLOSED") return "Projets clôturés";
    return "Projets";
  }, [tab]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await adminApi.listProjects({ status: tab, limit: 40 });
      setProjects(res.data.projects || []);
    } catch (e) {
      const out = extractApiError(e, "Impossible de charger la liste.");
      setError(out.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canAccess) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, canAccess]);

  async function doApprove(p, { publishAfter = false } = {}) {
    setBusyId(p._id);
    setError("");
    setOk("");
    try {
      await adminApi.validateProject(p._id, {
        decision: "APPROVED",
        feedback: feedbackById[p._id] || "",
      });
      if (publishAfter) {
        await adminApi.publishProject(p._id);
      }
      await load();
      setOk(
        publishAfter
          ? "Projet approuvé et publié (campagne en ligne)."
          : "Projet approuvé. Il doit encore être publié pour apparaître dans l’explorer."
      );
    } catch (e) {
      const out = extractApiError(e, "Action impossible.");
      setError(out.message);
    } finally {
      setBusyId(null);
    }
  }

  function approve(p) {
    confirmAlert({
      title: "Approuver le projet",
      message:
        "Un projet approuvé n’est pas encore visible dans “Explorer” tant qu’il n’est pas publié.\n\nSouhaitez-vous le publier maintenant ?",
      buttons: [
        {
          label: "Approuver seulement",
          onClick: () => doApprove(p, { publishAfter: false }),
        },
        {
          label: "Approuver & publier",
          onClick: () => doApprove(p, { publishAfter: true }),
        },
      ],
    });
  }

  function viewAiReport(p) {
    const a = p?.aiAnalysis || null;
    const report = a?.report || null;
    const improvements = Array.isArray(report?.improvements) ? report.improvements : [];
    const disadvantages = Array.isArray(report?.disadvantages) ? report.disadvantages : [];
    const advantages = Array.isArray(report?.advantages) ? report.advantages : [];
    const removals = Array.isArray(report?.removals) ? report.removals : [];
    const questions = Array.isArray(report?.questionsToClarify) ? report.questionsToClarify : [];
    const summary = String(report?.summary || "").trim();

    const riskLevel = String(a?.riskLevel || "");
    const riskLabel = riskLevel === "HIGH" ? "Élevé" : riskLevel === "MEDIUM" ? "Moyen" : riskLevel === "LOW" ? "Faible" : "—";
    const riskBadge =
      riskLevel === "HIGH"
        ? "bg-danger"
        : riskLevel === "MEDIUM"
          ? "bg-warning text-dark"
          : riskLevel === "LOW"
            ? "bg-success"
            : "bg-light text-dark border";
    const scoreLabel = Number.isFinite(Number(a?.riskScore)) ? `${Number(a.riskScore)}/100` : "—";

    confirmAlert({
      customUI: ({ onClose }) => (
        <div className="card border-0 shadow" style={{ width: "min(860px, 94vw)" }}>
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-start gap-3">
              <div className="d-flex flex-column gap-1">
                <div className="h5 mb-0">Rapport d’analyse IA</div>
                <div className="text-muted small">
                  {p?.title ? (
                    <>
                      Projet: <strong className="text-dark">{p.title}</strong>
                    </>
                  ) : (
                    "—"
                  )}
                </div>
                <div className="d-flex flex-wrap gap-2 mt-1">
                  <span className={`badge ${riskBadge}`}>Risque: {riskLabel}</span>
                  <span className="badge bg-light text-dark border">Score: {scoreLabel}</span>
                </div>
              </div>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>
                Fermer
              </button>
            </div>

            <div className="mt-3">
              <div className="fw-semibold mb-1">Résumé</div>
              <div className="small text-muted" style={{ whiteSpace: "pre-wrap" }}>
                {summary || "—"}
              </div>
            </div>

            <div className="row g-3 mt-1">
              <div className="col-12 col-md-6">
                <div className="card border-0 bg-light">
                  <div className="card-body py-3">
                    <div className="fw-semibold mb-2">Points forts</div>
                    {advantages.length ? (
                      <ul className="small mb-0">
                        {advantages.slice(0, 6).map((x, i) => (
                          <li key={`adv-${i}`}>{x}</li>
                        ))}
                      </ul>
                    ) : (
                      <div className="small text-muted">—</div>
                    )}
                  </div>
                </div>
              </div>
              <div className="col-12 col-md-6">
                <div className="card border-0 bg-light">
                  <div className="card-body py-3">
                    <div className="fw-semibold mb-2">Points faibles</div>
                    {disadvantages.length ? (
                      <ul className="small mb-0">
                        {disadvantages.slice(0, 6).map((x, i) => (
                          <li key={`dis-${i}`}>{x}</li>
                        ))}
                      </ul>
                    ) : (
                      <div className="small text-muted">—</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="col-12 col-md-6">
                <div className="card border-0 bg-light">
                  <div className="card-body py-3">
                    <div className="fw-semibold mb-2">Améliorations suggérées</div>
                    {improvements.length ? (
                      <ul className="small mb-0">
                        {improvements.slice(0, 6).map((x, i) => (
                          <li key={`imp-${i}`}>{x}</li>
                        ))}
                      </ul>
                    ) : (
                      <div className="small text-muted">—</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="col-12 col-md-6">
                <div className="card border-0 bg-light">
                  <div className="card-body py-3">
                    <div className="fw-semibold mb-2">À enlever / corriger</div>
                    {removals.length ? (
                      <ul className="small mb-0">
                        {removals.slice(0, 6).map((x, i) => (
                          <li key={`rem-${i}`}>{x}</li>
                        ))}
                      </ul>
                    ) : (
                      <div className="small text-muted">—</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="col-12">
                <div className="card border-0 bg-light">
                  <div className="card-body py-3">
                    <div className="fw-semibold mb-2">Questions à clarifier</div>
                    {questions.length ? (
                      <ul className="small mb-0">
                        {questions.slice(0, 6).map((x, i) => (
                          <li key={`q-${i}`}>{x}</li>
                        ))}
                      </ul>
                    ) : (
                      <div className="small text-muted">—</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    });
  }

  async function reject(p) {
    setBusyId(p._id);
    setError("");
    setOk("");
    try {
      await adminApi.validateProject(p._id, {
        decision: "REJECTED",
        feedback: feedbackById[p._id] || "",
      });
      await load();
      setOk("Projet rejeté. Le créateur a été notifié avec le motif.");
    } catch (e) {
      const out = extractApiError(e, "Action impossible.");
      setError(out.message);
    } finally {
      setBusyId(null);
    }
  }

  async function publish(p) {
    setBusyId(p._id);
    setError("");
    setOk("");
    try {
      await adminApi.publishProject(p._id);
      await load();
      setOk("Projet publié. La campagne est visible publiquement.");
    } catch (e) {
      const out = extractApiError(e, "Action impossible.");
      setError(out.message);
    } finally {
      setBusyId(null);
    }
  }

  async function revokeApproval(p) {
    const reason = String(feedbackById[p._id] || "").trim();
    if (!reason) {
      setError("Merci de renseigner le feedback (motif) avant d’annuler l’approbation.");
      return;
    }
    confirmAlert({
      title: "Annuler l’approbation ?",
      message:
        "Le projet repassera en “Rejeté” (à corriger) et le créateur sera notifié avec votre motif.\n\nConfirmer ?",
      buttons: [
        { label: "Annuler", onClick: () => {} },
        {
          label: "Confirmer",
          onClick: async () => {
            setBusyId(p._id);
            setError("");
            setOk("");
            try {
              await adminApi.revokeApproval(p._id, { reason });
              await load();
              setOk("Approbation annulée. Corrections demandées au créateur.");
            } catch (e) {
              const out = extractApiError(e, "Action impossible.");
              setError(out.message);
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    });
  }

  async function retryAi(p) {
    setBusyId(p._id);
    setError("");
    setOk("");
    try {
      const { data } = await adminApi.retryAiAnalysis(p._id);
      await load();
      const queued = Boolean(data?.diagnostics?.queued);
      const jobId = data?.diagnostics?.jobId ? String(data.diagnostics.jobId) : "";
      const hint = String(data?.diagnostics?.hint || "").trim();
      setOk(
        queued
          ? `Analyse IA relancée. Job en file${jobId ? ` (#${jobId})` : ""}. ${hint || ""}`.trim()
          : `Impossible de mettre en file l’analyse IA. ${hint || "Vérifiez Redis/n8n."}`.trim()
      );
    } catch (e) {
      const out = extractApiError(e, "Action impossible.");
      setError(out.message);
    } finally {
      setBusyId(null);
    }
  }

  async function reactivate(p) {
    setBusyId(p._id);
    setError("");
    setOk("");
    try {
      await adminApi.reactivateProject(p._id);
      await load();
      setOk("Projet réactivé.");
    } catch (e) {
      const out = extractApiError(e, "Action impossible.");
      setError(out.message);
    } finally {
      setBusyId(null);
    }
  }

  async function deactivate(p) {
    confirmAlert({
      title: "Suspendre ce projet ?",
      message:
        "Le projet ne sera plus visible publiquement et les investissements ne seront plus possibles.\n\nConfirmer ?",
      buttons: [
        { label: "Annuler", onClick: () => {} },
        {
          label: "Suspendre",
          onClick: async () => {
            setBusyId(p._id);
            setError("");
            setOk("");
            try {
              await adminApi.deactivateProject(p._id, { reason: feedbackById[p._id] || "" });
              await load();
              setOk("Projet suspendu.");
            } catch (e) {
              const out = extractApiError(e, "Action impossible.");
              setError(out.message);
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    });
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
        subtitle="Validez les dossiers en revue, publiez les projets approuvés, puis modérez les campagnes en ligne (suspension possible avec motif optionnel)."
        actions={
          <div className="btn-group shadow-sm">
            <button
              type="button"
              className={`btn btn-sm ${tab === "AWAITING_AI" ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => setTab("AWAITING_AI")}
            >
              IA en cours
            </button>
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
              className={`btn btn-sm ${tab === "ACTIVE" ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => setTab("ACTIVE")}
            >
              En ligne
            </button>
            <button
              type="button"
              className={`btn btn-sm ${tab === "FUNDED" ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => setTab("FUNDED")}
            >
              Financés
            </button>
            <button
              type="button"
              className={`btn btn-sm ${tab === "CLOSED" ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => setTab("CLOSED")}
            >
              Clôturés
            </button>
            <button
              type="button"
              className={`btn btn-sm ${tab === "REJECTED" ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => setTab("REJECTED")}
            >
              Rejetés
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

      {error && <Alert variant="danger" className="mb-0">{error}</Alert>}
      {ok && <Alert variant="success" className="mb-0">{ok}</Alert>}

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
                    {usesFeedback ? <th style={{ minWidth: "18rem" }}>Feedback</th> : null}
                    <th style={{ width: "1%" }} />
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => (
                    <tr key={p._id}>
                      <td className="fw-semibold">{p.title}</td>
                      <td>
                        <span className={badgeClass(p.status)}>{statusLabel(p.status)}</span>
                        {p.status === "AWAITING_AI" ? (
                          <div className="text-muted small mt-1">
                            IA: <strong>{p.aiStatus || "PENDING"}</strong>
                            {p.aiQueuedAt ? ` · mis en file: ${new Date(p.aiQueuedAt).toLocaleString("fr-FR")}` : ""}
                            {p.aiLastError ? ` · erreur: ${String(p.aiLastError).slice(0, 90)}…` : ""}
                          </div>
                        ) : null}
                        {p.status === "APPROVED" && (
                          <div className="text-muted small mt-1">
                            Visible public : <strong>non</strong> (publier pour ouvrir la campagne).
                          </div>
                        )}
                      </td>
                      <td className="text-muted small">{formatDate(p.createdAt)}</td>
                      <td className="text-muted small">{formatDate(p.startAt)}</td>
                      <td className="text-muted small">{formatDate(p.deadline)}</td>
                      {usesFeedback ? (
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
                      ) : null}
                      <td className="text-end">
                        <div className="d-inline-flex flex-column align-items-stretch gap-1" style={{ minWidth: 140 }}>
                          {p.aiStatus === "COMPLETED" && p.aiAnalysis ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-dark"
                              disabled={busyId === p._id}
                              onClick={() => viewAiReport(p)}
                            >
                              Rapport IA
                            </button>
                          ) : null}

                          {p.status === "UNDER_REVIEW" ? (
                            <div className="btn-group">
                              <button
                                type="button"
                                className="btn btn-sm btn-success"
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
                              {busyId === p._id ? "Relance…" : "Relancer IA"}
                            </button>
                        ) : p.status === "REJECTED" ? (
                          <div className="text-muted small">En attente de corrections côté créateur.</div>
                          ) : p.status === "SUSPENDED" ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-success"
                              disabled={busyId === p._id}
                              onClick={() => reactivate(p)}
                            >
                              Réactiver
                            </button>
                          ) : p.status === "APPROVED" ? (
                            <div className="btn-group">
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                disabled={busyId === p._id}
                                onClick={() => publish(p)}
                              >
                                Publier
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                disabled={busyId === p._id}
                                onClick={() => revokeApproval(p)}
                              >
                                Annuler
                              </button>
                            </div>
                          ) : p.status === "ACTIVE" || p.status === "FUNDED" ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              disabled={busyId === p._id}
                              onClick={() => deactivate(p)}
                            >
                              Suspendre
                            </button>
                          ) : null}
                        </div>
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

