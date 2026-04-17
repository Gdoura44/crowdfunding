const Project = require("../models/Project");

async function getRecommendationsForUser(userId, { limit = 8 } = {}) {
  // Demo-first: no Redis/ML. Return active projects sorted by "progress".
  const n = Number(limit);
  const safeLimit = Number.isFinite(n) ? Math.min(Math.max(n, 1), 20) : 8;

  const list = await Project.find({
    status: "ACTIVE",
    isArchived: false,
  })
    .sort({ currentFunding: -1 })
    .limit(safeLimit)
    .lean();

  // Future enhancement: personalize using user profile (categories, risk preference, history).
  return list;
}

module.exports = { getRecommendationsForUser };

