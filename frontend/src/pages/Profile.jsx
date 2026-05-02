import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usersApi } from "../api/users";
import { useAuth } from "../hooks/useAuth.js";
import PageLoader from "../components/ui/PageLoader.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import { extractApiError } from "../utils/apiError";
import { PROJECT_CATEGORIES } from "../config/categories.js";
import Alert from "../components/ui/Alert.jsx";
import { confirmAlert } from "react-confirm-alert";

export default function Profile() {
  const navigate = useNavigate();
  const { refreshUser, user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [deleting, setDeleting] = useState(false);
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
    firstName: "",
    lastName: "",
    phoneCountry: "TN",
    phoneNational: "",
    riskPreference: "MEDIUM",
    preferredCategories: [],
  });

  useEffect(() => {
    let cancelled = false;
    setError("");
    setMessage("");
    (async () => {
      try {
        const { data } = await usersApi.getProfile();
        const p = data.profile || {};
        if (!cancelled) {
          const rawFirst = String(p.firstName || "");
          const rawLast = String(p.lastName || "");
          const looksLikeRolePair =
            ["ADMIN", "USER"].includes(rawFirst.toUpperCase()) &&
            ["ADMIN", "USER"].includes(rawLast.toUpperCase());
          const country = String(p.phoneCountry || "TN").toUpperCase();
          const phone = String(p.phone || "");
          const calling = callingCodeFor(country);
          const national =
            phone.startsWith(calling) ? normalizeDigits(phone.slice(calling.length)) : normalizeDigits(phone);
          setForm({
            firstName: looksLikeRolePair ? "" : rawFirst,
            lastName: looksLikeRolePair ? "" : rawLast,
            phoneCountry: country,
            phoneNational: national,
            riskPreference: p.riskPreference || "MEDIUM",
            preferredCategories: Array.isArray(p.preferredCategories) ? p.preferredCategories : [],
          });
        }
      } catch (err) {
        if (!cancelled) {
          const out = extractApiError(err, "Impossible de charger le profil.");
          setError(out.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [callingCodeFor, refreshUser]);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const preferredCategories =
        user?.role === "ADMIN"
          ? []
          : Array.isArray(form.preferredCategories)
            ? form.preferredCategories.filter(Boolean)
            : [];
      const calling = callingCodeFor(form.phoneCountry);
      const phoneE164 =
        form.phoneNational && normalizeDigits(form.phoneNational)
          ? `${calling}${normalizeDigits(form.phoneNational)}`
          : "";
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: phoneE164,
        ...(user?.role === "ADMIN"
          ? {}
          : { riskPreference: form.riskPreference, preferredCategories }),
      };
      await usersApi.updateProfile(payload);
      await refreshUser();
      setMessage("Profil mis à jour.");
    } catch (err) {
      const out = extractApiError(err, "Mise à jour impossible.");
      setError(out.message);
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteAccount() {
    confirmAlert({
      title: "Supprimer votre compte ?",
      message:
        "Cette action anonymise vos données et est irréversible.\nElle peut être bloquée si vous avez des opérations financières en cours.",
      buttons: [
        { label: "Annuler", onClick: () => {} },
        {
          label: "Supprimer",
          onClick: async () => {
            setDeleting(true);
            setError("");
            setMessage("");
            try {
              await usersApi.deleteAccount();
              try {
                await logout();
              } catch {
                // ignorer
              }
              navigate("/", { replace: true });
            } catch (err) {
              const out = extractApiError(err, "Suppression impossible.");
              setError(out.message);
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    });
  }

  if (loading) {
    return <PageLoader label="Chargement de votre profil…" />;
  }

  return (
    <div className="row justify-content-center">
      <div className="col-12 col-lg-7">
        <PageHeader
          title="Mon profil"
          subtitle="Ces informations nous aident à personnaliser votre expérience et à vous contacter si nécessaire."
        />
        <div className="card border-0 fc-surface-card">
          <div className="card-body p-4 p-md-5">
            {message && <Alert variant="success">{message}</Alert>}
            {error && <Alert variant="danger">{error}</Alert>}
            <form onSubmit={onSubmit} className="vstack gap-3">
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label small text-muted mb-1">Prénom</label>
                  <input
                    className="form-control"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label small text-muted mb-1">Nom</label>
                  <input
                    className="form-control"
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="form-label small text-muted mb-1">Téléphone</label>
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
                        onChange={(e) =>
                          setForm({ ...form, phoneNational: e.target.value })
                        }
                        placeholder="Numéro"
                      />
                    </div>
                  </div>
                </div>
              </div>
              {user?.role !== "ADMIN" && (
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label small text-muted mb-1">
                      Préférence de risque
                    </label>
                    <select
                      className="form-select"
                      value={form.riskPreference}
                      onChange={(e) =>
                        setForm({ ...form, riskPreference: e.target.value })
                      }
                    >
                      <option value="LOW">Prudent</option>
                      <option value="MEDIUM">Équilibré</option>
                      <option value="HIGH">Dynamique</option>
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small text-muted mb-1">
                      Catégories préférées
                    </label>
                    <div className="border rounded-3 p-2" style={{ maxHeight: 170, overflow: "auto" }}>
                      {PROJECT_CATEGORIES.filter((c) => c !== "Autre").map((c) => {
                        const checked = form.preferredCategories.includes(c);
                        return (
                          <div key={c} className="form-check">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id={`pref-cat-${c}`}
                              checked={checked}
                              onChange={(e) => {
                                const on = e.target.checked;
                                setForm((f) => {
                                  const next = new Set(f.preferredCategories || []);
                                  if (on) next.add(c);
                                  else next.delete(c);
                                  return { ...f, preferredCategories: Array.from(next) };
                                });
                              }}
                            />
                            <label className="form-check-label" htmlFor={`pref-cat-${c}`}>
                              {c}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                    <div className="form-text">Choisissez 2–5 catégories pour personnaliser les recommandations.</div>
                  </div>
                </div>
              )}
              <button
                className="btn btn-fc-primary text-white"
                type="submit"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    />
                    Enregistrement…
                  </>
                ) : (
                  <>
                    <i className="fa-regular fa-floppy-disk me-2" aria-hidden="true" />
                    Enregistrer
                  </>
                )}
              </button>
            </form>

            {user?.role !== "ADMIN" && (
              <div className="border-top mt-4 pt-4">
                <h2 className="h6 text-danger mb-2">Zone sensible</h2>
                <p className="small text-muted mb-3">
                  Vous pouvez demander la suppression de votre compte. La plateforme bloque cette
                  action si des opérations sont en cours (investissements en attente, annulation,
                  payouts prêts, etc.).
                </p>
                <button
                  type="button"
                  className="btn btn-outline-danger"
                  onClick={onDeleteAccount}
                  disabled={deleting}
                >
                  {deleting ? "Suppression…" : "Supprimer mon compte"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

