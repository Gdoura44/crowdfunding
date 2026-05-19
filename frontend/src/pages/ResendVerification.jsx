import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authApi } from "../api/auth";
import { extractApiError } from "../utils/apiError";
import { suggestEmailTypo } from "../utils/formHints";
import { MailCheck, Loader2, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function ResendVerification() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = String(params.get("email") || "").trim();
    if (q) { setEmail(q); setHint(suggestEmailTypo(q)); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(""); setMessage(""); setHint("");
    try {
      const { data } = await authApi.resendVerification({ email });
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
              <MailCheck className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl font-bold tracking-tight">Renvoyer l'e-mail de vérification</CardTitle>
              <CardDescription>Recevez un nouveau code de vérification.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 p-3 rounded-xl text-sm flex items-start gap-2 border border-blue-200 dark:border-blue-800">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Utilisez cette page si vous n'avez pas reçu le <strong>code de vérification</strong>. Pensez à vérifier le <strong>spam</strong>.</span>
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
                placeholder="vous@exemple.com"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Envoi…</> : "Renvoyer le code"}
            </Button>
          </form>

          <div className="flex justify-between text-sm text-muted-foreground pt-1">
            <Link to="/login" className="font-medium text-primary hover:underline underline-offset-4">Connexion</Link>
            <Link to="/register" className="font-medium text-primary hover:underline underline-offset-4">Inscription</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
