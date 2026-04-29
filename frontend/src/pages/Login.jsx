import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { authApi } from "../api/auth";
import { useAuth } from "../hooks/useAuth.js";
import { extractApiError } from "../utils/apiError";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshUser } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const from =
    location.state?.from?.pathname &&
    location.state.from.pathname !== "/login"
      ? location.state.from.pathname
      : "/dashboard";

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await authApi.login(form);
      await refreshUser();
      navigate(from, { replace: true });
    } catch (err) {
      const out = extractApiError(err, "Connexion impossible.");
      setError(out.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="row justify-content-center py-4">
      <div className="col-12 col-md-5 col-lg-4">
        <div className="card auth-card">
          <div className="card-body p-4 p-md-5">
            <div className="d-flex align-items-start gap-3 mb-3">
              <div
                className="rounded-3 d-flex align-items-center justify-content-center text-white flex-shrink-0"
                style={{
                  width: "3rem",
                  height: "3rem",
                  background: "linear-gradient(135deg, #0f4c5c, #1a8a9e)",
                }}
                aria-hidden="true"
              >
                <i className="fa-solid fa-right-to-bracket" />
              </div>
              <div>
                <h1 className="h4 mb-1 fw-bold text-dark">Connexion</h1>
                <p className="text-muted small mb-0">
                  Accédez à votre espace pour gérer vos projets et vos messages.
                </p>
              </div>
            </div>
            {location.state?.from && (
              <div className="alert alert-info py-2 small mb-3">
                Connectez-vous pour accéder à la page demandée.
              </div>
            )}
            {error && <div className="alert alert-danger small">{error}</div>}
            <form onSubmit={onSubmit} className="vstack gap-3">
              <div>
                <label className="form-label small text-muted mb-1">E-mail</label>
                <input
                  className="form-control"
                  type="email"
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label small text-muted mb-1">Mot de passe</label>
                <input
                  className="form-control"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
              <button
                className="btn btn-fc-primary text-white w-100 py-2"
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    />
                    Connexion…
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-right-to-bracket me-2" aria-hidden="true" />
                    Se connecter
                  </>
                )}
              </button>
            </form>
            <div className="d-flex justify-content-center mt-3 small">
              <Link to="/forgot-password" className="text-decoration-none fw-semibold">
                Mot de passe oublié ?
              </Link>
            </div>
            <p className="mt-4 mb-0 small text-center text-muted">
              Pas encore de compte ?{" "}
              <Link to="/register" className="fw-semibold">
                Créer un compte
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
