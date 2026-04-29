import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authApi } from "../api/auth";
import { extractApiError } from "../utils/apiError";
import { suggestEmailTypo } from "../utils/formHints";
import Guidance from "../components/ui/Guidance.jsx";

export default function ResendVerification() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = String(params.get("email") || "").trim();
    if (q) {
      setEmail(q);
      setHint(suggestEmailTypo(q));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    setHint("");
    try {
      const { data } = await authApi.resendVerification({ email });
      setMessage(data.message || "Demande envoyée.");
    } catch (err) {
      const out = extractApiError(err, "Action impossible.");
      setError(out.message);
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
            <Guidance title="Quand l’utiliser ?" variant="info">
              Utilisez cette page si vous n’avez pas reçu le <strong>code de vérification</strong>. Si un compte
              existe, nous renverrons un e‑mail <strong>dans quelques instants</strong>. Pensez à vérifier le{" "}
              <strong>spam</strong>.
            </Guidance>
            {message && <div className="alert alert-success small">{message}</div>}
            {error && <div className="alert alert-danger small">{error}</div>}
            {hint && <div className="alert alert-warning small mb-3">{hint}</div>}

            <form onSubmit={onSubmit} className="vstack gap-3">
              <div>
                <label className="form-label small text-muted mb-1">E-mail</label>
                <input
                  className="form-control"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    const v = e.target.value;
                    setEmail(v);
                    setHint(suggestEmailTypo(v));
                  }}
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

