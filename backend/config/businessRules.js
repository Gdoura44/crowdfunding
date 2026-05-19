/**
 * Règles métier / constantes centralisées (faible couplage).
 * Le frontend peut en miroiter certaines pour l’UX, mais le backend reste la source de vérité.
 */

const FUNDING_GOAL_MIN = 1_000;
const FUNDING_GOAL_MAX = 1_100_000;
const PLATFORM_FEE_RATE = 0.05; // 5% platform commission fee

// Le créateur peut supprimer son projet uniquement avant que la campagne ne soit en ligne.
const PROJECT_NON_DELETABLE_STATUSES = ["ACTIVE", "FUNDED", "CLOSED", "SUSPENDED"];

module.exports = {
  FUNDING_GOAL_MIN,
  FUNDING_GOAL_MAX,
  PLATFORM_FEE_RATE,
  PROJECT_NON_DELETABLE_STATUSES,
};

