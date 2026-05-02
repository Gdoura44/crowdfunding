const mongoose = require("mongoose");
const Report = require("../models/Report");
const Project = require("../models/Project");
const Notification = require("../models/Notification");
const AuditLog = require("../models/AuditLog");
const HttpError = require("../utils/HttpError");
const { enqueueEmailForNotifications } = require("../integrations/emailQueue");
const User = require("../models/User");
const Comment = require("../models/Comment");
const { ProjectStatus, canSuspendProject, transitionProjectStatus } = require("../config/projectLifecycle");

async function createReport({ reporterId, projectId, type, description = "" }) {
  if (!mongoose.isValidObjectId(projectId)) throw new HttpError(400, "Identifiant de projet invalide.");
  const project = await Project.findById(projectId).lean();
  if (!project) throw new HttpError(404, "Projet introuvable.");
  if (String(project.creatorId) === String(reporterId)) {
    throw new HttpError(400, "Vous ne pouvez pas signaler votre propre projet.");
  }

  const existing = await Report.findOne({
    reporterId,
    projectId,
    type,
    status: { $in: ["PENDING", "RESOLVED"] },
  }).lean();
  if (existing) {
    throw new HttpError(
      409,
      "Vous avez déjà un signalement en cours (ou déjà traité) de ce type pour ce projet."
    );
  }

  // Pas de transaction MongoDB (compatibilité instance « standalone ») : l’ordre des opérations suffit ici.
  const report = await Report.create({
    reporterId,
    projectId,
    type,
    description: String(description || "").trim(),
    status: "PENDING",
  });

  // Notifier les admins (conception): les admins doivent voir les nouveaux signalements
  // même sans ouvrir l’écran dédié aux signalements.
  const admins = await User.find({ role: "ADMIN" }).select("_id email").lean();
  const notifs = await Notification.insertMany(
    admins.map((a) => ({
      userId: a._id,
      type: "NEW_REPORT",
      title: "Nouveau signalement",
      message: "Un utilisateur a signalé un projet. Ouvrez l’onglet Signalements pour traiter le cas.",
      relatedEntityId: report._id,
      relatedEntityType: "REPORT",
    }))
  );
  await enqueueEmailForNotifications(notifs);

  return report.toObject();
}

async function createCommentReport({ reporterId, projectId, commentId, type, description = "" }) {
  if (!mongoose.isValidObjectId(projectId)) throw new HttpError(400, "Identifiant de projet invalide.");
  if (!mongoose.isValidObjectId(commentId)) throw new HttpError(400, "Identifiant de commentaire invalide.");

  const project = await Project.findById(projectId).lean();
  if (!project) throw new HttpError(404, "Projet introuvable.");

  const comment = await Comment.findOne({
    _id: commentId,
    projectId,
    deletedAt: { $exists: false },
  }).lean();
  if (!comment) throw new HttpError(404, "Commentaire introuvable.");
  if (String(comment.userId) === String(reporterId)) {
    throw new HttpError(400, "Vous ne pouvez pas signaler votre propre commentaire.");
  }

  const existing = await Report.findOne({
    reporterId,
    commentId,
    type,
    status: { $in: ["PENDING", "RESOLVED"] },
  }).lean();
  if (existing) {
    throw new HttpError(409, "Vous avez déjà un signalement en cours (ou déjà traité) pour ce commentaire.");
  }

  const report = await Report.create({
    reporterId,
    projectId,
    commentId,
    type,
    description: String(description || "").trim(),
    status: "PENDING",
  });

  const admins = await User.find({ role: "ADMIN" }).select("_id email").lean();
  const notifs = await Notification.insertMany(
    admins.map((a) => ({
      userId: a._id,
      type: "NEW_REPORT",
      title: "Nouveau signalement",
      message:
        "Un utilisateur a signalé un commentaire. Ouvrez l’onglet Signalements pour traiter le cas.",
      relatedEntityId: report._id,
      relatedEntityType: "REPORT",
    }))
  );
  await enqueueEmailForNotifications(notifs);

  return report.toObject();
}

async function listMyReports(reporterId, { limit = 30 } = {}) {
  const n = Number(limit);
  const safeLimit = Number.isFinite(n) ? Math.min(Math.max(n, 1), 50) : 30;
  return Report.find({ reporterId })
    .sort({ createdAt: -1 })
    .limit(safeLimit)
    .lean();
}

async function listAdminReports({ status, limit = 40 } = {}) {
  const n = Number(limit);
  const safeLimit = Number.isFinite(n) ? Math.min(Math.max(n, 1), 100) : 40;
  const query = {};
  if (status) query.status = String(status);
  return Report.find(query)
    .select({
      reporterId: 1,
      projectId: 1,
      commentId: 1,
      type: 1,
      description: 1,
      status: 1,
      resolvedBy: 1,
      resolution: 1,
      resolvedAt: 1,
      createdAt: 1,
    })
    .populate({ path: "projectId", select: { title: 1, status: 1 }, options: { lean: true } })
    .populate({
      path: "reporterId",
      select: { email: 1, role: 1, profile: 1 },
      options: { lean: true },
    })
    .populate({
      path: "commentId",
      select: { content: 1, authorLabel: 1, isHidden: 1, deletedAt: 1, createdAt: 1 },
      options: { lean: true },
    })
    .sort({ createdAt: -1 })
    .limit(safeLimit)
    .lean();
}

async function resolveReport({
  adminId,
  reportId,
  resolution,
  actionOnProject,
  actionOnComment,
  status = "RESOLVED",
}) {
  if (!mongoose.isValidObjectId(reportId)) throw new HttpError(400, "Identifiant de signalement invalide.");
  const report = await Report.findById(reportId);
  if (!report) throw new HttpError(404, "Signalement introuvable.");
  if (report.status !== "PENDING") throw new HttpError(400, "Signalement déjà traité.");

  const normalizedStatus = String(status || "RESOLVED").toUpperCase();
  if (!["RESOLVED", "DISMISSED"].includes(normalizedStatus)) {
    throw new HttpError(400, "status doit être RESOLVED ou DISMISSED.");
  }
  report.status = normalizedStatus;
  report.resolvedBy = adminId;
  report.resolvedAt = new Date();
  report.resolution = String(resolution || "").trim();
  await report.save();

  const notifs = [];

  // Action sur le projet facultative (AVERTISSEMENT / DÉSACTIVATION).
  if (actionOnProject === "DEACTIVATE") {
    const project = await Project.findById(report.projectId);
    if (project) {
      if (!canSuspendProject(project.status)) {
        throw new HttpError(
          400,
          `Suspension impossible depuis le statut ${String(project.status || "")}.`
        );
      }
      transitionProjectStatus(project, ProjectStatus.SUSPENDED, { action: "ADMIN_SUSPEND_FROM_REPORT" });
      project.rejectionReason = "Suspendu suite à un signalement (modération)";
      project.rejectedBy = adminId;
      project.rejectedAt = new Date();
      await project.save();
      notifs.push(
        await Notification.create({
          userId: project.creatorId,
          type: "PROJECT_SUSPENDED",
          title: "Projet suspendu",
          message:
            "Votre projet a été suspendu suite à un signalement. Un administrateur vous contactera si besoin.",
          relatedEntityId: project._id,
          relatedEntityType: "PROJECT",
        })
      );
    }
  } else if (actionOnProject === "WARNING") {
    const project = await Project.findById(report.projectId).lean();
    if (project) {
      notifs.push(
        await Notification.create({
          userId: project.creatorId,
          type: "PROJECT_WARNING",
          title: "Avertissement",
          message:
            "Votre projet a reçu un signalement. Merci de vérifier le contenu et de respecter les règles de la plateforme.",
          relatedEntityId: project._id,
          relatedEntityType: "PROJECT",
        })
      );
    }
  }

  // Action sur le commentaire facultative (SUPPRIMER / MASQUER).
  if (report.commentId && actionOnComment) {
    if (!["DELETE_COMMENT", "HIDE_COMMENT"].includes(String(actionOnComment))) {
      throw new HttpError(400, "actionOnComment doit être DELETE_COMMENT ou HIDE_COMMENT.");
    }
    const c = await Comment.findById(report.commentId);
    if (c && !c.deletedAt) {
      c.isHidden = true;
      c.hiddenReason = "Masqué par un administrateur (signalement)";
      c.hiddenAt = new Date();
      c.hiddenBy = adminId;
      if (String(actionOnComment) === "DELETE_COMMENT") {
        c.deletedAt = new Date();
        c.deletedBy = adminId;
        c.deletedByRole = "ADMIN";
      }
      await c.save();
    }
  }

  // Informer le rapporteur de la clôture du signalement.
  notifs.push(
    await Notification.create({
      userId: report.reporterId,
      type: "REPORT_RESOLVED",
      title: "Signalement traité",
      message:
        normalizedStatus === "DISMISSED"
          ? "Votre signalement a été examiné. Aucune action n’a été retenue pour le moment. Merci pour votre contribution."
          : "Votre signalement a été traité par un administrateur. Merci pour votre contribution.",
      relatedEntityId: report._id,
      relatedEntityType: "REPORT",
    })
  );

  await AuditLog.create({
    actorId: adminId,
    actorRole: "ADMIN",
    action: "RESOLVE_REPORT",
    targetType: "Report",
    targetId: report._id,
    details: {
      status: normalizedStatus,
      actionOnProject: actionOnProject || null,
      actionOnComment: actionOnComment || null,
      hasCommentTarget: Boolean(report.commentId),
    },
  });

  await enqueueEmailForNotifications(notifs);
  return report.toObject();
}

module.exports = {
  createReport,
  createCommentReport,
  listMyReports,
  listAdminReports,
  resolveReport,
};

