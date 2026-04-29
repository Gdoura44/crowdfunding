const FailedRefundEvent = require("../models/FailedRefundEvent");
const FailedPayoutEvent = require("../models/FailedPayoutEvent");
const FailedWorkflowEvent = require("../models/FailedWorkflowEvent");
const HttpError = require("../utils/HttpError");
const Notification = require("../models/Notification");
const cronService = require("./cronService");
const { enqueueEmailForNotification } = require("../integrations/emailQueue");
const { writeAudit } = require("./auditService");

async function listFailedRefunds({ resolved, limit = 50 } = {}) {
  const query = {};
  if (resolved != null) query.resolved = Boolean(resolved);
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  return FailedRefundEvent.find(query).sort({ createdAt: -1 }).limit(safeLimit).lean();
}

async function listFailedPayouts({ resolved, limit = 50 } = {}) {
  const query = {};
  if (resolved != null) query.resolved = Boolean(resolved);
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  return FailedPayoutEvent.find(query).sort({ createdAt: -1 }).limit(safeLimit).lean();
}

async function retryRefundsOnce({ limit } = {}) {
  return cronService.retryFailedRefunds({ limit });
}

async function retryPayoutsOnce({ limit } = {}) {
  return cronService.retryFailedPayouts({ limit });
}

async function listFailedNotifications({ resolved, limit = 50 } = {}) {
  const query = { workflowType: "notification" };
  if (resolved != null) query.resolved = Boolean(resolved);
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  return FailedWorkflowEvent.find(query).sort({ createdAt: -1 }).limit(safeLimit).lean();
}

async function retryNotificationOnce({ adminId, eventId }) {
  const ev = await FailedWorkflowEvent.findById(eventId);
  if (!ev) throw new HttpError(404, "Événement introuvable.");
  if (ev.resolved) throw new HttpError(400, "Événement déjà clôturé.");

  const notificationId = ev.payload?.notificationId;
  if (!notificationId) {
    ev.resolved = true;
    ev.resolvedAt = new Date();
    ev.resolvedBy = adminId;
    await ev.save();
    return { ok: true, queued: false, reason: "notificationId manquant" };
  }

  const notif = await Notification.findById(notificationId).lean();
  if (!notif) {
    ev.resolved = true;
    ev.resolvedAt = new Date();
    ev.resolvedBy = adminId;
    await ev.save();
    return { ok: true, queued: false, reason: "notification introuvable" };
  }

  // Relance best-effort (ne doit pas bloquer le flux admin).
  await enqueueEmailForNotification(notif);

  ev.resolved = true;
  ev.resolvedAt = new Date();
  ev.resolvedBy = adminId;
  await ev.save();

  await writeAudit({
    actorId: adminId,
    actorRole: "ADMIN",
    action: "RETRY_NOTIFICATION_SUCCESS",
    targetType: "FailedWorkflowEvent",
    targetId: ev._id,
    details: { notificationId: String(notificationId) },
  });

  return { ok: true, queued: true };
}

module.exports = {
  listFailedRefunds,
  listFailedPayouts,
  retryRefundsOnce,
  retryPayoutsOnce,
  listFailedNotifications,
  retryNotificationOnce,
};

