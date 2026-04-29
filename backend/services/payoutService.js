const mongoose = require("mongoose");
const Payout = require("../models/Payout");
const Project = require("../models/Project");
const FailedRefundEvent = require("../models/FailedRefundEvent");
const FailedPayoutEvent = require("../models/FailedPayoutEvent");
const Notification = require("../models/Notification");
const AuditLog = require("../models/AuditLog");
const HttpError = require("../utils/HttpError");
const { seal, open } = require("../utils/cryptoSeal");
const { enqueueEmailForNotifications } = require("../integrations/emailQueue");
const User = require("../models/User");

// Pourquoi: l’intégration bancaire est simulée par un fournisseur factice (cf. MockPaymentProvider),
// mais on modélise tout le workflow réel (PENDING → READY → COMPLETED) afin que l’UX et le processus
// admin restent fidèles à un environnement de production.

function validateBankDetailsJsonString(bankDetails) {
  let parsed;
  try {
    parsed = JSON.parse(String(bankDetails || ""));
  } catch {
    throw new HttpError(400, "Coordonnées bancaires invalides : JSON invalide.");
  }

  const accountHolderName = String(parsed.accountHolderName || "").trim();
  const bankName = String(parsed.bankName || "").trim();
  const iban = String(parsed.iban || "").replace(/\s+/g, "").toUpperCase();
  const swiftCode = parsed.swiftCode ? String(parsed.swiftCode || "").trim().toUpperCase() : "";

  if (accountHolderName.length < 3 || accountHolderName.length > 100) {
    throw new HttpError(
      400,
      "Coordonnées bancaires invalides : `accountHolderName` doit contenir 3 à 100 caractères."
    );
  }
  if (bankName.length < 3 || bankName.length > 100) {
    throw new HttpError(
      400,
      "Coordonnées bancaires invalides : `bankName` doit contenir 3 à 100 caractères."
    );
  }
  // Contrôle de format IBAN (lettres pays + 13 à 32 alphanumériques).
  if (!/^[A-Z]{2}[0-9A-Z]{13,32}$/.test(iban)) {
    throw new HttpError(400, "Coordonnées bancaires invalides : format IBAN incorrect.");
  }
  if (swiftCode && !/^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(swiftCode)) {
    throw new HttpError(
      400,
      "Coordonnées bancaires invalides : `swiftCode` doit faire 8 ou 11 caractères."
    );
  }

  return { accountHolderName, bankName, iban, swiftCode: swiftCode || null };
}

async function ensurePayoutForFundedProject(projectId) {
  const project = await Project.findById(projectId);
  if (!project) throw new HttpError(404, "Projet introuvable.");
  // Pourquoi: dans la conception, le payout est créé après clôture d’un projet FUNDED (cron/période de grâce).
  // On accepte FUNDED ou CLOSED afin que le cron puisse clôturer puis créer le payout de manière fiable.
  if (!["FUNDED", "CLOSED"].includes(project.status)) return { ok: false };

  const existing = await Payout.findOne({ projectId: project._id }).lean();
  if (existing) return { ok: true, payout: existing, created: false };

  const payout = await Payout.create({
    projectId: project._id,
    creatorId: project.creatorId,
    amount: project.fundingGoal,
    status: "PENDING",
  });

  const notif = await Notification.create({
    userId: project.creatorId,
    type: "PAYOUT_BANK_DETAILS_REQUEST",
    title: "Coordonnées bancaires requises",
    message:
      "Votre projet est financé. Ajoutez vos coordonnées bancaires pour permettre le virement (validation admin).",
    relatedEntityId: payout._id,
    relatedEntityType: "PAYOUT",
  });
  await enqueueEmailForNotifications([notif]);

  return { ok: true, payout: payout.toObject(), created: true };
}

async function listMyPayouts(creatorId, { limit = 30 } = {}) {
  const n = Number(limit);
  const safeLimit = Number.isFinite(n) ? Math.min(Math.max(n, 1), 50) : 30;
  return Payout.find({ creatorId })
    .sort({ createdAt: -1 })
    .limit(safeLimit)
    .lean();
}

async function getMyPayout(creatorId, payoutId) {
  if (!mongoose.isValidObjectId(payoutId)) throw new HttpError(400, "Identifiant de retrait invalide.");
  const payout = await Payout.findOne({ _id: payoutId, creatorId }).lean();
  if (!payout) throw new HttpError(404, "Retrait introuvable.");
  // Do not return decrypted bank details on API (minimize exposure)
  return payout;
}

async function provideBankDetails(creatorId, payoutId, bankDetails) {
  const payout = await Payout.findOne({ _id: payoutId, creatorId });
  if (!payout) throw new HttpError(404, "Retrait introuvable.");
  if (payout.status !== "PENDING") {
    throw new HttpError(400, "Retrait non modifiable : il n’est pas en attente (PENDING).");
  }

  const normalized = validateBankDetailsJsonString(bankDetails);
  const sealed = seal(JSON.stringify(normalized));

  payout.bankDetails = sealed;
  payout.status = "READY";
  payout.bankDetailsProvidedAt = new Date();
  await payout.save();

  await AuditLog.create({
    actorId: creatorId,
    actorRole: "USER",
    action: "PROVIDE_BANK_DETAILS",
    targetType: "Payout",
    targetId: payout._id,
    details: {},
  });

  const notifs = [];
  notifs.push(
    await Notification.create({
      userId: creatorId,
      type: "PAYOUT_BANK_DETAILS_REQUEST",
      title: "Coordonnées enregistrées",
      message: "Coordonnées bancaires enregistrées. Un administrateur validera le virement.",
      relatedEntityId: payout._id,
      relatedEntityType: "PAYOUT",
    })
  );

  // Conception: notify admins to approve payout once bank details are provided.
  const admins = await User.find({ role: "ADMIN" }).select("_id").lean();
  if (admins.length) {
    const adminNotifs = await Notification.insertMany(
      admins.map((a) => ({
        userId: a._id,
        type: "PAYOUT_READY_FOR_APPROVAL",
        title: "Payout à valider",
        message: "Un créateur a fourni ses coordonnées. Vous pouvez approuver le payout.",
        relatedEntityId: payout._id,
        relatedEntityType: "PAYOUT",
      }))
    );
    notifs.push(...adminNotifs);
  }

  await enqueueEmailForNotifications(notifs);

  return payout.toObject();
}

async function listAdminPayouts({ status, limit = 50 } = {}) {
  const n = Number(limit);
  const safeLimit = Number.isFinite(n) ? Math.min(Math.max(n, 1), 100) : 50;
  const query = {};
  if (status) query.status = String(status);
  return Payout.find(query).sort({ createdAt: -1 }).limit(safeLimit).lean();
}

async function approvePayout({ adminId, payoutId, notes = "" }) {
  const payout = await Payout.findById(payoutId);
  if (!payout) throw new HttpError(404, "Retrait introuvable.");
  if (payout.status !== "READY" || !payout.bankDetails) {
    throw new HttpError(400, "Retrait non prêt ou coordonnées bancaires manquantes.");
  }

  const unresolved = await FailedRefundEvent.findOne({
    projectId: payout.projectId,
    reason: "OVERFUNDING",
    resolved: false,
  }).lean();
  if (unresolved) {
    throw new HttpError(400, "Approbation impossible : remboursements de surfinancement en attente.");
  }

  // Provider factice : on simule la réussite du virement.
  // En production, on appellerait ici le fournisseur de paiement réel (PSP/banque).
  const decrypted = open(payout.bankDetails); // validate decrypt works
  if (!decrypted) {
    throw new HttpError(500, "Erreur interne : impossible de déchiffrer les coordonnées bancaires.");
  }

  payout.status = "COMPLETED";
  payout.completedAt = new Date();
  payout.notes = String(notes || "").trim();
  await payout.save();

  await AuditLog.create({
    actorId: adminId,
    actorRole: "ADMIN",
    action: "APPROVE_PAYOUT",
    targetType: "Payout",
    targetId: payout._id,
    details: { notes: payout.notes },
  });

  const notifs = await Notification.create([
    {
      userId: payout.creatorId,
      type: "PAYOUT_COMPLETED",
      title: "Virement effectué",
      message: "Votre paiement a été validé et marqué comme complété.",
      relatedEntityId: payout._id,
      relatedEntityType: "PAYOUT",
    },
  ]);
  await enqueueEmailForNotifications(notifs);

  return payout.toObject();
}

async function failPayout({ adminId, payoutId, error }) {
  const payout = await Payout.findById(payoutId);
  if (!payout) throw new HttpError(404, "Retrait introuvable.");
  payout.status = "FAILED";
  payout.failureReason = String(error || "Transfer failed");
  await payout.save();

  await FailedPayoutEvent.create({
    payoutId: payout._id,
    error: payout.failureReason,
    retryCount: 0,
    resolved: false,
  });

  await AuditLog.create({
    actorId: adminId,
    actorRole: "ADMIN",
    action: "FAIL_PAYOUT",
    targetType: "Payout",
    targetId: payout._id,
    details: { error: payout.failureReason },
  });

  const notifs = await Notification.create([
    {
      userId: payout.creatorId,
      type: "PAYOUT_FAILED",
      title: "Virement échoué",
      message: "Le paiement n’a pas pu être finalisé. Un administrateur va réessayer.",
      relatedEntityId: payout._id,
      relatedEntityType: "PAYOUT",
    },
  ]);
  await enqueueEmailForNotifications(notifs);

  return payout.toObject();
}

async function cancelOpenPayoutForProject({ adminId, projectId, reason = "" }) {
  if (!mongoose.isValidObjectId(projectId)) throw new HttpError(400, "Identifiant de projet invalide.");
  const payout = await Payout.findOne({ projectId });
  if (!payout) return { cancelled: false, payout: null };

  if (!["PENDING", "READY"].includes(String(payout.status || ""))) {
    return { cancelled: false, payout: payout.toObject() };
  }

  payout.status = "CANCELLED";
  payout.failureReason = String(reason || "").trim() || "Cancelled by admin";
  await payout.save();

  await AuditLog.create({
    actorId: adminId,
    actorRole: "ADMIN",
    action: "CANCEL_PAYOUT",
    targetType: "Payout",
    targetId: payout._id,
    details: { projectId: String(projectId), reason: payout.failureReason },
  });

  const notifs = await Notification.create([
    {
      userId: payout.creatorId,
      type: "PAYOUT_CANCELLED",
      title: "Payout annulé",
      message:
        "Le payout associé à votre projet a été annulé suite à une action administrative (projet suspendu).",
      relatedEntityId: payout._id,
      relatedEntityType: "PAYOUT",
    },
  ]);
  await enqueueEmailForNotifications(notifs);

  return { cancelled: true, payout: payout.toObject() };
}

module.exports = {
  ensurePayoutForFundedProject,
  listMyPayouts,
  getMyPayout,
  provideBankDetails,
  listAdminPayouts,
  approvePayout,
  failPayout,
  cancelOpenPayoutForProject,
};

