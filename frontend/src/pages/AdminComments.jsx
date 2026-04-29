import { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/ui/PageHeader.jsx";
import PageLoader from "../components/ui/PageLoader.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { adminApi } from "../api/admin.js";
import { extractApiError } from "../utils/apiError.js";

export default function AdminComments() {
  const [projectId, setProjectId] = useState("");
  const [q, setQ] = useState("");
  const [includeHidden, setIncludeHidden] = useState(true);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const params = useMemo(() => {
    const p = { limit: 80, includeHidden: includeHidden ? "true" : "false" };
    if (projectId.trim()) p.projectId = projectId.trim();
    if (q.trim()) p.q = q.trim();
    return p;
  }, [projectId, q, includeHidden]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data } = await adminApi.listComments(params);
      setItems(data.comments || []);
    } catch (e) {
      const out = extractApiError(e, "Impossible de charger les commentaires.");
      setError(out.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  return (
    <div>
      <PageHeader
        title="Modération des commentaires"
        subtitle="Masquer un commentaire le retire de l’espace public (sans le supprimer définitivement)."
      />

      <div className="card border-0 fc-surface-card mb-3">
        <div className="card-body p-3 p-md-4">
          <div className="row g-3 align-items-end">
            <div className="col-md-4">
              <label className="form-label small text-muted mb-1">Filtrer par projet (ID)</label>
              <input
                className="form-control"
                placeholder="ObjectId du projet…"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              />
            </div>
            <div className="col-md-5">
              <label className="form-label small text-muted mb-1">Recherche texte</label>
              <input
                className="form-control"
                placeholder="Mot-clé…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <div className="form-check form-switch mt-2">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id="includeHidden"
                  checked={includeHidden}
                  onChange={(e) => setIncludeHidden(e.target.checked)}
                />
                <label className="form-check-label small text-muted" htmlFor="includeHidden">
                  Inclure masqués
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}
      {loading && <PageLoader label="Chargement…" />}

      {!loading && !error && items.length === 0 && (
        <EmptyState
          icon="fa-regular fa-comments"
          title="Aucun commentaire"
          description="Aucun résultat avec ces filtres."
        />
      )}

      {!loading && !error && items.length > 0 && (
        <div className="card border-0 fc-surface-card">
          <div className="table-responsive rounded-3">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>Projet</th>
                  <th>Auteur</th>
                  <th>Contenu</th>
                  <th>État</th>
                  <th style={{ width: "1%" }} />
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c._id}>
                    <td className="text-muted small text-truncate" style={{ maxWidth: "10rem" }}>
                      {String(c.projectId || "—")}
                    </td>
                    <td className="small">
                      <div className="fw-semibold text-truncate" style={{ maxWidth: "12rem" }}>
                        {c.authorLabel || "Utilisateur"}
                      </div>
                      <div className="text-muted">{c.createdAt ? new Date(c.createdAt).toLocaleString() : "—"}</div>
                    </td>
                    <td style={{ minWidth: "22rem" }}>
                      <div className="small" style={{ whiteSpace: "pre-wrap" }}>
                        {c.content}
                      </div>
                      {c.isHidden && c.hiddenReason ? (
                        <div className="small text-muted mt-2">
                          <strong>Raison:</strong> {c.hiddenReason}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      {c.isHidden ? (
                        <span className="badge bg-secondary">Masqué</span>
                      ) : (
                        <span className="badge bg-success">Visible</span>
                      )}
                    </td>
                    <td className="text-end">
                      {!c.isHidden ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          disabled={busyId === c._id}
                          onClick={async () => {
                            const reason = window.prompt("Raison du masquage (optionnel) :", "");
                            setBusyId(c._id);
                            try {
                              await adminApi.hideComment(c._id, { reason: reason || "" });
                              await load();
                            } catch (e) {
                              const out = extractApiError(e, "Action impossible.");
                              setError(out.message);
                            } finally {
                              setBusyId(null);
                            }
                          }}
                        >
                          Masquer
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          disabled={busyId === c._id}
                          onClick={async () => {
                            setBusyId(c._id);
                            try {
                              await adminApi.unhideComment(c._id);
                              await load();
                            } catch (e) {
                              const out = extractApiError(e, "Action impossible.");
                              setError(out.message);
                            } finally {
                              setBusyId(null);
                            }
                          }}
                        >
                          Rétablir
                        </button>
                      )}
                    </td>
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

