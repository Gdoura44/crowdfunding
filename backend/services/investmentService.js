const mongoose = require("mongoose");
const crypto = require("crypto");
const Project = require("../models/Project");
const Investment = require("../models/Investment");
const Transaction = require("../models/Transaction");
const Notification = require("../models/Notification");
const ExpertConsultation = require("../models/ExpertConsultation");
const AuditLog = require("../models/AuditLog");
const HttpError = require("../utils/HttpError");
const mockProvider = require("../integrations/mockPaymentProvider");
const User = require("../models/User");
const { sendMailDetailed } = require("../utils/email");
const { enqueueEmailForNotifications } = require("../integrations/emailQueue");
const FailedCancellationEvent = require("../models/FailedCancellationEvent");
const FailedRefundEvent = require("../models/FailedRefundEvent");
const { ProjectStatus, transitionProjectStatus } = require("../config/projectLifecycle");
const { withOptionalTransaction } = require("../utils/withOptionalTransaction");
const invoiceService = require("./invoiceService");
const Invoice = require("../models/Invoice");


function nowStartOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function requirePositiveAmount(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n < 100) {
    throw new HttpError(400, "Le montant minimum est 100 TND.");
  }
  return Math.round(n * 100) / 100;
}

/** Instant de confirmation du paiement (pour délai d’annulation), pas la création du lien. */
function paymentConfirmedAt(tx) {
  if (!tx || String(tx.status) !== "SUCCEEDED") return null;
  if (tx.succeededAt) return new Date(tx.succeededAt);
  if (tx.updatedAt) return new Date(tx.updatedAt);
  if (tx.createdAt) return new Date(tx.createdAt);
  return null;
}

async function createInvestment({ investorId, projectId, amount, wantsConsultation, tipAmount }) {
  if (!mongoose.isValidObjectId(projectId)) {
    throw new HttpError(400, "Identifiant de projet invalide.");
  }

  const amt = requirePositiveAmount(amount);
  const tip = tipAmount != null ? Math.round(Number(tipAmount) * 100) / 100 : 0;
  const totalCharged = Math.round((amt + tip) * 100) / 100;

  const project = await Project.findById(projectId).lean();
  if (!project) throw new HttpError(404, "Projet introuvable.");

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
    throw new HttpError(400, "Projet non disponible pour investissement.");
  }

  if (String(project.creatorId) === String(investorId)) {
    throw new HttpError(400, "Vous ne pouvez pas investir dans votre propre projet.");
  }

  if (wantsConsultation) {
    const threshold = Number(project.fundingGoal) * 0.30;
    if (Number(amt) < threshold) {
      throw new HttpError(400, `La consultation expert est réservée aux investissements d'au moins 30% (${threshold} TND).`);
    }
  }

  // générer la clé d’idempotence AVANT tout appel au provider.
  const investmentId = new mongoose.Types.ObjectId();

  const providerResp = mockProvider.createPaymentLink({
    amount: totalCharged,
    currency: "TND",
    referenceId: String(investmentId),
  });

  return await withOptionalTransaction(async (session) => {
    const investment = await Investment.create(
      [
        {
          _id: investmentId,
          investorId,
          projectId,
          amount: amt,
          tipAmount: tip,
          status: "INITIATED",
          paymentAttempts: 1,
          wantsConsultation: !!wantsConsultation,
        },
      ],
      session ? { session } : undefined
    );

    await Transaction.create(
      [
        {
          investmentId,
          provider: providerResp.provider,
          providerPaymentId: providerResp.providerPaymentId,
          amount: totalCharged,
          status: "PENDING",
          attemptNumber: 1,
        },
      ],
      session ? { session } : undefined
    );

    return {
      investment: investment[0].toObject(),
      paymentUrl: providerResp.paymentUrl,
      providerPaymentId: providerResp.providerPaymentId,
    };
  });
}

function verifyMockSignature(req) {
  const signature = req.get("x-mock-signature") || "";
  const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
  const expected = mockProvider.signPayload(raw);
  if (!signature || signature !== expected) {
    throw new HttpError(401, "Signature webhook invalide.");
  }
}

async function handleMockWebhookPayload(payload) {
  const { providerPaymentId, status, paymentMethod } = payload || {};
  if (!providerPaymentId) {
    throw new HttpError(400, "providerPaymentId est requis.");
  }
  const normalized = String(status || "").toUpperCase();
  if (!["SUCCEEDED", "FAILED"].includes(normalized)) {
    throw new HttpError(400, "status doit être SUCCEEDED ou FAILED.");
  }

  const tx = await Transaction.findOne({ providerPaymentId });
  if (!tx) throw new HttpError(404, "Transaction introuvable.");

  // En dev/PFE, MongoDB est souvent en standalone (sans transactions).
  // Ici on exécute “au mieux” sans session, car le provider est mocké et la priorité est la robustesse locale.
  const investment = await Investment.findById(tx.investmentId);
  if (!investment) throw new HttpError(404, "Investissement introuvable.");

  const project = await Project.findById(investment.projectId);
  if (!project) throw new HttpError(404, "Projet introuvable.");

  if (tx.status !== "PENDING") {
    return {
      ok: true,
      idempotent: true,
      status: tx.status,
      investmentId: investment._id,
      projectId: project._id,
      redirectTo: "/investments",
    };
  }

  if (normalized === "FAILED") {
    tx.status = "FAILED";
    tx.paymentMethod = paymentMethod || tx.paymentMethod;
    await tx.save();

    investment.status = "FAILED";
    await investment.save();

    const notifs = await Notification.create([
      {
        userId: investment.investorId,
        type: "PAYMENT_FAILED",
        title: "Paiement échoué",
        message:
          "Votre paiement n’a pas été confirmé. Vous pouvez réessayer en relançant un investissement.",
        relatedEntityId: investment._id,
        relatedEntityType: "INVESTMENT",
      },
    ]);

    // Ne pas bloquer la confirmation sur l’envoi d’e-mails (au mieux, asynchrone).
    void enqueueEmailForNotifications(notifs).catch(() => {});
    return {
      ok: true,
      idempotent: false,
      status: "FAILED",
      investmentId: investment._id,
      projectId: project._id,
      redirectTo: "/investments",
    };
  }

  // Cas SUCCEEDED — détection atomique du sur-financement.
  const requestConsultation = Boolean(payload?.requestConsultation) || investment.wantsConsultation;

  if (requestConsultation) {
    tx.status = "SUCCEEDED";
    tx.succeededAt = new Date();
    tx.paymentMethod = paymentMethod || tx.paymentMethod;
    tx.onHoldForConsultation = true; // Je devrais peut-être ajouter ce champ au modèle Transaction ou juste me fier à Investment.status
    await tx.save();

    investment.status = "PENDING_CONSULTATION";
    await investment.save();

    // Création automatique de la facture correspondante
    const invObj = await invoiceService.createInvoiceForInvestment(investment);

    // Création automatique du dossier de consultation pour que l'investisseur le retrouve
    await ExpertConsultation.create([{
      projectId: project._id,
      investorId: investment.investorId,
      investmentId: investment._id,
      investedAmount: investment.amount,
      subject: "Consultation requise pour valider l'investissement",
      status: "OPEN",
    }]);

    await AuditLog.create([
      {
        actorId: investment.investorId,
        actorRole: "USER",
        action: "INVESTMENT_HOLD_FOR_CONSULTATION",
        targetType: "Investment",
        targetId: investment._id,
        details: { amount: investment.amount, projectId: project._id },
      },
    ]);

    const notifs = await Notification.create([
      {
        userId: investment.investorId,
        type: "PAYMENT_HELD_CONSULTATION",
        title: "Paiement en attente de consultation",
        message: "Votre paiement est confirmé mais l'investissement est en attente de votre consultation avec l'expert.",
        relatedEntityId: investment._id,
        relatedEntityType: "INVESTMENT",
      },
    ]);
    void enqueueEmailForNotifications(notifs).catch(() => {});

    // Notification aux experts qu'une nouvelle demande de consultation est ouverte
    try {
      const experts = await User.find({ role: "EXPERT", deletedAt: null }).lean();
      if (experts.length > 0) {
        const expertNotifs = experts.map((exp) => ({
          userId: exp._id,
          type: "NEW_ASSIGNMENT",
          title: "Nouvelle demande de consultation",
          message: `Un investisseur sollicite une consultation d'expert pour le projet "${project.title}" (${investment.amount} TND).`,
          relatedEntityId: investment._id,
          relatedEntityType: "INVESTMENT",
        }));
        const createdExpertNotifs = await Notification.create(expertNotifs);
        void enqueueEmailForNotifications(createdExpertNotifs).catch(() => {});
      }
    } catch (err) {
      console.error("[expert-notification] Erreur lors de la notification aux experts:", err);
    }

    return {
      ok: true,
      status: "PENDING_CONSULTATION",
      investmentId: investment._id,
      projectId: project._id,
      invoiceId: invObj?._id,
      redirectTo: invObj ? `/invoices/${invObj._id}` : "/investments",
    };
  }

  const updateResult = await Project.updateOne(
    {
      _id: project._id,
      status: ProjectStatus.ACTIVE,
      isArchived: false,
      $expr: { $lte: [{ $add: ["$currentFunding", investment.amount] }, "$fundingGoal"] },
    },
    { $inc: { currentFunding: investment.amount } }
  );

  if (updateResult.modifiedCount === 0) {
    // Sur-financement détecté: rembourser et ne pas incrémenter le total.
    const refundResp = mockProvider.refundPayment({
      provider: tx.provider,
      providerPaymentId: tx.providerPaymentId,
      amount: tx.amount,
      reason: "OVERFUNDING",
    });

    const refunded = Boolean(refundResp && refundResp.ok);
    tx.status = refunded ? "REFUNDED" : "SUCCEEDED";
    if (tx.status === "SUCCEEDED") tx.succeededAt = new Date();
    tx.refundStatus = refunded ? "SUCCEEDED" : "FAILED";
    tx.refundedAt = refunded ? new Date() : undefined;
    tx.paymentMethod = paymentMethod || tx.paymentMethod;
    await tx.save();

    investment.status = refunded ? "REFUNDED" : "SUCCESS";
    await investment.save();

    await AuditLog.create([
      {
        actorId: investment.investorId,
        actorRole: "USER",
        action: "REFUND_INVESTMENT",
        targetType: "Investment",
        targetId: investment._id,
        details: { amount: investment.amount, projectId: project._id, reason: "OVERFUNDING" },
      },
    ]);

    if (!refunded) {
      await FailedRefundEvent.create([
        {
          investmentId: investment._id,
          projectId: project._id,
          error: "Échec remboursement côté provider",
          retryCount: 0,
          reason: "OVERFUNDING",
          resolved: false,
        },
      ]);
    }

    const notifs = await Notification.create([
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
    ]);

    // Ne pas bloquer la confirmation sur l’envoi d’e-mails (au mieux, asynchrone).
    void enqueueEmailForNotifications(notifs).catch(() => {});
    return {
      ok: true,
      idempotent: false,
      status: refunded ? "REFUNDED" : "SUCCEEDED",
      refunded,
      investmentId: investment._id,
      projectId: project._id,
      redirectTo: "/investments",
    };
  }

  // Cas nominal: paiement réussi.
  tx.status = "SUCCEEDED";
  tx.succeededAt = new Date();
  tx.paymentMethod = paymentMethod || tx.paymentMethod;
  await tx.save();

  investment.status = "SUCCESS";
  await investment.save();

  // Création automatique de la facture correspondante
  const invObj = await invoiceService.createInvoiceForInvestment(investment);

  await AuditLog.create([
    {
      actorId: investment.investorId,
      actorRole: "USER",
      action: "CREATE_INVESTMENT",
      targetType: "Investment",
      targetId: investment._id,
      details: { amount: investment.amount, projectId: project._id, status: "SUCCESS" },
    },
  ]);

  const notifs = await Notification.create([
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
  ]);

  const updated = await Project.findById(project._id);
  if (updated && Number(updated.currentFunding) >= Number(updated.fundingGoal)) {
    transitionProjectStatus(updated, ProjectStatus.FUNDED, { action: "FUNDING_GOAL_REACHED" });
    updated.fundedAt = new Date();
    await updated.save();

    await Notification.create([
      {
        userId: updated.creatorId,
        type: "PROJECT_FUNDED",
        title: "Objectif atteint",
        message: "Félicitations ! Votre projet a atteint son objectif de financement.",
        relatedEntityId: updated._id,
        relatedEntityType: "PROJECT",
      },
    ]);
  }

  // Ne pas bloquer la confirmation sur l’envoi d’e-mails (au mieux, asynchrone).
  void enqueueEmailForNotifications(notifs).catch(() => {});
  return {
    ok: true,
    idempotent: false,
    status: "SUCCEEDED",
    refunded: false,
    investmentId: investment._id,
    projectId: project._id,
    invoiceId: invObj?._id,
    redirectTo: "/investments",
  };
}

async function handleMockWebhook(req) {
  verifyMockSignature(req);
  return handleMockWebhookPayload(req.body || {});
}

async function confirmMockPaymentFromClient(payload) {
  if (process.env.NODE_ENV === "production") {
    throw new HttpError(404, "Indisponible en production.");
  }
  const body = payload || {};
  const providerPaymentId = String(body?.providerPaymentId || "").trim();
  if (providerPaymentId) {
    const tx = await Transaction.findOne({ providerPaymentId })
      .select("mockOtpHash mockOtpExpiresAt")
      .lean();
    if (tx?.mockOtpHash) {
      const expAt = tx?.mockOtpExpiresAt ? new Date(tx.mockOtpExpiresAt) : null;
      if (!expAt || Number.isNaN(expAt.getTime()) || expAt.getTime() < Date.now()) {
        throw new HttpError(400, "Code OTP expiré. Veuillez relancer la vérification.");
      }
      const given = String(body?.otp || "").replace(/[^\d]/g, "");
      if (given.length !== 6) throw new HttpError(400, "Code OTP invalide (6 chiffres).");
      const hash = crypto.createHash("sha256").update(given).digest("hex");
      if (hash !== tx.mockOtpHash) throw new HttpError(400, "Code OTP incorrect.");
    }
  }
  return handleMockWebhookPayload(body);
}

async function sendMockOtpEmail({ investorId, providerPaymentId }) {
  if (process.env.NODE_ENV === "production") {
    throw new HttpError(404, "Indisponible en production.");
  }
  const pid = String(providerPaymentId || "").trim();
  if (!pid) throw new HttpError(400, "providerPaymentId est requis.");

  const tx = await Transaction.findOne({ providerPaymentId: pid });
  if (!tx) throw new HttpError(404, "Transaction introuvable.");

  const inv = await Investment.findById(tx.investmentId).lean();
  if (!inv) throw new HttpError(404, "Investissement introuvable.");
  if (String(inv.investorId) !== String(investorId)) {
    throw new HttpError(403, "Accès refusé.");
  }

  const user = await User.findById(investorId).select("email deletedAt").lean();
  if (!user || user.deletedAt) throw new HttpError(404, "Utilisateur introuvable.");

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const hash = crypto.createHash("sha256").update(code).digest("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  tx.mockOtpHash = hash;
  tx.mockOtpExpiresAt = expiresAt;
  tx.mockOtpSentAt = new Date();
  await tx.save();

  console.info(`\n==================================================\n[3DS SECURE OTP] Transaction: ${providerPaymentId}\nCode OTP : ${code}\n==================================================\n`);

  const subject = "FinCollab — Code de vérification (démo)";
  const text = `Votre code OTP (démo) est : ${code}\n\nIl expire dans 10 minutes.\n`;
  const html = `<p>Votre code OTP (démo) est : <strong style="font-size:18px;letter-spacing:2px">${code}</strong></p><p>Il expire dans 10 minutes.</p>`;
  const out = await sendMailDetailed({ to: user.email, subject, text, html });
  return { ok: true, sent: Boolean(out?.ok), previewUrl: out?.previewUrl || null };
}

async function cancelInvestment({ investorId, investmentId }) {
  if (!mongoose.isValidObjectId(investmentId)) {
    throw new HttpError(400, "Identifiant d’investissement invalide.");
  }

  const investment = await Investment.findOne({ _id: investmentId, investorId });
  if (!investment) throw new HttpError(404, "Investissement introuvable.");

  const tx = await Transaction.findOne({ investmentId: investment._id }).sort({ attemptNumber: -1 });
  if (!tx) throw new HttpError(400, "Transaction introuvable pour cet investissement.");

  const eligibleInitiated = investment.status === "INITIATED" && tx.status === "PENDING";
  const confirmedAt = paymentConfirmedAt(tx);
  const eligibleSuccess =
    (investment.status === "SUCCESS" || investment.status === "PENDING_CONSULTATION") &&
    tx.status === "SUCCEEDED" &&
    confirmedAt &&
    (investment.status === "PENDING_CONSULTATION" ||
      Date.now() <
        confirmedAt.getTime() + investment.cancellationGracePeriodMinutes * 60 * 1000);

  if (!eligibleInitiated && !eligibleSuccess) {
    throw new HttpError(
      400,
      "Annulation impossible : paiement déjà traité ou délai d’annulation dépassé."
    );
  }

  await withOptionalTransaction(async (session) => {
    investment.status = "CANCELLING";
    await investment.save(session ? { session } : undefined);

    // Mettre à jour le statut de la facture associée en REFUNDED
    await Invoice.updateOne(
      { type: "INVESTMENT", referenceId: investment._id },
      { status: "REFUNDED" },
      session ? { session } : undefined
    );
  });

  const providerResp = mockProvider.cancelPayment();
  if (!providerResp.ok) {
    await FailedCancellationEvent.create({
      investmentId: investment._id,
      error: "Échec d’annulation côté provider",
      retryCount: 0,
      reason: "CANCELLATION_FAILED",
      resolved: false,
    });
    // Notifier l’investisseur: l’annulation a échoué immédiatement (traçabilité in-app).
    try {
      const notifs = await Notification.create([
        {
          userId: investorId,
          type: "CANCELLATION_FAILED",
          title: "Annulation en échec",
          message:
            "L’annulation n’a pas pu être confirmée pour le moment. Merci de réessayer plus tard. Si le problème persiste, contactez le support.",
          relatedEntityId: investment._id,
          relatedEntityType: "INVESTMENT",
        },
      ]);
      // Au mieux : ne pas bloquer sur l’envoi d’e-mails.
      void enqueueEmailForNotifications(notifs).catch(() => {});
    } catch {
      // ignorer
    }
    throw new HttpError(500, "Annulation échouée. Merci de réessayer ou de contacter le support.");
  }

  return await withOptionalTransaction(async (session2) => {
    const freshInvestment = session2
      ? await Investment.findById(investment._id).session(session2)
      : await Investment.findById(investment._id);
    const freshTx = session2
      ? await Transaction.findById(tx._id).session(session2)
      : await Transaction.findById(tx._id);
    if (!freshInvestment || !freshTx) throw new HttpError(404, "Investissement introuvable.");

    const project = session2
      ? await Project.findById(freshInvestment.projectId).session(session2)
      : await Project.findById(freshInvestment.projectId);
    if (!project) throw new HttpError(404, "Projet introuvable.");

    // Si le paiement était déjà confirmé au moment de la demande d’annulation,
    // l’annulation agit comme un remboursement (et doit mettre à jour les totaux).
    // Remarque : on ne peut pas se fier à `freshInvestment.status` ici car on l’a déjà passé en CANCELLING.
    const wasSucceeded = Boolean(eligibleSuccess) && freshTx.status === "SUCCEEDED";
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
              error: "Échec remboursement côté provider",
              retryCount: 0,
              reason: "USER_REQUESTED",
              resolved: false,
            },
          ],
          session2 ? { session: session2 } : undefined
        );
        throw new HttpError(
          500,
          "Remboursement échoué. Merci de réessayer plus tard ou de contacter le support."
        );
      }

      // Recalculer le total “effectif” à partir des transactions (plus robuste que currentFunding -= amount).
      // Règle: ne compter que les investissements SUCCESS dont la dernière transaction a refundStatus ∈ ["NOT_ATTEMPTED","SUCCEEDED"].
      const successInvsQuery = Investment.find({
        projectId: project._id,
        status: "SUCCESS",
      }).select("_id amount");
      if (session2) successInvsQuery.session(session2);
      const successInvs = await successInvsQuery.lean();
      const successIds = successInvs.map((x) => x._id);
      let txs = [];
      if (successIds.length) {
        const txsQuery = Transaction.find({ investmentId: { $in: successIds } }).select(
          "investmentId attemptNumber refundStatus status"
        );
        if (session2) txsQuery.session(session2);
        txs = await txsQuery.lean();
      }
      const latestTxByInv = new Map();
      for (const t of txs) {
        const key = String(t.investmentId);
        const existing = latestTxByInv.get(key);
        if (!existing || Number(t.attemptNumber || 1) > Number(existing.attemptNumber || 1)) {
          latestTxByInv.set(key, t);
        }
      }
      let effective = 0;
      for (const inv2 of successInvs) {
        // Cet investissement est en cours de remboursement (annulation) : ne pas le compter dans le total effectif.
        if (String(inv2._id) === String(freshInvestment._id)) continue;
        const last = latestTxByInv.get(String(inv2._id));
        if (!last) continue;
        if (String(last.status || "") !== "SUCCEEDED") continue;
        const rs = String(last.refundStatus || "NOT_ATTEMPTED");
        if (!["NOT_ATTEMPTED", "SUCCEEDED"].includes(rs)) continue;
        effective += Number(inv2.amount || 0);
      }
      const nextFunding = Math.max(0, Math.round(effective * 100) / 100);
      const wasFundedBefore = project.status === ProjectStatus.FUNDED;
      project.currentFunding = nextFunding;
      const goal = Number(project.fundingGoal || 0);
      // Normaliser le statut selon le total effectif (cohérence métier):
      // - si on perd l’objectif => FUNDED -> ACTIVE
      // - si on retrouve l’objectif (rare, mais possible) => ACTIVE -> FUNDED
      if (project.status === ProjectStatus.FUNDED && nextFunding < goal) {
        transitionProjectStatus(project, ProjectStatus.ACTIVE, { action: "FUNDING_GOAL_LOST" });
      } else if (project.status === ProjectStatus.ACTIVE && nextFunding >= goal) {
        transitionProjectStatus(project, ProjectStatus.FUNDED, { action: "FUNDING_GOAL_REACHED" });
      }
      await project.save(session2 ? { session: session2 } : undefined);

      freshInvestment.status = "REFUNDED";
      freshInvestment.cancelReason = "USER_REQUESTED";
      freshInvestment.cancelledAt = new Date();
      await freshInvestment.save(session2 ? { session: session2 } : undefined);

      freshTx.status = "REFUNDED";
      freshTx.refundStatus = "SUCCEEDED";
      freshTx.refundedAt = new Date();
      freshTx.cancelledAt = new Date();
      await freshTx.save(session2 ? { session: session2 } : undefined);

      await Notification.create(
        [
          {
            userId: investorId,
            type: "PAYMENT_REFUNDED",
            title: "Paiement remboursé",
            message: "Votre investissement a été annulé et remboursé.",
            relatedEntityId: freshInvestment._id,
            relatedEntityType: "INVESTMENT",
          },
          ...(wasFundedBefore && project.status === "ACTIVE"
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
        session2 ? { session: session2 } : undefined
      );
    } else {
      // Annulation depuis INITIATED: aucun impact sur le financement.
      freshInvestment.status = "CANCELLED";
      freshInvestment.cancelReason = "USER_REQUESTED";
      freshInvestment.cancelledAt = new Date();
      await freshInvestment.save(session2 ? { session: session2 } : undefined);

      freshTx.status = "CANCELLED";
      freshTx.cancelledAt = new Date();
      await freshTx.save(session2 ? { session: session2 } : undefined);

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
        session2 ? { session: session2 } : undefined
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
      session2 ? { session: session2 } : undefined
    );

    return freshInvestment.toObject();
  });
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
    throw new HttpError(400, "Identifiant d’investissement invalide.");
  }

  const investment = await Investment.findOne({ _id: investmentId, investorId });
  if (!investment) throw new HttpError(404, "Investissement introuvable.");
  if (investment.status !== "FAILED") {
    throw new HttpError(400, "Relance impossible : seul un investissement en échec peut être relancé.");
  }

  const project = await Project.findById(investment.projectId).lean();
  if (!project) throw new HttpError(404, "Projet introuvable.");

  const today = nowStartOfDay(new Date());
  const startAt = project.startAt ? nowStartOfDay(project.startAt) : null;
  const deadline = project.deadline ? nowStartOfDay(project.deadline) : null;
  const isInvestable =
    project.status === "ACTIVE" &&
    !project.isArchived &&
    (!startAt || startAt <= today) &&
    (!deadline || deadline >= today) &&
    Number(project.currentFunding || 0) < Number(project.fundingGoal || 0);
  if (!isInvestable) throw new HttpError(400, "Projet non disponible pour investissement.");

  const lastTx = await Transaction.findOne({ investmentId: investment._id }).sort({ attemptNumber: -1 }).lean();
  const nextAttempt = (lastTx?.attemptNumber || 1) + 1;

  const providerResp = mockProvider.createPaymentLink({
    amount: investment.amount,
    currency: "TND",
    referenceId: String(investment._id),
  });

  return await withOptionalTransaction(async (session) => {
    investment.status = "INITIATED";
    investment.paymentAttempts = Number(investment.paymentAttempts || 0) + 1;
    await investment.save(session ? { session } : undefined);

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
      session ? { session } : undefined
    );

    return {
      investment: investment.toObject(),
      paymentUrl: providerResp.paymentUrl,
      providerPaymentId: providerResp.providerPaymentId,
    };
  });
}

async function finalizeInvestmentAfterConsultation({ investorId, investmentId }) {
  if (!mongoose.isValidObjectId(investmentId)) {
    throw new HttpError(400, "Identifiant d’investissement invalide.");
  }

  const investment = await Investment.findOne({ _id: investmentId, investorId });
  if (!investment) throw new HttpError(404, "Investissement introuvable.");

  if (investment.status !== "PENDING_CONSULTATION") {
    throw new HttpError(400, "L'investissement n'est pas en attente de consultation.");
  }

  const project = await Project.findById(investment.projectId);
  if (!project) throw new HttpError(404, "Projet introuvable.");

  const refundAndFail = async (reasonText) => {
    investment.status = "REFUNDED";
    investment.cancelReason = "OVER_FUNDED_OR_INACTIVE";
    investment.cancelledAt = new Date();
    await investment.save();

    await Invoice.updateOne(
      { type: "INVESTMENT", referenceId: investment._id },
      { status: "REFUNDED" }
    );

    const tx = await Transaction.findOne({ investmentId: investment._id, status: "SUCCEEDED" });
    if (tx) {
      const refundResp = mockProvider.refundPayment({
        provider: tx.provider,
        providerPaymentId: tx.providerPaymentId,
        amount: tx.amount,
        reason: "OVER_FUNDED_OR_INACTIVE",
      });

      if (refundResp && refundResp.ok) {
        tx.status = "REFUNDED";
        tx.refundStatus = "SUCCEEDED";
        tx.refundedAt = new Date();
        tx.cancelledAt = new Date();
        await tx.save();
      } else {
        await FailedRefundEvent.create({
          investmentId: investment._id,
          projectId: project._id,
          error: "Échec remboursement automatique lors du sur-financement",
          retryCount: 0,
          reason: "OVER_FUNDED_OR_INACTIVE",
          resolved: false,
        });
      }
    }

    const notifs = await Notification.create([
      {
        userId: investorId,
        type: "PAYMENT_REFUNDED",
        title: "Investissement remboursé automatiquement",
        message: `Votre investissement de ${investment.amount} TND dans le projet "${project.title}" a été remboursé car le projet a déjà atteint son objectif ou n'est plus actif.`,
        relatedEntityId: investment._id,
        relatedEntityType: "INVESTMENT",
      }
    ]);
    void enqueueEmailForNotifications(notifs).catch(() => {});

    throw new HttpError(400, reasonText);
  };

  // On vérifie à nouveau si le projet est encore investissable (même si le paiement est déjà fait)
  // Car si le projet est clôturé ou archivé, on ne peut plus ajouter de fonds.
  if (project.status !== ProjectStatus.ACTIVE || project.isArchived) {
    await refundAndFail("Le projet n'est plus actif. Vous allez être remboursé.");
  }

  const updateResult = await Project.updateOne(
    {
      _id: project._id,
      status: ProjectStatus.ACTIVE,
      isArchived: false,
      $expr: { $lte: [{ $add: ["$currentFunding", investment.amount] }, "$fundingGoal"] },
    },
    { $inc: { currentFunding: investment.amount } }
  );

  if (updateResult.modifiedCount === 0) {
    // Cas sur-financement entre temps: remboursement nécessaire.
    await refundAndFail("Le projet a atteint son objectif. Vous allez être remboursé.");
  }

  investment.status = "SUCCESS";
  await investment.save();

  // Vérifier si le projet a maintenant atteint son objectif de financement suite à cette confirmation
  try {
    const updated = await Project.findById(project._id);
    if (updated && Number(updated.currentFunding) >= Number(updated.fundingGoal)) {
      transitionProjectStatus(updated, ProjectStatus.FUNDED, { action: "FUNDING_GOAL_REACHED" });
      updated.fundedAt = new Date();
      await updated.save();

      await Notification.create([
        {
          userId: updated.creatorId,
          type: "PROJECT_FUNDED",
          title: "Objectif atteint",
          message: "Félicitations ! Votre projet a atteint son objectif de financement.",
          relatedEntityId: updated._id,
          relatedEntityType: "PROJECT",
        },
      ]);
    }
  } catch (err) {
    console.error("[finalize-consultation] Erreur lors de la transition du projet vers FUNDED:", err);
  }

  // Mettre à jour la facture (PAID) et réinitialiser issuedAt pour que le compteur
  // de grâce (5 min) ne démarre que maintenant.
  await Invoice.updateOne(
    { type: "INVESTMENT", referenceId: investment._id },
    { status: "PAID", issuedAt: new Date() }
  );

  // Également réinitialiser `succeededAt` sur la transaction pour que l'interface
  // utilisateur (MyInvestments) commence son décompte de grâce à partir de cet instant.
  await mongoose.model("Transaction").updateOne(
    { investmentId: investment._id, status: "SUCCEEDED" },
    { succeededAt: new Date() }
  );

  // Notifs etc. (copier-coller de handleMockWebhookPayload ?)
  // ... (simplifié pour le moment)
  
  return { ok: true, investment };
}

module.exports = {
  createInvestment,
  handleMockWebhook,
  confirmMockPaymentFromClient,
  cancelInvestment,
  listMyInvestments,
  retryInvestmentPayment,
  sendMockOtpEmail,
  finalizeInvestmentAfterConsultation,
};

