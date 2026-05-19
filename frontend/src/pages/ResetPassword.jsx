import { useMemo, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { authApi } from "../api/auth";
import { extractApiError } from "../utils/apiError";
import { ShieldCheck, Loader2, AlertTriangle, CheckCircle2, Info, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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
  const [showPwd, setShowPwd] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordMismatch = password && confirmPassword && password !== confirmPassword;

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
      setTimeout(() => navigate("/login", { replace: true }), 1500);
    } catch (err) {
      setError(extractApiError(err, "Réinitialisation impossible.").message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] py-8 px-4">
      <Card className="w-full max-w-md shadow-lg border-border/50">
        <CardHeader className="space-y-3 pb-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0f4c5c] to-[#1a8a9e] text-white shadow-inner">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl font-bold tracking-tight">Réinitialiser le mot de passe</CardTitle>
              <CardDescription>Choisissez un nouveau mot de passe sécurisé.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 p-3 rounded-xl text-sm flex items-start gap-2 border border-blue-200 dark:border-blue-800">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Choisissez un nouveau mot de passe (8+ caractères). Le lien est valide pendant une durée limitée.</span>
          </div>

          {!token && (
            <div className="bg-amber-50 text-amber-800 p-3 rounded-xl text-sm border border-amber-200">
              Lien invalide : token manquant. Recommencez depuis "Mot de passe oublié".
            </div>
          )}

          {message && (
            <div className="bg-green-50 text-green-800 p-3 rounded-xl flex items-center gap-2 border border-green-200">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> <span className="text-sm">{message}</span>
            </div>
          )}
          {error && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> <span className="text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nouveau mot de passe (8 caractères minimum) <span className="text-destructive font-bold">*</span></label>
              <div className="relative">
                <Input
                  type={showPwd ? "text" : "password"}
                  required minLength={8} autoComplete="new-password"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  disabled={!token} className="pr-10"
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Confirmer le mot de passe <span className="text-destructive font-bold">*</span></label>
              <Input
                type="password" required minLength={8} autoComplete="new-password"
                value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={!token}
                className={passwordMismatch ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {passwordMismatch && (
                <p className="text-xs text-destructive">Les deux mots de passe ne correspondent pas.</p>
              )}
            </div>
            <Button type="submit" disabled={loading || !token} className="w-full">
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Mise à jour…</> : "Mettre à jour le mot de passe"}
            </Button>
          </form>

          <div className="flex justify-between text-sm text-muted-foreground pt-1">
            <Link to="/login" className="font-medium text-primary hover:underline underline-offset-4">Connexion</Link>
            <Link to="/forgot-password" className="font-medium text-primary hover:underline underline-offset-4">Renvoyer un lien</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
