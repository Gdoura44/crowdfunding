export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

/**
 * Helper UX uniquement: suggérer des typos fréquentes de domaines (gmail/hotmail/outlook/yahoo).
 * On ne peut pas vérifier si une adresse “existe” réellement chez Gmail.
 */
export function suggestEmailTypo(email) {
  const e = normalizeEmail(email);
  const at = e.lastIndexOf("@");
  if (at < 0) return "";
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  if (!local || !domain) return "";

  const suggestions = new Map([
    ["gamil.com", "gmail.com"],
    ["gmial.com", "gmail.com"],
    ["gmai.com", "gmail.com"],
    ["gmal.com", "gmail.com"],
    ["gmail.con", "gmail.com"],
    ["hotmail.con", "hotmail.com"],
    ["outlook.con", "outlook.com"],
    ["yahoo.con", "yahoo.com"],
  ]);

  const fixed = suggestions.get(domain);
  if (!fixed) return "";
  return `Voulez-vous dire : ${local}@${fixed} ?`;
}

export function passwordChecklist(password) {
  const s = String(password || "");
  return {
    min8: s.length >= 8,
    hasLetter: /[A-Za-zÀ-ÿ]/.test(s),
    hasDigit: /\d/.test(s),
  };
}

