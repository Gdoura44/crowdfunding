/** Minimum days between "now" and project deadline (conception/projects.txt). */
const MIN_PROJECT_DEADLINE_DAYS = 7;

/** Minimum delay before a project can start (business rule). */
const MIN_PROJECT_START_DELAY_DAYS = 7;

/** Max refresh tokens per user (conception/mongo db/user.txt). */
const MAX_REFRESH_TOKENS = 5;

const ACCESS_TOKEN_COOKIE = "access_token";
const REFRESH_TOKEN_COOKIE = "refresh_token";

module.exports = {
  MIN_PROJECT_DEADLINE_DAYS,
  MIN_PROJECT_START_DELAY_DAYS,
  MAX_REFRESH_TOKENS,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
};
