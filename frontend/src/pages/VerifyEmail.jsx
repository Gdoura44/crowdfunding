import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authApi } from "../api/auth";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState(token ? "pending" : "error");
  const [message, setMessage] = useState(
    token ? "" : "Lien invalide : token manquant."
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await authApi.verifyEmail({ token });
        if (!cancelled) {
          setStatus("ok");
          setMessage(data.message || "E-mail vérifié.");
        }
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          setMessage(
            err.response?.data?.message || "Vérification impossible."
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="row justify-content-center py-4">
      <div className="col-12 col-md-6 col-lg-5">
        <div className="card auth-card">
          <div className="card-body p-4 p-md-5 text-center">
            <h1 className="h4 fw-bold text-dark mb-3">Vérification de l’e-mail</h1>
            {status === "pending" && (
              <div className="py-4">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Vérification…</span>
                </div>
              </div>
            )}
            {status === "ok" && (
              <>
                <div className="alert alert-success small text-start">
                  {message}
                </div>
                <Link to="/login" className="btn btn-fc-primary text-white w-100">
                  Se connecter
                </Link>
              </>
            )}
            {status === "error" && (
              <>
                <div className="alert alert-danger small text-start">
                  {message}
                </div>
                <Link
                  to="/register"
                  className="btn btn-outline-secondary w-100"
                >
                  Retour à l’inscription
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
