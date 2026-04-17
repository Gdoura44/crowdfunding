import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { authApi } from "../api/auth";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function ResetPassword() {
  const q = useQuery();
  const navigate = useNavigate();
  const token = q.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const { data } = await authApi.resetPassword({ token, password });
      setMessage(data.message || "Mot de passe mis à jour.");
      setTimeout(() => navigate("/login", { replace: true }), 800);
    } catch (err) {
      setError(err.response?.data?.message || "Réinitialisation impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="row justify-content-center py-4">
      <div className="col-12 col-md-6 col-lg-5">
        <div className="card auth-card">
          <div className="card-body p-4 p-md-5">
            <h1 className="h4 mb-1 fw-bold text-dark">Réinitialiser le mot de passe</h1>
            <p className="text-muted small mb-4">
              Choisissez un nouveau mot de passe. Le lien est valide pendant une durée limitée.
            </p>

            {!token && (
              <div className="alert alert-warning small">
                Lien invalide : token manquant. Recommencez depuis “Mot de passe oublié”.
              </div>
            )}

            {message && <div className="alert alert-success small">{message}</div>}
            {error && <div className="alert alert-danger small">{error}</div>}

            <form onSubmit={onSubmit} className="vstack gap-3">
              <div>
                <label className="form-label small text-muted mb-1">
                  Nouveau mot de passe (8 caractères minimum)
                </label>
                <input
                  className="form-control"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={!token}
                />
              </div>
              <div>
                <label className="form-label small text-muted mb-1">Confirmer le mot de passe</label>
                <input
                  className="form-control"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={!token}
                />
                {password && confirmPassword && password !== confirmPassword && (
                  <div className="form-text text-danger">Les deux mots de passe ne correspondent pas.</div>
                )}
              </div>
              <button className="btn btn-fc-primary text-white" type="submit" disabled={loading || !token}>
                {loading ? "Mise à jour…" : "Mettre à jour"}
              </button>
            </form>

            <div className="mt-4 small text-muted d-flex flex-wrap gap-2 justify-content-between">
              <Link to="/login" className="text-decoration-none fw-semibold">
                Connexion
              </Link>
              <Link to="/forgot-password" className="text-decoration-none fw-semibold">
                Renvoyer un lien
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

