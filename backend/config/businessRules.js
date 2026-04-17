/**
 * Business rules/constants centralized for low coupling.
 * Frontend may mirror some of these for UX, but backend is the source of truth.
 */

const FUNDING_GOAL_MIN = 10_000;
const FUNDING_GOAL_MAX = 10_000_000;

// Creator may delete before the campaign goes live.
const PROJECT_NON_DELETABLE_STATUSES = ["ACTIVE", "FUNDED", "CLOSED", "SUSPENDED"];

module.exports = {
  FUNDING_GOAL_MIN,
  FUNDING_GOAL_MAX,
  PROJECT_NON_DELETABLE_STATUSES,
};

