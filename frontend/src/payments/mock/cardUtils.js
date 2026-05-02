/**
 * Utilitaires carte (démo uniquement — aucune donnée sensible n’est envoyée au serveur).
 */

export function onlyDigits(s) {
  return String(s || "").replace(/[^\d]/g, "");
}

export function formatCardNumber(digits) {
  const d = onlyDigits(digits).slice(0, 19);
  return d.replace(/(.{4})/g, "$1 ").trim();
}

/**
 * MM/AA valide et non expiré : fin de mois du mois indiqué (dernier jour inclus).
 */
export function isValidExpiry(mmYY) {
  const raw = String(mmYY || "").trim();
  const m = raw.match(/^(\d{2})\s*\/\s*(\d{2})$/);
  if (!m) return false;
  const mm = Number(m[1]);
  const yy = Number(m[2]);
  if (!Number.isFinite(mm) || mm < 1 || mm > 12) return false;
  if (!Number.isFinite(yy)) return false;
  const now = new Date();
  const fullYear = 2000 + yy;
  const exp = new Date(fullYear, mm, 0, 23, 59, 59, 999);
  return exp.getTime() >= now.getTime();
}

/** Détection marque à partir du BIN (patterns usuels, suffisant pour une démo). */
export function detectCardBrand(digits) {
  const d = onlyDigits(digits);
  if (!d) return "";
  if (/^4/.test(d)) return "VISA";
  if (/^(5[1-5]|2(2[2-9]|[3-6]|7[01]|720))/.test(d)) return "MASTERCARD";
  if (/^(34|37)/.test(d)) return "AMEX";
  if (/^6(?:011|5)/.test(d)) return "DISCOVER";
  return "CARTE";
}

export function maskCardLast4(digits) {
  const d = onlyDigits(digits);
  if (d.length < 4) return "";
  return `•••• •••• •••• ${d.slice(-4)}`;
}

/**
 * Normalise la saisie expiration : chiffres + slash, insère « / » après MM.
 */
export function normalizeExpiryInput(raw) {
  const v = String(raw || "").replace(/[^\d/]/g, "").slice(0, 5);
  return v.length === 2 && !v.includes("/") ? `${v}/` : v;
}
