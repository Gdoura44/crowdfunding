const User = require("../models/User");
const HttpError = require("../utils/HttpError");
const Notification = require("../models/Notification");
const { writeAudit } = require("./auditService");
const { enqueueEmailForNotifications } = require("../integrations/emailQueue");

/**
 * List registered users (admin moderation / support).
 */
async function listUsers({ limit = 40 } = {}) {
  const n = Number(limit);
  const safeLimit = Number.isFinite(n) ? Math.min(Math.max(n, 1), 100) : 40;
  return User.find({ deletedAt: null })
    .select("email role isActive createdAt updatedAt profile")
    .sort({ createdAt: -1 })
    .limit(safeLimit)
    .lean();
}

async function setUserActive({ userId, isActive }) {
  const user = await User.findById(userId);
  if (!user || user.deletedAt) throw new HttpError(404, "User not found");
  if (user.role === "ADMIN") {
    throw new HttpError(403, "Cannot change active state for admin accounts");
  }
  user.isActive = Boolean(isActive);
  await user.save();
  return user.toObject();
}

async function reactivateUser({ adminId, userId }) {
  const user = await User.findById(userId);
  if (!user || user.deletedAt) throw new HttpError(404, "User not found");
  if (user.role === "ADMIN") {
    throw new HttpError(403, "Cannot reactivate admin accounts");
  }
  if (user.isActive) {
    return user.toObject();
  }

  user.isActive = true;
  await user.save();

  await writeAudit({
    actorId: adminId,
    actorRole: "ADMIN",
    action: "REACTIVATE_USER",
    targetType: "User",
    targetId: user._id,
    details: {},
  });

  const notifications = await Notification.create([
    {
      userId: user._id,
      type: "USER_REACTIVATED",
      title: "Compte réactivé",
      message: "Votre compte a été réactivé. Vous pouvez à nouveau vous connecter.",
      relatedEntityId: user._id,
      relatedEntityType: "USER",
    },
  ]);
  await enqueueEmailForNotifications(notifications);

  return user.toObject();
}

module.exports = {
  listUsers,
  setUserActive,
  reactivateUser,
};
