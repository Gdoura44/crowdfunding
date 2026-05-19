import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "../api/auth";
import { extractApiError } from "../utils/apiError";
import { suggestEmailTypo } from "../utils/formHints";
import { UserPlus, Loader2, AlertCircle, Info, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
    setMessage(
      "Après l’inscription, vous recevrez un code de vérification par e‑mail pour activer votre compte."
    );
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

  const emailHint = suggestEmailTypo(form.email);

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] py-8 px-4">
      <Card className="w-full max-w-lg shadow-lg border-border/50">
        <CardHeader className="space-y-3 pb-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0f4c5c] to-[#1a8a9e] text-white shadow-inner">
              <UserPlus className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl font-bold tracking-tight">Inscription</CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Créez un compte pour lancer une campagne ou suivre vos soutiens.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {message && (
            <div className="mb-6 flex items-start gap-2 rounded-md bg-blue-50 dark:bg-blue-900/30 p-3 text-sm text-blue-800 dark:text-blue-300">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <p>{String(message)}</p>
            </div>
          )}
          {error && (
            <div className="mb-6 rounded-md bg-destructive/15 p-4 text-sm text-destructive">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <strong>{String(error)}</strong>
              </div>
              {fieldErrors?.length > 0 && (
                <ul className="list-disc pl-6 space-y-1 mt-2 text-destructive/90">
                  {fieldErrors.map((e, idx) => (
                    <li key={`${e.field}-${idx}`}>
                      <strong>{e.field}</strong> : {e.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">Prénom</label>
                <input
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
                  placeholder="Prénom"
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">Nom</label>
                <input
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
                  placeholder="Nom"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">E-mail <span className="text-destructive font-bold">*</span></label>
              <input
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
                type="email"
                required
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              {emailHint && <p className="text-xs text-muted-foreground">{emailHint}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">Mot de passe <span className="text-destructive font-bold">*</span></label>
              <input
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Doit contenir au moins 8 caractères, avec au moins 1 lettre et 1 chiffre.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">Confirmer le mot de passe <span className="text-destructive font-bold">*</span></label>
              <input
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">Téléphone (optionnel)</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  className="flex h-10 w-full sm:w-1/3 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
                  value={form.phoneCountry}
                  onChange={(e) => setForm({ ...form, phoneCountry: e.target.value })}
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.iso2} value={c.iso2}>
                      {c.name} ({c.calling})
                    </option>
                  ))}
                </select>
                <div className="flex h-10 w-full sm:w-2/3 rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 overflow-hidden transition-colors">
                  <span className="flex items-center px-3 bg-muted border-r border-input text-muted-foreground text-sm shrink-0">
                    {callingCodeFor(form.phoneCountry)}
                  </span>
                  <input
                    className="w-full bg-transparent px-3 py-2 text-sm focus:outline-none"
                    value={form.phoneNational}
                    onChange={(e) => setForm({ ...form, phoneNational: e.target.value })}
                    placeholder="Numéro"
                  />
                </div>
              </div>
            </div>

            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Envoi…
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  S'inscrire
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Déjà inscrit ?{" "}
            <Link to="/login" className="font-medium text-primary hover:underline underline-offset-4">
              Se connecter
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
