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
const mockPayoutProvider = require("../integrations/mockPayoutProvider");

// Pourquoi : l’intégration bancaire est simulée par un fournisseur factice (cf. mockPaymentProvider),
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
  const rawIban = String(parsed.iban || "").replace(/\s+/g, "").toUpperCase();
  const rawRib = String(parsed.rib || "").replace(/\s+/g, "");
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
  // Tunisie : certaines plateformes exigent un RIB (20 chiffres), d’autres un IBAN (TN…).
  const hasIban = Boolean(rawIban);
  const hasRib = Boolean(rawRib);
  if (!hasIban && !hasRib) {
    throw new HttpError(400, "Coordonnées bancaires invalides : renseignez un RIB ou un IBAN.");
  }
  if (hasIban && !/^[A-Z]{2}[0-9A-Z]{13,32}$/.test(rawIban)) {
    throw new HttpError(400, "Coordonnées bancaires invalides : format IBAN incorrect.");
  }
  if (hasRib && !/^[0-9]{20}$/.test(rawRib)) {
    throw new HttpError(400, "Coordonnées bancaires invalides : le RIB doit contenir 20 chiffres.");
  }
  if (swiftCode && !/^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(swiftCode)) {
    throw new HttpError(
      400,
      "Coordonnées bancaires invalides : `swiftCode` doit faire 8 ou 11 caractères."
    );
  }

  return {
    accountHolderName,
    bankName,
    iban: hasIban ? rawIban : null,
    rib: hasRib ? rawRib : null,
    swiftCode: swiftCode || null,
  };
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
    // Montant du payout = montant réellement collecté (plus réaliste que fundingGoal).
    amount: Number(project.currentFunding || project.fundingGoal || 0),
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
    .select({
      projectId: 1,
      amount: 1,
      status: 1,
      provider: 1,
      providerTransferId: 1,
      bankDetailsProvidedAt: 1,
      transferInitiatedAt: 1,
      completedAt: 1,
      createdAt: 1,
    })
    .populate({ path: "projectId", select: { title: 1, status: 1 }, options: { lean: true } })
    .sort({ createdAt: -1 })
    .limit(safeLimit)
    .lean();
}

async function getMyPayout(creatorId, payoutId) {
  if (!mongoose.isValidObjectId(payoutId)) throw new HttpError(400, "Identifiant de retrait invalide.");
  const payout = await Payout.findOne({ _id: payoutId, creatorId })
    .select({
      projectId: 1,
      creatorId: 1,
      amount: 1,
      status: 1,
      provider: 1,
      providerTransferId: 1,
      failureReason: 1,
      notes: 1,
      bankDetailsProvidedAt: 1,
      transferInitiatedAt: 1,
      completedAt: 1,
      createdAt: 1,
    })
    .populate({ path: "projectId", select: { title: 1, status: 1 }, options: { lean: true } })
    .lean();
  if (!payout) throw new HttpError(404, "Retrait introuvable.");
  // Ne pas renvoyer les coordonnées bancaires déchiffrées via l’API (minimiser l’exposition).
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

  // Notifier les administrateurs : un retrait est prêt à être validé après saisie des coordonnées.
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
  // Liste admin: enrichir avec des libellés utiles (sans exposer bankDetails).
  return Payout.find(query)
    .select({
      projectId: 1,
      creatorId: 1,
      amount: 1,
      status: 1,
      provider: 1,
      providerTransferId: 1,
      notes: 1,
      failureReason: 1,
      bankDetailsProvidedAt: 1,
      transferInitiatedAt: 1,
      completedAt: 1,
      failedAt: 1,
      cancelledAt: 1,
      createdAt: 1,
    })
    .populate({ path: "projectId", select: { title: 1, status: 1 }, options: { lean: true } })
    .populate({
      path: "creatorId",
      select: { email: 1, role: 1, isActive: 1, profile: 1 },
      options: { lean: true },
    })
    .sort({ createdAt: -1 })
    .limit(safeLimit)
    .lean();
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

  // Valider qu’on peut déchiffrer (ne jamais renvoyer les détails).
  const decrypted = open(payout.bankDetails);
  if (!decrypted) {
    throw new HttpError(500, "Erreur interne : impossible de déchiffrer les coordonnées bancaires.");
  }

  // Initier un transfert (simulation provider) → PROCESSING.
  const transfer = mockPayoutProvider.createTransfer({
    amount: payout.amount,
    currency: "TND",
    referenceId: String(payout._id),
  });

  payout.status = "PROCESSING";
  payout.transferInitiatedAt = new Date();
  payout.provider = transfer.provider;
  payout.providerTransferId = transfer.providerTransferId;
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
      type: "PAYOUT_PROCESSING",
      title: "Virement en cours",
      message:
        "Un administrateur a initié le virement. Vous serez notifié(e) dès confirmation du prestataire.",
      relatedEntityId: payout._id,
      relatedEntityType: "PAYOUT",
    },
  ]);
  void enqueueEmailForNotifications(notifs).catch(() => {});

  return { payout: payout.toObject(), transferUrl: transfer.transferUrl };
}

async function confirmMockPayoutTransfer({ adminId, payoutId, providerTransferId, status }) {
  const payout = await Payout.findById(payoutId);
  if (!payout) throw new HttpError(404, "Retrait introuvable.");
  if (payout.status !== "PROCESSING") {
    throw new HttpError(409, "État invalide : le payout doit être en cours (PROCESSING).");
  }
  if (String(payout.providerTransferId || "") !== String(providerTransferId || "")) {
    throw new HttpError(400, "Identifiant de transfert invalide.");
  }
  const normalized = String(status || "").toUpperCase();
  if (!["COMPLETED", "FAILED"].includes(normalized)) {
    throw new HttpError(400, "status doit être COMPLETED ou FAILED.");
  }

  payout.status = normalized;
  const now = new Date();
  if (normalized === "COMPLETED") {
    payout.completedAt = now;
    payout.failureReason = "";
    payout.failedAt = undefined;
  } else {
    payout.failureReason = "Virement refusé par le prestataire (simulation)";
    payout.failedAt = now;
  }
  await payout.save();

  await Notification.create([
    {
      userId: payout.creatorId,
      type: normalized === "COMPLETED" ? "PAYOUT_COMPLETED" : "PAYOUT_FAILED",
      title: normalized === "COMPLETED" ? "Virement effectué" : "Virement échoué",
      message:
        normalized === "COMPLETED"
          ? "Le prestataire a confirmé le virement. Le payout est complété."
          : "Le prestataire a refusé le virement. Un administrateur pourra réessayer.",
      relatedEntityId: payout._id,
      relatedEntityType: "PAYOUT",
    },
  ]).catch(() => {});

  await AuditLog.create({
    actorId: adminId,
    actorRole: "ADMIN",
    action: normalized === "COMPLETED" ? "CONFIRM_PAYOUT_COMPLETED" : "CONFIRM_PAYOUT_FAILED",
    targetType: "Payout",
    targetId: payout._id,
    details: { provider: payout.provider, providerTransferId: payout.providerTransferId },
  });

  return payout.toObject();
}

async function failPayout({ adminId, payoutId, error }) {
  const payout = await Payout.findById(payoutId);
  if (!payout) throw new HttpError(404, "Retrait introuvable.");
  payout.status = "FAILED";
  payout.failureReason = String(error || "Transfer failed");
  payout.failedAt = new Date();
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
  payout.cancelledAt = new Date();
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
  confirmMockPayoutTransfer,
  failPayout,
  cancelOpenPayoutForProject,
};

