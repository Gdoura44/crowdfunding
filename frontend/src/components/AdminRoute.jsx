import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import PageLoader from "./ui/PageLoader.jsx";

export default function AdminRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageLoader label="Chargement…" />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== "ADMIN") {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

