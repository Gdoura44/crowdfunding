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

/** Taille d’une page liste utilisateur (API `page`, `limit` ≤ ce plafond). */
const MAX_LIST_PAGE_SIZE = 30;
/** La route demande parfois N+1 lignes pour savoir si une page suivante existe (`hasMore`). */
const MAX_LIST_QUERY_LIMIT = MAX_LIST_PAGE_SIZE + 1;

async function listUserNotifications(
  userId,
  { limit = MAX_LIST_PAGE_SIZE, skip = 0, unreadOnly = false } = {}
) {
  const n = Number(limit);
  const safeLimit = Number.isFinite(n)
    ? Math.min(Math.max(n, 1), MAX_LIST_QUERY_LIMIT)
    : MAX_LIST_PAGE_SIZE;
  const sk = Number(skip);
  const safeSkip = Number.isFinite(sk) ? Math.max(0, Math.floor(sk)) : 0;
  const query = { userId };
  if (isTruthyQueryFlag(unreadOnly)) {
    query.read = { $ne: true };
  }
  // Du plus récent au plus ancien
  return Notification.find(query)
    .sort({ createdAt: -1 })
    .skip(safeSkip)
    .limit(safeLimit)
    .lean();
}

async function markAsRead(userId, notificationId) {
  const updated = await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { $set: { read: true } },
    { returnDocument: "after" }
  ).lean();
  if (!updated) {
    throw new HttpError(404, "Notification introuvable.");
  }
  return updated;
}

/** Nombre total de notifications non lues pour un utilisateur. */
async function countUserUnread(userId) {
  if (!mongoose.isValidObjectId(userId)) return 0;
  return Notification.countDocuments({ userId, read: { $ne: true } });
}

module.exports = {
  createInAppNotification,
  MAX_LIST_PAGE_SIZE,
  listUserNotifications,
  countUserUnread,
  markAsRead,
};

