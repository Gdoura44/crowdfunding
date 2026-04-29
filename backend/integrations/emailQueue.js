const { Queue } = require("bullmq");
const IORedis = require("ioredis");
const Notification = require("../models/Notification");
const { shouldEmailNotificationType } = require("../config/emailNotificationPolicy");

let queueInstance = null;

function getQueue() {
  if (queueInstance) return queueInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: 1 });
  queueInstance = new Queue("send-email", { connection });
  return queueInstance;
}

/**
 * Enfile l’envoi d’un e-mail *uniquement* pour les notifications critiques (anti-spam).
 *
 * Pourquoi filtrer ici:
 * - éviter de remplir Redis/BullMQ avec des e-mails “bruit” (ex: PROJECT_UPDATED).
 *
 * Pourquoi filtrer aussi côté worker:
 * - sécurité/robustesse: même si un ancien job existe déjà en queue, on ne spamme pas.
 *
 * Accepte:
 * - un ObjectId (notificationId)
 * - ou un document notification (préféré) pour éviter une requête DB juste pour lire `type`.
 */
async function enqueueEmailForNotification(notificationId) {
  // Accepter soit un document notification (préféré), soit juste un id.
  const input = notificationId;
  const id =
    (input && (input._id || input.id)) != null ? String(input._id || input.id) : String(input);
  let type = input?.type;
  if (!type) {
    try {
      const n = await Notification.findById(id).select("type").lean();
      type = n?.type;
    } catch {
      type = undefined;
    }
  }

  // Par défaut: OFF. Seuls les types explicitement autorisés déclenchent un e-mail.
  if (!shouldEmailNotificationType(type)) {
    return { ok: true, queued: false, skipped: true, reason: "type-not-emailed", type };
  }

  const q = getQueue();
  if (!q) {
    console.info("[send-email-queue] Enfilement stub (définir REDIS_URL pour activer):", {
      notificationId: String(id),
      type,
    });
    return { ok: true, queued: false };
  }

  const job = await q.add(
    "send-notification-email",
    { notificationId: String(id) },
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 30_000 },
      removeOnComplete: 1000,
      removeOnFail: 1000,
    }
  );

  return { ok: true, queued: true, jobId: job.id };
}

async function enqueueEmailForNotifications(notifications) {
  const items = Array.isArray(notifications) ? notifications : [];
  for (const n of items) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await enqueueEmailForNotification(n);
    } catch {
      // L’e-mail ne doit pas casser le flux principal.
    }
  }
}

module.exports = {
  enqueueEmailForNotification,
  enqueueEmailForNotifications,
};

