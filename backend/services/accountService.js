const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const HttpError = require("../utils/HttpError");
const User = require("../models/User");
const Project = require("../models/Project");
const Investment = require("../models/Investment");
const Transaction = require("../models/Transaction");
const Payout = require("../models/Payout");
const Notification = require("../models/Notification");
const { writeAudit } = require("./auditService");

const BCRYPT_ROUNDS = 10;

function anonymizedEmailFor(userId) {
  return `deleted+${String(userId)}@fincollab.local`;
}

/**
 * Account deletion (conception: `code_delet_account_diag.txt`).
 * On garde l’opération synchrone et bloquante pour éviter des états financiers orphelins.
 *
 * NOTE (amélioration intentionnelle vs conception) :
 * - On efface `bankDetails` uniquement pour les payouts non-COMPLETED.
 *   Pour les payouts COMPLETED, conserver `bankDetails` préserve la traçabilité (audit / litige).
 */
async function deleteAccount({ userId }) {
  if (!mongoose.isValidObjectId(userId)) throw new HttpError(400, "Identifiant utilisateur invalide.");

  const user = await User.findById(userId);
  if (!user || user.deletedAt) {
    throw new HttpError(400, "Compte déjà supprimé (ou suppression impossible).");
  }
  if (user.role === "ADMIN") {
    throw new HttpError(403, "Les comptes administrateur ne peuvent pas être supprimés via l’application.");
  }

  // 1) Bloquer si des retraits (payouts) sont encore en attente pour ce créateur.
  const pendingCreatorPayout = await Payout.findOne({
    creatorId: user._id,
    status: { $in: ["PENDING", "READY"] },
  }).lean();
  if (pendingCreatorPayout) {
    throw new HttpError(
      400,
      "Suppression impossible : un retrait est encore en attente. Merci d’attendre sa résolution ou de contacter le support."
    );
  }

  // 2) Bloquer si le créateur a des projets qui ne doivent pas rester sans gestion.
  const blockingCreatorProject = await Project.findOne({
    creatorId: user._id,
    status: { $in: ["ACTIVE", "APPROVED", "UNDER_REVIEW", "AWAITING_AI", "FUNDED"] },
  }).lean();
  if (blockingCreatorProject) {
    throw new HttpError(
      400,
      "Suppression impossible : vous avez encore des projets actifs/en cours. Archivez-les ou clôturez-les avant de supprimer le compte."
    );
  }

  // 3) Bloquer si l’utilisateur a des investissements actifs.
  const activeInvestment = await Investment.findOne({
    investorId: user._id,
    status: { $in: ["INITIATED", "CANCELLING"] },
  }).lean();
  if (activeInvestment) {
    throw new HttpError(
      400,
      "Suppression impossible : vous avez un investissement en cours (ou en annulation). Annulez-le d’abord, ou contactez le support."
    );
  }

  // 4) Bloquer si un investissement SUCCESS n’est pas totalement remboursé.
  const successInvestments = await Investment.find({
    investorId: user._id,
    status: "SUCCESS",
  })
    .select("_id")
    .lean();
  for (const inv of successInvestments) {
    const tx = await Transaction.findOne({ investmentId: inv._id })
      .sort({ attemptNumber: -1 })
      .lean();
    if (!tx || tx.refundStatus !== "SUCCEEDED") {
      throw new HttpError(
        400,
        "Suppression impossible : un remboursement est encore en cours. Merci d’attendre la fin du remboursement ou de contacter le support."
      );
    }
  }

  // 5) Mettre à jour les projets du créateur : conserver creatorId, mais marquer le créateur comme supprimé.
  await Project.updateMany(
    { creatorId: user._id },
    { $set: { isCreatorDeleted: true } }
  );

  // 6) Effacer les coordonnées bancaires des payouts non terminés (confidentialité).
  await Payout.updateMany(
    { creatorId: user._id, status: { $in: ["PENDING", "READY", "FAILED"] } },
    { $set: { bankDetails: null } }
  );

  // 7) Anonymiser l’utilisateur et faire une suppression logique (soft delete).
  const randomPass = `deleted-${Date.now()}-${Math.random()}`;
  user.email = anonymizedEmailFor(user._id);
  user.passwordHash = await bcrypt.hash(randomPass, BCRYPT_ROUNDS);
  user.isActive = false;
  user.verifyTokenHash = null;
  user.verifyTokenExpiry = null;
  user.resetTokenHash = null;
  user.resetTokenExpiry = null;
  user.refreshTokens = [];
  user.profile = { firstName: "", lastName: "", phone: "", preferredCategories: [] };
  user.deletedAt = new Date();
  await user.save();

  await writeAudit({
    actorId: user._id,
    actorRole: "USER",
    action: "DELETE_ACCOUNT",
    targetType: "User",
    targetId: user._id,
    details: {},
  });

  // Notification au mieux (le compte est supprimé, mais on garde une trace interne).
  try {
    await Notification.create({
      userId: user._id,
      type: "ACCOUNT_DELETED",
      title: "Compte supprimé",
      message: "Votre compte a été supprimé et vos données personnelles ont été anonymisées.",
      relatedEntityId: user._id,
      relatedEntityType: "USER",
    });
  } catch {
    // la notification ne doit pas casser la suppression
  }

  return { ok: true };
}

module.exports = {
  deleteAccount,
};

