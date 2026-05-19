/** Délai minimum avant qu’un projet puisse démarrer (règle métier). */
const MIN_PROJECT_START_DELAY_DAYS = 7;

/** Durée minimale de campagne entre startAt et deadline (règle métier). */
const MIN_PROJECT_DURATION_DAYS = 31;

/** Nombre max de refresh tokens par utilisateur (conception/mongo db/user.txt). */
const MAX_REFRESH_TOKENS = 5;

const ACCESS_TOKEN_COOKIE = "access_token";
const REFRESH_TOKEN_COOKIE = "refresh_token";

/** Scheduler interne (dev/démo). */
const INTERNAL_CRON_DEFAULT_INTERVAL_MIN = 10;
const INTERNAL_CRON_RETRY_STUCK_AI_OLDER_THAN_MIN = 2;

module.exports = {
  MIN_PROJECT_START_DELAY_DAYS,
  MIN_PROJECT_DURATION_DAYS,
  MAX_REFRESH_TOKENS,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  INTERNAL_CRON_DEFAULT_INTERVAL_MIN,
  INTERNAL_CRON_RETRY_STUCK_AI_OLDER_THAN_MIN,
};
