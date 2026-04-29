const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const HttpError = require("../utils/HttpError");

function isTruthyQueryFlag(value) {
  if (value === true) return true;
  if (value === false || value == null) return false;
  const s = String(value).trim().toLowerCase();
  return ["1", "true", "yes", "y", "on"].includes(s);
}

async function createInAppNotification({
  userId,
  type,
  title,
  message,
  relatedEntityId = null,
  relatedEntityType = null,
}) {
  if (!mongoose.isValidObjectId(userId)) {
    throw new HttpError(400, "Identifiant utilisateur invalide.");
  }
  return Notification.create({
    userId,
    type,
    title,
    message,
    relatedEntityId,
    relatedEntityType,
  });
}

async function listUserNotifications(userId, { limit = 20 } = {}) {
  const n = Number(limit);
  const safeLimit = Number.isFinite(n) ? Math.min(Math.max(n, 1), 50) : 20;
  return Notification.find({ userId })
    .sort({ createdAt: -1 })
    .limit(safeLimit)
    .lean();
}

/**
 * Recent notifications across all users (admin read-only overview).
 */
async function listAllNotificationsForAdmin({ limit = 50, unreadOnly = false } = {}) {
  const n = Number(limit);
  const safeLimit = Number.isFinite(n) ? Math.min(Math.max(n, 1), 100) : 50;
  const query = {};
  if (isTruthyQueryFlag(unreadOnly)) {
    query.adminRead = { $ne: true };
  }
  return Notification.find(query)
    .sort({ createdAt: -1 })
    .limit(safeLimit)
    .lean();
}

async function markAsRead(userId, notificationId) {
  const updated = await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { $set: { read: true } },
    { new: true }
  ).lean();
  if (!updated) {
    throw new HttpError(404, "Notification introuvable.");
  }
  return updated;
}

async function markAdminRead(notificationId) {
  if (!mongoose.isValidObjectId(notificationId)) {
    throw new HttpError(400, "Identifiant de notification invalide.");
  }
  const updated = await Notification.findOneAndUpdate(
    { _id: notificationId },
    { $set: { adminRead: true } },
    { new: true }
  ).lean();
  if (!updated) {
    throw new HttpError(404, "Notification introuvable.");
  }
  return updated;
}

module.exports = {
  createInAppNotification,
  listUserNotifications,
  listAllNotificationsForAdmin,
  markAsRead,
  markAdminRead,
};

