import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader.jsx";
import PageLoader from "../components/ui/PageLoader.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import ProjectCard from "../components/project/ProjectCard.jsx";
import { recommendationsApi } from "../api/recommendations";
import { useAuth } from "../hooks/useAuth.js";

export default function Recommendations() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.role === "ADMIN") return;
    let cancelled = false;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const { data } = await recommendationsApi.list({ limit: 12 });
        if (!cancelled) setItems(data.projects || []);
      } catch (e) {
        if (!cancelled)
          setError(e?.response?.data?.message || "Impossible de charger les recommandations.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div>
      <PageHeader
        title="Recommandations"
        subtitle="Mode démo: sélection de projets actifs. Plus tard, on peut personnaliser selon votre profil et vos intérêts."
        actions={
          <Link to="/projects" className="btn btn-outline-secondary btn-sm">
            Explorer tout
          </Link>
        }
      />

      {user?.role === "ADMIN" && (
        <div className="alert alert-info py-2">
          Les comptes administrateur n’ont pas de recommandations personnelles.
        </div>
      )}
      {error && <div className="alert alert-danger py-2">{error}</div>}
      {loading && <PageLoader label="Chargement…" />}

      {!loading && !error && items.length === 0 && (
        <EmptyState
          icon="fa-solid fa-wand-magic-sparkles"
          title="Aucune recommandation"
          description="Réessayez plus tard ou explorez les projets publics."
        />
      )}

      {!loading && !error && items.length > 0 && (
        <div className="row g-3">
          {items.map((p) => (
            <div key={p._id} className="col-12 col-md-6 col-lg-4">
              <ProjectCard project={p} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

