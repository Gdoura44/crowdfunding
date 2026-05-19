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
    NEW_ASSIGNMENT: "Expertise",
    EXPERT_REPORT_READY: "Rapport Expert",
    EXPERT_STATUS_CHANGED: "Statut Expert",
    NEW_EXPERT_APPLICATION: "Candidature Expert",
    NEW_PROJECT_SUBMITTED: "Administration",
    NEW_REPORT_SUBMITTED: "Signalement",
    INVESTMENT_RECEIVED: "Investissement",
    NEW_MESSAGE: "Chat",
    PAYMENT_HELD_CONSULTATION: "Paiement retenu (Consultation)",
  };
  return map[t] || "";
}

/**
 * Returns a lucide-react icon name string for a notification type.
 * Consumers should map these to actual Lucide components.
 * Kept for backward compatibility — Notifications.jsx uses its own getIconForType().
 */
export function getNotificationIconName(type) {
  const t = String(type || "").toUpperCase();
  switch (t) {
    case "PROJECT_APPROVED":
    case "PROJECT_PUBLISHED":
      return "CheckCircle2";
    case "PROJECT_REJECTED":
    case "PROJECT_AUTO_REJECTED":
    case "PAYMENT_FAILED":
      return "XCircle";
    case "INVESTMENT_RECEIVED":
      return "HandCoins";
    case "PAYMENT_HELD_CONSULTATION":
      return "Handshake";
    case "NEW_ASSIGNMENT":
    case "NEW_EXPERT_APPLICATION":
      return "BriefcaseBusiness";
    case "EXPERT_REPORT_READY":
      return "FileText";
    case "NEW_MESSAGE":
      return "MessageSquare";
    default:
      return "Bell";
  }
}
