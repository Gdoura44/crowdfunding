import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { authApi } from "../api/auth";
import { extractApiError } from "../utils/apiError";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const location = useLocation();
  const emailFromQuery = String(params.get("email") || "").trim();

  const [email, setEmail] = useState(emailFromQuery);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState(token ? "pending" : "idle"); // idle | pending | ok | error
  const [message, setMessage] = useState("");

  const flash = useMemo(() => {
    const f = location.state?.flash;
    return f ? String(f) : "";
  }, [location.state]);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    (async () => {
      try {
        const { data } = await authApi.verifyEmail({ token }, { signal: controller.signal });
        setStatus("ok");
        setMessage(data.message || "E-mail vérifié.");
      } catch (err) {
        // Ignore abort (React StrictMode / navigation).
        if (err?.name === "CanceledError" || err?.code === "ERR_CANCELED") return;
        setStatus("error");
        const out = extractApiError(err, "Vérification impossible.");
        setMessage(out.message);
      }
    })();
    return () => {
      controller.abort();
    };
  }, [token]);

  async function onSubmitCode(e) {
    e.preventDefault();
    setStatus("pending");
    setMessage("");
    try {
      const { data } = await authApi.verifyEmailCode({
        email: String(email || "").trim(),
        code: String(code || "").trim(),
      });
      setStatus("ok");
      setMessage(data.message || "E-mail vérifié.");
    } catch (err) {
      setStatus("error");
      const out = extractApiError(err, "Vérification impossible.");
      setMessage(out.message);
    }
  }

  return (
    <div className="row justify-content-center py-4">
      <div className="col-12 col-md-6 col-lg-5">
        <div className="card auth-card">
          <div className="card-body p-4 p-md-5">
            <h1 className="h4 fw-bold text-dark mb-3">Vérification de l’e-mail</h1>
            {status !== "ok" && flash && <div className="alert alert-info small">{flash}</div>}
            {status === "pending" && (
              <div className="py-4">
                <div className="spinner-border text-primary" role="status" aria-hidden="true">
                  <span className="visually-hidden">Vérification…</span>
                </div>
              </div>
            )}
            {status === "ok" && (
              <>
                <div className="alert alert-success small">{message}</div>
                <Link to="/login" className="btn btn-fc-primary text-white w-100">
                  Se connecter
                </Link>
              </>
            )}
            {status === "error" && (
              <>
                {message && <div className="alert alert-danger small">{message}</div>}
              </>
            )}
            {!token && status !== "ok" && (
              <>
                <form onSubmit={onSubmitCode} className="vstack gap-3">
                  <div>
                    <label className="form-label small text-muted mb-1">E-mail</label>
                    <input
                      className="form-control"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="vous@exemple.com"
                    />
                  </div>
                  <div>
                    <label className="form-label small text-muted mb-1">Code</label>
                    <input
                      className="form-control text-center"
                      inputMode="numeric"
                      pattern="[0-9]{4,6}"
                      maxLength={6}
                      required
                      value={code}
                      onChange={(e) => setCode(String(e.target.value || "").replace(/[^0-9]/g, ""))}
                      placeholder="------"
                      style={{ letterSpacing: "0.35em", fontWeight: 700 }}
                    />
                    <div className="form-text">Code valable 15 minutes.</div>
                  </div>
                  <button className="btn btn-fc-primary text-white w-100" type="submit" disabled={status === "pending"}>
                    Vérifier
                  </button>
                </form>

                <div className="mt-3 d-flex flex-wrap gap-2 justify-content-between small">
                  <Link to={`/resend-verification?email=${encodeURIComponent(email)}`} className="fw-semibold text-decoration-none">
                    Renvoyer le code
                  </Link>
                  <Link to="/register" className="text-muted text-decoration-none">
                    Retour
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
