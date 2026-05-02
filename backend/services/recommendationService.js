const Project = require("../models/Project");
const User = require("../models/User");

function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}

function scoreRiskMatch(userPref, projectRiskLevel) {
  const pref = String(userPref || "MEDIUM").toUpperCase();
  const lvl = String(projectRiskLevel || "").toUpperCase();
  if (!lvl) return 0; // unknown: neutral
  // Préférence risque : LOW → préfère LOW, évite HIGH.
  if (pref === "LOW") return lvl === "LOW" ? 20 : lvl === "MEDIUM" ? 8 : -15;
  // Préférence risque : HIGH → accepte MEDIUM/HIGH.
  if (pref === "HIGH") return lvl === "HIGH" ? 18 : lvl === "MEDIUM" ? 12 : 2;
  // Préférence risque : MEDIUM → préfère MEDIUM, accepte LOW, pénalise légèrement HIGH.
  return lvl === "MEDIUM" ? 16 : lvl === "LOW" ? 10 : -6;
}

function scoreCategoryMatch(preferredCategories, category) {
  const prefs = Array.isArray(preferredCategories) ? preferredCategories : [];
  const c = String(category || "");
  if (!c) return 0;
  if (prefs.includes(c)) return 30;
  return 0;
}

function scorePopularity(project) {
  const goal = Number(project.fundingGoal || 0);
  const cur = Number(project.currentFunding || 0);
  const pct = goal > 0 ? cur / goal : 0;
  // Progression du financement : jusqu’à 20 points (capé).
  return Math.round(clamp(pct, 0, 1) * 20);
}

function scoreRecency(project) {
  const created = project?.createdAt ? new Date(project.createdAt) : null;
  if (!created || Number.isNaN(created.getTime())) return 0;
  const days = Math.max(0, (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
  // Léger bonus pour les projets récents (jusqu’à 10 points), s’estompe après environ 30 jours.
  return Math.round(clamp(1 - days / 30, 0, 1) * 10);
}

async function getRecommendationsForUser(userId, { limit = 8 } = {}) {
  const n = Number(limit);
  const safeLimit = Number.isFinite(n) ? Math.min(Math.max(n, 1), 20) : 8;

  // Ne jamais recommander les projets archivés (le créateur les a explicitement masqués).
  const candidates = await Project.find({
    status: "ACTIVE",
    isArchived: false,
  })
    .sort({ createdAt: -1 })
    .limit(80)
    .lean();

  const user = await User.findById(userId).select("profile.riskPreference profile.preferredCategories").lean();
  const riskPref = user?.profile?.riskPreference || "MEDIUM";
  const prefs = user?.profile?.preferredCategories || [];

  const scored = candidates
    .map((p) => {
      const s =
        scoreCategoryMatch(prefs, p.category) +
        scoreRiskMatch(riskPref, p.aiAnalysis?.riskLevel) +
        scorePopularity(p) +
        scoreRecency(p);
      return { p, s };
    })
    .sort((a, b) => b.s - a.s)
    .slice(0, safeLimit)
    .map((x) => x.p);

  return scored;
}

module.exports = { getRecommendationsForUser };

