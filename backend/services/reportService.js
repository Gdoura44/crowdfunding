const mongoose = require("mongoose");
const Report = require("../models/Report");
const Project = require("../models/Project");
const Notification = require("../models/Notification");
const AuditLog = require("../models/AuditLog");
const HttpError = require("../utils/HttpError");
const { enqueueEmailForNotifications } = require("../integrations/emailQueue");
const User = require("../models/User");
const { ProjectStatus, canSuspendProject } = require("../config/projectLifecycle");

async function createReport({ reporterId, projectId, type, description = "" }) {
  if (!mongoose.isValidObjectId(projectId)) throw new HttpError(400, "Invalid project id");
  const project = await Project.findById(projectId).lean();
  if (!project) throw new HttpError(404, "Project not found");
  if (String(project.creatorId) === String(reporterId)) {
    throw new HttpError(400, "You cannot report your own project");
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
      "You already have a pending or resolved report of this type for this project"
    );
  }

  // No transaction (standalone MongoDB compatibility); order is safe enough for PFE.
  const report = await Report.create({
    reporterId,
    projectId,
    type,
    description: String(description || "").trim(),
    status: "PENDING",
  });

  // Notify admins (conception): admins must see new reports even without opening the reports screen.
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
  return Report.find(query).sort({ createdAt: -1 }).limit(safeLimit).lean();
}

async function resolveReport({ adminId, reportId, resolution, actionOnProject, status = "RESOLVED" }) {
  if (!mongoose.isValidObjectId(reportId)) throw new HttpError(400, "Invalid report id");
  const report = await Report.findById(reportId);
  if (!report) throw new HttpError(404, "Report not found");
  if (report.status !== "PENDING") throw new HttpError(400, "Report already resolved");

  const normalizedStatus = String(status || "RESOLVED").toUpperCase();
  if (!["RESOLVED", "DISMISSED"].includes(normalizedStatus)) {
    throw new HttpError(400, "status must be RESOLVED or DISMISSED");
  }
  report.status = normalizedStatus;
  report.resolvedBy = adminId;
  report.resolvedAt = new Date();
  report.resolution = String(resolution || "").trim();
  await report.save();

  const notifs = [];

  // Optional project action (WARNING / DEACTIVATE)
  if (actionOnProject === "DEACTIVATE") {
    const project = await Project.findById(report.projectId);
    if (project) {
      if (!canSuspendProject(project.status)) {
        throw new HttpError(
          400,
          `Cannot suspend project from status ${String(project.status || "")}`
        );
      }
      project.status = ProjectStatus.SUSPENDED;
      project.rejectionReason = "Reported fraud";
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

  // Notify reporter
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
    details: { actionOnProject: actionOnProject || null },
  });

  await enqueueEmailForNotifications(notifs);
  return report.toObject();
}

module.exports = {
  createReport,
  listMyReports,
  listAdminReports,
  resolveReport,
};

