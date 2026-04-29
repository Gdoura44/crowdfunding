export function labelNotificationType(type) {
  const t = String(type || "").toUpperCase();
  const map = {
    PROJECT_CREATED: "Projet",
    PROJECT_UPDATED: "Projet",
    PROJECT_SUBMITTED: "Analyse IA",
    PROJECT_AI_REPORT_READY: "Analyse IA",
    PROJECT_APPROVED: "Projet",
    PROJECT_REJECTED: "Projet",
    PROJECT_AUTO_REJECTED: "Projet",
    PROJECT_PUBLISHED: "Projet",
    PROJECT_ARCHIVED: "Projet",
    PROJECT_EXPIRED: "Projet",
    PAYMENT_FAILED: "Paiement",
    PAYMENT_REFUNDED: "Paiement",
    PAYOUT_READY_FOR_APPROVAL: "Retrait",
    PAYOUT_APPROVED: "Retrait",
    REPORT_SUBMITTED: "Signalement",
    REPORT_RESOLVED: "Signalement",
  };
  return map[t] || "";
}

