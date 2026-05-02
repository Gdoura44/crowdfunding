import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "../api/auth";
import { extractApiError } from "../utils/apiError";
import { passwordChecklist, suggestEmailTypo } from "../utils/formHints";
import Guidance from "../components/ui/Guidance.jsx";
import Alert from "../components/ui/Alert.jsx";

export default function Register() {
  const navigate = useNavigate();
  const COUNTRIES = useMemo(
    () => [
      { iso2: "TN", name: "Tunisie", calling: "+216" },
      { iso2: "FR", name: "France", calling: "+33" },
      { iso2: "DZ", name: "Algérie", calling: "+213" },
      { iso2: "MA", name: "Maroc", calling: "+212" },
      { iso2: "LY", name: "Libye", calling: "+218" },
      { iso2: "DE", name: "Allemagne", calling: "+49" },
      { iso2: "IT", name: "Italie", calling: "+39" },
      { iso2: "ES", name: "Espagne", calling: "+34" },
      { iso2: "GB", name: "Royaume-Uni", calling: "+44" },
      { iso2: "US", name: "États-Unis", calling: "+1" },
    ],
    []
  );
  const callingCodeFor = useMemo(() => {
    return (iso2) => COUNTRIES.find((c) => c.iso2 === iso2)?.calling || "+";
  }, [COUNTRIES]);
  function normalizeDigits(s) {
    return String(s || "").replace(/[^\d]/g, "");
  }

  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    phoneCountry: "TN",
    phoneNational: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState([]);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    setFieldErrors([]);
    try {
      const calling = callingCodeFor(form.phoneCountry);
      const phone =
        form.phoneNational && normalizeDigits(form.phoneNational)
          ? `${calling}${normalizeDigits(form.phoneNational)}`
          : "";
      const payload = {
        email: form.email,
        password: form.password,
        confirmPassword: form.confirmPassword,
        firstName: form.firstName,
        lastName: form.lastName,
        phone,
      };
      const { data } = await authApi.register(payload);
      // Rediriger immédiatement vers l’écran de vérification (code OTP).
      navigate(`/verify-email?email=${encodeURIComponent(String(form.email || ""))}`, {
        replace: true,
        state: {
          flash:
            data?.message ||
            "Compte créé. Nous vous avons envoyé un code de vérification par e-mail.",
        },
      });
    } catch (err) {
      const out = extractApiError(err, "Erreur lors de l’inscription.");
      setError(out.message);
      setFieldErrors(out.fieldMessages);
    } finally {
      setLoading(false);
    }
  }

  const pw = passwordChecklist(form.password);
  const emailHint = suggestEmailTypo(form.email);

  return (
    <div className="row justify-content-center py-4">
      <div className="col-12 col-md-6 col-lg-5">
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
                <i className="fa-solid fa-user-plus" />
              </div>
              <div>
                <h1 className="h4 mb-1 fw-bold text-dark">Inscription</h1>
                <p className="text-muted small mb-0">
                  Créez un compte pour lancer une campagne ou suivre vos soutiens.
                </p>
              </div>
            </div>
            {message && <Alert variant="success">{String(message)}</Alert>}
            {error && (
              <Alert variant="danger">
                <div>{String(error)}</div>
                {fieldErrors?.length > 0 && (
                  <ul className="mb-0 mt-2">
                    {fieldErrors.map((e, idx) => (
                      <li key={`${e.field}-${idx}`}>
                        <strong>{e.field}</strong> : {e.message}
                      </li>
                    ))}
                  </ul>
                )}
              </Alert>
            )}
            {!message && !error && (
              <Guidance title="Astuce" variant="info">
                Après l’inscription, vous recevrez un <strong>code de vérification</strong> par e‑mail pour activer
                votre compte.
              </Guidance>
            )}
            <form onSubmit={onSubmit} className="vstack gap-3">
              <div className="row g-2">
                <div className="col-md-6">
                  <label className="form-label small text-muted mb-1">Prénom</label>
                  <input
                    className="form-control"
                    placeholder="Prénom"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label small text-muted mb-1">Nom</label>
                  <input
                    className="form-control"
                    placeholder="Nom"
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  />
                </div>
              </div>
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
                {emailHint && <div className="form-text">{emailHint}</div>}
              </div>
              <div>
                <label className="form-label small text-muted mb-1">
                  Mot de passe
                </label>
                <input
                  className="form-control"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                <div className="form-text">
                  Doit contenir au moins 8 caractères, avec au moins 1 lettre et 1 chiffre.
                </div>
                <div className="small text-muted mt-1">
                  <div>• 8+ caractères : {pw.min8 ? "OK" : "Non"}</div>
                  <div>• 1 lettre : {pw.hasLetter ? "OK" : "Non"}</div>
                  <div>• 1 chiffre : {pw.hasDigit ? "OK" : "Non"}</div>
                </div>
              </div>
              <div>
                <label className="form-label small text-muted mb-1">Confirmer le mot de passe</label>
                <input
                  className="form-control"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label small text-muted mb-1">Téléphone (optionnel)</label>
                <div className="row g-2">
                  <div className="col-12 col-md-5">
                    <select
                      className="form-select"
                      value={form.phoneCountry}
                      onChange={(e) => setForm({ ...form, phoneCountry: e.target.value })}
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c.iso2} value={c.iso2}>
                          {c.name} ({c.calling})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12 col-md-7">
                    <div className="input-group">
                      <span className="input-group-text">{callingCodeFor(form.phoneCountry)}</span>
                      <input
                        className="form-control"
                        value={form.phoneNational}
                        onChange={(e) => setForm({ ...form, phoneNational: e.target.value })}
                        placeholder="Numéro"
                      />
                    </div>
                  </div>
                </div>
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
                    Envoi…
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-paper-plane me-2" aria-hidden="true" />
                    S’inscrire
                  </>
                )}
              </button>
            </form>
            <p className="mt-4 mb-0 small text-center text-muted">
              Déjà inscrit ?{" "}
              <Link to="/login" className="fw-semibold">
                Se connecter
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
