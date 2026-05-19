import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { authApi } from "../api/auth";
import { useAuth } from "../hooks/useAuth.js";
import { extractApiError } from "../utils/apiError";
import { LogIn, Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshUser } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const from =
    location.state?.from?.pathname && location.state.from.pathname !== "/login"
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
      setError(extractApiError(err, "Connexion impossible.").message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] py-8 px-4">
      {/* Background glow */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-to-br from-primary/12 to-[oklch(0.60_0.11_210)]/6 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md shadow-xl border-border/50 bg-card/95 backdrop-blur">
        {/* Gradient top bar */}
        <div className="h-1 w-full bg-gradient-to-r from-primary to-[oklch(0.60_0.11_210)] rounded-t-xl" />

        <CardHeader className="space-y-3 pt-6 pb-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[oklch(0.60_0.11_210)] text-white shadow-md">
              <LogIn className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl font-bold tracking-tight">
                Connexion
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Accédez à votre espace pour gérer vos projets et vos messages.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pb-6">
          {error && (
            <div className="mb-5 flex items-center gap-2.5 rounded-xl bg-destructive/10 border border-destructive/20 p-3.5 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                Adresse e-mail <span className="text-destructive font-bold">*</span>
              </label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="vous@exemple.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium text-foreground">
                  Mot de passe <span className="text-destructive font-bold">*</span>
                </label>
                <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline underline-offset-4">
                  Mot de passe oublié ?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  disabled={loading}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                  aria-label={showPwd ? "Masquer" : "Afficher"}
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button className="w-full mt-2" type="submit" disabled={loading} size="lg">
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Connexion en cours…</>
              ) : (
                <><LogIn className="h-4 w-4" />Se connecter</>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Pas encore de compte ?{" "}
            <Link to="/register" className="font-semibold text-primary hover:underline underline-offset-4">
              Créer un compte
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
