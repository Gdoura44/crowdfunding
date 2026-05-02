import { useEffect, useState } from "react";
import { adminApi } from "../api/admin";
import { useAuth } from "../hooks/useAuth";
import PageHeader from "../components/ui/PageHeader.jsx";
import PageLoader from "../components/ui/PageLoader.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { extractApiError } from "../utils/apiError";
import Alert from "../components/ui/Alert.jsx";
import { confirmAlert } from "react-confirm-alert";

export default function AdminReports() {
  const { user } = useAuth();
  const [status, setStatus] = useState("PENDING");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [resolutionById, setResolutionById] = useState({});
  const [actionById, setActionById] = useState({});
  const [decisionById, setDecisionById] = useState({});

  const canAccess = user?.role === "ADMIN";

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data } = await adminApi.listReports({ status, limit: 80 });
      setItems(data.reports || []);
    } catch (e) {
      const out = extractApiError(e, "Impossible de charger les signalements.");
      setError(out.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canAccess) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, canAccess]);

  if (!canAccess) {
    return (
      <div className="card border-0 fc-surface-card">
        <div className="card-body p-4 text-center text-muted">Accès réservé aux administrateurs.</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Signalements"
        subtitle="Traitez les signalements utilisateurs et appliquez une action si nécessaire."
        actions={
          <div className="btn-group shadow-sm">
            <button
              type="button"
              className={`btn btn-sm ${status === "PENDING" ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => setStatus("PENDING")}
            >
              En attente
            </button>
            <button
              type="button"
              className={`btn btn-sm ${status === "RESOLVED" ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => setStatus("RESOLVED")}
            >
              Traités
            </button>
          </div>
        }
      />

      {error && <Alert variant="danger">{error}</Alert>}
      {ok && <Alert variant="success">{ok}</Alert>}
      {loading && <PageLoader label="Chargement…" />}

      {!loading && !error && items.length === 0 && (
        <EmptyState
          icon="fa-solid fa-flag"
          title="Aucun signalement"
          description="Rien à traiter pour le moment."
        />
      )}

      {!loading && items.length > 0 && (
        <div className="card border-0 fc-surface-card">
          <div className="table-responsive rounded-3">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Projet</th>
                  <th>Rapporteur</th>
                  <th>Date</th>
                  {status === "PENDING" && <th style={{ minWidth: "16rem" }}>Résolution</th>}
                  {status === "PENDING" && <th style={{ width: "1%" }} />}
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r._id}>
                    <td>
                      <span className="badge bg-light text-dark border">{r.type}</span>
                    </td>
                    <td className="small text-muted" style={{ maxWidth: "28rem" }}>
                      {r.description || "—"}
                    </td>
                    <td className="small text-muted">
                      <div className="text-truncate" style={{ maxWidth: "18rem" }}>
                        {r.projectId && typeof r.projectId === "object"
                          ? r.projectId.title || String(r.projectId._id || "—")
                          : String(r.projectId || "—")}
                      </div>
                      {r.projectId && typeof r.projectId === "object" && r.projectId.status ? (
                        <div className="text-muted small">Statut projet : {r.projectId.status}</div>
                      ) : null}
                      {r.commentId ? (
                        <div className="mt-2">
                          <div className="d-flex align-items-center gap-2">
                            <span className="badge bg-light text-dark border">COMMENT</span>
                            <span className="text-muted small">
                              {r.commentId && typeof r.commentId === "object" && r.commentId.createdAt
                                ? new Date(r.commentId.createdAt).toLocaleString("fr-FR")
                                : "—"}
                            </span>
                            {r.commentId && typeof r.commentId === "object" && (r.commentId.deletedAt || r.commentId.isHidden) ? (
                              <span className="badge bg-secondary">
                                {r.commentId.deletedAt ? "Supprimé" : "Masqué"}
                              </span>
                            ) : null}
                          </div>
                          <div className="small mt-1" style={{ whiteSpace: "pre-wrap" }}>
                            {r.commentId && typeof r.commentId === "object" ? (r.commentId.content || "—") : "—"}
                          </div>
                        </div>
                      ) : null}
                    </td>
                    <td className="small text-muted">
                      {r.reporterId && typeof r.reporterId === "object"
                        ? [
                            r.reporterId.profile?.firstName,
                            r.reporterId.profile?.lastName,
                          ].filter(Boolean).join(" ") ||
                          String(r.reporterId.email || r.reporterId._id || "—")
                        : String(r.reporterId || "—")}
                    </td>
                    <td className="small text-muted">
                      {r.createdAt ? new Date(r.createdAt).toLocaleString("fr-FR") : "—"}
                    </td>
                    {status === "PENDING" && (
                      <td>
                        <textarea
                          className="form-control form-control-sm"
                          rows={2}
                          placeholder="Expliquez la décision…"
                          value={resolutionById[r._id] || ""}
                          onChange={(e) =>
                            setResolutionById((p) => ({ ...p, [r._id]: e.target.value }))
                          }
                        />
                        <select
                          className="form-select form-select-sm mt-2"
                          value={decisionById[r._id] || "RESOLVED"}
                          onChange={(e) =>
                            setDecisionById((p) => ({ ...p, [r._id]: e.target.value }))
                          }
                        >
                          <option value="RESOLVED">Résoudre</option>
                          <option value="DISMISSED">Rejeter (dismiss)</option>
                        </select>
                        <select
                          className="form-select form-select-sm mt-2"
                          value={actionById[r._id] || ""}
                          onChange={(e) =>
                            setActionById((p) => ({ ...p, [r._id]: e.target.value }))
                          }
                        >
                          {r.commentId ? (
                            <>
                              <option value="">Aucune action sur le commentaire</option>
                              <option value="HIDE_COMMENT">Masquer le commentaire</option>
                              <option value="DELETE_COMMENT">Supprimer le commentaire</option>
                            </>
                          ) : (
                            <>
                              <option value="">Aucune action sur le projet</option>
                              <option value="WARNING">Avertissement</option>
                              <option value="DEACTIVATE">Suspendre le projet</option>
                            </>
                          )}
                        </select>
                      </td>
                    )}
                    {status === "PENDING" && (
                      <td className="text-end">
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          disabled={busyId === r._id || !(resolutionById[r._id] || "").trim()}
                          onClick={async () => {
                            const action = actionById[r._id] || "";
                            const decision = decisionById[r._id] || "RESOLVED";
                            const isDestructive =
                              action === "DELETE_COMMENT" || action === "HIDE_COMMENT" || action === "DEACTIVATE";
                            const doRun = async () => {
                              setBusyId(r._id);
                              setError("");
                              setOk("");
                              try {
                                await adminApi.resolveReport(r._id, {
                                  resolution: resolutionById[r._id],
                                  actionOnProject: r.commentId ? undefined : actionById[r._id] || undefined,
                                  actionOnComment: r.commentId ? actionById[r._id] || undefined : undefined,
                                  status: decisionById[r._id] || "RESOLVED",
                                });
                                await load();
                                setOk("Signalement traité.");
                              } catch (e) {
                                const out = extractApiError(e, "Action impossible.");
                                setError(out.message);
                              } finally {
                                setBusyId(null);
                              }
                            };

                            if (!isDestructive) {
                              await doRun();
                              return;
                            }

                            confirmAlert({
                              title: "Confirmer l’action ?",
                              message: `Décision: ${decision}\nAction: ${action || "Aucune"}\n\nCette action impactera le contenu/projet.`,
                              buttons: [
                                { label: "Annuler", onClick: () => {} },
                                { label: "Confirmer", onClick: () => void doRun() },
                              ],
                            });
                          }}
                        >
                          Traiter
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

