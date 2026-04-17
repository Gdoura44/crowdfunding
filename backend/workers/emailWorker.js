require("dotenv").config();
require("../models");

const mongoose = require("mongoose");
const { Worker } = require("bullmq");
const IORedis = require("ioredis");
const Notification = require("../models/Notification");
const User = require("../models/User");
const FailedWorkflowEvent = require("../models/FailedWorkflowEvent");
const { sendMail } = require("../utils/email");

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
    throw new Error("DATABASE environment variable is required");
  }
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn(
      "[emailWorker] REDIS_URL not set: email worker will not start."
    );
    process.exit(0);
  }

  await mongoose.connect(databaseUrl);
  console.log("[emailWorker] Database connected");

  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

  const worker = new Worker(
    "send-email",
    async (job) => {
      const notificationId = job.data?.notificationId;
      if (!notificationId) return { ok: false, skipped: true };

      const notification = await Notification.findById(notificationId).lean();
      if (!notification) return { ok: false, missing: "notification" };

      const user = await User.findById(notification.userId).lean();
      if (!user || user.deletedAt) return { ok: false, missing: "user" };

      const mail = buildEmailFromNotification({ notification, user });
      await sendMail(mail);
      return { ok: true };
    },
    { connection }
  );

  worker.on("failed", (job, err) => {
    console.error("[emailWorker] job failed", job?.id, err?.message || err);
    const notificationId = job?.data?.notificationId;
    if (!notificationId) return;
    // Record a dead-letter event so admin can retry later (conception: Retry Failed Notification).
    FailedWorkflowEvent.create({
      workflowType: "notification",
      payload: { notificationId: String(notificationId) },
      error: String(err?.message || err),
      retryCount: Number(job?.attemptsMade || 0),
      resolved: false,
    }).catch(() => {});
  });
  worker.on("completed", (job) => {
    console.log("[emailWorker] job completed", job?.id);
  });
}

main().catch((err) => {
  console.error("[emailWorker] fatal:", err);
  process.exit(1);
});

