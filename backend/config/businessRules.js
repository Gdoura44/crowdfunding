/**
 * Règles métier / constantes centralisées (faible couplage).
 * Le frontend peut en miroiter certaines pour l’UX, mais le backend reste la source de vérité.
 */

const FUNDING_GOAL_MIN = 10_000;
const FUNDING_GOAL_MAX = 10_000_000;

// Le créateur peut supprimer son projet uniquement avant que la campagne ne soit en ligne.
const PROJECT_NON_DELETABLE_STATUSES = ["ACTIVE", "FUNDED", "CLOSED", "SUSPENDED"];

module.exports = {
  FUNDING_GOAL_MIN,
  FUNDING_GOAL_MAX,
  PROJECT_NON_DELETABLE_STATUSES,
};

