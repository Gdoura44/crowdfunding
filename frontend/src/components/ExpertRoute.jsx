import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";

/**
 * Protège les routes réservées aux experts en analyse financière.
 * Redirige vers /dashboard si l'utilisateur connecté n'est pas un EXPERT.
 */
export default function ExpertRoute() {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== "EXPERT") return <Navigate to="/dashboard" replace />;

  return <Outlet />;
}
