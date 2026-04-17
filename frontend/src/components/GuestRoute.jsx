import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import PageLoader from "./ui/PageLoader.jsx";

/**
 * Login / register: already connected users go to the dashboard.
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
