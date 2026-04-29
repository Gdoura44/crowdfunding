import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import PageLoader from "./ui/PageLoader.jsx";

/**
 * Connexion / inscription: si l’utilisateur est déjà connecté, on le redirige vers le tableau de bord.
 */
export default function GuestRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageLoader label="Préparation de la page…" />;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
