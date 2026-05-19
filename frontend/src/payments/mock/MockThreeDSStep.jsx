import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { onlyDigits } from "./cardUtils.js";

const inputClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-center tracking-[0.35em] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors disabled:opacity-50";

export default function MockThreeDSStep({
  otp, onOtpChange, otpErr, loading, onCancel, onConfirm, onResend
}) {
  return (
    <div className="mt-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 space-y-4">
      <div className="flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <div className="font-semibold text-blue-900 dark:text-blue-200 text-sm">Vérification 3D Secure</div>
          <div className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
            Un code à usage unique a été envoyé à votre adresse e-mail. Saisissez-le pour poursuivre.
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-end">
        <div className="flex-1 space-y-1.5">
          <label className="text-xs font-medium text-blue-800 dark:text-blue-300">Code OTP</label>
          <input
            className={inputClass}
            inputMode="numeric"
            value={onlyDigits(otp).slice(0, 6)}
            onChange={(e) => onOtpChange(e.target.value)}
            placeholder="______"
            disabled={loading}
          />
          {otpErr && <p className="text-xs text-destructive font-medium">{otpErr}</p>}
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Format attendu : 6 chiffres (code transmis par e-mail).</p>
            {onResend && (
              <button 
                type="button" 
                onClick={onResend} 
                disabled={loading}
                className="text-xs text-primary font-medium hover:underline disabled:opacity-50"
              >
                Renvoyer le code
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" type="button" disabled={loading} onClick={onCancel}>
            Annuler
          </Button>
          <Button size="sm" type="button" disabled={loading} onClick={onConfirm}>
            {loading ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Vérification…</> : "Confirmer"}
          </Button>
        </div>
      </div>
    </div>
  );
}
