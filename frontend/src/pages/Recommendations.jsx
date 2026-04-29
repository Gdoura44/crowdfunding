import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { confirmAlert } from "react-confirm-alert";
import PageHeader from "../components/ui/PageHeader.jsx";
import PageLoader from "../components/ui/PageLoader.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import ProjectCard from "../components/project/ProjectCard.jsx";
import { recommendationsApi } from "../api/recommendations";
import { useAuth } from "../hooks/useAuth.js";
import { extractApiError } from "../utils/apiError";

export default function Recommendations() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || user?.role === "ADMIN") return;
    const prefs = user?.profile?.preferredCategories || [];
    const hasPrefs = Array.isArray(prefs) && prefs.length > 0;
    if (hasPrefs) return;

    const key = "fc:recommendations-prefs-prompted:v1";
    try {
      if (window.localStorage.getItem(key) === "1") return;
      window.localStorage.setItem(key, "1");
    } catch {
      // ignorer
    }

    confirmAlert({
      title: "Personnaliser vos recommandations ?",
      message:
        "Les recommandations se basent surtout sur vos catégories préférées (profil) et le niveau de risque indicatif des projets. Pour de meilleurs résultats, choisissez au moins une catégorie.",
      buttons: [
        { label: "Plus tard", onClick: () => {} },
        {
          label: "Oui, aller au profil",
          onClick: () => navigate("/profile", { replace: false }),
        },
      ],
    });
  }, [user, navigate]);

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
        if (!cancelled) {
          const out = extractApiError(e, "Impossible de charger les recommandations.");
          setError(out.message);
        }
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
        subtitle="Sélection de projets actifs, adaptée selon vos catégories préférées et votre préférence de risque (profil)."
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

