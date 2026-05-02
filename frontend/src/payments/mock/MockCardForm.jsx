import {
  onlyDigits,
  formatCardNumber,
  normalizeExpiryInput,
  detectCardBrand,
  maskCardLast4,
} from "./cardUtils.js";

export default function MockCardForm({
  cardName,
  onCardNameChange,
  cardNumber,
  onCardNumberChange,
  expiry,
  onExpiryChange,
  cvv,
  onCvvChange,
  disabled,
  looksLikeCard,
  looksLikeCvv,
  looksLikeExpiry,
}) {
  const cardDigits = onlyDigits(cardNumber);
  const cvvDigits = onlyDigits(cvv);
  const brand = detectCardBrand(cardDigits);

  return (
    <div className="row g-3 mt-1">
      <div className="col-12">
        <label className="form-label small text-muted mb-1">Nom sur la carte</label>
        <input
          className="form-control"
          value={cardName}
          onChange={(e) => onCardNameChange(e.target.value)}
          placeholder="ex: AHMED BEN SALAH"
          autoComplete="cc-name"
          disabled={disabled}
        />
      </div>
      <div className="col-12">
        <label className="form-label small text-muted mb-1 d-flex justify-content-between">
          <span>Numéro de carte</span>
          {cardDigits ? <span className="badge bg-light text-dark border">{brand}</span> : null}
        </label>
        <input
          className="form-control"
          value={formatCardNumber(cardNumber)}
          onChange={(e) => onCardNumberChange(e.target.value)}
          placeholder="0000 0000 0000 0000"
          inputMode="numeric"
          autoComplete="cc-number"
          disabled={disabled}
        />
        {cardDigits.length >= 4 ? (
          <div className="form-text">
            Affichage masqué : <strong>{maskCardLast4(cardDigits)}</strong>
          </div>
        ) : null}
        {!looksLikeCard && cardDigits.length > 0 ? (
          <div className="form-text text-danger">Numéro invalide (13 à 19 chiffres).</div>
        ) : null}
      </div>
      <div className="col-6">
        <label className="form-label small text-muted mb-1">Expiration (MM/AA)</label>
        <input
          className="form-control"
          value={expiry}
          onChange={(e) => onExpiryChange(normalizeExpiryInput(e.target.value))}
          placeholder="MM/AA"
          inputMode="numeric"
          autoComplete="cc-exp"
          disabled={disabled}
        />
        {expiry && !looksLikeExpiry ? (
          <div className="form-text text-danger">Date invalide.</div>
        ) : null}
      </div>
      <div className="col-6">
        <label className="form-label small text-muted mb-1">CVV</label>
        <input
          className="form-control"
          value={cvvDigits}
          onChange={(e) => onCvvChange(e.target.value)}
          placeholder="***"
          inputMode="numeric"
          autoComplete="cc-csc"
          maxLength={4}
          disabled={disabled}
        />
        {cvvDigits && !looksLikeCvv ? (
          <div className="form-text text-danger">CVV invalide (3 ou 4 chiffres).</div>
        ) : null}
      </div>
    </div>
  );
}
