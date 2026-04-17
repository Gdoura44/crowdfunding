const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const HttpError = require("../utils/HttpError");

async function createInAppNotification({
  userId,
  type,
  title,
  message,
  relatedEntityId = null,
  relatedEntityType = null,
}) {
  if (!mongoose.isValidObjectId(userId)) {
    throw new HttpError(400, "Invalid user id");
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
async function listAllNotificationsForAdmin({ limit = 50 } = {}) {
  const n = Number(limit);
  const safeLimit = Number.isFinite(n) ? Math.min(Math.max(n, 1), 100) : 50;
  return Notification.find({})
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
    throw new HttpError(404, "Notification not found");
  }
  return updated;
}

module.exports = {
  createInAppNotification,
  listUserNotifications,
  listAllNotificationsForAdmin,
  markAsRead,
};

