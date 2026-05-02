const User = require("../models/User");

/**
 * Cleanup expired refresh tokens stored in `users.refreshTokens[]`.
 * Cela garde des documents plus petits et réduit les échecs lors des refresh.
 */
async function cleanupExpiredRefreshTokens({ now = new Date(), limit = 500 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 500, 1), 5000);

  // Trouver d’abord des utilisateurs candidats (borné), puis appliquer $pull.
  const candidates = await User.find({
    "refreshTokens.expiresAt": { $lt: now },
    deletedAt: null,
  })
    .select("_id")
    .limit(safeLimit)
    .lean();

  let cleanedUsers = 0;
  for (const u of candidates) {
    const r = await User.updateOne(
      { _id: u._id },
      { $pull: { refreshTokens: { expiresAt: { $lt: now } } } }
    );
    if (r.modifiedCount > 0) cleanedUsers += 1;
  }

  return { scanned: candidates.length, cleanedUsers };
}

module.exports = { cleanupExpiredRefreshTokens };

