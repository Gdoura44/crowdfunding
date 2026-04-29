import { Routes, Route } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import ProtectedRoute from "../components/ProtectedRoute.jsx";
import AdminRoute from "../components/AdminRoute.jsx";
import GuestRoute from "../components/GuestRoute.jsx";
import Home from "../pages/Home.jsx";
import Register from "../pages/Register.jsx";
import Login from "../pages/Login.jsx";
import VerifyEmail from "../pages/VerifyEmail.jsx";
import Dashboard from "../pages/Dashboard.jsx";
import Notifications from "../pages/Notifications.jsx";
import BrowseProjects from "../pages/BrowseProjects.jsx";
import ProjectNew from "../pages/ProjectNew.jsx";
import ProjectDetail from "../pages/ProjectDetail.jsx";
import ProjectEdit from "../pages/ProjectEdit.jsx";
import Profile from "../pages/Profile.jsx";
import ForgotPassword from "../pages/ForgotPassword.jsx";
import ResetPassword from "../pages/ResetPassword.jsx";
import ResendVerification from "../pages/ResendVerification.jsx";
import MyInvestments from "../pages/MyInvestments.jsx";
import MyPayouts from "../pages/MyPayouts.jsx";
import PayoutDetail from "../pages/PayoutDetail.jsx";
import MyReports from "../pages/MyReports.jsx";
import AdminProjects from "../pages/AdminProjects.jsx";
import AdminUsers from "../pages/AdminUsers.jsx";
import AdminNotifications from "../pages/AdminNotifications.jsx";
import AdminReports from "../pages/AdminReports.jsx";
import AdminPayouts from "../pages/AdminPayouts.jsx";
import AdminComments from "../pages/AdminComments.jsx";
import MockCheckout from "../pages/MockCheckout.jsx";
import Recommendations from "../pages/Recommendations.jsx";
import AdminOps from "../pages/AdminOps.jsx";

/**
 * Public vs authentifié :
 * - Visiteur : accueil, détail projet (si actif côté API), inscription, connexion, vérif. e-mail.
 * - Connecté : tableau de bord, création de projet (+ redirection après login).
 */
export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="projects" element={<BrowseProjects />} />
        <Route path="verify-email" element={<VerifyEmail />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password" element={<ResetPassword />} />
        <Route path="resend-verification" element={<ResendVerification />} />
        <Route path="projects/:id" element={<ProjectDetail />} />

        <Route element={<GuestRoute />}>
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="investments" element={<MyInvestments />} />
          <Route path="payouts" element={<MyPayouts />} />
          <Route path="payouts/:id" element={<PayoutDetail />} />
          <Route path="reports" element={<MyReports />} />
          <Route path="recommendations" element={<Recommendations />} />
          <Route path="profile" element={<Profile />} />
          <Route path="projects/new" element={<ProjectNew />} />
          <Route path="projects/:id/edit" element={<ProjectEdit />} />
          <Route path="mock-checkout" element={<MockCheckout />} />
        </Route>

        <Route element={<AdminRoute />}>
          <Route path="admin/projects" element={<AdminProjects />} />
          <Route path="admin/comments" element={<AdminComments />} />
          <Route path="admin/users" element={<AdminUsers />} />
          <Route path="admin/reports" element={<AdminReports />} />
          <Route path="admin/payouts" element={<AdminPayouts />} />
          <Route path="admin/ops" element={<AdminOps />} />
          <Route path="admin/notifications" element={<AdminNotifications />} />
        </Route>
      </Route>
    </Routes>
  );
}
