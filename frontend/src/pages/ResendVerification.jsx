import { useState } from "react";
import { Link } from "react-router-dom";
import { authApi } from "../api/auth";

export default function ResendVerification() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const { data } = await authApi.resendVerification({ email });
      setMessage(data.message || "Demande envoyée.");
    } catch (err) {
      setError(err.response?.data?.message || "Action impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="row justify-content-center py-4">
      <div className="col-12 col-md-6 col-lg-5">
        <div className="card auth-card">
          <div className="card-body p-4 p-md-5">
            <h1 className="h4 mb-1 fw-bold text-dark">Renvoyer l’e-mail de vérification</h1>
            <p className="text-muted small mb-4">
              Si votre compte n’est pas encore vérifié, nous renverrons un lien.
            </p>
            {message && <div className="alert alert-success small">{message}</div>}
            {error && <div className="alert alert-danger small">{error}</div>}

            <form onSubmit={onSubmit} className="vstack gap-3">
              <div>
                <label className="form-label small text-muted mb-1">E-mail</label>
                <input
                  className="form-control"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <button className="btn btn-fc-primary text-white" type="submit" disabled={loading}>
                {loading ? "Envoi…" : "Renvoyer"}
              </button>
            </form>

            <div className="mt-4 small text-muted d-flex flex-wrap gap-2 justify-content-between">
              <Link to="/login" className="text-decoration-none fw-semibold">
                Connexion
              </Link>
              <Link to="/register" className="text-decoration-none fw-semibold">
                Inscription
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

