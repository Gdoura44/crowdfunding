// Politique centrale: quelles notifications in-app déclenchent aussi un e-mail.
// Objectif: éviter le spam tout en conservant les alertes critiques.

const EMAIL_ON_NOTIFICATION_TYPES = new Set([
  // Sécurité / auth (déclenchées via notification)
  "PASSWORD_RESET_REQUESTED",

  // Paiements
  "PAYMENT_SUCCESS",
  "PAYMENT_FAILED",
  "PAYMENT_REFUNDED",

  // Retraits (payouts)
  "PAYOUT_BANK_DETAILS_REQUEST",
  "PAYOUT_READY_FOR_APPROVAL",
  "PAYOUT_FAILED",
  "PAYOUT_COMPLETED",

  // Décisions projet / visibilité
  "PROJECT_APPROVED",
  "PROJECT_REJECTED",
  "PROJECT_AUTO_REJECTED",
  "PROJECT_PUBLISHED",
  "PROJECT_AI_REPORT_READY",
]);

function shouldEmailNotificationType(type) {
  return EMAIL_ON_NOTIFICATION_TYPES.has(String(type || ""));
}

module.exports = {
  EMAIL_ON_NOTIFICATION_TYPES,
  shouldEmailNotificationType,
};

