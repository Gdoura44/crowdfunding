import {
  onlyDigits,
  formatCardNumber,
  normalizeExpiryInput,
  detectCardBrand,
  maskCardLast4,
} from "./cardUtils.js";

const inputClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

export default function MockCardForm({
  cardName, onCardNameChange,
  cardNumber, onCardNumberChange,
  expiry, onExpiryChange,
  cvv, onCvvChange,
  disabled, looksLikeCard, looksLikeCvv, looksLikeExpiry,
}) {
  const cardDigits = onlyDigits(cardNumber);
  const cvvDigits = onlyDigits(cvv);
  const brand = detectCardBrand(cardDigits);

  return (
    <div className="grid grid-cols-2 gap-4 mt-4">
      {/* Card name – full width */}
      <div className="col-span-2 space-y-1.5">
        <label className="text-sm font-medium text-muted-foreground">Nom sur la carte <span className="text-destructive font-bold">*</span></label>
        <input
          className={inputClass}
          value={cardName}
          onChange={(e) => onCardNameChange(e.target.value)}
          placeholder="ex: AHMED BEN SALAH"
          autoComplete="cc-name"
          disabled={disabled}
        />
      </div>

      {/* Card number – full width */}
      <div className="col-span-2 space-y-1.5">
        <div className="flex justify-between items-center">
          <label className="text-sm font-medium text-muted-foreground">Numéro de carte <span className="text-destructive font-bold">*</span></label>
          {cardDigits && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-muted border border-border text-muted-foreground">
              {brand}
            </span>
          )}
        </div>
        <input
          className={inputClass}
          value={formatCardNumber(cardNumber)}
          onChange={(e) => {
            const val = onlyDigits(e.target.value).slice(0, 16);
            onCardNumberChange(val);
          }}
          placeholder="0000 0000 0000 0000"
          inputMode="numeric"
          autoComplete="cc-number"
          maxLength={19}
          disabled={disabled}
        />
        {cardDigits.length >= 4 && (
          <p className="text-xs text-muted-foreground">
            Affichage masqué : <strong className="text-foreground">{maskCardLast4(cardDigits)}</strong>
          </p>
        )}
        {!looksLikeCard && cardDigits.length > 0 && (
          <p className="text-xs text-destructive">Numéro de carte invalide (15 ou 16 chiffres requis).</p>
        )}
      </div>

      {/* Expiry */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-muted-foreground">Expiration (MM/AA) <span className="text-destructive font-bold">*</span></label>
        <input
          className={inputClass}
          value={expiry}
          onChange={(e) => onExpiryChange(normalizeExpiryInput(e.target.value))}
          placeholder="MM/AA"
          inputMode="numeric"
          autoComplete="cc-exp"
          disabled={disabled}
        />
        {expiry && !looksLikeExpiry && (
          <p className="text-xs text-destructive">Date invalide.</p>
        )}
      </div>

      {/* CVV */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-muted-foreground">CVV <span className="text-destructive font-bold">*</span></label>
        <input
          className={inputClass}
          value={cvvDigits}
          onChange={(e) => onCvvChange(e.target.value)}
          placeholder="***"
          inputMode="numeric"
          autoComplete="cc-csc"
          maxLength={4}
          disabled={disabled}
        />
        {cvvDigits && !looksLikeCvv && (
          <p className="text-xs text-destructive">CVV invalide (3 ou 4 chiffres).</p>
        )}
      </div>
    </div>
  );
}
