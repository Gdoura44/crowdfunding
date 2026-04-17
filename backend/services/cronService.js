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
const { ProjectStatus } = require("../config/projectLifecycle");

// WHY: Cron-like services make lifecycle rules reliable even if n8n is down temporarily.
// n8n can call these endpoints later via `/internal/*`, but the logic lives here (testable, reusable).

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

    // Close project (idempotent).
    const closed = await Project.updateOne(
      { _id: p._id, status: ProjectStatus.ACTIVE },
      { $set: { status: ProjectStatus.CLOSED } }
    );
    if (closed.modifiedCount > 0) {
      summary.closed += 1;
      await AuditLog.create({
        actorId: "000000000000000000000001",
        actorRole: "ADMIN",
        action: "EXPIRE_PROJECT",
        targetType: "Project",
        targetId: p._id,
        details: { deadline: p.deadline, currentFunding: p.currentFunding },
      });

      await Notification.create({
        userId: p.creatorId,
        type: "PROJECT_EXPIRED",
        title: "Projet expiré",
        message:
          "La date limite est dépassée. Le projet est clôturé et les remboursements éventuels seront traités.",
        relatedEntityId: p._id,
        relatedEntityType: "PROJECT",
      });
    }

    // Fail pending initiated investments.
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

    // Refund successful investments (best-effort, create FailedRefundEvent on failure).
    const successes = await Investment.find({ projectId: p._id, status: "SUCCESS" }).lean();
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
          message: "Le projet a été clôturé. Votre paiement a été remboursé (mode démo).",
          relatedEntityId: inv._id,
          relatedEntityType: "INVESTMENT",
        });
      } else {
        await Transaction.updateOne({ _id: tx._id }, { $set: { refundStatus: "FAILED" } });
        summary.refundFailed += 1;
        await FailedRefundEvent.create({
          investmentId: inv._id,
          projectId: p._id,
          error: "Provider refund failed",
          retryCount: 0,
          reason: "EXPIRY",
          resolved: false,
        });
      }
    }

    // Alert admins if there are failed refunds.
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

    // Conception alignment: close only when ALL successful investments are outside their
    // cancellation grace period (per-investment `cancellationGracePeriodMinutes`).
    const successInvestments = await Investment.find({
      projectId: p._id,
      status: "SUCCESS",
    })
      .select("_id cancellationGracePeriodMinutes")
      .lean();

    let canClose = true;
    for (const inv of successInvestments) {
      // eslint-disable-next-line no-await-in-loop
      const tx = await Transaction.findOne({ investmentId: inv._id })
        .sort({ attemptNumber: -1 })
        .select("createdAt refundStatus status")
        .lean();

      if (!tx) continue;
      // If the success payment has a refund failure, closing should not proceed.
      if (tx.refundStatus === "FAILED") {
        canClose = false;
        break;
      }
      // If transaction isn't succeeded, grace logic isn't satisfied.
      if (tx.status !== "SUCCEEDED") {
        canClose = false;
        break;
      }

      const graceMin = Math.max(Number(inv.cancellationGracePeriodMinutes || 0), 1);
      const graceUntil = new Date(new Date(tx.createdAt).getTime() + graceMin * 60 * 1000);
      if (now < graceUntil) {
        canClose = false;
        break;
      }
    }

    if (!canClose) {
      summary.skippedGrace += 1;
      continue;
    }

    const res = await Project.updateOne(
      { _id: p._id, status: ProjectStatus.FUNDED },
      { $set: { status: ProjectStatus.CLOSED } }
    );
    if (res.modifiedCount === 0) continue;
    summary.closed += 1;

    await AuditLog.create({
      actorId: "000000000000000000000001",
      actorRole: "ADMIN",
      action: "CLOSE_FUNDED_PROJECT",
      targetType: "Project",
      targetId: p._id,
      details: { fundedAt: p.fundedAt, rule: "per-investment-grace" },
    });

    try {
      const payoutRes = await payoutService.ensurePayoutForFundedProject(p._id);
      if (payoutRes?.created) summary.payoutsCreated += 1;
    } catch {
      // payout creation must not break closure cron
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
        { $inc: { retryCount: 1 }, $set: { error: "Provider refund failed" } }
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
    // Conception: each retry increments retryCount; event remains unresolved until success/cancel.
    await FailedPayoutEvent.updateOne({ _id: ev._id }, { $inc: { retryCount: 1 } });
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
    // eslint-disable-next-line no-await-in-loop
    const ev = await FailedCancellationEvent.create({
      investmentId: inv._id,
      error: "Investment stuck in CANCELLING state",
      retryCount: 0,
      reason: "STUCK_CANCELLING",
      resolved: false,
    }).catch(() => null);
    if (!ev) continue;

    summary.flagged += 1;

    // eslint-disable-next-line no-await-in-loop
    await Investment.updateOne(
      { _id: inv._id, status: "CANCELLING" },
      { $set: { status: "FAILED" } }
    );

    if (admins.length) {
      // eslint-disable-next-line no-await-in-loop
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

module.exports = {
  expireProjects,
  closeFundedProjects,
  retryFailedRefunds,
  retryFailedPayouts,
  cleanupStuckStates,
};

