const { Queue } = require("bullmq");
const IORedis = require("ioredis");

let queueInstance = null;

function getQueue() {
  if (queueInstance) return queueInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: 1 });
  queueInstance = new Queue("send-email", { connection });
  return queueInstance;
}

async function enqueueEmailForNotification(notificationId) {
  const q = getQueue();
  if (!q) {
    console.info("[send-email-queue] Stub enqueue (set REDIS_URL to enable):", {
      notificationId: String(notificationId),
    });
    return { ok: true, queued: false };
  }

  const job = await q.add(
    "send-notification-email",
    { notificationId: String(notificationId) },
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
  const ids = (notifications || [])
    .map((n) => n?._id || n?.id)
    .filter(Boolean);
  for (const id of ids) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await enqueueEmailForNotification(id);
    } catch {
      // Email must not break main flow.
    }
  }
}

module.exports = {
  enqueueEmailForNotification,
  enqueueEmailForNotifications,
};

