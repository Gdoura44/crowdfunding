require("dotenv").config();
require("../models");

const mongoose = require("mongoose");
const { Worker } = require("bullmq");
const IORedis = require("ioredis");
const Notification = require("../models/Notification");
const User = require("../models/User");
const FailedWorkflowEvent = require("../models/FailedWorkflowEvent");
const { sendMail } = require("../utils/email");
const { shouldEmailNotificationType } = require("../config/emailNotificationPolicy");

/**
 * Worker BullMQ "send-email".
 *
 * Rôle:
 * - transformer une notification in-app en e-mail (simple copie du title/message).
 *
 * Note anti-spam:
 * - on n’envoie des e-mails que pour une liste de types critiques (policy centrale).
 * - même si un job existe déjà en queue, on peut le “skipper” proprement.
 */
function buildEmailFromNotification({ notification, user }) {
  const subject = notification.title || "Notification";
  const preview = notification.message || "";
  const text = `${subject}\n\n${preview}\n`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5">
      <h2 style="margin:0 0 8px">${escapeHtml(subject)}</h2>
      <p style="margin:0 0 12px; color:#334155">${escapeHtml(preview)}</p>
      <p style="margin:0; color:#64748b; font-size: 12px">Compte: ${escapeHtml(
        user.email
      )}</p>
    </div>
  `;
  return { to: user.email, subject, text, html };
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function main() {
  const databaseUrl = process.env.DATABASE;
  if (!databaseUrl) {
    throw new Error("La variable d’environnement DATABASE est requise");
  }
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn(
      "[emailWorker] REDIS_URL non défini : le worker email ne démarrera pas."
    );
    process.exit(0);
  }

  await mongoose.connect(databaseUrl);
  console.log("[emailWorker] Base de données connectée");

  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

  const worker = new Worker(
    "send-email",
    async (job) => {
      const notificationId = job.data?.notificationId;
      if (!notificationId) return { ok: false, skipped: true };

      const notification = await Notification.findById(notificationId).lean();
      if (!notification) return { ok: false, missing: "notification" };

      // Anti-spam: envoyer uniquement pour les types de notification critiques.
      if (!shouldEmailNotificationType(notification.type)) {
        return { ok: true, skipped: true, reason: "type-not-emailed", type: notification.type };
      }

      const user = await User.findById(notification.userId).lean();
      if (!user || user.deletedAt) return { ok: false, missing: "user" };

      const mail = buildEmailFromNotification({ notification, user });
      await sendMail(mail);
      return { ok: true };
    },
    { connection }
  );

  worker.on("failed", (job, err) => {
    console.error("[emailWorker] job en échec", job?.id, err?.message || err);
    const notificationId = job?.data?.notificationId;
    if (!notificationId) return;
    // Enregistrer un event “dead-letter” pour relance admin plus tard
    // (conception: Retry Failed Notification).
    FailedWorkflowEvent.create({
      workflowType: "notification",
      payload: { notificationId: String(notificationId) },
      error: String(err?.message || err),
      retryCount: Number(job?.attemptsMade || 0),
      resolved: false,
    }).catch(() => {});
  });
  worker.on("completed", (job) => {
    console.log("[emailWorker] job terminé", job?.id);
  });
}

main().catch((err) => {
  console.error("[emailWorker] erreur fatale:", err);
  process.exit(1);
});

