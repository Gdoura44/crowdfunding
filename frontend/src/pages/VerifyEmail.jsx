import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { authApi } from "../api/auth";
import { extractApiError } from "../utils/apiError";
import { MailCheck, Loader2, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const location = useLocation();
  const emailFromQuery = String(params.get("email") || "").trim();

  const [email, setEmail] = useState(emailFromQuery);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState(token ? "pending" : "idle");
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
        if (err?.name === "CanceledError" || err?.code === "ERR_CANCELED") return;
        setStatus("error");
        setMessage(extractApiError(err, "Vérification impossible.").message);
      }
    })();
    return () => { controller.abort(); };
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
      setMessage(extractApiError(err, "Vérification impossible.").message);
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
              <CardTitle className="text-2xl font-bold tracking-tight">Vérification de l'e-mail</CardTitle>
              <CardDescription>Confirmez votre adresse pour activer votre compte.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {status !== "ok" && flash && (
            <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm border border-blue-200">{flash}</div>
          )}

          {status === "pending" && (
            <div className="flex flex-col items-center py-8 space-y-3">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-muted-foreground text-sm">Vérification en cours…</p>
            </div>
          )}

          {status === "ok" && (
            <div className="space-y-4">
              <div className="bg-green-50 text-green-800 p-4 rounded-xl flex items-center gap-3 border border-green-200">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <p className="text-sm font-medium">{message}</p>
              </div>
              <Button asChild className="w-full">
                <Link to="/login">Se connecter</Link>
              </Button>
            </div>
          )}

          {status === "error" && message && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-xl flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <p className="text-sm">{message}</p>
            </div>
          )}

          {!token && status !== "ok" && (
            <>
              <form onSubmit={onSubmitCode} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">E-mail <span className="text-destructive font-bold">*</span></label>
                  <Input
                    type="email" required autoComplete="email"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="vous@exemple.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Code de vérification <span className="text-destructive font-bold">*</span></label>
                  <Input
                    inputMode="numeric" pattern="[0-9]{4,6}" maxLength={6} required
                    value={code}
                    onChange={(e) => setCode(String(e.target.value || "").replace(/[^0-9]/g, ""))}
                    placeholder="------"
                    className="text-center text-xl tracking-[0.35em] font-bold"
                  />
                  <p className="text-xs text-muted-foreground">Code valable 15 minutes.</p>
                </div>
                <Button type="submit" disabled={status === "pending"} className="w-full">
                  {status === "pending" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Vérifier
                </Button>
              </form>

              <div className="flex justify-between text-sm pt-2">
                <Link
                  to={`/resend-verification?email=${encodeURIComponent(email)}`}
                  className="text-primary font-medium hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Renvoyer le code
                </Link>
                <Link to="/register" className="text-muted-foreground hover:underline">Retour</Link>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
