import { onlyDigits } from "./cardUtils.js";

export default function MockThreeDSStep({
  otp,
  onOtpChange,
  otpErr,
  loading,
  onCancel,
  onConfirm,
}) {
  return (
    <div className="card border-0 bg-light mt-3">
      <div className="card-body">
        <div className="d-flex align-items-start gap-2">
          <i className="fa-solid fa-shield-halved text-primary mt-1" aria-hidden="true" />
          <div className="min-w-0">
            <div className="fw-semibold">3D Secure (démo)</div>
            <div className="small text-muted">
              Un code OTP a été “envoyé” sur votre téléphone. Entrez le code pour continuer.
            </div>
          </div>
        </div>

        <div className="row g-2 align-items-end mt-2">
          <div className="col-12 col-sm-6">
            <label className="form-label small text-muted mb-1">Code OTP</label>
            <input
              className="form-control text-center"
              inputMode="numeric"
              value={onlyDigits(otp).slice(0, 6)}
              onChange={(e) => onOtpChange(e.target.value)}
              placeholder="______"
              style={{ letterSpacing: "0.35em", fontWeight: 700 }}
              disabled={loading}
            />
            {otpErr ? <div className="form-text text-danger">{otpErr}</div> : null}
            <div className="form-text">Astuce démo : utilisez n’importe quel code à 6 chiffres.</div>
          </div>
          <div className="col-12 col-sm-6 d-flex justify-content-sm-end gap-2">
            <button type="button" className="btn btn-outline-secondary" disabled={loading} onClick={onCancel}>
              Annuler
            </button>
            <button type="button" className="btn btn-primary" disabled={loading} onClick={onConfirm}>
              {loading ? "Vérification…" : "Confirmer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
