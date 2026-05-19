const Project = require("../models/Project");
const Investment = require("../models/Investment");
const Transaction = require("../models/Transaction");
const FailedRefundEvent = require("../models/FailedRefundEvent");
const FailedPayoutEvent = require("../models/FailedPayoutEvent");
const FailedCancellationEvent = require("../models/FailedCancellationEvent");
const Payout = require("../models/Payout");
const Notification = require("../models/Notification");
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");
const mockProvider = require("../integrations/mockPaymentProvider");
const payoutService = require("./payoutService");
const { ProjectStatus, AIStatus, transitionProjectStatus } = require("../config/projectLifecycle");
const { enqueueRiskAnalysisJob } = require("../integrations/riskAnalysisQueue");

// Pourquoi: des services “cron-like” rendent les règles de cycle de vie fiables même si n8n est temporairement indisponible.
// n8n peut appeler ces endpoints plus tard via `/internal/*`, mais la logique vit ici (testable, réutilisable).

async function adminIds() {
  const admins = await User.find({ role: "ADMIN" }).select("_id").lean();
  return admins.map((a) => a._id);
}

async function expireProjects({ now = new Date(), limit = 50 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const expired = await Project.find({
    status: ProjectStatus.ACTIVE,
    isArchived: false,
    deadline: { $lt: now },
  })
    .sort({ deadline: 1 })
    .limit(safeLimit)
    .lean();

  const summary = {
    scanned: expired.length,
    closed: 0,
    skippedOverfunding: 0,
    failedPending: 0,
    refundAttempts: 0,
    refundSucceeded: 0,
    refundFailed: 0,
  };

  const admins = await adminIds();

  for (const p of expired) {
    const unresolvedOverfunding = await FailedRefundEvent.findOne({
      projectId: p._id,
      reason: "OVERFUNDING",
      resolved: false,
    }).lean();

    if (unresolvedOverfunding) {
      summary.skippedOverfunding += 1;
      continue;
    }

    // Clôture du projet (opération idempotente) avec respect des transitions du cycle de vie.
    const projectDoc = await Project.findById(p._id);
    if (projectDoc && projectDoc.status === ProjectStatus.ACTIVE) {
      transitionProjectStatus(projectDoc, ProjectStatus.CLOSED, { action: "EXPIRE_PROJECT" });
      await projectDoc.save();
      summary.closed += 1;
      await AuditLog.create({
        actorId: "000000000000000000000001",
        actorRole: "ADMIN",
        action: "EXPIRE_PROJECT",
        targetType: "Project",
        targetId: projectDoc._id,
        details: { deadline: projectDoc.deadline, currentFunding: projectDoc.currentFunding },
      });

      await Notification.create({
        userId: projectDoc.creatorId,
        type: "PROJECT_EXPIRED",
        title: `Projet expiré — ${String(projectDoc.title || "").trim() || "Campagne"}`,
        message:
          `La date limite est dépassée. Le projet “${String(projectDoc.title || "").trim() || "ce projet"}” est clôturé et les remboursements éventuels seront traités.`,
        relatedEntityId: projectDoc._id,
        relatedEntityType: "PROJECT",
      });
    }

    // Marquer en échec les investissements INITIATED encore en attente (paiement non confirmé).
    const pendings = await Investment.find({ projectId: p._id, status: "INITIATED" }).lean();
    for (const inv of pendings) {
      await Investment.updateOne({ _id: inv._id, status: "INITIATED" }, { $set: { status: "FAILED" } });
      await Transaction.updateMany(
        { investmentId: inv._id, status: "PENDING" },
        { $set: { status: "FAILED" } }
      );
      summary.failedPending += 1;

      await Notification.create({
        userId: inv.investorId,
        type: "PAYMENT_FAILED",
        title: "Paiement non confirmé",
        message:
          "Le projet a été clôturé avant confirmation du paiement. Vous pouvez soutenir d’autres projets actifs.",
        relatedEntityId: inv._id,
        relatedEntityType: "INVESTMENT",
      });
    }

    // Rembourser les investissements SUCCESS et PENDING_CONSULTATION (au mieux, créer FailedRefundEvent en cas d’échec).
    const successes = await Investment.find({ projectId: p._id, status: { $in: ["SUCCESS", "PENDING_CONSULTATION"] } }).lean();
    for (const inv of successes) {
      const tx = await Transaction.findOne({ investmentId: inv._id }).sort({ attemptNumber: -1 }).lean();
      if (!tx || tx.status !== "SUCCEEDED") continue;
      if (tx.refundStatus === "SUCCEEDED") continue;

      summary.refundAttempts += 1;
      await Transaction.updateOne(
        { _id: tx._id, refundStatus: { $ne: "SUCCEEDED" } },
        {
          $set: { refundStatus: "PENDING", lastRefundAttemptAt: new Date() },
          $inc: { refundAttempts: 1 },
        }
      );

      const resp = mockProvider.refundPayment({
        provider: tx.provider,
        providerPaymentId: tx.providerPaymentId,
        amount: tx.amount,
        reason: "EXPIRY",
      });

      if (resp && resp.ok) {
        await Transaction.updateOne(
          { _id: tx._id },
          {
            $set: {
              status: "REFUNDED",
              refundStatus: "SUCCEEDED",
              refundedAt: new Date(),
            },
          }
        );
        await Investment.updateOne({ _id: inv._id }, { $set: { status: "REFUNDED" } });
        summary.refundSucceeded += 1;

        await Notification.create({
          userId: inv.investorId,
          type: "PAYMENT_REFUNDED",
          title: "Remboursement effectué",
          message: "Le projet a été clôturé. Votre paiement a été remboursé.",
          relatedEntityId: inv._id,
          relatedEntityType: "INVESTMENT",
        });
      } else {
        await Transaction.updateOne({ _id: tx._id }, { $set: { refundStatus: "FAILED" } });
        summary.refundFailed += 1;
        await FailedRefundEvent.create({
          investmentId: inv._id,
          projectId: p._id,
          error: "Échec remboursement côté provider",
          retryCount: 0,
          reason: "EXPIRY",
          resolved: false,
        });
      }
    }

    // Alerter les admins si des remboursements ont échoué.
    const failed = await FailedRefundEvent.findOne({ projectId: p._id, resolved: false }).lean();
    if (failed && admins.length) {
      await Notification.insertMany(
        admins.map((adminId) => ({
          userId: adminId,
          type: "REFUND_FAILED",
          title: "Remboursement à vérifier",
          message:
            "Un projet clôturé a un remboursement en échec. Intervention admin requise.",
          relatedEntityId: p._id,
          relatedEntityType: "PROJECT",
        }))
      );
    }
  }

  return summary;
}

async function closeFundedProjects({ now = new Date(), limit = 50 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const funded = await Project.find({
    status: ProjectStatus.FUNDED,
    isArchived: false,
  })
    .sort({ fundedAt: 1 })
    .limit(safeLimit)
    .lean();

  const summary = {
    scanned: funded.length,
    closed: 0,
    payoutsCreated: 0,
    skippedOverfunding: 0,
    skippedGrace: 0,
  };

  for (const p of funded) {
    const unresolvedOverfunding = await FailedRefundEvent.findOne({
      projectId: p._id,
      reason: "OVERFUNDING",
      resolved: false,
    }).lean();

    if (unresolvedOverfunding) {
      summary.skippedOverfunding += 1;
      continue;
    }

    // Alignement conception: clôturer uniquement quand TOUS les investissements SUCCESS sont hors
    // période de grâce d’annulation (par investissement `cancellationGracePeriodMinutes`).
    const successInvestments = await Investment.find({
      projectId: p._id,
      status: "SUCCESS",
    })
      .select("_id cancellationGracePeriodMinutes")
      .lean();

    let canClose = true;
    for (const inv of successInvestments) {
      const tx = await Transaction.findOne({ investmentId: inv._id })
        .sort({ attemptNumber: -1 })
        .select("createdAt updatedAt succeededAt refundStatus status")
        .lean();

      if (!tx) continue;
      // Si le paiement SUCCESS a un échec de remboursement, on ne doit pas clôturer.
      if (tx.refundStatus === "FAILED") {
        canClose = false;
        break;
      }
      // Si la transaction n’est pas SUCCEEDED, la logique de grâce n’est pas satisfaite.
      if (tx.status !== "SUCCEEDED") {
        canClose = false;
        break;
      }

      const graceMin = Math.max(Number(inv.cancellationGracePeriodMinutes || 0), 1);
      const confirmedAt = tx.succeededAt || tx.updatedAt || tx.createdAt;
      const graceUntil = new Date(new Date(confirmedAt).getTime() + graceMin * 60 * 1000);
      if (now < graceUntil) {
        canClose = false;
        break;
      }
    }

    if (!canClose) {
      summary.skippedGrace += 1;
      continue;
    }

    const projectDoc = await Project.findById(p._id);
    if (!projectDoc || projectDoc.status !== ProjectStatus.FUNDED) continue;
    transitionProjectStatus(projectDoc, ProjectStatus.CLOSED, { action: "CLOSE_FUNDED_PROJECT" });
    await projectDoc.save();
    summary.closed += 1;

    await AuditLog.create({
      actorId: "000000000000000000000001",
      actorRole: "ADMIN",
      action: "CLOSE_FUNDED_PROJECT",
      targetType: "Project",
      targetId: projectDoc._id,
      details: { fundedAt: projectDoc.fundedAt, rule: "per-investment-grace" },
    });

    try {
      const payoutRes = await payoutService.ensurePayoutForFundedProject(p._id);
      if (payoutRes?.created) summary.payoutsCreated += 1;
    } catch {
      // La création de payout ne doit pas casser le cron de clôture.
    }
  }

  return summary;
}

async function retryFailedRefunds({ limit = 30 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 200);
  const events = await FailedRefundEvent.find({ resolved: false })
    .sort({ createdAt: 1 })
    .limit(safeLimit)
    .lean();

  const summary = { scanned: events.length, succeeded: 0, failed: 0 };
  for (const ev of events) {
    const tx = await Transaction.findOne({ investmentId: ev.investmentId }).sort({ attemptNumber: -1 });
    const inv = await Investment.findById(ev.investmentId);
    if (!tx || !inv) {
      await FailedRefundEvent.updateOne(
        { _id: ev._id },
        { $set: { resolved: true, resolvedAt: new Date() } }
      );
      continue;
    }

    const resp = mockProvider.refundPayment({
      provider: tx.provider,
      providerPaymentId: tx.providerPaymentId,
      amount: tx.amount,
      reason: ev.reason,
    });

    if (resp && resp.ok) {
      tx.status = "REFUNDED";
      tx.refundStatus = "SUCCEEDED";
      tx.refundedAt = new Date();
      await tx.save();
      inv.status = "REFUNDED";
      await inv.save();
      await FailedRefundEvent.updateOne(
        { _id: ev._id },
        { $set: { resolved: true, resolvedAt: new Date() } }
      );
      summary.succeeded += 1;
    } else {
      await FailedRefundEvent.updateOne(
        { _id: ev._id },
        { $inc: { retryCount: 1 }, $set: { error: "Échec remboursement côté provider" } }
      );
      summary.failed += 1;
    }
  }
  return summary;
}

async function retryFailedPayouts({ limit = 30 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 200);
  const events = await FailedPayoutEvent.find({ resolved: false })
    .sort({ createdAt: 1 })
    .limit(safeLimit)
    .lean();

  const summary = { scanned: events.length, movedToReady: 0, retried: 0 };
  for (const ev of events) {
    const payout = await Payout.findById(ev.payoutId);
    if (!payout) {
      await FailedPayoutEvent.updateOne(
        { _id: ev._id },
        { $set: { resolved: true, resolvedAt: new Date() } }
      );
      continue;
    }
    if (payout.status === "FAILED") {
      payout.status = "READY";
      payout.failureReason = "";
      await payout.save();
      summary.movedToReady += 1;
    }
    // Alignement conception: la relance incrémente retryCount et marque l’événement comme “pris en charge”.
    await FailedPayoutEvent.updateOne(
      { _id: ev._id },
      { $inc: { retryCount: 1 }, $set: { resolved: true, resolvedAt: new Date() } }
    );
    summary.retried += 1;
  }
  return summary;
}

async function cleanupStuckStates({ now = new Date(), limit = 200 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 1000);
  const cutoffMinutes = Number(process.env.STUCK_CANCELLING_MINUTES || 30);
  const cutoff = new Date(now.getTime() - Math.max(cutoffMinutes, 5) * 60 * 1000);

  const admins = await adminIds();
  const stuck = await Investment.find({
    status: "CANCELLING",
    cancellingStartedAt: { $lte: cutoff },
  })
    .sort({ cancellingStartedAt: 1 })
    .limit(safeLimit)
    .lean();

  const summary = { scanned: stuck.length, flagged: 0 };
  for (const inv of stuck) {
    const ev = await FailedCancellationEvent.create({
      investmentId: inv._id,
      error: "Investment stuck in CANCELLING state",
      retryCount: 0,
      reason: "STUCK_CANCELLING",
      resolved: false,
    }).catch(() => null);
    if (!ev) continue;

    summary.flagged += 1;

    await Investment.updateOne(
      { _id: inv._id, status: "CANCELLING" },
      { $set: { status: "FAILED" } }
    );

    if (admins.length) {
      await Notification.insertMany(
        admins.map((adminId) => ({
          userId: adminId,
          type: "CANCELLATION_FAILED",
          title: "Annulation bloquée",
          message:
            "Une annulation d’investissement est restée bloquée. Vérifiez l’opération et relancez si nécessaire.",
          relatedEntityId: inv._id,
          relatedEntityType: "INVESTMENT",
        }))
      ).catch(() => {});
    }
  }

  return summary;
}

/**
 * Relancer l’analyse IA pour les projets bloqués en AWAITING_AI.
 *
 * Pourquoi:
 * - Les jobs BullMQ ont un nombre d’essais limité et peuvent échouer pendant une panne/quota Gemini.
 * - Sans “rescan” périodique, un projet peut rester AWAITING_AI indéfiniment.
 *
 * Stratégie:
 * - Cibler AWAITING_AI avec aiStatus=PENDING/FAILED et aiQueuedAt plus ancien que le cutoff.
 * - Ne relancer que si aiNextRetryAt est atteinte (backoff) pour éviter le spam quota.
 * - Ré-enfiler le job risk-analysis (au mieux) et rafraîchir aiQueuedAt/aiJobId.
 * - Garder une limite conservatrice pour éviter les bursts.
 */
async function retryStuckAiAnalyses({
  now = new Date(),
  olderThanMinutes = 20,
  limit = 30,
} = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 200);
  // Autoriser 0 pour les déclenchements manuels/debug (ré-enfiler immédiatement).
  const mins = Math.max(Number(olderThanMinutes) || 20, 0);
  const cutoff = new Date(now.getTime() - mins * 60 * 1000);

  const stuck = await Project.find({
    status: ProjectStatus.AWAITING_AI,
    aiStatus: { $in: [AIStatus.PENDING, AIStatus.FAILED] },
    aiQueuedAt: { $lte: cutoff },
    $or: [{ aiNextRetryAt: null }, { aiNextRetryAt: { $lte: now } }],
  })
    .sort({ aiQueuedAt: 1 })
    .limit(safeLimit);

  const summary = { scanned: stuck.length, requeued: 0, movedToPending: 0, skipped: 0 };

  for (const project of stuck) {
    try {
      if (project.aiStatus !== AIStatus.PENDING) {
        project.aiStatus = AIStatus.PENDING;
        summary.movedToPending += 1;
      }
      project.aiQueuedAt = new Date();
      project.aiJobId = "";
      project.aiLastError = "";
      project.aiNextRetryAt = null;
      await project.save();

      const enq = await enqueueRiskAnalysisJob(project);
      if (enq && enq.queued && enq.jobId) {
        project.aiJobId = String(enq.jobId);
        await project.save();
      }
      summary.requeued += 1;
    } catch {
      summary.skipped += 1;
    }
  }

  return summary;
}

module.exports = {
  expireProjects,
  closeFundedProjects,
  retryFailedRefunds,
  retryFailedPayouts,
  cleanupStuckStates,
  retryStuckAiAnalyses,
};

