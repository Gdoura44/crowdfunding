const { Queue } = require("bullmq");
const IORedis = require("ioredis");
const { buildRiskPayload } = require("../services/workflowInternalService");

let queueInstance = null;

function getQueue() {
  if (queueInstance) return queueInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  // Producer connection: fail fast when Redis is down (workers should use maxRetriesPerRequest: null).
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: 1 });
  queueInstance = new Queue("risk-analysis", { connection });
  return queueInstance;
}

/**
 * Architecture: le backend enfile un job BullMQ → n8n (consumer) → Gemini → /internal/*.
 * Si REDIS_URL n’est pas configuré, on log le payload (stub mode).
 */
async function enqueueRiskAnalysisJob(project) {
  const payload = buildRiskPayload(project);
  const q = getQueue();
  if (!q) {
    console.info(
      "[risk-analysis-queue] Stub enqueue (set REDIS_URL to enable BullMQ):",
      JSON.stringify(payload)
    );
    return { ok: true, queued: false };
  }

  const job = await q.add("risk-analysis", payload, {
    attempts: 3,
    backoff: { type: "exponential", delay: 60_000 },
    removeOnComplete: 1000,
    removeOnFail: 1000,
  });

  return { ok: true, queued: true, jobId: job.id };
}

module.exports = { enqueueRiskAnalysisJob };
