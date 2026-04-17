const mongoose = require("mongoose");
const Project = require("../models/Project");
const Investment = require("../models/Investment");
const Transaction = require("../models/Transaction");
const Notification = require("../models/Notification");
const AuditLog = require("../models/AuditLog");
const HttpError = require("../utils/HttpError");
const mockProvider = require("../integrations/mockPaymentProvider");
const { enqueueEmailForNotifications } = require("../integrations/emailQueue");
const FailedCancellationEvent = require("../models/FailedCancellationEvent");
const FailedRefundEvent = require("../models/FailedRefundEvent");
const { ProjectStatus, transitionProjectStatus } = require("../config/projectLifecycle");

function nowStartOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function requirePositiveAmount(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) throw new HttpError(400, "Amount must be positive");
  return Math.round(n * 100) / 100;
}

async function createInvestment({ investorId, projectId, amount }) {
  if (!mongoose.isValidObjectId(projectId)) {
    throw new HttpError(400, "Invalid project id");
  }

  const amt = requirePositiveAmount(amount);

  const project = await Project.findById(projectId).lean();
  if (!project) throw new HttpError(404, "Project not found");

  const today = nowStartOfDay(new Date());
  const startAt = project.startAt ? nowStartOfDay(project.startAt) : null;
  const deadline = project.deadline ? nowStartOfDay(project.deadline) : null;

  const isInvestable =
    project.status === ProjectStatus.ACTIVE &&
    !project.isArchived &&
    (!startAt || startAt <= today) &&
    (!deadline || deadline >= today) &&
    Number(project.currentFunding || 0) < Number(project.fundingGoal || 0);

  if (!isInvestable) {
    throw new HttpError(400, "Project not available for investment");
  }

  if (String(project.creatorId) === String(investorId)) {
    throw new HttpError(400, "You cannot invest in your own project");
  }

  // Conception: generate idempotency key BEFORE any provider call.
  const investmentId = new mongoose.Types.ObjectId();

  const providerResp = mockProvider.createPaymentLink({
    amount: amt,
    currency: "TND",
    referenceId: String(investmentId),
  });

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const investment = await Investment.create(
      [
        {
          _id: investmentId,
          investorId,
          projectId,
          amount: amt,
          status: "INITIATED",
          paymentAttempts: 1,
        },
      ],
      { session }
    );

    await Transaction.create(
      [
        {
          investmentId,
          provider: providerResp.provider,
          providerPaymentId: providerResp.providerPaymentId,
          amount: amt,
          status: "PENDING",
          attemptNumber: 1,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    return {
      investment: investment[0].toObject(),
      paymentUrl: providerResp.paymentUrl,
      providerPaymentId: providerResp.providerPaymentId,
    };
  } catch (err) {
    try {
      await session.abortTransaction();
    } catch {
      // ignore
    }
    throw err;
  } finally {
    session.endSession();
  }
}

function verifyMockSignature(req) {
  const signature = req.get("x-mock-signature") || "";
  const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
  const expected = mockProvider.signPayload(raw);
  if (!signature || signature !== expected) {
    throw new HttpError(401, "Invalid webhook signature");
  }
}

async function handleMockWebhookPayload(payload) {
  const { providerPaymentId, status, paymentMethod } = payload || {};
  if (!providerPaymentId) throw new HttpError(400, "providerPaymentId is required");
  const normalized = String(status || "").toUpperCase();
  if (!["SUCCEEDED", "FAILED"].includes(normalized)) {
    throw new HttpError(400, "status must be SUCCEEDED or FAILED");
  }

  const tx = await Transaction.findOne({ providerPaymentId });
  if (!tx) throw new HttpError(404, "Transaction not found");
  if (tx.status !== "PENDING") {
    return { ok: true, idempotent: true };
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const investment = await Investment.findById(tx.investmentId).session(session);
    if (!investment) throw new HttpError(404, "Investment not found");

    const project = await Project.findById(investment.projectId).session(session);
    if (!project) throw new HttpError(404, "Project not found");

    if (normalized === "FAILED") {
      tx.status = "FAILED";
      tx.paymentMethod = paymentMethod || tx.paymentMethod;
      await tx.save({ session });

      investment.status = "FAILED";
      await investment.save({ session });

      const notifs = await Notification.create(
        [
          {
            userId: investment.investorId,
            type: "PAYMENT_FAILED",
            title: "Paiement échoué",
            message:
              "Votre paiement n’a pas été confirmé. Vous pouvez réessayer en relançant un investissement.",
            relatedEntityId: investment._id,
            relatedEntityType: "INVESTMENT",
          },
        ],
        { session }
      );

      await session.commitTransaction();
      await enqueueEmailForNotifications(notifs);
      return { ok: true, idempotent: false };
    }

    // SUCCEEDED path — atomic overfunding detection.
    const updateResult = await Project.updateOne(
      {
        _id: project._id,
        status: ProjectStatus.ACTIVE,
        isArchived: false,
        $expr: { $lte: [{ $add: ["$currentFunding", investment.amount] }, "$fundingGoal"] },
      },
      { $inc: { currentFunding: investment.amount } },
      { session }
    );

    if (updateResult.modifiedCount === 0) {
      // Overfunding detected: refund and do not increment.
      // Demo provider call: keep structure close to real integrations.
      const refundResp = mockProvider.refundPayment({
        provider: tx.provider,
        providerPaymentId: tx.providerPaymentId,
        amount: tx.amount,
        reason: "OVERFUNDING",
      });

      const refunded = Boolean(refundResp && refundResp.ok);
      tx.status = refunded ? "REFUNDED" : "SUCCEEDED";
      tx.refundStatus = refunded ? "SUCCEEDED" : "FAILED";
      tx.refundedAt = refunded ? new Date() : undefined;
      tx.paymentMethod = paymentMethod || tx.paymentMethod;
      await tx.save({ session });

      investment.status = refunded ? "REFUNDED" : "SUCCESS";
      await investment.save({ session });

      await AuditLog.create(
        [
          {
            actorId: investment.investorId,
            actorRole: "USER",
            action: "REFUND_INVESTMENT",
            targetType: "Investment",
            targetId: investment._id,
            details: { amount: investment.amount, projectId: project._id, reason: "OVERFUNDING" },
          },
        ],
        { session }
      );

      if (!refunded) {
        await FailedRefundEvent.create(
          [
            {
              investmentId: investment._id,
              projectId: project._id,
              error: "Provider refund failed",
              retryCount: 0,
              reason: "OVERFUNDING",
              resolved: false,
            },
          ],
          { session }
        );
      }

      const notifs = await Notification.create(
        [
          {
            userId: investment.investorId,
            type: refunded ? "OVERFUND_REFUNDED" : "REFUND_FAILED",
            title: refunded ? "Paiement remboursé" : "Remboursement en attente",
            message: refunded
              ? "Le projet a atteint son objectif au même moment. Votre paiement est donc remboursé automatiquement."
              : "Le projet a atteint son objectif au même moment. Votre remboursement est en cours de traitement ; si besoin un administrateur interviendra.",
            relatedEntityId: project._id,
            relatedEntityType: "PROJECT",
          },
        ],
        { session }
      );

      await session.commitTransaction();
      await enqueueEmailForNotifications(notifs);
      return { ok: true, idempotent: false, refunded: true };
    }

    // Normal success.
    tx.status = "SUCCEEDED";
    tx.paymentMethod = paymentMethod || tx.paymentMethod;
    await tx.save({ session });

    investment.status = "SUCCESS";
    await investment.save({ session });

    await AuditLog.create(
      [
        {
          actorId: investment.investorId,
          actorRole: "USER",
          action: "CREATE_INVESTMENT",
          targetType: "Investment",
          targetId: investment._id,
          details: { amount: investment.amount, projectId: project._id, status: "SUCCESS" },
        },
      ],
      { session }
    );

    const notifs = await Notification.create(
      [
        {
          userId: investment.investorId,
          type: "PAYMENT_SUCCESS",
          title: "Paiement confirmé",
          message: "Merci ! Votre investissement a bien été enregistré.",
          relatedEntityId: investment._id,
          relatedEntityType: "INVESTMENT",
        },
        {
          userId: project.creatorId,
          type: "NEW_INVESTMENT",
          title: "Nouveau soutien",
          message: "Vous avez reçu un nouvel investissement sur votre projet.",
          relatedEntityId: project._id,
          relatedEntityType: "PROJECT",
        },
      ],
      { session }
    );

    const updated = await Project.findById(project._id).session(session);
    if (updated && Number(updated.currentFunding) >= Number(updated.fundingGoal)) {
      transitionProjectStatus(updated, ProjectStatus.FUNDED, { action: "FUNDING_GOAL_REACHED" });
      updated.fundedAt = new Date();
      await updated.save({ session });

      await Notification.create(
        [
          {
            userId: updated.creatorId,
            type: "PROJECT_FUNDED",
            title: "Objectif atteint",
            message:
              "Félicitations ! Votre projet a atteint son objectif de financement.",
            relatedEntityId: updated._id,
            relatedEntityType: "PROJECT",
          },
        ],
        { session }
      );
    }

    await session.commitTransaction();
    await enqueueEmailForNotifications(notifs);
    return { ok: true, idempotent: false, refunded: false };
  } catch (err) {
    try {
      await session.abortTransaction();
    } catch {
      // ignore
    }
    throw err;
  } finally {
    session.endSession();
  }
}

async function handleMockWebhook(req) {
  verifyMockSignature(req);
  return handleMockWebhookPayload(req.body || {});
}

async function confirmMockPaymentFromClient(payload) {
  if (process.env.NODE_ENV === "production") {
    throw new HttpError(404, "Not found");
  }
  return handleMockWebhookPayload(payload || {});
}

async function cancelInvestment({ investorId, investmentId }) {
  if (!mongoose.isValidObjectId(investmentId)) {
    throw new HttpError(400, "Invalid investment id");
  }

  const investment = await Investment.findOne({ _id: investmentId, investorId });
  if (!investment) throw new HttpError(404, "Investment not found");

  const tx = await Transaction.findOne({ investmentId: investment._id }).sort({ attemptNumber: -1 });
  if (!tx) throw new HttpError(400, "Transaction not found for investment");

  const eligibleInitiated = investment.status === "INITIATED" && tx.status === "PENDING";
  const eligibleSuccess =
    investment.status === "SUCCESS" &&
    tx.status === "SUCCEEDED" &&
    Date.now() <
      new Date(tx.createdAt).getTime() + investment.cancellationGracePeriodMinutes * 60 * 1000;

  if (!eligibleInitiated && !eligibleSuccess) {
    throw new HttpError(
      400,
      "Cannot cancel: payment already processed or cancellation window expired"
    );
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    investment.status = "CANCELLING";
    await investment.save({ session });
    await session.commitTransaction();
  } finally {
    session.endSession();
  }

  const providerResp = mockProvider.cancelPayment();
  if (!providerResp.ok) {
    await FailedCancellationEvent.create({
      investmentId: investment._id,
      error: "Provider cancellation failed",
      retryCount: 0,
      reason: "CANCELLATION_FAILED",
      resolved: false,
    });
    throw new HttpError(500, "Cancellation failed, contact support");
  }

  const session2 = await mongoose.startSession();
  try {
    session2.startTransaction();

    const freshInvestment = await Investment.findById(investment._id).session(session2);
    const freshTx = await Transaction.findById(tx._id).session(session2);
    if (!freshInvestment || !freshTx) throw new HttpError(404, "Investment not found");

    const project = await Project.findById(freshInvestment.projectId).session(session2);
    if (!project) throw new HttpError(404, "Project not found");

    // If payment already succeeded, cancellation acts like a refund (and must update funding totals).
    const wasSucceeded = freshInvestment.status === "SUCCESS" && freshTx.status === "SUCCEEDED";
    if (wasSucceeded) {
      const refundResp = mockProvider.refundPayment({
        provider: freshTx.provider,
        providerPaymentId: freshTx.providerPaymentId,
        amount: freshTx.amount,
        reason: "USER_REQUESTED",
      });
      const refunded = Boolean(refundResp && refundResp.ok);
      if (!refunded) {
        await FailedRefundEvent.create(
          [
            {
              investmentId: freshInvestment._id,
              projectId: project._id,
              error: "Provider refund failed",
              retryCount: 0,
              reason: "USER_DEACTIVATED",
              resolved: false,
            },
          ],
          { session: session2 }
        );
        throw new HttpError(500, "Refund failed, contact support");
      }

      // Decrement funding safely (never below zero).
      const nextFunding = Math.max(0, Number(project.currentFunding || 0) - Number(freshInvestment.amount || 0));
      project.currentFunding = nextFunding;
      // Rollback FUNDED if the goal is no longer reached.
      const wasFunded = project.status === ProjectStatus.FUNDED;
      if (wasFunded && nextFunding < Number(project.fundingGoal || 0)) {
        transitionProjectStatus(project, ProjectStatus.ACTIVE, { action: "FUNDING_GOAL_LOST" });
      }
      await project.save({ session: session2 });

      freshInvestment.status = "REFUNDED";
      freshInvestment.cancelReason = "USER_REQUESTED";
      freshInvestment.cancelledAt = new Date();
      await freshInvestment.save({ session: session2 });

      freshTx.status = "REFUNDED";
      freshTx.refundStatus = "SUCCEEDED";
      freshTx.refundedAt = new Date();
      freshTx.cancelledAt = new Date();
      await freshTx.save({ session: session2 });

      await Notification.create(
        [
          {
            userId: investorId,
            type: "PAYMENT_REFUNDED",
            title: "Paiement remboursé",
            message: "Votre investissement a été annulé et remboursé (mode démo).",
            relatedEntityId: freshInvestment._id,
            relatedEntityType: "INVESTMENT",
          },
          ...(wasFunded && project.status === "ACTIVE"
            ? [
                {
                  userId: project.creatorId,
                  type: "PROJECT_FUNDING_GOAL_LOST",
                  title: "Objectif non atteint",
                  message:
                    "Suite à une annulation/remboursement, le projet n’atteint plus l’objectif. Il reste actif et peut recevoir d’autres investissements.",
                  relatedEntityId: project._id,
                  relatedEntityType: "PROJECT",
                },
              ]
            : []),
        ],
        { session: session2 }
      );
    } else {
      // INITIATED cancellation: no funding impact.
      freshInvestment.status = "CANCELLED";
      freshInvestment.cancelReason = "USER_REQUESTED";
      freshInvestment.cancelledAt = new Date();
      await freshInvestment.save({ session: session2 });

      freshTx.status = "CANCELLED";
      freshTx.cancelledAt = new Date();
      await freshTx.save({ session: session2 });

      await Notification.create(
        [
          {
            userId: investorId,
            type: "PAYMENT_CANCELLED",
            title: "Paiement annulé",
            message: "Votre investissement a été annulé.",
            relatedEntityId: freshInvestment._id,
            relatedEntityType: "INVESTMENT",
          },
        ],
        { session: session2 }
      );
    }

    await AuditLog.create(
      [
        {
          actorId: investorId,
          actorRole: "USER",
          action: "CANCEL_INVESTMENT",
          targetType: "Investment",
          targetId: freshInvestment._id,
          details: {},
        },
      ],
      { session: session2 }
    );

    await session2.commitTransaction();
    return freshInvestment.toObject();
  } catch (err) {
    try {
      await session2.abortTransaction();
    } catch {
      // ignore
    }
    throw err;
  } finally {
    session2.endSession();
  }
}

async function listMyInvestments(investorId, { limit = 30 } = {}) {
  const n = Number(limit);
  const safeLimit = Number.isFinite(n) ? Math.min(Math.max(n, 1), 50) : 30;
  const list = await Investment.find({ investorId })
    .sort({ createdAt: -1 })
    .limit(safeLimit)
    .lean();
  const ids = list.map((i) => i._id);
  const txs = await Transaction.find({ investmentId: { $in: ids } }).lean();
  const txByInvestment = new Map();
  for (const tx of txs) {
    const key = String(tx.investmentId);
    const existing = txByInvestment.get(key);
    if (!existing || Number(tx.attemptNumber || 1) > Number(existing.attemptNumber || 1)) {
      txByInvestment.set(key, tx);
    }
  }
  const projectIds = [...new Set(list.map((i) => String(i.projectId)))];
  const projects = await Project.find({ _id: { $in: projectIds } })
    .select("title category status fundingGoal currentFunding")
    .lean();
  const projectById = new Map(projects.map((p) => [String(p._id), p]));
  return list.map((inv) => ({
    ...inv,
    project: projectById.get(String(inv.projectId)) || null,
    transaction: txByInvestment.get(String(inv._id)) || null,
  }));
}

async function retryInvestmentPayment({ investorId, investmentId }) {
  if (!mongoose.isValidObjectId(investmentId)) {
    throw new HttpError(400, "Invalid investment id");
  }

  const investment = await Investment.findOne({ _id: investmentId, investorId });
  if (!investment) throw new HttpError(404, "Investment not found");
  if (investment.status !== "FAILED") {
    throw new HttpError(400, "Only failed investments can be retried");
  }

  const project = await Project.findById(investment.projectId).lean();
  if (!project) throw new HttpError(404, "Project not found");

  const today = nowStartOfDay(new Date());
  const startAt = project.startAt ? nowStartOfDay(project.startAt) : null;
  const deadline = project.deadline ? nowStartOfDay(project.deadline) : null;
  const isInvestable =
    project.status === "ACTIVE" &&
    !project.isArchived &&
    (!startAt || startAt <= today) &&
    (!deadline || deadline >= today) &&
    Number(project.currentFunding || 0) < Number(project.fundingGoal || 0);
  if (!isInvestable) throw new HttpError(400, "Project not available for investment");

  const lastTx = await Transaction.findOne({ investmentId: investment._id }).sort({ attemptNumber: -1 }).lean();
  const nextAttempt = (lastTx?.attemptNumber || 1) + 1;

  const providerResp = mockProvider.createPaymentLink({
    amount: investment.amount,
    currency: "TND",
    referenceId: String(investment._id),
  });

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    investment.status = "INITIATED";
    investment.paymentAttempts = Number(investment.paymentAttempts || 0) + 1;
    await investment.save({ session });

    await Transaction.create(
      [
        {
          investmentId: investment._id,
          provider: providerResp.provider,
          providerPaymentId: providerResp.providerPaymentId,
          amount: investment.amount,
          status: "PENDING",
          attemptNumber: nextAttempt,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    return {
      investment: investment.toObject(),
      paymentUrl: providerResp.paymentUrl,
      providerPaymentId: providerResp.providerPaymentId,
    };
  } catch (err) {
    try {
      await session.abortTransaction();
    } catch {
      // ignore
    }
    throw err;
  } finally {
    session.endSession();
  }
}

module.exports = {
  createInvestment,
  handleMockWebhook,
  confirmMockPaymentFromClient,
  cancelInvestment,
  listMyInvestments,
  retryInvestmentPayment,
};

