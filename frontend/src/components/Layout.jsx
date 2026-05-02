import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { useUnreadNotifications } from "../hooks/useUnreadNotifications.js";
import { useUnreadAdminNotifications } from "../hooks/useUnreadAdminNotifications.js";

function navClass({ isActive }) {
  return ["nav-link py-2 py-md-1 d-inline-flex align-items-center gap-2", isActive ? "active" : ""]
    .filter(Boolean)
    .join(" ");
}

// Layout global : navbar + routage. Affiche un badge +N sur “Notifications” (user/admin) en temps réel.
export default function Layout() {
  const { user, loading, logout, isAuthenticated } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const userKey = user?.id || user?._id;
  const unreadUser = useUnreadNotifications({ enabled: Boolean(isAuthenticated && userKey && !isAdmin) });
  const unreadAdmin = useUnreadAdminNotifications({ enabled: Boolean(isAuthenticated && userKey && isAdmin) });
  const unread = isAdmin ? unreadAdmin : unreadUser;
  const displayName =
    user?.profile?.firstName?.trim() ||
    user?.email?.split("@")[0] ||
    "Compte";

  return (
    <div className="app-shell d-flex flex-column min-vh-100">
      <a className="fc-skip-link" href="#main-content">
        Aller au contenu
      </a>
      <header className="navbar navbar-expand-md navbar-light app-navbar border-bottom shadow-sm sticky-top">
        <div className="container">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 py-2 py-md-3 w-100">
            <Link className="navbar-brand mb-0 d-flex align-items-center gap-2" to="/">
              <span
                className="d-inline-flex align-items-center justify-content-center rounded-2 text-white fw-bold"
                style={{
                  width: "2rem",
                  height: "2rem",
                  fontSize: "0.85rem",
                  background: "linear-gradient(135deg, #0f4c5c, #1a8a9e)",
                }}
                aria-hidden="true"
              >
                FC
              </span>
              <span>
                Fin<span className="text-muted fw-normal">Collab</span>
              </span>
            </Link>
            <button
              type="button"
              className="navbar-toggler d-md-none border rounded px-2 py-1"
              data-bs-toggle="collapse"
              data-bs-target="#mainNav"
              aria-controls="mainNav"
              aria-expanded="false"
              aria-label="Ouvrir le menu"
            >
              <span className="navbar-toggler-icon" />
            </button>
            <nav
              className="collapse navbar-collapse d-md-flex flex-md-grow-0 justify-content-md-end"
              id="mainNav"
            >
              <ul className="navbar-nav ms-md-auto flex-column flex-md-row align-items-stretch align-items-md-center gap-md-1 pt-2 pt-md-0 border-top border-md-0 mt-2 mt-md-0">
                <li className="nav-item">
                  <NavLink className={navClass} to="/" end>
                    <i className="fa-solid fa-house-chimney fa-fw" aria-hidden="true" />
                    <span>Accueil</span>
                  </NavLink>
                </li>
                <li className="nav-item">
                  <NavLink className={navClass} to="/projects">
                    <i className="fa-solid fa-compass fa-fw" aria-hidden="true" />
                    <span>Explorer</span>
                  </NavLink>
                </li>
                {!loading && isAuthenticated && (
                  <>
                    {user?.role === "ADMIN" && (
                      <li className="nav-item dropdown">
                        <a
                          className="nav-link py-2 py-md-1 d-inline-flex align-items-center gap-2 dropdown-toggle"
                          href="#admin-menu"
                          role="button"
                          data-bs-toggle="dropdown"
                          aria-expanded="false"
                          onClick={(e) => e.preventDefault()}
                        >
                          <i className="fa-solid fa-shield-halved fa-fw" aria-hidden="true" />
                          <span>Admin</span>
                        </a>
                        <ul className="dropdown-menu shadow-sm">
                          <li>
                            <NavLink className="dropdown-item" to="/admin/projects">
                              Projets
                            </NavLink>
                          </li>
                          <li>
                            <NavLink className="dropdown-item" to="/admin/users">
                              Utilisateurs
                            </NavLink>
                          </li>
                          <li>
                            <NavLink className="dropdown-item" to="/admin/reports">
                              Signalements
                            </NavLink>
                          </li>
                          <li>
                            <NavLink className="dropdown-item" to="/admin/comments">
                              Commentaires
                            </NavLink>
                          </li>
                          <li>
                            <NavLink className="dropdown-item" to="/admin/payouts">
                              Payouts
                            </NavLink>
                          </li>
                          <li>
                            <NavLink className="dropdown-item" to="/admin/ops">
                              Ops
                            </NavLink>
                          </li>
                        </ul>
                      </li>
                    )}
                    {user?.role !== "ADMIN" && (
                      <li className="nav-item">
                        <NavLink className={navClass} to="/dashboard">
                          <i className="fa-solid fa-layer-group fa-fw" aria-hidden="true" />
                          <span>Mes projets</span>
                        </NavLink>
                      </li>
                    )}
                    <li className="nav-item">
                      <NavLink className={navClass} to={isAdmin ? "/admin/notifications" : "/notifications"}>
                        <span className="position-relative d-inline-flex align-items-center">
                          <i className="fa-regular fa-bell fa-fw" aria-hidden="true" />
                        </span>
                        <span className="d-inline-flex align-items-center gap-2">
                          <span>Notifications</span>
                          {unread > 0 && (
                            <span
                              className="badge rounded-pill bg-danger"
                              style={{ fontSize: "0.7rem" }}
                              aria-label={`${unread} notifications non lues`}
                            >
                              +{unread}
                            </span>
                          )}
                        </span>
                      </NavLink>
                    </li>
                    {user?.role !== "ADMIN" && (
                      <>
                        <li className="nav-item">
                          <NavLink className={navClass} to="/investments">
                            <i className="fa-solid fa-coins fa-fw" aria-hidden="true" />
                            <span>Mes investissements</span>
                          </NavLink>
                        </li>
                        <li className="nav-item">
                          <NavLink className={navClass} to="/payouts">
                            <i className="fa-solid fa-building-columns fa-fw" aria-hidden="true" />
                            <span>Mes payouts</span>
                          </NavLink>
                        </li>
                        <li className="nav-item">
                          <NavLink className={navClass} to="/recommendations">
                            <i className="fa-solid fa-wand-magic-sparkles fa-fw" aria-hidden="true" />
                            <span>Recommandations</span>
                          </NavLink>
                        </li>
                      </>
                    )}
                    <li className="nav-item dropdown ms-md-2">
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm dropdown-toggle w-100 w-md-auto d-inline-flex align-items-center gap-2"
                        data-bs-toggle="dropdown"
                        aria-expanded="false"
                      >
                        <i className="fa-regular fa-user" aria-hidden="true" />
                        <span className="text-truncate" style={{ maxWidth: "10rem" }}>
                          {displayName}
                        </span>
                      </button>
                      <ul className="dropdown-menu dropdown-menu-end shadow-sm">
                        <li>
                          <span
                            className="dropdown-item-text small text-muted text-truncate d-block"
                            style={{ maxWidth: "16rem" }}
                          >
                            {user?.email}
                          </span>
                        </li>
                        <li>
                          <Link className="dropdown-item" to="/profile">
                            <i className="fa-regular fa-id-card me-2" aria-hidden="true" />
                            Mon profil
                          </Link>
                        </li>
                        {user?.role !== "ADMIN" && (
                          <li>
                            <Link className="dropdown-item" to="/reports">
                              <i className="fa-solid fa-flag me-2" aria-hidden="true" />
                              Mes signalements
                            </Link>
                          </li>
                        )}
                        {user?.role === "ADMIN" && (
                          <li>
                            <span className="dropdown-item-text small text-primary">
                              <i className="fa-solid fa-shield-halved me-2" aria-hidden="true" />
                              Administrateur
                            </span>
                          </li>
                        )}
                        <li>
                          <hr className="dropdown-divider" />
                        </li>
                        <li>
                          <button
                            type="button"
                            className="dropdown-item text-danger"
                            onClick={() => logout()}
                          >
                            <i className="fa-solid fa-arrow-right-from-bracket me-2" aria-hidden="true" />
                            Déconnexion
                          </button>
                        </li>
                      </ul>
                    </li>
                  </>
                )}
                {!loading && !isAuthenticated && (
                  <>
                    <li className="nav-item">
                      <NavLink className={navClass} to="/login">
                        <i className="fa-solid fa-right-to-bracket fa-fw" aria-hidden="true" />
                        <span>Connexion</span>
                      </NavLink>
                    </li>
                    <li className="nav-item d-md-flex align-items-md-center">
                      <NavLink
                        className="btn btn-fc-primary btn-sm text-white px-3 w-100 w-md-auto mt-1 mt-md-0"
                        to="/register"
                      >
                        <i className="fa-solid fa-user-plus me-2" aria-hidden="true" />
                        Inscription
                      </NavLink>
                    </li>
                  </>
                )}
              </ul>
            </nav>
          </div>
        </div>
      </header>

      <main id="main-content" className="flex-grow-1 py-4" tabIndex={-1}>
        <div className="container fc-fade-in">
          <Outlet />
        </div>
      </main>

      <footer className="app-footer py-4 mt-auto small text-muted">
        <div className="container d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2">
          <span>© {new Date().getFullYear()} FinCollab</span>
          <span className="text-md-end">Plateforme de financement collaboratif</span>
        </div>
      </footer>
    </div>
  );
}
