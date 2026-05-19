import { useState } from "react";
import { Link } from "react-router-dom";
import { authApi } from "../api/auth";
import { extractApiError } from "../utils/apiError";
import { suggestEmailTypo } from "../utils/formHints";
import { KeyRound, Loader2, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(""); setMessage(""); setHint("");
    try {
      const { data } = await authApi.forgotPassword({ email });
      setMessage(data.message || "Demande envoyée.");
    } catch (err) {
      setError(extractApiError(err, "Action impossible.").message);
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
              <KeyRound className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl font-bold tracking-tight">Mot de passe oublié</CardTitle>
              <CardDescription>Recevez un lien de réinitialisation par e-mail.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 p-3 rounded-xl text-sm flex items-start gap-2 border border-blue-200 dark:border-blue-800">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Entrez votre e-mail. Si un compte existe, un lien sera envoyé <strong>dans quelques instants</strong>. (Pensez à vérifier le spam.)</span>
          </div>

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
          {hint && (
            <div className="bg-amber-50 text-amber-800 p-3 rounded-xl text-sm border border-amber-200">{hint}</div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">E-mail <span className="text-destructive font-bold">*</span></label>
              <Input
                type="email" required autoComplete="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setHint(suggestEmailTypo(e.target.value)); }}
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Envoi…</> : "Envoyer le lien"}
            </Button>
          </form>

          <div className="flex justify-between text-sm text-muted-foreground pt-1">
            <Link to="/login" className="font-medium text-primary hover:underline underline-offset-4">Retour connexion</Link>
            <Link to="/register" className="font-medium text-primary hover:underline underline-offset-4">Créer un compte</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
