import { useEffect, useState } from "react";
import { adminApi } from "../api/admin";
import { useAuth } from "../hooks/useAuth";
import PageHeader from "../components/ui/PageHeader.jsx";
import PageLoader from "../components/ui/PageLoader.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { extractApiError } from "../utils/apiError";

export default function AdminUsers() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const canAccess = user?.role === "ADMIN";

  async function reload() {
    const { data } = await adminApi.listUsers({ limit: 60 });
    setItems(data.users || []);
  }

  useEffect(() => {
    if (!canAccess) return;
    let cancelled = false;
    setError("");
    setLoading(true);
    (async () => {
      try {
        const { data } = await adminApi.listUsers({ limit: 60 });
        if (!cancelled) setItems(data.users || []);
      } catch (e) {
        if (!cancelled) {
          const out = extractApiError(e, "Impossible de charger les utilisateurs.");
          setError(out.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canAccess]);

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
        title="Utilisateurs"
        subtitle="Vue d’ensemble des comptes enregistrés (e-mail, rôle, activation)."
      />
      {error && <div className="alert alert-danger py-2">{error}</div>}
      {loading && <PageLoader label="Chargement des comptes…" />}
      {!loading && !error && items.length === 0 && (
        <EmptyState icon="fa-solid fa-users" title="Aucun utilisateur" description="Aucune donnée à afficher." />
      )}
      {!loading && items.length > 0 && (
        <div className="card border-0 fc-surface-card">
          <div className="table-responsive rounded-3">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>E-mail</th>
                  <th>Nom</th>
                  <th>Rôle</th>
                  <th>Compte activé</th>
                  <th>Inscription</th>
                  <th style={{ width: "1%" }} />
                </tr>
              </thead>
              <tbody>
                {items.map((u) => (
                  <tr key={u._id}>
                    <td className="small text-break">{u.email}</td>
                    <td className="small text-muted">
                      {[u.profile?.firstName, u.profile?.lastName].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td>
                      <span className={`badge ${u.role === "ADMIN" ? "bg-primary" : "bg-secondary"}`}>
                        {u.role}
                      </span>
                    </td>
                    <td>{u.isActive ? <span className="text-success small">Oui</span> : <span className="text-warning small">Non</span>}</td>
                    <td className="small text-muted">
                      {u.createdAt ? new Date(u.createdAt).toLocaleString("fr-FR") : "—"}
                    </td>
                    <td className="text-end">
                      {u.role !== "ADMIN" && (
                        <div className="btn-group">
                          {!u.isActive ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-success"
                              disabled={busyId === u._id}
                              onClick={async () => {
                                setBusyId(u._id);
                                setError("");
                                try {
                                  await adminApi.reactivateUser(u._id);
                                  await reload();
                                } catch (e) {
                                  const out = extractApiError(e, "Action impossible.");
                                  setError(out.message);
                                } finally {
                                  setBusyId(null);
                                }
                              }}
                            >
                              Réactiver
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-warning"
                              disabled={busyId === u._id}
                              onClick={async () => {
                                setBusyId(u._id);
                                setError("");
                                try {
                                  await adminApi.setUserActive(u._id, { isActive: false });
                                  await reload();
                                } catch (e) {
                                  const out = extractApiError(e, "Action impossible.");
                                  setError(out.message);
                                } finally {
                                  setBusyId(null);
                                }
                              }}
                            >
                              Désactiver
                            </button>
                          )}
                        </div>
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
