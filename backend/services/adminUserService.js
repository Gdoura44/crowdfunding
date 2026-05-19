const bcrypt = require("bcrypt");
const User = require("../models/User");
const HttpError = require("../utils/HttpError");
const Notification = require("../models/Notification");
const { writeAudit } = require("./auditService");
const { enqueueEmailForNotifications } = require("../integrations/emailQueue");

const BCRYPT_ROUNDS = 10;

/**
 * List registered users (admin moderation / support).
 */
async function listUsers({ limit = 40 } = {}) {
  const n = Number(limit);
  const safeLimit = Number.isFinite(n) ? Math.min(Math.max(n, 1), 100) : 40;
  return User.find({ deletedAt: null })
    .select("email role isActive createdAt updatedAt profile")
    .sort({ createdAt: -1 })
    .limit(safeLimit)
    .lean();
}

async function setUserActive({ userId, isActive }) {
  const user = await User.findById(userId);
  if (!user || user.deletedAt) throw new HttpError(404, "Utilisateur introuvable.");
  if (user.role === "ADMIN") {
    throw new HttpError(403, "Action interdite : vous ne pouvez pas modifier l’état d’un compte administrateur.");
  }
  user.isActive = Boolean(isActive);
  await user.save();
  return user.toObject();
}

async function reactivateUser({ adminId, userId }) {
  const user = await User.findById(userId);
  if (!user || user.deletedAt) throw new HttpError(404, "Utilisateur introuvable.");
  if (user.role === "ADMIN") {
    throw new HttpError(403, "Action interdite : vous ne pouvez pas réactiver un compte administrateur.");
  }
  if (user.isActive) {
    return user.toObject();
  }

  user.isActive = true;
  await user.save();

  await writeAudit({
    actorId: adminId,
    actorRole: "ADMIN",
    action: "REACTIVATE_USER",
    targetType: "User",
    targetId: user._id,
    details: {},
  });

  const notifications = await Notification.create([
    {
      userId: user._id,
      type: "USER_REACTIVATED",
      title: "Compte réactivé",
      message: "Votre compte a été réactivé. Vous pouvez à nouveau vous connecter.",
      relatedEntityId: user._id,
      relatedEntityType: "USER",
    },
  ]);
  await enqueueEmailForNotifications(notifications);

  return user.toObject();
}

/**
 * List all active Experts.
 */
async function listExperts({ limit = 50 } = {}) {
  const n = Number(limit);
  const safeLimit = Number.isFinite(n) ? Math.min(Math.max(n, 1), 100) : 50;
  return User.find({ role: "EXPERT", deletedAt: null })
    .select("email role isActive createdAt profile")
    .sort({ createdAt: -1 })
    .limit(safeLimit)
    .lean();
}

/**
 * Create a new Expert user with pre-activated status.
 */
async function createExpert({ email, password, firstName, lastName, cabinetName, phone }) {
  const normalizedEmail = String(email || "").toLowerCase().trim();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    if (existing.deletedAt) {
      // Si l'utilisateur est archivé/supprimé, on le restaure avec le rôle EXPERT.
      existing.deletedAt = null;
      existing.role = "EXPERT";
      existing.isActive = true;
      existing.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      existing.profile = {
        firstName: firstName || "",
        lastName: lastName || "",
        cabinetName: cabinetName || "",
        phone: phone || "",
      };
      await existing.save();
      return existing.toObject();
    }
    throw new HttpError(409, "Cette adresse e-mail est déjà utilisée par un autre utilisateur.");
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const expert = await User.create({
    email: normalizedEmail,
    passwordHash,
    role: "EXPERT",
    isActive: true, // L'expert créé par l'admin est immédiatement actif
    profile: {
      firstName: firstName || "",
      lastName: lastName || "",
      cabinetName: cabinetName || "",
      phone: phone || "",
    },
  });

  return expert.toObject();
}

/**
 * Revoke/Delete an expert by scrubbing personal information and setting deletedAt.
 */
async function deleteExpert(expertId) {
  const expert = await User.findOne({ _id: expertId, role: "EXPERT", deletedAt: null });
  if (!expert) throw new HttpError(404, "Expert introuvable ou déjà supprimé.");

  // Anonymisation des informations personnelles (identique à la suppression d'utilisateur standard)
  const randomPass = `deleted-expert-${Date.now()}-${Math.random()}`;
  expert.email = `deleted+expert+${String(expert._id)}@fincollab.local`;
  expert.passwordHash = await bcrypt.hash(randomPass, BCRYPT_ROUNDS);
  expert.isActive = false;
  expert.verifyTokenHash = null;
  expert.verifyTokenExpiry = null;
  expert.resetTokenHash = null;
  expert.resetTokenExpiry = null;
  expert.refreshTokens = [];
  expert.profile = {
    firstName: "",
    lastName: "",
    cabinetName: "",
    phone: "",
  };
  expert.deletedAt = new Date();

  await expert.save();
  return expert.toObject();
}

module.exports = {
  listUsers,
  setUserActive,
  reactivateUser,
  listExperts,
  createExpert,
  deleteExpert,
};
