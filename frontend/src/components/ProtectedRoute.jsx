import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import PageLoader from "./ui/PageLoader.jsx";

/**
 * Nécessite une session valide (cookies). Les visiteurs sont redirigés vers la page de connexion avec une URL de retour.
 */
export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <PageLoader label="Vérification de votre session…" />;
  }

  if (!user) {
    return (
      <Navigate to="/login" replace state={{ from: location }} />
    );
  }

  return <Outlet />;
}
